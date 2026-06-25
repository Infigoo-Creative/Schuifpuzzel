// Praat met api.php als dat beschikbaar is, anders valt terug op localStorage per niveau.

const API_URL = 'api.php';

function localKey(size) {
  return `schuifpuzzel-ranking-${size}x${size}`;
}

export async function fetchRanking(size) {
  try {
    const response = await fetch(`${API_URL}?size=${size}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('API niet beschikbaar');
    return await response.json();
  } catch {
    return JSON.parse(localStorage.getItem(localKey(size)) || '[]');
  }
}

export async function saveScore(size, entry) {
  try {
    const response = await fetch(`${API_URL}?size=${size}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Opslaan mislukt');
    return { ranking: await response.json(), persisted: true };
  } catch {
    const local = JSON.parse(localStorage.getItem(localKey(size)) || '[]');
    local.push({ id: entry.id, name: entry.name, time: entry.time, moves: entry.moves, date: new Date().toISOString() });
    local.sort((a, b) => a.time - b.time || a.moves - b.moves);
    const trimmed = local.slice(0, 10);
    localStorage.setItem(localKey(size), JSON.stringify(trimmed));
    return { ranking: trimmed, persisted: false };
  }
}
