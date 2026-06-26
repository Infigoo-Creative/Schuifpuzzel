// Praat met api.php als dat beschikbaar is, anders valt terug op localStorage per niveau.

const API_URL = 'api.php';
const LOCAL_CAP = 300;

function localKey(size) {
  return `schuifpuzzel-ranking-${size}x${size}`;
}

function toPublic(score, rank) {
  return { rank, id: score.id, name: score.name, time: score.time, moves: score.moves, image: score.image, date: score.date };
}

// Bouwt dezelfde {ranking, rank, context} structuur als api.php, zodat de UI niet hoeft te
// weten of de score lokaal of server-side is opgeslagen.
function rankedView(sortedScores, highlightId) {
  const ranking = sortedScores.slice(0, 10).map((score, index) => toPublic(score, index + 1));
  let rank = null;
  const context = [];
  if (highlightId != null) {
    rank = sortedScores.findIndex((score) => score.id === highlightId) + 1 || null;
    if (rank && rank > 10) {
      const start = Math.max(11, rank - 2);
      const end = Math.min(sortedScores.length, rank + 2);
      for (let i = start; i <= end; i++) context.push(toPublic(sortedScores[i - 1], i));
    }
  }
  return { ranking, rank, context };
}

export async function fetchRanking(size) {
  try {
    const response = await fetch(`${API_URL}?size=${size}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('API niet beschikbaar');
    return await response.json();
  } catch {
    const local = JSON.parse(localStorage.getItem(localKey(size)) || '[]');
    return rankedView(local, null).ranking;
  }
}

function saveLocal(size, entry) {
  const local = JSON.parse(localStorage.getItem(localKey(size)) || '[]');
  local.push({ id: entry.id, name: entry.name, time: entry.time, moves: entry.moves, image: entry.image, date: new Date().toISOString() });
  local.sort((a, b) => a.time - b.time || a.moves - b.moves);
  const trimmed = local.slice(0, LOCAL_CAP);
  localStorage.setItem(localKey(size), JSON.stringify(trimmed));
  return { ...rankedView(trimmed, entry.id), persisted: false };
}

export async function saveScore(size, entry) {
  let response;
  try {
    response = await fetch(`${API_URL}?size=${size}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // Geen netwerk/API beschikbaar: lokale fallback.
    return saveLocal(size, entry);
  }

  if (response.status === 422) {
    // Server heeft de score/naam afgekeurd (bv. blacklist) — niet stilletjes lokaal opslaan.
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Ongeldige score');
  }
  if (!response.ok) {
    return saveLocal(size, entry);
  }
  const data = await response.json();
  return { ...data, persisted: true };
}
