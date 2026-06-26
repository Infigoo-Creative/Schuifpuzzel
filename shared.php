<?php
declare(strict_types=1);

// Gedeeld door api.php en progress.php.

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

function dataDir(): string {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
    return $dir;
}

// Leest een JSON-bestand met shared lock; geeft $default terug als het (nog) niet bestaat.
function readJsonFile(string $file, array $default = []): array {
    if (!file_exists($file)) return $default;
    $handle = fopen($file, 'r');
    if (!$handle) return $default;
    flock($handle, LOCK_SH);
    $json = stream_get_contents($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    $data = json_decode($json ?: '', true);
    return is_array($data) ? $data : $default;
}

// Schrijft een JSON-bestand met exclusive lock (maakt 'm aan indien nodig).
function writeJsonFile(string $file, array $data): bool {
    $handle = fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) return false;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return true;
}
