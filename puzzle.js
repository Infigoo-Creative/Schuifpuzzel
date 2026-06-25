// Pure puzzlelogica: los van DOM, makkelijk te testen.

export function solvedBoard(size) {
  return [...Array(size * size).keys()];
}

export function neighbours(index, size) {
  const row = Math.floor(index / size), col = index % size;
  return [index - size, index + size, index - 1, index + 1].filter((i) => {
    if (i < 0 || i >= size * size) return false;
    return Math.abs(Math.floor(i / size) - row) + Math.abs((i % size) - col) === 1;
  });
}

export function isSolved(board) {
  return board.every((value, index) => value === index);
}

// Schudt door random walks vanaf de opgeloste staat: elke uitkomst is per definitie oplosbaar.
export function shuffledBoard(size, steps = size * size * 25) {
  const empty = size * size - 1;
  let board = solvedBoard(size);
  let emptyIndex = empty;
  let previous = -1;
  for (let i = 0; i < steps; i++) {
    const options = neighbours(emptyIndex, size).filter((n) => n !== previous);
    const pool = options.length ? options : neighbours(emptyIndex, size);
    const next = pool[Math.floor(Math.random() * pool.length)];
    [board[emptyIndex], board[next]] = [board[next], board[emptyIndex]];
    previous = emptyIndex;
    emptyIndex = next;
  }
  return isSolved(board) ? shuffledBoard(size, 20) : board;
}

export function trySwap(board, size, value) {
  const empty = size * size - 1;
  const tileIndex = board.indexOf(value);
  const emptyIndex = board.indexOf(empty);
  if (!neighbours(emptyIndex, size).includes(tileIndex)) return null;
  const next = board.slice();
  [next[tileIndex], next[emptyIndex]] = [next[emptyIndex], next[tileIndex]];
  return next;
}

export function formatTime(ms) {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${totalTenths % 10}`;
}
