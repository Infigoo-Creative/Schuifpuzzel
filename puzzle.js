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

// Kleine binaire min-heap op basis van .f, zodat A* niet bij elke stap de hele lijst
// hoeft te doorzoeken (dat werd bij grotere borden snel te traag).
class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      while (true) {
        const left = i * 2 + 1, right = i * 2 + 2;
        let smallest = i;
        if (left < items.length && items[left].f < items[smallest].f) smallest = left;
        if (right < items.length && items[right].f < items[smallest].f) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// Oplosser voor testdoeleinden (zie ENABLE_AUTOSOLVE in app.js): A* met Manhattan-afstand +
// "linear conflict" als heuristiek (twee tegels die in elkaars weg staan in dezelfde rij/kolom
// kosten minstens 2 extra zetten om langs elkaar te komen — dit versnelt de zoektocht flink
// bij grotere borden). Een harde tijdslimiet voorkomt dat de pagina ooit kan vastlopen: lukt
// het niet binnen die tijd, dan geven we gewoon een lege lijst terug (zie app.js voor de melding).
export function solveBoard(board, size, timeBudgetMs = 7000) {
  const empty = size * size - 1;

  function heuristic(b) {
    let total = 0;
    const rows = Array.from({ length: size }, () => []);
    const cols = Array.from({ length: size }, () => []);
    for (let i = 0; i < b.length; i++) {
      const value = b[i];
      if (value === empty) continue;
      const valueRow = Math.floor(value / size), valueCol = value % size;
      const row = Math.floor(i / size), col = i % size;
      total += Math.abs(row - valueRow) + Math.abs(col - valueCol);
      if (row === valueRow) rows[row].push([col, valueCol]);
      if (col === valueCol) cols[col].push([row, valueRow]);
    }
    for (const line of [...rows, ...cols]) {
      line.sort((a, b2) => a[0] - b2[0]);
      for (let a = 0; a < line.length; a++) {
        for (let b2 = a + 1; b2 < line.length; b2++) {
          if (line[a][1] > line[b2][1]) total += 2;
        }
      }
    }
    return total;
  }

  const startKey = board.join(',');
  const bestCost = new Map([[startKey, 0]]);
  const cameFrom = new Map(); // key -> { parentKey, move }
  const heap = new MinHeap();
  heap.push({ board, key: startKey, g: 0, f: heuristic(board) });
  const deadline = performance.now() + timeBudgetMs;
  let iterations = 0;

  while (heap.size) {
    iterations++;
    if (iterations % 2000 === 0 && performance.now() > deadline) break;
    const current = heap.pop();
    if (current.g > (bestCost.get(current.key) ?? Infinity)) continue; // verlopen entry
    if (heuristic(current.board) === 0) {
      const path = [];
      let key = current.key;
      while (cameFrom.has(key)) {
        const { parentKey, move } = cameFrom.get(key);
        path.push(move);
        key = parentKey;
      }
      return path.reverse();
    }

    const emptyIndex = current.board.indexOf(empty);
    for (const next of neighbours(emptyIndex, size)) {
      const nextBoard = current.board.slice();
      [nextBoard[emptyIndex], nextBoard[next]] = [nextBoard[next], nextBoard[emptyIndex]];
      const key = nextBoard.join(',');
      const g = current.g + 1;
      if (!bestCost.has(key) || bestCost.get(key) > g) {
        bestCost.set(key, g);
        cameFrom.set(key, { parentKey: current.key, move: nextBoard[emptyIndex] });
        heap.push({ board: nextBoard, key, g, f: g + heuristic(nextBoard) });
      }
    }
  }

  return []; // geen oplossing binnen de tijdslimiet gevonden
}

export function formatTime(ms) {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${totalTenths % 10}`;
}
