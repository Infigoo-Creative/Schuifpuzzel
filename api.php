<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/shared.php';

function resolveSize(): int {
    $size = (int)($_GET['size'] ?? 3);
    return in_array($size, ALLOWED_SIZES, true) ? $size : 3;
}

function scoresFileFor(int $size): string {
    return dataDir() . "/scores-{$size}x{$size}.json";
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

function resolveDailyDate(): ?string {
    $raw = preg_replace('/[^0-9-]/', '', (string)($_GET['daily'] ?? ''));
    return (strlen($raw) === 10 && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) ? $raw : null;
}

function dailyScoresFile(string $date): string {
    return dataDir() . "/scores-daily-{$date}.json";
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $daily = resolveDailyDate();
    if ($daily !== null) {
        $view = rankedView(sortScores(readJsonFile(dailyScoresFile($daily))), null);
        echo json_encode($view['ranking'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $size = resolveSize();
    $view = rankedView(sortScores(readJsonFile(scoresFileFor($size))), null);
    echo json_encode($view['ranking'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Methode niet toegestaan']);
    exit;
}

$input = json_decode(file_get_contents('php://input') ?: '', true);

// Naam gewijzigd terwijl dezelfde speler (code) doorspeelt: werk alle eerder behaalde
// scores van die code bij, zodat overal — oud en nieuw — dezelfde naam getoond wordt.
if (($input['action'] ?? '') === 'rename') {
    $code = preg_replace('/[^0-9]/', '', (string)($input['code'] ?? ''));
    $name = trim((string)($input['name'] ?? ''));
    if (!preg_match('/^[0-9]{6}$/', $code) || $name === '' || strlen($name) > 80) {
        http_response_code(422);
        echo json_encode(['error' => 'Ongeldige aanvraag']);
        exit;
    }
    if (containsBannedWord($name)) {
        http_response_code(422);
        echo json_encode(['error' => 'Ongeldige naam']);
        exit;
    }
    foreach (ALLOWED_SIZES as $size) {
        $file = scoresFileFor($size);
        $scores = readJsonFile($file);
        $changed = false;
        foreach ($scores as &$score) {
            if (($score['code'] ?? '') === $code && $score['name'] !== $name) {
                $score['name'] = $name;
                $changed = true;
            }
        }
        unset($score);
        if ($changed) { writeJsonFile($file, $scores); }
    }
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

$daily = resolveDailyDate();
$size = resolveSize();
$scoresFile = ($daily !== null) ? dailyScoresFile($daily) : scoresFileFor($size);

$name = trim((string)($input['name'] ?? ''));
$time = (int)($input['time'] ?? 0);
$moves = (int)($input['moves'] ?? 0);
$id = preg_replace('/[^a-zA-Z0-9-]/', '', (string)($input['id'] ?? ''));
$image = (string)($input['image'] ?? '');
if (!in_array($image, ALLOWED_IMAGES, true)) { $image = 'papegaai'; }
$code = preg_replace('/[^0-9]/', '', (string)($input['code'] ?? ''));
if (!preg_match('/^[0-9]{6}$/', $code)) { $code = null; }

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

$scores = readJsonFile($scoresFile);
$entry = ['id' => $id, 'name' => $name, 'time' => $time, 'moves' => $moves, 'image' => $image, 'date' => gmdate('c')];
if ($code !== null) { $entry['code'] = $code; }
$scores[] = $entry;
$scores = sortScores($scores);
$scores = array_slice($scores, 0, 500);

if (!writeJsonFile($scoresFile, $scores)) {
    http_response_code(500);
    echo json_encode(['error' => 'Score kon niet worden opgeslagen']);
    exit;
}

echo json_encode(rankedView($scores, $id), JSON_UNESCAPED_UNICODE);
