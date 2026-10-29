import { APP_VERSION, GAME, MODES, STORAGE_KEY } from './config.js';
import { SurvivalGame } from './game.js';
import { FlightInput } from './input.js';
import { FlightAudio } from './audio.js';
import { FlightReplay } from './replay.js';

const $ = id => document.getElementById(id);
const game = new SurvivalGame();
const input = new FlightInput($('joystick'));
const audio = new FlightAudio();
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const records = { practice: 0, normal: 0, expert: 0 };
const descriptions = { practice: '放慢节奏，先找到飞行的感觉。', normal: '经典节奏，20 秒见真章。', expert: '更快、更密，每一秒都不简单。' };
let view;
let suspendedState;
let lastFrame = 0;
let accumulator = 0;
let lastUI = 0;
let lastCount = GAME.countdown;
let bestAtStart = 0;
let noticeTimeout;
let layoutAnimation;
const replay = new FlightReplay(storageNotice);

function stopReplay() {
  const wasPlaying = replay.playing;
  replay.stop();
  if (wasPlaying) {
    $('overlay').hidden = false;
    updateHUD();
    view.render(game);
  }
}

function animateLayout(expanded) {
  const deck = document.querySelector('.flight-deck');
  const before = deck.getBoundingClientRect();
  layoutAnimation?.cancel();
  document.body.classList.toggle('flight-expanded', expanded);
  const after = deck.getBoundingClientRect();
  view.resize();
  // 仅变换现有画面，避免展开过程中逐帧重建绘制缓冲。
  layoutAnimation = deck.animate([
    { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})` },
    { transform: 'none' },
  ], { duration: (expanded ? GAME.expandDuration : GAME.collapseDuration) * 1000, easing: 'cubic-bezier(.22,.68,.2,1)', fill: 'both' });
  layoutAnimation.pause();
  layoutAnimation.currentTime = 0;
}

function updateLayoutAnimation() {
  if (!layoutAnimation) return;
  const expanded = document.body.classList.contains('flight-expanded');
  const duration = expanded ? GAME.expandDuration : GAME.collapseDuration;
  const elapsed = expanded ? GAME.countdown - game.countdown : GAME.collapseDuration - game.returnTime;
  layoutAnimation.currentTime = Math.min(duration, elapsed) * 1000;
  if (elapsed + 1e-8 >= duration) {
    layoutAnimation.cancel();
    layoutAnimation = null;
  }
}

function storageNotice() {
  $('storage-notice').hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { $('storage-notice').hidden = true; }, 3000);
}

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && typeof saved === 'object') {
    if (Object.hasOwn(MODES, saved.mode)) game.mode = saved.mode;
    if (typeof saved.sound === 'boolean') audio.enabled = saved.sound;
    for (const mode of Object.keys(MODES)) {
      const score = saved.records?.[mode];
      if (typeof score === 'number' && Number.isFinite(score) && score >= 0) records[mode] = score;
    }
  }
} catch { storageNotice(); }

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: game.mode, sound: audio.enabled, records })); }
  catch { storageNotice(); }
}

function updateSettings() {
  for (const button of modeButtons) {
    const selected = button.dataset.mode === game.mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = !['ready', 'over'].includes(game.state);
  }
  $('mode-description').textContent = descriptions[game.mode];
  $('mode-label').textContent = `${MODES[game.mode].label}模式`;
  $('best').textContent = records[game.mode].toFixed(2).padStart(5, '0');
  $('record-label').textContent = `${MODES[game.mode].label}模式 · ${records[game.mode] ? '你的最佳生存时间' : '等你刷新纪录'}`;
  $('sound').textContent = audio.enabled ? '♪' : '♪̸';
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').setAttribute('aria-label', audio.enabled ? '关闭音效' : '开启音效');
}

function updateHUD() {
  document.body.dataset.state = game.state;
  document.body.dataset.replay = String(replay.playing);
  $('replay-panel').hidden = !replay.playing;
  const display = replay.playing ? replay.model : game;
  const controlsReady = game.state === 'playing' || (game.state === 'countdown' && game.countdown <= GAME.countdown - GAME.expandDuration + 1e-8);
  document.body.dataset.controls = String(controlsReady);
  document.querySelector('.sidebar').inert = !['ready', 'over'].includes(game.state);
  const [integer, decimal] = display.time.toFixed(2).padStart(5, '0').split('.');
  $('timer').innerHTML = `${integer}<span>.${decimal}</span>`;
  $('bullet-count').textContent = String(display.count).padStart(3, '0');
  $('progress').style.width = `${Math.min(100, display.time / GAME.goal * 100)}%`;
  $('progress').setAttribute('aria-valuenow', String(Math.min(20, Math.floor(display.time))));
  $('flight-status').textContent = replay.playing ? '上次飞行回放' : { ready: '待命中', countdown: '准备起飞', playing: '飞行中', paused: '已暂停', returning: '挑战失败', over: '挑战失败' }[game.state];
  $('mode-label').textContent = `${MODES[replay.playing ? replay.clip.mode : game.mode].label}模式`;
  $('stage-label').textContent = replay.playing ? '回放中 · 随时可以开始挑战' : game.state === 'ready' ? '等待起飞' : game.state === 'over' ? '下一次，飞得更远' : game.time >= 20 ? '目标达成 · 突破极限' : game.time >= 10 ? '弹幕加密 · 保持专注' : '初始空域 · 留意四周';
  $('countdown').hidden = game.state !== 'countdown';
  if (game.state === 'countdown') {
    $('countdown').querySelector('strong').textContent = Math.ceil(game.countdown);
    $('countdown').querySelector('span').textContent = controlsReady ? '可以移动' : '空域展开中';
  }
  $('milestone').hidden = game.state !== 'playing' || game.time < 20 || game.time > 22;
  $('pause').disabled = ['ready', 'returning', 'over'].includes(game.state);
  if (view) $('start').disabled = game.state === 'returning';
  $('pause').innerHTML = game.state === 'paused' ? '▷ <span>继续</span>' : 'Ⅱ <span>暂停</span>';
  $('pause').setAttribute('aria-label', game.state === 'paused' ? '继续游戏' : '暂停游戏');
}

function start() {
  if (!view) return;
  if (game.state === 'paused') { resume(); return; }
  if (!['ready', 'over'].includes(game.state)) return;
  stopReplay();
  replay.resetRecording();
  input.clear();
  audio.unlock();
  audio.tone('count');
  bestAtStart = records[game.mode];
  game.reset();
  updateHUD();
  animateLayout(true);
  view.explosionTime = 1;
  accumulator = 0;
  lastCount = GAME.countdown;
  $('overlay').hidden = true;
  $('arena').focus({ preventScroll: true });
  updateSettings();
  updateHUD();
}

function pause() {
  if (!['playing', 'countdown'].includes(game.state)) return;
  suspendedState = game.state;
  game.state = 'paused';
  input.clear();
  accumulator = 0;
  $('overlay-tag').textContent = 'TAKE A BREATH';
  $('overlay-title').textContent = '空域已暂停';
  $('overlay-description').textContent = '调整呼吸，准备好再回到飞行。';
  $('result-details').hidden = true;
  $('start').querySelector('span').textContent = '继续飞行';
  $('start-hint').innerHTML = '按 <kbd>ESC</kbd> 或 <kbd>SPACE</kbd> 继续';
  $('overlay').hidden = false;
  updateHUD();
  view.render(game);
}

function resume() {
  if (game.state !== 'paused') return;
  game.state = suspendedState;
  input.clear();
  accumulator = 0;
  lastFrame = performance.now();
  audio.unlock();
  $('overlay').hidden = true;
  $('arena').focus({ preventScroll: true });
  updateHUD();
}

function finish() {
  input.clear();
  replay.finishRecording(game);
  game.state = 'returning';
  game.returnTime = GAME.collapseDuration;
  audio.tone('hit');
  view.burst(game.player.x, game.player.y);
  updateHUD();
  animateLayout(false);
  const newBest = game.time > bestAtStart;
  records[game.mode] = Math.max(records[game.mode], game.time);
  save();
  updateSettings();
  $('overlay-tag').textContent = newBest ? 'NEW PERSONAL BEST' : 'FLIGHT REPORT';
  $('overlay-title').textContent = '挑战失败';
  $('overlay-description').textContent = game.crossedGoal ? '已达成20秒目标，继续挑战更长纪录。' : '调整一下，再飞一次。';
  $('result-details').innerHTML = `<div><strong>${game.time.toFixed(2)}s</strong>生存时间</div><div><strong>${game.dodged}</strong>避开子弹</div><div><strong>${MODES[game.mode].label}</strong>飞行难度</div>`;
  $('result-details').hidden = false;
  $('start').querySelector('span').textContent = '再次挑战';
  $('start-hint').textContent = '正在返回…';
  $('overlay').hidden = false;
  updateHUD();
}

for (const button of modeButtons) button.addEventListener('click', () => {
  if (!['ready', 'over'].includes(game.state)) return;
  stopReplay();
  game.mode = button.dataset.mode;
  updateSettings();
  save();
});
$('start').addEventListener('click', start);
$('replay-start').addEventListener('click', start);
$('pause').addEventListener('click', () => game.state === 'paused' ? resume() : pause());
$('sound').addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  if (audio.enabled) { audio.unlock(); audio.tone('count'); }
  updateSettings();
  save();
});
window.addEventListener('keydown', event => {
  if (event.repeat || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (event.code === 'Escape') {
    event.preventDefault();
    if (replay.playing) { stopReplay(); return; }
    if (game.state === 'paused') resume(); else pause();
  } else if (event.code === 'Space' && !event.target.closest('button,a')) {
    event.preventDefault();
    start();
  }
});
window.addEventListener('blur', () => { stopReplay(); input.clear(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopReplay(); input.clear(); pause(); } });
$('arena').tabIndex = -1;
$('progress').setAttribute('role', 'progressbar');
$('progress').setAttribute('aria-label', '20秒挑战进度');
$('progress').setAttribute('aria-valuemin', '0');
$('progress').setAttribute('aria-valuemax', String(GAME.goal));
$('version').textContent = `LAST VECTOR / ${APP_VERSION}`;
updateSettings();
updateHUD();

function frame(now) {
  const dt = Math.min(GAME.maxFrame, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (['playing', 'countdown', 'returning'].includes(game.state)) {
    accumulator += dt;
    const movement = input.read();
    while (accumulator >= GAME.step) {
      const previousState = game.state;
      const previousGoal = game.crossedGoal;
      game.step(GAME.step, movement);
      accumulator -= GAME.step;
      if (game.state === 'playing') replay.capture(game);
      if (game.state === 'over' && previousState === 'playing') { finish(); accumulator = 0; break; }
      if (game.state === 'over' && previousState === 'returning') {
        updateSettings();
        $('start-hint').innerHTML = '按 <kbd>SPACE</kbd> 再飞一次';
        updateHUD();
        accumulator = 0;
        break;
      }
      if (!previousGoal && game.crossedGoal) audio.tone('goal');
      if (previousState === 'countdown') {
        const count = Math.ceil(game.countdown);
        if (count !== lastCount) { audio.tone('count'); lastCount = count; }
      }
    }
    updateLayoutAnimation();
    view.render(game, dt);
    if (now - lastUI > 50) { updateHUD(); lastUI = now; }
  } else if (['ready', 'over'].includes(game.state) && !document.hidden && document.hasFocus()) {
    const wasPlaying = replay.playing;
    replay.advance(dt);
    if (wasPlaying !== replay.playing) {
      $('overlay').hidden = replay.playing;
      if (replay.playing) view.explosionTime = 1;
      updateHUD();
    }
    if (replay.playing) {
      view.render(replay.model);
      if (now - lastUI > 50) { updateHUD(); lastUI = now; }
    } else if (wasPlaying || (game.state === 'over' && view.explosionTime < 1)) view.render(game, dt);
  }
  requestAnimationFrame(frame);
}

try {
  const { FlightScene } = await import('./scene.js');
  view = new FlightScene($('scene'), game);
  view.render(game);
  await view.renderer.compileAsync(view.scene, view.camera);
  $('start').disabled = false;
  $('start').querySelector('span').textContent = '开始挑战';
  lastFrame = performance.now();
  requestAnimationFrame(frame);
} catch (error) {
  console.error('Flight initialization failed', error);
  $('overlay-title').textContent = '暂时无法起飞';
  $('overlay-description').textContent = '请确认依赖已安装，并使用支持 WebGL 2 的浏览器打开游戏。';
  $('start').querySelector('span').textContent = '刷新重试';
  $('start').disabled = false;
  $('start-hint').textContent = '请通过 npm start 启动，避免直接打开 HTML 文件。';
  $('start').addEventListener('click', () => location.reload());
}
