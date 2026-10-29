export const APP_VERSION = '1.0.0';
export const SAVE_VERSION = 1;
export const WIDTH = 10;
export const HEIGHT = 20;
export const CLASSIC_PERIOD = 120000;
export const PUZZLE_PERIOD = 150000;
export const LOCK_DELAY = 350;
export const SPEEDS = [900, 720, 560, 420, 310, 220, 150];
export const CLASSIC_KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export const PUZZLE_KINDS = [...CLASSIC_KINDS, 'I2', 'L3', 'T5'];

const patterns = {
  I: ['1111'], O: ['11', '11'], T: ['111', '010'],
  S: ['011', '110'], Z: ['110', '011'], J: ['100', '111'], L: ['001', '111'],
  I2: ['11'], L3: ['11', '01'], T5: ['111', '010', '010'], bonus: ['1'],
};

// 预先计算离散朝向，游玩期间只读取占用格。
export const SHAPES = Object.fromEntries(Object.entries(patterns).map(([kind, rows]) => {
  let cells = rows.flatMap((row, y) => [...row].flatMap((value, x) => value === '1' ? [[x, y]] : []));
  const turns = [];
  for (let i = 0; i < 4; i++) {
    turns.push(cells);
    const rotated = cells.map(([x, y]) => [-y, x]);
    const left = Math.min(...rotated.map(cell => cell[0]));
    const top = Math.min(...rotated.map(cell => cell[1]));
    cells = rotated.map(([x, y]) => [x - left, y - top]);
  }
  return [kind, turns];
}));

export function dropInterval(speed) {
  return speed <= 7 ? SPEEDS[speed - 1] : Math.max(35, Math.round(150 * 0.82 ** (speed - 7)));
}

export function cellsOf(piece) { return SHAPES[piece.kind][piece.rotation]; }
