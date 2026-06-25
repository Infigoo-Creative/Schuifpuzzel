<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const ALLOWED_SIZES = [3, 4, 5, 6];

function resolveSize(): int {
    $size = (int)($_GET['size'] ?? 3);
    return in_array($size, ALLOWED_SIZES, true) ? $size : 3;
}

function dataFileFor(int $size): string {
    $dataDir = __DIR__ . '/data';
    if (!is_dir($dataDir)) { @mkdir($dataDir, 0755, true); }
    return $dataDir . "/scores-{$size}x{$size}.json";
}

function readScores(string $file): array {
    if (!file_exists($file)) return [];
    $handle = fopen($file, 'r');
    if (!$handle) return [];
    flock($handle, LOCK_SH);
    $json = stream_get_contents($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    $data = json_decode($json ?: '[]', true);
    return is_array($data) ? $data : [];
}

function publicRanking(array $scores): array {
    usort($scores, fn($a, $b) => ($a['time'] <=> $b['time']) ?: ($a['moves'] <=> $b['moves']));
    return array_map(fn($score) => [
        'id' => $score['id'], 'name' => $score['name'], 'time' => $score['time'],
        'moves' => $score['moves'], 'date' => $score['date'],
    ], array_slice($scores, 0, 10));
}

$size = resolveSize();
$dataFile = dataFileFor($size);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(publicRanking(readScores($dataFile)), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Methode niet toegestaan']);
    exit;
}

$input = json_decode(file_get_contents('php://input') ?: '', true);
$name = trim((string)($input['name'] ?? ''));
$time = (int)($input['time'] ?? 0);
$moves = (int)($input['moves'] ?? 0);
$id = preg_replace('/[^a-zA-Z0-9-]/', '', (string)($input['id'] ?? ''));

if ($name === '' || strlen($name) > 80 || $time < 300 || $time > 7200000 || $moves < 1 || $moves > 50000 || $id === '' || strlen($id) > 100) {
    http_response_code(422);
    echo json_encode(['error' => 'Ongeldige score']);
    exit;
}

$scores = readScores($dataFile);
$scores[] = ['id' => $id, 'name' => $name, 'time' => $time, 'moves' => $moves, 'date' => gmdate('c')];
usort($scores, fn($a, $b) => ($a['time'] <=> $b['time']) ?: ($a['moves'] <=> $b['moves']));
$scores = array_slice($scores, 0, 500);

$handle = fopen($dataFile, 'c+');
if (!$handle || !flock($handle, LOCK_EX)) {
    http_response_code(500);
    echo json_encode(['error' => 'Score kon niet worden opgeslagen']);
    exit;
}
ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode($scores, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

echo json_encode(publicRanking($scores), JSON_UNESCAPED_UNICODE);
