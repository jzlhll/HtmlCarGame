import { SAVE_VERSION, WIDTH, HEIGHT, LOCK_DELAY, CLASSIC_PERIOD, PUZZLE_PERIOD, SHAPES, CLASSIC_KINDS, PUZZLE_KINDS } from './config.js';
import { Game } from './game.js';

const PREFIX = 'brick-time.';
const integer = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
const number = (value, low, high = Number.MAX_SAFE_INTEGER) => Number.isFinite(value) && value >= low && value <= high;

function validState(s, mode) {
  if (!s || s.mode !== mode || !['playing', 'paused', 'gameOver', 'completed'].includes(s.status)) return false;
  if (mode === 'puzzle' && s.status === 'completed') return false;
  const kinds = mode === 'classic' ? CLASSIC_KINDS : PUZZLE_KINDS;
  if (!Array.isArray(s.board) || s.board.length !== HEIGHT || s.board.some(row => !Array.isArray(row) || row.length !== WIDTH || row.some(value => value !== '' && value !== 'G' && !kinds.includes(value)))) return false;
  if (mode === 'classic' && s.board.some(row => row.includes('G'))) return false;
  if (!integer(s.initialSpeed, 1, 7) || !integer(s.speed, 1, 1000000) || !integer(s.level, 1, 7)) return false;
  if (mode === 'classic' && (s.initialSpeed !== 1 || s.speed !== s.level)) return false;
  if (mode === 'puzzle' && (s.level !== 1 || s.speed < s.initialSpeed)) return false;
  if (!number(s.elapsed, 0) || !number(s.periodElapsed, 0, mode === 'classic' ? CLASSIC_PERIOD : PUZZLE_PERIOD)) return false;
  if (!integer(s.score, 0, Number.MAX_SAFE_INTEGER) || !integer(s.lines, 0, Number.MAX_SAFE_INTEGER) || !integer(s.pieces, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!integer(s.rng, 1, 4294967295) || !Array.isArray(s.bag) || s.bag.length > kinds.length || new Set(s.bag).size !== s.bag.length || s.bag.some(kind => !kinds.includes(kind))) return false;
  if (!Array.isArray(s.queue) || s.queue.length !== 4 || s.queue.some(kind => !kinds.includes(kind))) return false;
  if (!number(s.fallElapsed, 0, 900) || !number(s.lockElapsed, 0, LOCK_DELAY + 20) || !integer(s.lockResets, 0, 15)) return false;
  if (!number(s.bonusRemaining, 0, 180000) || typeof s.bonusPending !== 'boolean') return false;
  if (s.bonusPending && s.bonusRemaining !== 0) return false;
  if (mode === 'classic' && (s.bonusPending || s.bonusRemaining !== 0)) return false;
  const a = s.active;
  if (!a || (!kinds.includes(a.kind) && !(mode === 'puzzle' && a.kind === 'bonus')) || !SHAPES[a.kind] || !integer(a.rotation, 0, 3) || !integer(a.x, 0, WIDTH - 1) || !integer(a.y, 0, HEIGHT - 1)) return false;
  const game = Object.create(Game.prototype);
  game.state = s;
  const inside = SHAPES[a.kind][a.rotation].every(([x, y]) => a.x + x < WIDTH && a.y + y < HEIGHT);
  return inside && (s.status === 'gameOver' || game.fits(a));
}

export function readSave(mode) {
  try {
    const raw = localStorage.getItem(PREFIX + 'save.' + mode);
    if (!raw) return { game: null };
    const data = JSON.parse(raw);
    if (data.format !== SAVE_VERSION || !number(data.savedAt, 0) || !validState(data.state, mode)) return { error: '存档损坏或版本不兼容，原数据已保留。' };
    const game = Object.create(Game.prototype);
    game.state = structuredClone(data.state);
    game.events = []; game.revision = 0;
    if (game.state.status === 'playing') game.state.status = 'paused';
    return { game, savedAt: data.savedAt };
  } catch {
    return { error: '无法读取本地存档，请检查浏览器存储权限。' };
  }
}

export function saveGame(game) {
  try {
    const state = structuredClone(game.state);
    if (state.status === 'ready') return { ok: false };
    if (state.status === 'playing') state.status = 'paused';
    const savedAt = Date.now();
    localStorage.setItem(PREFIX + 'save.' + state.mode, JSON.stringify({ format: SAVE_VERSION, savedAt, state }));
    return { ok: true, savedAt };
  } catch { return { ok: false, error: '保存失败，本局仍在。请允许本地存储后重试。' }; }
}

export function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(PREFIX + 'preferences') || '{}');
    return { mode: value.mode === 'puzzle' ? 'puzzle' : 'classic', sound: value.sound !== false };
  } catch { return { mode: 'classic', sound: true }; }
}

export function writePreferences(mode, sound) {
  try { localStorage.setItem(PREFIX + 'preferences', JSON.stringify({ mode, sound })); } catch { /* 设置失败不阻断当前局。 */ }
}
