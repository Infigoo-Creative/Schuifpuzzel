<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/shared.php';

function progressDir(): string {
    $dir = dataDir() . '/progress';
    if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
    return $dir;
}

function isValidCode(string $code): bool {
    return (bool)preg_match('/^[0-9]{6}$/', $code);
}

function progressFileFor(string $code): string {
    return progressDir() . "/{$code}.json";
}

function generateUniqueCode(): string {
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        if (!file_exists(progressFileFor($code))) return $code;
    }
    throw new RuntimeException('Kon geen unieke code genereren');
}

function publicProgress(array $record): array {
    return [
        'code' => $record['code'], 'name' => $record['name'],
        'completed' => $record['completed'] ?? [],
    ];
}

$input = json_decode(file_get_contents('php://input') ?: '', true) ?? [];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $code = (string)($_GET['code'] ?? '');
    if (!isValidCode($code)) {
        http_response_code(422);
        echo json_encode(['error' => 'Ongeldige code']);
        exit;
    }
    $record = readJsonFile(progressFileFor($code), []);
    if (!$record) {
        http_response_code(404);
        echo json_encode(['error' => 'Code niet gevonden']);
        exit;
    }
    echo json_encode(publicProgress($record), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Methode niet toegestaan']);
    exit;
}

$action = (string)($input['action'] ?? '');

if ($action === 'register') {
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '' || strlen($name) > 80) {
        http_response_code(422);
        echo json_encode(['error' => 'Ongeldige naam']);
        exit;
    }
    if (containsBannedWord($name)) {
        http_response_code(422);
        echo json_encode(['error' => 'Ongeldige naam']);
        exit;
    }
    $code = generateUniqueCode();
    $record = ['code' => $code, 'name' => $name, 'completed' => [], 'createdAt' => gmdate('c')];
    if (!writeJsonFile(progressFileFor($code), $record)) {
        http_response_code(500);
        echo json_encode(['error' => 'Kon code niet aanmaken']);
        exit;
    }
    echo json_encode(publicProgress($record), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'complete') {
    $code = (string)($input['code'] ?? '');
    $size = (int)($input['size'] ?? 0);
    $image = (string)($input['image'] ?? '');
    if (!isValidCode($code) || !in_array($size, ALLOWED_SIZES, true) || !in_array($image, ALLOWED_IMAGES, true)) {
        http_response_code(422);
        echo json_encode(['error' => 'Ongeldige aanvraag']);
        exit;
    }
    $file = progressFileFor($code);
    $record = readJsonFile($file, []);
    if (!$record) {
        http_response_code(404);
        echo json_encode(['error' => 'Code niet gevonden']);
        exit;
    }
    $comboKey = "{$size}-{$image}";
    $completed = $record['completed'] ?? [];
    if (!in_array($comboKey, $completed, true)) {
        $completed[] = $comboKey;
        $record['completed'] = $completed;
        $record['updatedAt'] = gmdate('c');
        if (!writeJsonFile($file, $record)) {
            http_response_code(500);
            echo json_encode(['error' => 'Kon voortgang niet opslaan']);
            exit;
        }
    }
    echo json_encode(publicProgress($record), JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Onbekende actie']);
