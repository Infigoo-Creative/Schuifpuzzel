import { neighbours, isSolved, shuffledBoard, trySwap, formatTime } from './puzzle.js';
import { fetchRanking, saveScore } from './api-client.js';

const DEFAULT_IMAGE = 'assets/puzzle-default.png';
const SIZES = [3, 4, 5, 6];

const $ = (selector) => document.querySelector(selector);
const puzzle = $('#puzzle');
const frame = $('#puzzle-frame');
const setupForm = $('#setup-form');
const readyPanel = $('#ready-panel');
const timerEl = $('#timer');
const movesEl = $('#moves');
const levelLabel = $('#level-label');
const coverSize = $('#cover-size');
const stopButton = $('#stop-button');
const dialog = $('#result-dialog');
const imageInput = $('#image-upload');
const resetImageButton = $('#reset-image');

const state = {
  size: 3,
  image: DEFAULT_IMAGE,
  board: [],
  player: null,
  playing: false,
  startTime: 0,
  elapsed: 0,
  moves: 0,
  timerFrame: null,
  currentEntryId: null,
  activeLeaderboardSize: 3,
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

function moveTile(value) {
  if (!state.playing) return;
  const next = trySwap(state.board, state.size, value);
  if (!next) return;
  state.board = next;
  state.moves++;
  movesEl.textContent = state.moves;
  renderBoard();
  if (isSolved(state.board)) finishGame();
}

function startGame() {
  state.board = shuffledBoard(state.size);
  buildTiles();
  state.moves = 0;
  state.elapsed = 0;
  movesEl.textContent = '0';
  timerEl.textContent = '00:00.0';
  frame.className = 'puzzle-frame is-playing';
  state.playing = true;
  stopButton.disabled = false;
  $('#start-button').disabled = true;
  state.startTime = performance.now();
  tick();
}

function tick(now = performance.now()) {
  if (!state.playing) return;
  state.elapsed = now - state.startTime;
  timerEl.textContent = formatTime(state.elapsed);
  state.timerFrame = requestAnimationFrame(tick);
}

function stopGame() {
  if (!state.playing) return;
  state.playing = false;
  cancelAnimationFrame(state.timerFrame);
  stopButton.disabled = true;
  $('#start-button').disabled = false;
  frame.className = 'puzzle-frame is-ready';
  showToast('Poging gestopt — deze tijd telt niet mee.');
}

async function finishGame() {
  state.playing = false;
  cancelAnimationFrame(state.timerFrame);
  stopButton.disabled = true;
  $('#start-button').disabled = false;
  frame.className = 'puzzle-frame';
  state.currentEntryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const entry = { id: state.currentEntryId, name: state.player.name, time: Math.round(state.elapsed), moves: state.moves };
  const { ranking, persisted } = await saveScore(state.size, entry);
  if (!persisted) showToast('Demo-modus: score is alleen op dit apparaat bewaard.');
  if (state.activeLeaderboardSize === state.size) renderLeaderboard(ranking);

  const position = ranking.findIndex((item) => item.id === state.currentEntryId) + 1;
  $('#final-time').textContent = formatTime(state.elapsed);
  $('#result-title').textContent = position > 0 && position <= 10 ? `Plek ${position}. Heel netjes!` : 'Lekker geschoven!';
  $('#result-message').textContent = position > 0 && position <= 10
    ? `Met ${state.moves} zetten sta je nu in de top 10 van dit niveau.`
    : `Voltooid in ${state.moves} zetten. Nog één poging en je schuift misschien wél de top 10 binnen.`;
  dialog.showModal();
}

function renderLeaderboard(entries) {
  const list = $('#leaderboard');
  list.innerHTML = '';
  $('#empty-ranking').hidden = entries.length > 0;
  entries.slice(0, 10).forEach((entry, index) => {
    const li = document.createElement('li');
    if (entry.id === state.currentEntryId) li.className = 'is-current';
    li.innerHTML = `<span class="position">${String(index + 1).padStart(2, '0')}</span><span class="name"></span><span class="move-count">${entry.moves}</span><span class="time">${formatTime(entry.time)}</span>`;
    li.querySelector('.name').textContent = entry.name;
    list.appendChild(li);
  });
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

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!setupForm.reportValidity()) return;
  state.size = Number(new FormData(setupForm).get('size'));
  state.player = { name: $('#name').value.trim() };
  const label = `${state.size} × ${state.size}`;
  $('#player-greeting').textContent = state.player.name;
  levelLabel.textContent = label;
  coverSize.textContent = label;
  setupForm.hidden = true;
  readyPanel.hidden = false;
  frame.className = 'puzzle-frame is-ready';
  $('#puzzle-cover small').textContent = 'Klaar om te starten';
  loadLeaderboard(state.size);
});

$('#change-player').addEventListener('click', () => {
  readyPanel.hidden = true;
  setupForm.hidden = false;
  frame.className = 'puzzle-frame is-locked';
});
$('#start-button').addEventListener('click', startGame);
stopButton.addEventListener('click', stopGame);
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#play-again').addEventListener('click', () => { dialog.close(); startGame(); });
$('#view-ranking').addEventListener('click', () => { dialog.close(); $('.leaderboard-section').scrollIntoView(); });

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => loadLeaderboard(Number(tab.dataset.size)));
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { state.image = reader.result; };
  reader.readAsDataURL(file);
});

resetImageButton.addEventListener('click', () => {
  state.image = DEFAULT_IMAGE;
  imageInput.value = '';
});

document.addEventListener('keydown', (event) => {
  if (!state.playing) return;
  const empty = state.board.indexOf(emptyValue(state.size));
  const targetByKey = {
    ArrowUp: empty + state.size,
    ArrowDown: empty - state.size,
    ArrowLeft: empty + 1,
    ArrowRight: empty - 1,
  };
  const target = targetByKey[event.key];
  if (target !== undefined && neighbours(empty, state.size).includes(target)) {
    event.preventDefault();
    moveTile(state.board[target]);
  }
});

loadLeaderboard(state.size);
