import { neighbours, isSolved, shuffledBoard, trySwap, formatTime, solveBoard } from './puzzle.js';
import { fetchRanking, saveScore } from './api-client.js';
import { containsBannedWord } from './moderation.js';
import {
  getPlayer, registerPlayer, recoverByCode, syncFromServer, markCompleted,
  countCompletedForSize, totalCompleted, isCompleted, getLastTime, setLastTime,
} from './progress.js';

const SIZES = [3, 4, 5, 6];

// --- Tijdelijk testgereedschap: zet op false om de Autosolve-knop helemaal te verbergen. ---
const ENABLE_AUTOSOLVE = true;
const AUTOSOLVE_MIN_DELAY = 60;
const AUTOSOLVE_MAX_DELAY = 220;
// Met Autosolve opgeloste puzzels mogen nooit een goede tijd in de ranglijst zetten:
// de getoonde/opgeslagen tijd wordt geforceerd naar ruim boven het half uur.
const AUTOSOLVE_MIN_REPORTED_TIME = 30 * 60 * 1000;

const GALLERY = [
  { id: 'papegaai', name: 'Papegaai', src: 'assets/gallery/papegaai.jpg' },
  { id: 'molen', name: 'Molen', src: 'assets/gallery/molen.jpg' },
  { id: 'luchtballon', name: 'Luchtballon', src: 'assets/gallery/luchtballon.jpg' },
  { id: 'zonnebloem', name: 'Zonnebloem', src: 'assets/gallery/zonnebloem.jpg' },
  { id: 'dolfijn', name: 'Dolfijn', src: 'assets/gallery/dolfijn.jpg' },
  { id: 'vuurtoren', name: 'Vuurtoren', src: 'assets/gallery/vuurtoren.jpg' },
  { id: 'strand', name: 'Strand', src: 'assets/gallery/strand.jpg' },
  { id: 'auto', name: 'Auto', src: 'assets/gallery/auto.jpg' },
  { id: 'raket', name: 'Raket', src: 'assets/gallery/raket.jpg' },
];

const TOTAL_LEVELS = SIZES.length * GALLERY.length;

const $ = (selector) => document.querySelector(selector);
const puzzle = $('#puzzle');
const frame = $('#puzzle-frame');
const setupForm = $('#setup-form');
const playerBar = $('#player-bar');
const timerEl = $('#timer');
const timerMultiplier = $('#timer-multiplier');
const movesEl = $('#moves');
const levelLabel = $('#level-label');
const coverSize = $('#cover-size');
const coverTitle = $('#cover-title');
const coverSubtitle = $('#cover-subtitle');
const coverStartButton = $('#cover-start-button');
const coverNextChallengeButton = $('#cover-next-challenge');
const coverPickPhotoButton = $('#cover-pick-photo');
const puzzleCover = $('#puzzle-cover');
const stopButton = $('#stop-button');
const helpButton = $('#help-button');
const autosolveButton = $('#autosolve-button');
const dialog = $('#result-dialog');
const galleryDialog = $('#gallery-dialog');
const galleryGrid = $('#gallery-grid');
const openGalleryButton = $('#open-gallery');
const photoPickerPreview = $('#photo-picker-preview');
const photoPickerName = $('#photo-picker-name');
const haveCodeLink = $('#have-code-link');
const codeField = $('#code-field');
const playerCodeInput = $('#player-code');
const playerCodeHint = $('#player-code-hint');
const codeDialog = $('#code-dialog');
const codeDisplay = $('#code-display');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');
const nextChallengeButton = $('#next-challenge');
const confirmStopDialog = $('#confirm-stop-dialog');
const confirmStopConfirm = $('#confirm-stop-confirm');
const confirmStopCancel = $('#confirm-stop-cancel');

const state = {
  size: 3,
  imageId: GALLERY[0].id,
  image: GALLERY[0].src,
  board: [],
  player: null,
  playing: false,
  elapsed: 0,
  lastTick: 0,
  helpActive: false,
  autoSolving: false,
  autoSolveTimer: null,
  moves: 0,
  timerFrame: null,
  currentEntryId: null,
  activeLeaderboardSize: 3,
  startAfterPick: false,
};

function emptyValue(size) {
  return size * size - 1;
}

function buildTiles() {
  puzzle.innerHTML = '';
  puzzle.style.setProperty('--size', state.size);
  const empty = emptyValue(state.size);
  for (let value = 0; value < empty; value++) {
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.dataset.value = value;
    tile.setAttribute('aria-label', `Puzzelstuk ${value + 1}`);
    tile.style.backgroundImage = `url('${state.image}')`;
    const col = value % state.size;
    const row = Math.floor(value / state.size);
    tile.style.backgroundPosition = `${(col * 100) / (state.size - 1)}% ${(row * 100) / (state.size - 1)}%`;
    tile.addEventListener('click', () => moveTile(value));
    const number = document.createElement('span');
    number.className = 'tile-number';
    number.textContent = value + 1;
    tile.appendChild(number);
    puzzle.appendChild(tile);
  }
  renderBoard(false);
}

function renderBoard(animate = true) {
  const size = state.size;
  state.board.forEach((value, index) => {
    if (value === emptyValue(size)) return;
    const tile = puzzle.querySelector(`[data-value="${value}"]`);
    const x = (index % size) * 100;
    const y = Math.floor(index / size) * 100;
    if (!animate) tile.style.transition = 'none';
    tile.style.transform = `translate(${x}%, ${y}%)`;
    if (!animate) requestAnimationFrame(() => { tile.style.transition = ''; });
  });
}

// --- Geluid: doffe houten "thunk", geen audiobestand nodig. ---
let audioContext = null;
function playSlideSound() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, now);

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(130, now);
  oscillator.frequency.exponentialRampToValueAtTime(60, now + 0.1);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  oscillator.connect(filter).connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.14);
}

// --- Applaus bij een opgeloste puzzel: laagjes gefilterde noise, geen audiobestand nodig. ---
function playApplause() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const duration = 1.4;
  const bufferSize = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const now = audioContext.currentTime;

  const wash = audioContext.createBufferSource();
  wash.buffer = buffer;
  const washFilter = audioContext.createBiquadFilter();
  washFilter.type = 'bandpass';
  washFilter.frequency.value = 2200;
  washFilter.Q.value = 0.6;
  const washGain = audioContext.createGain();
  washGain.gain.setValueAtTime(0, now);
  washGain.gain.linearRampToValueAtTime(0.16, now + 0.15);
  washGain.gain.linearRampToValueAtTime(0.1, now + 0.7);
  washGain.gain.linearRampToValueAtTime(0.0001, now + duration);
  wash.connect(washFilter).connect(washGain).connect(audioContext.destination);
  wash.start(now);
  wash.stop(now + duration);

  for (let i = 0; i < 16; i++) {
    const t = now + Math.random() * duration * 0.85;
    const clap = audioContext.createBufferSource();
    clap.buffer = buffer;
    const clapFilter = audioContext.createBiquadFilter();
    clapFilter.type = 'bandpass';
    clapFilter.frequency.value = 1800 + Math.random() * 1800;
    clapFilter.Q.value = 1.2;
    const clapGain = audioContext.createGain();
    clapGain.gain.setValueAtTime(0, t);
    clapGain.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.08, t + 0.008);
    clapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    clap.connect(clapFilter).connect(clapGain).connect(audioContext.destination);
    clap.start(t);
    clap.stop(t + 0.1);
  }
}

// --- Subtiele confetti die vanaf de bovenkant naar beneden dwarrelt. ---
// target = waar de confetti in de DOM terechtkomt. Een open <dialog> leeft in de browser-
// "top layer", dus confetti die in document.body terechtkomt, verdwijnt daar visueel onder;
// door 'm als kind van de dialoog te plaatsen, deelt hij diezelfde top layer en blijft hij zichtbaar.
function spawnConfetti(target = document.body, count = 26) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#0a84ff', '#5e5ce6', '#ff375f', '#ffd60a', '#34c759'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '50';
  container.style.overflow = 'hidden';
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    const size = 6 + Math.random() * 5;
    piece.style.position = 'absolute';
    piece.style.top = '-20px';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.4}px`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.borderRadius = '2px';
    piece.style.opacity = '0.8';
    const duration = 2.6 + Math.random() * 1.6;
    const delay = Math.random() * 0.4;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    piece.style.animation = `confetti-fall ${duration}s ${delay}s ease-in forwards`;
    container.appendChild(piece);
  }
  target.appendChild(container);
  setTimeout(() => container.remove(), 4600);
}

function moveTile(value) {
  if (!state.playing) return;
  const next = trySwap(state.board, state.size, value);
  if (!next) return;
  state.board = next;
  state.moves++;
  movesEl.textContent = state.moves;
  renderBoard();
  playSlideSound();
  if (isSolved(state.board)) finishGame();
}

function setHelpActive(active) {
  state.helpActive = active;
  puzzle.classList.toggle('show-numbers', active);
  helpButton.classList.toggle('is-active', active);
  helpButton.textContent = active ? 'Stop help' : 'Help';
  timerEl.classList.toggle('is-fast', active);
  timerMultiplier.hidden = !active;
  // Korte "pulse" op de tijd zodat duidelijk is dat hij nu sneller gaat lopen.
  timerEl.classList.remove('pulse');
  void timerEl.offsetWidth;
  timerEl.classList.add('pulse');
}

// --- Tijdelijk testgereedschap: lost de actieve puzzel automatisch op, met willekeurige
// pauzes tussen zetten, zodat je niet elke keer handmatig hoeft te schuiven tijdens het testen.
function stopAutosolve() {
  state.autoSolving = false;
  clearTimeout(state.autoSolveTimer);
  autosolveButton.classList.remove('is-active');
  autosolveButton.textContent = 'Autosolve';
}

function startAutosolve() {
  if (!state.playing) return;
  autosolveButton.textContent = 'Bezig met rekenen…';
  autosolveButton.disabled = true;
  const moves = solveBoard(state.board, state.size);
  autosolveButton.disabled = false;
  if (!state.playing) return; // gestopt terwijl er gerekend werd
  if (moves.length === 0) {
    showToast('Dit bord is te complex om snel op te lossen. Werkt het best op 3×3/4×4 — speel anders verder of begin opnieuw.');
    autosolveButton.textContent = 'Autosolve';
    return;
  }
  state.autoSolving = true;
  state.usedAutosolve = true;
  autosolveButton.classList.add('is-active');
  autosolveButton.textContent = 'Stop autosolve';
  let i = 0;
  const playNext = () => {
    if (!state.autoSolving || !state.playing || i >= moves.length) {
      stopAutosolve();
      return;
    }
    moveTile(moves[i]);
    i++;
    const delay = AUTOSOLVE_MIN_DELAY + Math.random() * (AUTOSOLVE_MAX_DELAY - AUTOSOLVE_MIN_DELAY);
    state.autoSolveTimer = setTimeout(playNext, delay);
  };
  playNext();
}

// Autosolve is alleen haalbaar binnen de tijdslimiet op 3×3 — vanaf 4×4 duurt het
// zoekalgoritme te lang, dus de knop is daar verborgen i.p.v. een mislukte poging te tonen.
function updateAutosolveVisibility() {
  autosolveButton.hidden = !ENABLE_AUTOSOLVE || state.size !== 3;
}

function startGame() {
  coverStartButton.hidden = true;
  coverNextChallengeButton.hidden = true;
  coverPickPhotoButton.hidden = true;
  state.board = shuffledBoard(state.size);
  buildTiles();
  state.moves = 0;
  state.elapsed = 0;
  state.usedAutosolve = false;
  movesEl.textContent = '0';
  timerEl.textContent = '00:00.0';
  frame.className = 'puzzle-frame is-playing';
  state.playing = true;
  stopButton.disabled = false;
  helpButton.disabled = false;
  setHelpActive(false);
  stopAutosolve();
  updateAutosolveVisibility();
  autosolveButton.disabled = autosolveButton.hidden;
  state.lastTick = performance.now();
  tick();
}

// De tijd loopt op basis van verstreken delta's (niet vanaf één vast startmoment), zodat de
// helpknop de klok 2x zo snel kan laten lopen als "prijs" voor het zien van de stuknummers.
function tick(now = performance.now()) {
  if (!state.playing) return;
  const delta = now - state.lastTick;
  state.lastTick = now;
  state.elapsed += delta * (state.helpActive ? 2 : 1);
  timerEl.textContent = formatTime(state.elapsed);
  state.timerFrame = requestAnimationFrame(tick);
}

function stopGame() {
  if (!state.playing) return;
  state.playing = false;
  cancelAnimationFrame(state.timerFrame);
  stopButton.disabled = true;
  helpButton.disabled = true;
  setHelpActive(false);
  stopAutosolve();
  autosolveButton.disabled = true;
  frame.className = 'puzzle-frame is-ready';
  coverTitle.innerHTML = 'Poging gestopt.<br>Probeer het nog eens.';
  coverSubtitle.textContent = 'Deze tijd telt niet mee';
  coverNextChallengeButton.hidden = true;
  coverPickPhotoButton.hidden = true;
  coverStartButton.hidden = false;
  showToast('Poging gestopt — deze tijd telt niet mee.');
}

// Onderbreekt een actieve poging niet zomaar: als er al zetten gedaan zijn, eerst expliciet
// laten bevestigen (anders gaat de tijd/voortgang ongemerkt verloren). Zonder zetten is er
// niets te verliezen, dus dan voeren we de actie direct uit — geen onnodige drempel.
function confirmStopIfPlaying(action) {
  if (!state.playing || state.moves === 0) {
    action();
    return;
  }
  confirmStopDialog.returnValue = '';
  confirmStopDialog.showModal();
  confirmStopCancel.focus();
  const onClose = () => {
    confirmStopDialog.removeEventListener('close', onClose);
    if (confirmStopDialog.returnValue === 'stop') action();
  };
  confirmStopDialog.addEventListener('close', onClose);
}

// Stelt voor wat de speler hierna zou moeten doen: liever een nog niet voltooide foto op
// hetzelfde niveau, anders de volgende moeilijkheidsgraad, anders niets meer (alles klaar).
function findNextChallenge() {
  const sameLevelItem = GALLERY.find((item) => !isCompleted(state.size, item.id));
  if (sameLevelItem) return { size: state.size, imageId: sameLevelItem.id, kind: 'photo', item: sameLevelItem };

  const sizeIndex = SIZES.indexOf(state.size);
  for (let i = sizeIndex + 1; i < SIZES.length; i++) {
    const nextSize = SIZES[i];
    const item = GALLERY.find((entry) => !isCompleted(nextSize, entry.id));
    if (item) return { size: nextSize, imageId: item.id, kind: 'level', item };
  }
  return null;
}

async function finishGame() {
  state.playing = false;
  cancelAnimationFrame(state.timerFrame);
  stopButton.disabled = true;
  helpButton.disabled = true;
  setHelpActive(false);
  stopAutosolve();
  autosolveButton.disabled = true;
  if (state.usedAutosolve) {
    state.elapsed = Math.max(state.elapsed, AUTOSOLVE_MIN_REPORTED_TIME + Math.random() * 60000);
  }
  frame.className = 'puzzle-frame is-ready';
  coverTitle.innerHTML = 'Mooi gedaan!<br>Nog een ronde?';
  coverSubtitle.textContent = 'Klik om opnieuw te beginnen';
  coverStartButton.hidden = false;
  state.currentEntryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const entry = {
    id: state.currentEntryId,
    name: state.player.name,
    time: Math.round(state.elapsed),
    moves: state.moves,
    image: state.imageId,
  };

  const wasAlreadyCompleted = isCompleted(state.size, state.imageId);
  const totalBefore = totalCompleted();
  const previousTime = getLastTime(state.size, state.imageId);
  setLastTime(state.size, state.imageId, Math.round(state.elapsed));

  let ranking = [];
  let rank = null;
  let context = [];
  try {
    const result = await saveScore(state.size, entry);
    ranking = result.ranking;
    rank = result.rank;
    context = result.context ?? [];
    if (!result.persisted) showToast('Demo-modus: score is alleen op dit apparaat bewaard.');
  } catch (error) {
    showToast(error.message === 'Ongeldige naam' ? 'Score niet opgeslagen: kies een andere naam.' : 'Score kon niet worden opgeslagen.');
  }
  if (state.activeLeaderboardSize === state.size) renderLeaderboard(ranking, rank > 10 ? context : []);

  await markCompleted(state.size, state.imageId);
  renderProgress();
  const justCompletedAll = totalBefore < TOTAL_LEVELS && totalCompleted() === TOTAL_LEVELS;

  $('#final-time').textContent = formatTime(state.elapsed);

  const deltaEl = $('#time-delta');
  if (previousTime == null) {
    deltaEl.hidden = true;
  } else {
    const diff = previousTime - Math.round(state.elapsed);
    deltaEl.hidden = false;
    if (diff > 0) {
      deltaEl.textContent = `${formatTime(Math.abs(diff))} sneller dan je vorige poging`;
      deltaEl.className = 'time-delta is-faster';
    } else if (diff < 0) {
      deltaEl.textContent = `${formatTime(Math.abs(diff))} langzamer dan je vorige poging`;
      deltaEl.className = 'time-delta is-slower';
    } else {
      deltaEl.textContent = 'Precies even snel als je vorige poging';
      deltaEl.className = 'time-delta';
    }
  }

  $('#result-title').textContent = rank > 0 && rank <= 10 ? `Plek ${rank}. Heel netjes!` : 'Lekker geschoven!';
  let message = rank > 0 && rank <= 10
    ? `Met ${state.moves} zetten sta je nu in de top 10 van dit niveau.`
    : `Voltooid in ${state.moves} zetten.`;
  if (!wasAlreadyCompleted) message += ' Dit level heb je nu voor het eerst uitgespeeld — badge verdiend!';

  // Dezelfde vervolgactie (en dezelfde knoppen-tekst) geldt zowel in de pop-up als op de
  // cover die verschijnt zodra die pop-up wordt gesloten — zo hoeft de speler nooit terug
  // te zoeken naar "volgende foto" of "kies een andere foto" na bijv. de ranglijst bekijken.
  const nextChallenge = findNextChallenge();
  coverPickPhotoButton.hidden = false;
  if (nextChallenge) {
    const label = nextChallenge.kind === 'level'
      ? `Naar ${nextChallenge.size} × ${nextChallenge.size}: ${nextChallenge.item.name}`
      : 'Volgende foto';
    const goToNextChallenge = () => {
      dialog.close();
      state.size = nextChallenge.size;
      const radio = document.querySelector(`input[name=size][value="${nextChallenge.size}"]`);
      if (radio) radio.checked = true;
      selectImage(nextChallenge.imageId);
      startGame();
    };
    nextChallengeButton.hidden = false;
    nextChallengeButton.innerHTML = `${label} <span>→</span>`;
    nextChallengeButton.onclick = goToNextChallenge;
    coverNextChallengeButton.hidden = false;
    coverNextChallengeButton.innerHTML = `${label} <span>→</span>`;
    coverNextChallengeButton.onclick = goToNextChallenge;
    message += nextChallenge.kind === 'level'
      ? ' Alle foto\'s op dit niveau zijn klaar — tijd voor de volgende moeilijkheidsgraad.'
      : ' Kies hieronder gerust de volgende foto.';
  } else {
    nextChallengeButton.hidden = true;
    coverNextChallengeButton.hidden = true;
    message += ' Je hebt alle 36 levels uitgespeeld — knap gedaan!';
  }

  dialog.classList.toggle('is-grand', justCompletedAll);
  if (justCompletedAll) {
    $('#result-eyebrow-text').textContent = 'ALLES VOLTOOID';
    $('#result-title').textContent = 'Jij hebt ze allemaal!';
    message = `Alle 36 levels uitgespeeld — elke foto, op elk niveau. Met ${state.moves} zetten leg je deze laatste mooi af. Knap gedaan!`;
  } else {
    $('#result-eyebrow-text').textContent = 'PUZZEL VOLTOOID';
  }
  $('#result-message').textContent = message;
  dialog.showModal();
  playApplause();
  spawnConfetti(dialog, justCompletedAll ? 70 : 26);
  if (justCompletedAll) setTimeout(() => spawnConfetti(dialog, 50), 500);
}

function imageSrcFor(imageId) {
  return GALLERY.find((item) => item.id === imageId)?.src ?? GALLERY[0].src;
}

function leaderboardRow(entry, rank) {
  const li = document.createElement('li');
  if (entry.id === state.currentEntryId) li.className = 'is-current';
  li.innerHTML = `<span class="position">${String(rank).padStart(2, '0')}</span><span class="avatar"><img src="${imageSrcFor(entry.image)}" alt=""></span><span class="name"></span><span class="move-count">${entry.moves}</span><span class="time">${formatTime(entry.time)}</span>`;
  li.querySelector('.name').textContent = entry.name;
  return li;
}

// Toont de top 10, en als de huidige speler daarbuiten valt: een "···"-scheiding met
// een venster van 2 posities erboven en erbeneden, zodat je ziet hoe ver je nog van de top 10 zit.
function renderLeaderboard(entries, context = []) {
  const list = $('#leaderboard');
  list.innerHTML = '';
  $('#empty-ranking').hidden = entries.length > 0;
  entries.slice(0, 10).forEach((entry, index) => {
    list.appendChild(leaderboardRow(entry, entry.rank ?? index + 1));
  });
  if (context.length > 0) {
    const gap = document.createElement('li');
    gap.className = 'rank-gap';
    gap.innerHTML = '<span></span><span></span><span>···</span><span></span><span></span>';
    list.appendChild(gap);
    context.forEach((entry) => list.appendChild(leaderboardRow(entry, entry.rank)));
  }
}

async function loadLeaderboard(size) {
  state.activeLeaderboardSize = size;
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('is-active', Number(tab.dataset.size) === size));
  renderLeaderboard(await fetchRanking(size));
}

let toastTimeout = null;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

function updateCoverPreview() {
  puzzleCover.style.backgroundImage = `linear-gradient(140deg,rgba(10,30,90,.62),rgba(94,92,230,.7)), url('${state.image}')`;
  const label = `${state.size} × ${state.size}`;
  coverSize.textContent = label;
  levelLabel.textContent = label;
}

function renderProgressSummary() {
  const total = SIZES.length * GALLERY.length;
  const done = totalCompleted();
  progressFill.style.width = `${(done / total) * 100}%`;
  progressText.textContent = `${done} van ${total} levels voltooid`;
}

function renderSizeProgress() {
  document.querySelectorAll('.size-progress').forEach((container) => {
    const size = Number(container.dataset.size);
    const done = countCompletedForSize(size);
    container.innerHTML = '';
    container.setAttribute('aria-label', `${done} van ${GALLERY.length} foto's voltooid op dit niveau`);
    GALLERY.forEach((_, index) => {
      const dot = document.createElement('span');
      if (index < done) dot.className = 'is-done';
      container.appendChild(dot);
    });
    container.closest('.size-label')?.classList.toggle('is-complete', done >= GALLERY.length);
  });
}

function renderProgress() {
  renderProgressSummary();
  renderSizeProgress();
}

function selectImage(imageId) {
  const item = GALLERY.find((entry) => entry.id === imageId);
  if (!item) return;
  state.imageId = item.id;
  state.image = item.src;
  photoPickerPreview.src = item.src;
  photoPickerName.textContent = item.name;
  updateCoverPreview();
}

// Trofee-badge per foto: voltooid op het NU geselecteerde niveau (dus dit moet opnieuw
// gerenderd worden zodra de moeilijkheidsgraad wijzigt of de gallery weer opent).
function renderGallery() {
  galleryGrid.innerHTML = '';
  GALLERY.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-item';
    const badge = isCompleted(state.size, item.id)
      ? '<span class="trophy-badge" title="Al uitgespeeld op dit niveau"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z" fill="#fff"/><path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5 3.5 3.5 0 0 0 6.5 10H7M17 5h2.5A1.5 1.5 0 0 1 21 6.5 3.5 3.5 0 0 1 17.5 10H17" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M10 16.5h4v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2Z" fill="#fff"/><rect x="8.5" y="19.5" width="7" height="1.6" rx="0.8" fill="#fff"/></svg></span>'
      : '';
    button.innerHTML = `${badge}<img src="${item.src}" alt="${item.name}"><span>${item.name}</span>`;
    button.addEventListener('click', () => {
      selectImage(item.id);
      galleryDialog.close();
      if (state.startAfterPick) {
        state.startAfterPick = false;
        startGame();
      }
    });
    galleryGrid.appendChild(button);
  });
}

setupForm.addEventListener('change', (event) => {
  if (event.target.name === 'size') {
    state.size = Number(new FormData(setupForm).get('size'));
    updateCoverPreview();
    renderGallery();
    updateAutosolveVisibility();
  }
});

haveCodeLink.addEventListener('click', () => {
  codeField.hidden = !codeField.hidden;
  haveCodeLink.textContent = codeField.hidden ? 'Heb je al een code?' : 'Ik speel zonder code';
  if (!codeField.hidden) playerCodeInput.focus();
});

function showPlayerCodeHint() {
  const player = getPlayer();
  playerCodeHint.textContent = player ? player.code : '';
}

// Na het invullen van naam (en eventueel code) hier verder: leaderboard laden, UI omzetten
// naar "aan het spelen" en de puzzel starten.
function proceedToGame(name) {
  state.player = { name };
  $('#player-greeting').textContent = name;
  showPlayerCodeHint();
  updateCoverPreview();
  setupForm.hidden = true;
  playerBar.hidden = false;
  loadLeaderboard(state.size);
  startGame();
  // Op mobiel staat de pagina nog boven bij de intro-tekst; spring naar het
  // spelblok zodat speler, code, instellingen-knop en bord meteen in beeld staan.
  if (window.matchMedia('(max-width: 560px)').matches) {
    requestAnimationFrame(() => playerBar.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

setupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!setupForm.reportValidity()) return;
  const name = $('#name').value.trim();
  if (containsBannedWord(name)) {
    showToast('Kies een andere naam — dit woord is niet toegestaan.');
    return;
  }
  state.size = Number(new FormData(setupForm).get('size'));

  const enteredCode = playerCodeInput.value.trim();
  const existingPlayer = getPlayer();

  if (existingPlayer) {
    // Dit apparaat heeft al een code: gewoon doorspelen, voortgang is al lokaal bekend.
    proceedToGame(name);
    return;
  }

  if (enteredCode) {
    if (!/^\d{6}$/.test(enteredCode)) {
      showToast('Een code bestaat uit 6 cijfers.');
      return;
    }
    const recovered = await recoverByCode(enteredCode);
    if (!recovered) {
      showToast('Code niet gevonden — controleer je code.');
      return;
    }
    renderProgress();
    proceedToGame(name);
    return;
  }

  // Eerste keer op dit apparaat, geen code ingevuld: nieuwe code aanmaken en eenmalig tonen.
  const { code } = await registerPlayer(name);
  codeDisplay.textContent = code;
  codeDialog.showModal();
  codeDialog.dataset.pendingName = name;
});

$('#confirm-code').addEventListener('click', () => {
  const name = codeDialog.dataset.pendingName;
  codeDialog.close();
  if (name) proceedToGame(name);
});
$('#close-code-dialog').addEventListener('click', () => {
  const name = codeDialog.dataset.pendingName;
  codeDialog.close();
  if (name) proceedToGame(name);
});

function openSettings() {
  if (state.playing) stopGame();
  playerBar.hidden = true;
  setupForm.hidden = false;
  coverStartButton.hidden = true;
  coverNextChallengeButton.hidden = true;
  coverPickPhotoButton.hidden = true;
  coverTitle.innerHTML = 'Kies je niveau<br>en begin te schuiven.';
  coverSubtitle.textContent = 'Vul je naam in om te beginnen';
  frame.className = 'puzzle-frame is-locked';
}
$('#change-player').addEventListener('click', () => confirmStopIfPlaying(openSettings));
coverStartButton.addEventListener('click', startGame);
stopButton.addEventListener('click', () => confirmStopIfPlaying(stopGame));
confirmStopConfirm.addEventListener('click', () => {
  confirmStopDialog.returnValue = 'stop';
  confirmStopDialog.close();
});
confirmStopCancel.addEventListener('click', () => {
  confirmStopDialog.returnValue = '';
  confirmStopDialog.close();
});
helpButton.addEventListener('click', () => {
  if (!state.playing) return;
  setHelpActive(!state.helpActive);
});
updateAutosolveVisibility();
autosolveButton.addEventListener('click', () => {
  if (state.autoSolving) stopAutosolve(); else startAutosolve();
});
function openPhotoPicker() {
  dialog.close();
  state.startAfterPick = true;
  renderGallery();
  galleryDialog.showModal();
}
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#play-again').addEventListener('click', () => { dialog.close(); startGame(); });
$('#pick-other-photo').addEventListener('click', openPhotoPicker);
coverPickPhotoButton.addEventListener('click', openPhotoPicker);
$('#view-ranking').addEventListener('click', () => { dialog.close(); $('.leaderboard-section').scrollIntoView(); });

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => loadLeaderboard(Number(tab.dataset.size)));
});

openGalleryButton.addEventListener('click', () => {
  renderGallery();
  galleryDialog.showModal();
});
$('#close-gallery').addEventListener('click', () => {
  state.startAfterPick = false;
  galleryDialog.close();
});

// Verplaatst de tegel die bij een richting hoort (pijltjestoets of swipe): "omhoog" betekent
// hetzelfde als de ArrowUp-toets — de tegel ÓNDER de lege plek schuift naar boven, enz.
function moveInDirection(direction) {
  if (!state.playing) return;
  const empty = state.board.indexOf(emptyValue(state.size));
  const targetByDirection = {
    up: empty + state.size,
    down: empty - state.size,
    left: empty + 1,
    right: empty - 1,
  };
  const target = targetByDirection[direction];
  if (target !== undefined && neighbours(empty, state.size).includes(target)) {
    moveTile(state.board[target]);
  }
}

const SWIPE_THRESHOLD = 24; // pixels
let touchStart = null;
puzzle.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
puzzle.addEventListener('touchmove', (event) => {
  // touch-action:none op .puzzle voorkomt dit al, maar sommige browsers
  // (oudere Safari) negeren dat soms tijdens een actieve swipe — vandaar
  // deze expliciete preventDefault als achtervang tegen page-scroll.
  if (touchStart) event.preventDefault();
}, { passive: false });
puzzle.addEventListener('touchend', (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  moveInDirection(direction);
}, { passive: true });

document.addEventListener('keydown', (event) => {
  if (!state.playing) return;
  const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
  if (direction) {
    event.preventDefault();
    moveInDirection(direction);
  }
});

/* Geparkeerd voor later: eigen foto uploaden. UI is uit index.html gehaald,
   maar deze functies blijven staan zodat de feature makkelijk terug te zetten is.
   Verwacht dan weer een <input id="image-upload"> en <button id="reset-image"> in de pagina.

function wireImageUpload() {
  const imageInput = $('#image-upload');
  const resetImageButton = $('#reset-image');
  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.imageId = null;
      state.image = reader.result;
    };
    reader.readAsDataURL(file);
  });
  resetImageButton.addEventListener('click', () => {
    selectImage(GALLERY[0].id);
    imageInput.value = '';
  });
}
*/

$('#theme-toggle').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('schuifpuzzel-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('schuifpuzzel-theme', 'dark');
  }
});

renderGallery();
updateCoverPreview();
loadLeaderboard(state.size);

const existingPlayer = getPlayer();
if (existingPlayer) {
  $('#name').value = existingPlayer.name;
  $('.code-recovery').hidden = true;
}
syncFromServer().then(() => {
  renderProgress();
  renderGallery();
});
renderProgress();

// Subtiel, automatisch bijgehouden versiestempel (zie .git/hooks/pre-commit) —
// handig om te checken of de live server de laatste upload draait.
fetch('version.json').then((res) => res.ok ? res.json() : null).then((info) => {
  if (!info) return;
  $('#version-stamp').textContent = `Build ${info.build} · ${info.date}`;
}).catch(() => {});
