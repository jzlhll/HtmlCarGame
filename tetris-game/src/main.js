import { APP_VERSION, SHAPES, CLASSIC_PERIOD, PUZZLE_PERIOD } from './config.js';
import { Game } from './game.js';
import { BoardView } from './scene.js';
import { readSave, saveGame, readPreferences, writePreferences } from './storage.js';

const $ = id => document.getElementById(id);
const preferences = readPreferences();
let mode = preferences.mode, soundEnabled = preferences.sound;
const sessions = new Map();
let game, view, prepared = false, lastFrame = 0, frameId = 0;
let soundContext, toastTimer, messageTimer, lastHud = 0, previewKind = '';
let savedAt = 0, saveError = '', loadError = '';
const held = new Map();
const modeName = () => mode === 'classic' ? '经典七关' : '无尽残局';
const formatTime = value => {
  const seconds = Math.max(0, Math.ceil(value / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.toggle('error', error);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 7000 : 3200);
}

function tone(type) {
  if (!soundEnabled) return;
  try {
    soundContext ||= new (window.AudioContext || window.webkitAudioContext)();
    void soundContext.resume().catch(() => {});
    const now = soundContext.currentTime;
    const notes = type === 'clear' || type === 'starClear' ? [523, 659, 784] : type === 'speed' ? [440, 660] : type === 'completed' ? [523, 659, 784, 1046] : type === 'gameOver' ? [330, 220, 165] : [type === 'rotate' ? 440 : 200];
    notes.forEach((frequency, index) => {
      const oscillator = soundContext.createOscillator(), gain = soundContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      oscillator.connect(gain); gain.connect(soundContext.destination);
      const start = now + index * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.start(start); oscillator.stop(start + 0.13);
    });
  } catch { /* 音频不可用时保留完整玩法。 */ }
}

function showMessage(text) {
  clearTimeout(messageTimer);
  $('board-message').textContent = text;
  $('board-message').hidden = false;
  messageTimer = setTimeout(() => { $('board-message').hidden = true; }, 1700);
}

function persist() {
  const result = saveGame(game);
  if (result.ok) { savedAt = result.savedAt; saveError = ''; loadError = ''; }
  else if (result.error) {
    const changed = saveError !== result.error;
    saveError = result.error;
    if (changed) toast(result.error, true);
  }
  return result.ok;
}

function clearInput() { held.clear(); }

function pause(announce = true) {
  if (!game) return;
  clearInput();
  if (game.state.status === 'playing') {
    game.state.status = 'paused'; game.revision++;
    persist();
    if (announce && !saveError) toast('已暂停并保存，随时回来接着玩。');
  } else if (game.state.status === 'paused' && saveError) persist();
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  updateHud(); view?.draw();
}

function start() {
  if (!prepared || $('restart-dialog').open) return;
  if (['gameOver', 'completed'].includes(game.state.status)) { newGame(); return; }
  if (game.state.status === 'playing') return;
  tone('start');
  game.state.status = 'playing'; game.revision++;
  clearInput();
  persist();
  lastFrame = performance.now();
  updateHud();
  if (!frameId) frameId = requestAnimationFrame(frame);
}

function consumeEvents() {
  let checkpoint = false;
  for (const event of game.events.splice(0)) {
    if (event === 'checkpoint') { checkpoint = true; continue; }
    if (['lock', 'clear', 'starClear', 'speed', 'completed', 'gameOver'].includes(event)) tone(event);
    if (event === 'clear') showMessage('漂亮！消掉一行烦恼。');
    if (event === 'starClear') showMessage('★ BONUS · 整行消除');
    if (event === 'speed') showMessage(mode === 'classic' ? `第 ${game.state.level} 关 · 继续加油` : `速度 ${game.state.speed} · 挑战继续`);
    if (event === 'bonus') showMessage('★ 五角星来了！可以穿过堆叠');
    if (event === 'bonusReady') toast('★ BONUS 已就绪，下一块是五角星。');
    if (event === 'noSpace') toast('这一列下方没有空位，左右移动寻找空洞。');
  }
  if (checkpoint) persist();
}

function action(name) {
  if (game.state.status !== 'playing') return;
  if (name === 'left') game.move(-1);
  if (name === 'right') game.move(1);
  if (name === 'rotate' && game.rotate()) tone('rotate');
  if (name === 'reverse' && game.rotate(-1)) tone('rotate');
  if (name === 'drop') game.hardDrop();
  consumeEvents(); updateHud(); view.draw();
}

function frame(now) {
  frameId = 0;
  if (game.state.status !== 'playing') return;
  const elapsed = now - lastFrame;
  lastFrame = now;
  if (elapsed > 1500) { pause(false); toast('画面曾中断，已为你暂停并保存。'); return; }
  for (let remaining = elapsed; remaining > 0 && game.state.status === 'playing';) {
    const dt = Math.min(remaining, 16);
    for (const [name, key] of held) {
      if (name === 'soft') continue;
      key.elapsed += dt;
      while (key.elapsed >= key.next) { game.move(name === 'left' ? -1 : 1); key.next += 65; }
    }
    game.step(dt, held.has('soft'));
    remaining -= dt;
  }
  consumeEvents();
  if (now - lastHud > 100 || game.state.status !== 'playing') { updateHud(); lastHud = now; }
  view.draw();
  if (game.state.status === 'playing') frameId = requestAnimationFrame(frame);
  else { clearInput(); updateHud(); }
}

function updatePreview() {
  const kind = game.state.bonusPending ? 'bonus' : game.state.queue[0];
  if (previewKind === kind) return;
  previewKind = kind;
  const host = $('next-piece');
  host.replaceChildren();
  if (kind === 'bonus') {
    const star = document.createElement('span'); star.className = 'piece-star'; star.textContent = '★'; host.append(star);
  } else {
    const cells = SHAPES[kind][0], width = Math.max(...cells.map(cell => cell[0])) + 1, height = Math.max(...cells.map(cell => cell[1])) + 1;
    const grid = document.createElement('div'); grid.className = 'piece-grid'; grid.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const cell = document.createElement('span'); cell.className = 'piece-cell' + (cells.some(point => point[0] === x && point[1] === y) ? '' : ' empty'); grid.append(cell);
    }
    host.append(grid);
  }
  host.setAttribute('aria-label', kind === 'bonus' ? '下一块：五角星 BONUS' : `下一块：${kind}`);
  $('next-label').textContent = kind === 'bonus' ? '★ 穿透堆叠，落定消行' : '新的可能，正在路上。';
}

function updateHud() {
  const s = game.state, playing = s.status === 'playing';
  $('score').textContent = String(s.score).padStart(6, '0');
  $('lines').textContent = String(s.lines).padStart(3, '0');
  $('speed').textContent = String(s.speed).padStart(2, '0');
  $('status-label').textContent = ({ ready: '准备就绪', playing: '专注当下', paused: '已暂停', gameOver: '本局结束', completed: '恭喜通关' })[s.status];
  $('power-light').classList.toggle('playing', playing);
  $('machine-mode').textContent = mode === 'classic' ? `CLASSIC / ${String(s.level).padStart(2, '0')}` : 'ENDLESS / ∞';
  $('progress-label').textContent = mode === 'classic' ? '当前关卡' : '生存挑战';
  $('progress-value').textContent = mode === 'classic' ? `${s.level} / 7` : '∞';
  $('time-label').textContent = mode === 'classic' ? '本关剩余时间' : '本局生存时间';
  $('time-value').textContent = formatTime(mode === 'classic' ? CLASSIC_PERIOD - s.periodElapsed : s.elapsed);
  const period = mode === 'classic' ? CLASSIC_PERIOD : PUZZLE_PERIOD;
  $('time-progress').style.width = `${s.periodElapsed / period * 100}%`;
  $('bonus-status').textContent = s.bonusPending ? '★ 下一块已安排五角星' : `距离下次 BONUS ${formatTime(s.bonusRemaining)}`;
  $('screen-caption').textContent = mode === 'classic' ? '七关好时光 · 每关两分钟' : `距离下次提速 ${formatTime(PUZZLE_PERIOD - s.periodElapsed)}`;
  $('pause').disabled = !prepared || !['playing', 'paused'].includes(s.status);
  $('pause').setAttribute('aria-label', playing ? '暂停并保存' : '继续游戏');
  $('pause').innerHTML = playing ? 'Ⅱ <span>暂停 / 保存</span>' : '▷ <span>继续游戏</span>';
  $('overlay').hidden = playing;
  $('start').disabled = !prepared;
  $('initial-speed').disabled = !prepared;
  const title = $('overlay-title'), description = $('overlay-description');
  $('overlay-icon').textContent = s.status === 'completed' ? '✳' : mode === 'classic' ? '▦' : '✦';
  if (s.status === 'ready') {
    title.innerHTML = mode === 'classic' ? '好时光，<br>从这一块开始。' : '残局开场，<br>好戏没有终点。';
    description.textContent = loadError || (mode === 'classic' ? '七种经典方块，七关小小挑战。' : '六行随机残局，和一颗穿透的星。');
  } else if (s.status === 'paused') {
    title.innerHTML = '歇一歇，<br>好时光还在。';
    description.textContent = saveError || (savedAt ? '进度已保存，回来就能接着玩。' : '继续这一局，找到下一块的位置。');
  } else if (s.status === 'gameOver') {
    title.innerHTML = '这一局，<br>也很精彩。';
    description.textContent = `${s.score} 分 · 消除 ${s.lines} 行 · 游玩 ${formatTime(s.elapsed)}`;
  } else if (s.status === 'completed') {
    title.innerHTML = '恭喜通关！';
    description.textContent = `七关全部完成 · ${s.score} 分 · 消除 ${s.lines} 行`;
  }
  $('overlay-kicker').textContent = ({ ready: 'READY WHEN YOU ARE', paused: 'TAKE A LITTLE BREAK', gameOver: 'ONE MORE GOOD TIME', completed: 'SEVEN LEVELS. WELL PLAYED.' })[s.status] || '';
  const buttonText = !prepared ? '准备画面中…' : s.status === 'paused' ? '继续这一局' : s.status === 'ready' ? loadError ? '确认并开始新局' : '开始游戏' : '再来一局';
  $('start').innerHTML = `${buttonText} <span>→</span>`;
  $('overlay-hint').textContent = s.status === 'paused' ? '按 Enter 或 P 继续 · 进度随暂停保存' : '按 Enter 开始 · 暂停自动保存';
  $('save-status').classList.toggle('error', Boolean(saveError || loadError));
  $('save-status').textContent = saveError || loadError || (savedAt ? `◇ 已保存 ${new Date(savedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '◇ 暂停时自动保存进度');
  updatePreview();
}

function selectMode(nextMode) {
  if (game && nextMode === mode) return;
  if (game) { pause(false); sessions.set(mode, { game, savedAt, saveError, loadError }); }
  mode = nextMode;
  let session = sessions.get(mode);
  if (!session) {
    const loaded = readSave(mode);
    session = { game: loaded.game || new Game(mode, Number($('initial-speed').value)), savedAt: loaded.savedAt || 0, loadError: loaded.error || '', saveError: '' };
  }
  ({ game, savedAt, saveError, loadError } = session);
  previewKind = '';
  $('speed-section').hidden = mode !== 'puzzle';
  $('bonus-card').hidden = mode !== 'puzzle';
  document.querySelectorAll('[data-mode]').forEach(button => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
  view?.setGame(game);
  updateHud(); view?.draw();
  writePreferences(mode, soundEnabled);
}

function newGame() {
  if (!prepared) return;
  pause(false);
  $('restart-dialog').showModal();
}

$('restart-dialog').addEventListener('close', () => {
  clearInput();
  if ($('restart-dialog').returnValue !== 'restart') return;
  game = new Game(mode, Number($('initial-speed').value));
  savedAt = 0; saveError = ''; loadError = ''; previewKind = '';
  sessions.set(mode, { game, savedAt, saveError, loadError });
  view.setGame(game);
  start();
});
$('start').addEventListener('click', () => {
  if (loadError) { newGame(); return; }
  start();
});
$('pause').addEventListener('click', () => game.state.status === 'playing' ? pause() : start());
$('new-game').addEventListener('click', newGame);
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => selectMode(button.dataset.mode)));
$('initial-speed').addEventListener('input', () => {
  $('initial-speed-label').textContent = String($('initial-speed').value).padStart(2, '0');
  if (game.state.status === 'ready') {
    game = new Game(mode, Number($('initial-speed').value)); view?.setGame(game); updateHud(); view?.draw();
  }
});
$('sound').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('sound').setAttribute('aria-pressed', String(soundEnabled));
  $('sound').setAttribute('aria-label', soundEnabled ? '关闭音效' : '开启音效');
  $('sound').innerHTML = `♫ <span>音效${soundEnabled ? '开' : '关'}</span>`;
  writePreferences(mode, soundEnabled);
  if (soundEnabled) tone('rotate');
});
const keyActions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'soft', ArrowUp: 'rotate', KeyX: 'rotate', KeyZ: 'reverse', Space: 'drop' };
document.addEventListener('keydown', event => {
  if ($('restart-dialog').open || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target.matches('input,select,textarea')) return;
  const name = keyActions[event.code];
  if (['Escape', 'KeyP', 'Enter'].includes(event.code)) {
    event.preventDefault();
    if (event.repeat) return;
    if (game.state.status === 'playing') { if (event.code !== 'Enter') pause(); }
    else if (loadError) newGame(); else start();
    return;
  }
  if (!name) return;
  event.preventDefault();
  if (event.repeat || game.state.status !== 'playing') return;
  if (['left', 'right', 'soft'].includes(name)) {
    held.set(name, { elapsed: 0, next: 170, source: 'keyboard' });
  }
  action(name);
});
document.addEventListener('keyup', event => { const name = keyActions[event.code]; if (name && held.get(name)?.source === 'keyboard') held.delete(name); });
document.querySelectorAll('[data-action]').forEach(button => {
  const name = button.dataset.action;
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (game.state.status !== 'playing') return;
    button.setPointerCapture(event.pointerId);
    if (['left', 'right', 'soft'].includes(name)) held.set(name, { elapsed: 0, next: 170, source: event.pointerId });
    action(name);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => {
    if (held.get(name)?.source === event.pointerId) held.delete(name);
  });
  button.addEventListener('contextmenu', event => event.preventDefault());
});
window.addEventListener('blur', () => pause(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(false); });
window.addEventListener('pagehide', () => pause(false));
window.addEventListener('resize', () => view?.resize());
$('version').textContent = `v${APP_VERSION}`;
$('sound').setAttribute('aria-pressed', String(soundEnabled));
$('sound').setAttribute('aria-label', soundEnabled ? '关闭音效' : '开启音效');
$('sound').innerHTML = `♫ <span>音效${soundEnabled ? '开' : '关'}</span>`;
selectMode(mode);

async function prepare() {
  const began = performance.now();
  try {
    let previousVersion = null;
    try { previousVersion = localStorage.getItem('brick-time.prepared-version'); } catch { /* 存储不可用时仅完成本会话准备。 */ }
    if (previousVersion && previousVersion !== APP_VERSION) {
      $('overlay-title').textContent = '版本升级';
      $('overlay-description').textContent = '正在准备新版画面，原有进度会保留。';
    }
    view = new BoardView($('scene'), game);
    view.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); pause(false); prepared = false; updateHud(); toast('画面暂时中断，进度已尝试保存，正在等待恢复。', true);
    });
    view.renderer.domElement.addEventListener('webglcontextrestored', () => {
      prepared = true; view.dirty = true; view.lastRevision = -1; view.draw(); updateHud(); toast('画面已恢复，可以继续这一局。');
    });
    await view.prepare();
    try { localStorage.setItem('brick-time.prepared-version', APP_VERSION); }
    catch { toast('本地存储不可用，当前画面已准备好；进度可能无法保存。', true); }
    prepared = true;
    updateHud();
    console.info('Board prepared ' + JSON.stringify({ milliseconds: Math.round(performance.now() - began), geometries: view.renderer.info.memory.geometries, calls: view.renderer.info.render.calls }));
  } catch (error) {
    console.error('Board preparation failed', error);
    $('overlay-title').textContent = '画面暂时无法启动';
    $('overlay-description').textContent = '请使用支持 WebGL 2 的浏览器，并开启硬件加速后刷新。';
    $('start').textContent = '画面不可用'; $('start').disabled = true;
    toast('无法初始化 Three.js 画面，已有存档已保留。', true);
  }
}
void prepare();
