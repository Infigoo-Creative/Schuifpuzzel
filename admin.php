<?php
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:;");

const ALLOWED_SIZES = [3, 4, 5, 6];

$secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

require __DIR__ . '/config.php';

function resolveSize(): int {
    $size = (int)($_GET['size'] ?? $_POST['size'] ?? 3);
    return in_array($size, ALLOWED_SIZES, true) ? $size : 3;
}

function resolveDaily(): ?string {
    $raw = preg_replace('/[^0-9-]/', '', (string)($_GET['daily'] ?? $_POST['daily'] ?? ''));
    return (strlen($raw) === 10 && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) ? $raw : null;
}

function dailyDates(): array {
    $files = glob(__DIR__ . '/data/scores-daily-*.json') ?: [];
    $dates = [];
    foreach ($files as $file) {
        if (preg_match('/scores-daily-(\d{4}-\d{2}-\d{2})\.json$/', $file, $m)) {
            $dates[] = $m[1];
        }
    }
    rsort($dates);
    return $dates;
}

function dataFileFor(int $size): string {
    return __DIR__ . "/data/scores-{$size}x{$size}.json";
}

function dailyFileFor(string $date): string {
    return __DIR__ . "/data/scores-daily-{$date}.json";
}

function redirectAdmin(int $size): void {
    header('Location: admin.php?size=' . $size);
    exit;
}

function redirectDaily(string $date): void {
    header('Location: admin.php?daily=' . $date);
    exit;
}

function readAdminScores(string $file): array {
    if (!file_exists($file)) return [];
    $handle = fopen($file, 'r');
    if (!$handle) return [];
    flock($handle, LOCK_SH);
    $json = stream_get_contents($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    $scores = json_decode($json ?: '[]', true);
    if (!is_array($scores)) return [];
    usort($scores, fn($a, $b) => ((int)$a['time'] <=> (int)$b['time']) ?: ((int)$a['moves'] <=> (int)$b['moves']));
    return $scores;
}

function deleteScore(string $file, string $id): bool {
    $handle = fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) return false;
    rewind($handle);
    $scores = json_decode(stream_get_contents($handle) ?: '[]', true);
    if (!is_array($scores)) $scores = [];
    $before = count($scores);
    $scores = array_values(array_filter($scores, fn($score) => (string)($score['id'] ?? '') !== $id));
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($scores, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return count($scores) < $before;
}

function formatAdminTime(int $milliseconds): string {
    $tenths = intdiv($milliseconds, 100);
    $minutes = intdiv($tenths, 600);
    $seconds = intdiv($tenths % 600, 10);
    return sprintf('%02d:%02d.%d', $minutes, $seconds, $tenths % 10);
}

function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(24));
}

$size = resolveSize();
$daily = resolveDaily();
$dailyDates = dailyDates();
$isDaily = $daily !== null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string)($_POST['action'] ?? '');
    $postDaily = resolveDaily();

    if ($action === 'login') {
        $username = (string)($_POST['username'] ?? '');
        $password = (string)($_POST['password'] ?? '');
        if (hash_equals((string)$adminUsername, $username) && hash_equals((string)$adminPassword, $password)) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            $_SESSION['csrf'] = bin2hex(random_bytes(24));
            redirectAdmin($size);
        }
        $error = 'Gebruikersnaam of wachtwoord is niet juist.';
    } elseif (!empty($_SESSION['admin'])) {
        if (!hash_equals((string)$_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) {
            http_response_code(403);
            $error = 'De sessie is verlopen. Vernieuw de pagina en probeer opnieuw.';
        } elseif ($action === 'delete') {
            $id = preg_replace('/[^a-zA-Z0-9-]/', '', (string)($_POST['id'] ?? ''));
            if ($postDaily !== null) {
                if ($id !== '' && deleteScore(dailyFileFor($postDaily), $id)) {
                    $_SESSION['notice'] = 'De score is verwijderd.';
                }
                redirectDaily($postDaily);
            } else {
                if ($id !== '' && deleteScore(dataFileFor($size), $id)) {
                    $_SESSION['notice'] = 'De score is verwijderd.';
                }
                redirectAdmin($size);
            }
        } elseif ($action === 'logout') {
            $_SESSION = [];
            session_destroy();
            redirectAdmin($size);
        }
    }
}

$loggedIn = !empty($_SESSION['admin']);
$scores = $loggedIn ? readAdminScores($isDaily ? dailyFileFor($daily) : dataFileFor($size)) : [];
$error ??= '';
$notice = (string)($_SESSION['notice'] ?? '');
unset($_SESSION['notice']);
?>
<!doctype html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beheer · Schuifpuzzel</title>
  <style>
    :root{--ink:#171715;--blue:#173dcc;--coral:#ff5c45;--paper:#f5f1ea;--line:rgba(23,23,21,.16)}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,#f8f4ee,#efece6);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}
    button,input{font:inherit}
    .header{height:92px;padding:0 5vw;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);background:rgba(255,255,255,.5)}
    .header strong{font-size:16px}
    .header span{font-size:11px;letter-spacing:.16em;text-transform:uppercase}
    .wrap{width:min(1120px,90vw);margin:64px auto}
    .eyebrow{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--coral)}
    h1{font-size:clamp(42px,6vw,72px);line-height:.95;letter-spacing:-.055em;margin:18px 0 16px;font-weight:600}
    .subtitle{color:#5e5a54;max-width:600px}
    .login{width:min(480px,100%);margin:12vh auto 0;background:rgba(255,255,255,.72);padding:42px;box-shadow:0 28px 70px rgba(23,23,21,.13)}
    label{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:25px 0 8px}
    input{width:100%;border:0;border-bottom:1px solid rgba(23,23,21,.4);background:transparent;padding:12px 0;outline:none}
    input:focus{border-color:var(--blue)}
    .primary{width:100%;border:0;background:var(--coral);color:#fff;padding:17px 20px;margin-top:26px;text-transform:uppercase;font-size:11px;font-weight:700;letter-spacing:.12em;cursor:pointer}
    .primary:hover{background:#e8482f}
    .error,.notice{padding:13px 16px;margin:20px 0;font-size:13px}
    .error{background:#fff0f2;color:#a62c4b}
    .notice{background:#e9f3e1;color:#3a6a1f}
    .topline{display:flex;justify-content:space-between;align-items:end;gap:30px;flex-wrap:wrap}
    .size-tabs{display:flex;gap:8px;margin-top:18px}
    .size-tabs a{border:1px solid var(--line);border-radius:99px;padding:8px 16px;font-size:12px;text-decoration:none;color:var(--ink)}
    .size-tabs a.is-active{background:var(--blue);border-color:var(--blue);color:#fff}
    .logout{border:1px solid var(--line);background:transparent;color:var(--ink);padding:11px 16px;cursor:pointer}
    .card{background:rgba(255,255,255,.72);margin-top:40px;box-shadow:0 24px 65px rgba(23,23,21,.11);overflow-x:auto}
    .table{width:100%;border-collapse:collapse;min-width:700px}
    .table th,.table td{text-align:left;padding:18px 16px;border-bottom:1px solid var(--line)}
    .table th{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#85827d}
    .rank{font-weight:700;color:var(--blue)}
    .time{font-weight:750;font-variant-numeric:tabular-nums}
    .avatar-img{border-radius:8px;display:block;object-fit:cover}
    .trash{width:39px;height:39px;border:0;border-radius:50%;background:#fff0f2;color:var(--coral);display:grid;place-items:center;cursor:pointer}
    .trash:hover{background:var(--coral);color:#fff}
    .trash svg{width:17px;height:17px}
    .empty{padding:50px;text-align:center;color:#73858e}
    .count{display:inline-flex;background:var(--ink);color:#fff;border-radius:99px;padding:6px 11px;font-size:11px;margin-left:8px}
    @media(max-width:620px){.header{padding:0 20px}.wrap{margin:40px auto}.login{padding:28px}.topline{display:block}.logout{margin-top:20px}}
  </style>
</head>
<body>
  <header class="header"><strong>Schuifpuzzel</strong><span>Beheer · <?= $isDaily ? 'Dagelijks ' . e($daily) : $size . ' × ' . $size ?></span></header>
  <?php if (!$loggedIn): ?>
    <main class="login">
      <p class="eyebrow">Beveiligd beheer</p>
      <h1>Welkom terug.</h1>
      <p class="subtitle">Log in om deelnemers en scores te beheren.</p>
      <?php if ($error): ?><p class="error"><?= e($error) ?></p><?php endif; ?>
      <form method="post">
        <input type="hidden" name="action" value="login">
        <input type="hidden" name="size" value="<?= $size ?>">
        <label for="username">Gebruikersnaam</label>
        <input id="username" name="username" type="text" autocomplete="username" required autofocus>
        <label for="password">Beheerwachtwoord</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button class="primary" type="submit">Inloggen →</button>
      </form>
    </main>
  <?php else: ?>
    <main class="wrap">
      <div class="topline">
        <div>
          <p class="eyebrow">Schuifpuzzel</p>
          <h1>Deelnemers <span class="count"><?= count($scores) ?></span></h1>
          <p class="subtitle"><?= $isDaily ? 'Dagelijkse scores van ' . e($daily) . '.' : 'Scores voor het ' . $size . ' × ' . $size . '-niveau.' ?> Verwijderen is direct definitief.</p>
          <nav class="size-tabs">
            <?php foreach (ALLOWED_SIZES as $option): ?>
              <a class="<?= !$isDaily && $option === $size ? 'is-active' : '' ?>" href="admin.php?size=<?= $option ?>"><?= $option ?> × <?= $option ?></a>
            <?php endforeach; ?>
            <?php if ($dailyDates): ?>
              <span style="border-left:1px solid var(--line);margin:0 4px"></span>
              <?php foreach ($dailyDates as $date): ?>
                <a class="<?= $isDaily && $daily === $date ? 'is-active' : '' ?>" href="admin.php?daily=<?= e($date) ?>" style="<?= $isDaily && $daily === $date ? '' : 'background:rgba(255,122,69,.08);border-color:rgba(255,122,69,.3);color:#c94a20' ?>">📅 <?= e($date) ?></a>
              <?php endforeach; ?>
            <?php endif; ?>
          </nav>
        </div>
        <form method="post"><input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="<?= e((string)$_SESSION['csrf']) ?>"><button class="logout" type="submit">Uitloggen</button></form>
      </div>
      <?php if ($notice): ?><p class="notice"><?= e($notice) ?></p><?php endif; ?>
      <?php if ($error): ?><p class="error"><?= e($error) ?></p><?php endif; ?>
      <section class="card">
        <?php if (!$scores): ?>
          <p class="empty">Er zijn nog geen deelnemers opgeslagen op dit niveau.</p>
        <?php else: ?>
          <table class="table">
            <thead><tr><th>Pos.</th><th></th><th>Naam</th><th>Zetten</th><th>Tijd</th><th>Datum</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($scores as $index => $score): ?>
              <tr>
                <td class="rank"><?= str_pad((string)($index + 1), 2, '0', STR_PAD_LEFT) ?></td>
                <td><img class="avatar-img" src="assets/gallery/<?= e((string)($score['image'] ?? 'papegaai')) ?>.jpg" alt="" width="32" height="32"></td>
                <td><strong><?= e((string)($score['name'] ?? '')) ?></strong></td>
                <td><?= (int)($score['moves'] ?? 0) ?></td>
                <td class="time"><?= e(formatAdminTime((int)($score['time'] ?? 0))) ?></td>
                <td><?= e(substr((string)($score['date'] ?? ''), 0, 10)) ?></td>
                <td>
                  <form method="post" onsubmit="return confirm('Deze score definitief verwijderen?')">
                    <input type="hidden" name="action" value="delete">
                    <?php if ($isDaily): ?>
                      <input type="hidden" name="daily" value="<?= e($daily) ?>">
                    <?php else: ?>
                      <input type="hidden" name="size" value="<?= $size ?>">
                    <?php endif; ?>
                    <input type="hidden" name="csrf" value="<?= e((string)$_SESSION['csrf']) ?>">
                    <input type="hidden" name="id" value="<?= e((string)($score['id'] ?? '')) ?>">
                    <button class="trash" type="submit" aria-label="Score van <?= e((string)($score['name'] ?? 'deze deelnemer')) ?> verwijderen" title="Score verwijderen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 10v7m4-7v7"/></svg></button>
                  </form>
                </td>
              </tr>
            <?php endforeach; ?>
            </tbody>
          </table>
        <?php endif; ?>
      </section>
    </main>
  <?php endif; ?>
</body>
</html>
