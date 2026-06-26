<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const ALLOWED_SIZES = [3, 4, 5, 6];
const ALLOWED_IMAGES = ['papegaai', 'molen', 'luchtballon', 'zonnebloem', 'dolfijn', 'vuurtoren', 'strand', 'auto', 'raket'];

// Zelfde idee als moderation.js — houd die twee lijsten in lijn, deze hier is de echte poortwachter.
const BANNED_WORDS = [
    'hoer', 'hoeren', 'slet', 'sletje', 'kutwijf', 'teef',
    'kanker', 'kankerlijer', 'mongool', 'mongol', 'spast', 'retard',
    'neger', 'nikker', 'nigger', 'makak', 'pleurislijer',
    'kut', 'lul', 'klootzak', 'fuck', 'bitch', 'slut', 'whore', 'cunt', 'faggot',
];

function containsBannedWord(string $text): bool {
    $normalized = strtolower($text);
    if (function_exists('transliterator_transliterate')) {
        $normalized = transliterator_transliterate('Any-Latin; Latin-ASCII', $normalized) ?: $normalized;
    }
    $normalized = str_replace(['0', '1', '3', '4', '5', '7'], ['o', 'i', 'e', 'a', 's', 't'], $normalized);
    $normalized = preg_replace('/[^a-z]/', '', $normalized) ?? '';
    foreach (BANNED_WORDS as $word) {
        if (str_contains($normalized, $word)) return true;
    }
    return false;
}

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

function sortScores(array $scores): array {
    usort($scores, fn($a, $b) => ($a['time'] <=> $b['time']) ?: ($a['moves'] <=> $b['moves']));
    return $scores;
}

function toPublic(array $score, int $rank): array {
    return [
        'rank' => $rank, 'id' => $score['id'], 'name' => $score['name'], 'time' => $score['time'],
        'moves' => $score['moves'], 'date' => $score['date'], 'image' => $score['image'] ?? 'papegaai',
    ];
}

// Geeft de genummerde top 10 terug, plus (indien nodig) een venster van 2 posities boven en
// onder $highlightId zodat je kunt zien hoe ver je van de top 10 afzit.
function rankedView(array $sortedScores, ?string $highlightId): array {
    $top10 = [];
    foreach (array_slice($sortedScores, 0, 10) as $index => $score) {
        $top10[] = toPublic($score, $index + 1);
    }

    $rank = null;
    $context = [];
    if ($highlightId !== null) {
        foreach ($sortedScores as $index => $score) {
            if ((string)($score['id'] ?? '') === $highlightId) { $rank = $index + 1; break; }
        }
        if ($rank !== null && $rank > 10) {
            $start = max(11, $rank - 2);
            $end = min(count($sortedScores), $rank + 2);
            for ($i = $start; $i <= $end; $i++) {
                $context[] = toPublic($sortedScores[$i - 1], $i);
            }
        }
    }

    return ['ranking' => $top10, 'rank' => $rank, 'context' => $context];
}

$size = resolveSize();
$dataFile = dataFileFor($size);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $view = rankedView(sortScores(readScores($dataFile)), null);
    echo json_encode($view['ranking'], JSON_UNESCAPED_UNICODE);
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
$image = (string)($input['image'] ?? '');
if (!in_array($image, ALLOWED_IMAGES, true)) { $image = 'papegaai'; }

if ($name === '' || strlen($name) > 80 || $time < 300 || $time > 7200000 || $moves < 1 || $moves > 50000 || $id === '' || strlen($id) > 100) {
    http_response_code(422);
    echo json_encode(['error' => 'Ongeldige score']);
    exit;
}

if (containsBannedWord($name)) {
    http_response_code(422);
    echo json_encode(['error' => 'Ongeldige naam']);
    exit;
}

$scores = readScores($dataFile);
$scores[] = ['id' => $id, 'name' => $name, 'time' => $time, 'moves' => $moves, 'image' => $image, 'date' => gmdate('c')];
$scores = sortScores($scores);
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

echo json_encode(rankedView($scores, $id), JSON_UNESCAPED_UNICODE);
