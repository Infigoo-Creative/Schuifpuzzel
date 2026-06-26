// Voortgang zonder echte login: een 6-cijferige code identificeert de speler.
// Op hetzelfde apparaat/browser werkt het automatisch via localStorage; op een ander
// apparaat vul je de code in om je voortgang terug te halen (zie recoverByCode).

const PROGRESS_URL = 'progress.php';
const PLAYER_KEY = 'schuifpuzzel-player';
const COMPLETED_KEY = 'schuifpuzzel-completed';
const LAST_TIMES_KEY = 'schuifpuzzel-last-times';

export function comboKey(size, imageId) {
  return `${size}-${imageId}`;
}

export function getPlayer() {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_KEY));
  } catch {
    return null;
  }
}

function setPlayer(player) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

function getCompletedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COMPLETED_KEY)) || []);
  } catch {
    return new Set();
  }
}

function setCompletedSet(set) {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify([...set]));
}

export function countCompletedForSize(size) {
  let count = 0;
  for (const key of getCompletedSet()) {
    if (key.startsWith(`${size}-`)) count++;
  }
  return count;
}

export function isCompleted(size, imageId) {
  return getCompletedSet().has(comboKey(size, imageId));
}

export function totalCompleted() {
  return getCompletedSet().size;
}

// Onthoudt (los van de gedeelde ranglijst) wat je laatste tijd was op een specifieke
// foto x niveau-combinatie, zodat we bij een nieuwe poging kunnen zeggen "sneller/langzamer".
function getLastTimes() {
  try {
    return JSON.parse(localStorage.getItem(LAST_TIMES_KEY)) || {};
  } catch {
    return {};
  }
}

export function getLastTime(size, imageId) {
  return getLastTimes()[comboKey(size, imageId)] ?? null;
}

export function setLastTime(size, imageId, ms) {
  const times = getLastTimes();
  times[comboKey(size, imageId)] = ms;
  localStorage.setItem(LAST_TIMES_KEY, JSON.stringify(times));
}

// Eerste keer naam invullen, geen code: server genereert een nieuwe unieke code.
// Zonder PHP (lokale demo) wordt een willekeurige code gegenereerd die alleen lokaal werkt.
export async function registerPlayer(name) {
  try {
    const response = await fetch(PROGRESS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', name }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Registreren mislukt');
    }
    const data = await response.json();
    setPlayer({ code: data.code, name });
    return { code: data.code, persisted: true };
  } catch (error) {
    if (error.message === 'Ongeldige naam') throw error;
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    setPlayer({ code, name });
    return { code, persisted: false };
  }
}

// Code van een ander apparaat invullen: haalt voortgang op en voegt 'm samen met wat hier
// al lokaal bekend is (zodat je niets verliest als je toevallig al iets gespeeld had).
export async function recoverByCode(code) {
  let data;
  try {
    const response = await fetch(`${PROGRESS_URL}?code=${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    data = await response.json();
  } catch {
    // Geen PHP-server beschikbaar (of geen geldig JSON-antwoord): code-herstel kan dan niet werken.
    return null;
  }
  setPlayer({ code, name: data.name });
  const merged = new Set([...getCompletedSet(), ...(data.completed || [])]);
  setCompletedSet(merged);
  return data;
}

// Haalt bij het laden van de pagina de laatste stand van de server op (voor het geval er op
// een ander apparaat met dezelfde code is doorgespeeld) en voegt 'm samen met lokale data.
export async function syncFromServer() {
  const player = getPlayer();
  if (!player) return;
  try {
    const response = await fetch(`${PROGRESS_URL}?code=${encodeURIComponent(player.code)}`);
    if (!response.ok) return;
    const data = await response.json();
    const merged = new Set([...getCompletedSet(), ...(data.completed || [])]);
    setCompletedSet(merged);
  } catch {
    // Geen server beschikbaar: lokale stand blijft gewoon gelden.
  }
}

export async function markCompleted(size, imageId) {
  const key = comboKey(size, imageId);
  const set = getCompletedSet();
  if (set.has(key)) return;
  set.add(key);
  setCompletedSet(set);

  const player = getPlayer();
  if (!player) return;
  try {
    await fetch(PROGRESS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', code: player.code, size, image: imageId }),
    });
  } catch {
    // Geen server beschikbaar: blijft lokaal bewaard, dat is voor de demo voldoende.
  }
}
