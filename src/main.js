import { GAME } from './config.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { GameRenderer } from './render.js';

const container = document.getElementById('game');
const game = new Game();
const input = new Input(container);
const ui = new UI(game, container);

try {
  const renderer = new GameRenderer(document.getElementById('scene'));
  let inFrame = false;
  let previousPhase = game.phase, previouslyPaused = game.paused;
  let frameId = null, last = performance.now(), accumulator = 0;
  const frame = now => {
    frameId = null;
    inFrame = true;
    const dt = Math.min(GAME.maxFrameSeconds, (now - last) / 1000);
    last = now;
    const active = game.active && !renderer.contextLost;
    if (active) {
      accumulator += dt;
      while (accumulator >= GAME.fixedStep) {
        accumulator -= GAME.fixedStep;
        game.step(GAME.fixedStep, input.held);
      }
    } else accumulator = 0;
    try {
      if (active && (['INTRO', 'TAKEOFF_ROLL', 'INITIAL_CLIMB'].includes(game.phase) || (game.phase === 'STARTUP' && game.aircraft.systems.engine !== 'OFF'))) renderer.dirty = true;
      renderer.draw(game, accumulator);
      ui.update();
    } catch (error) {
      inFrame = false;
      console.error('Scene update failed', error);
      game.pause();
      ui.showError('请刷新页面重试，并确认浏览器已开启硬件加速。');
      return;
    }
    inFrame = false;
    if (game.active && !renderer.contextLost) frameId = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (frameId !== null || inFrame) return;
    last = performance.now();
    frameId = requestAnimationFrame(frame);
  };
  renderer.onInvalidate = wake;
  game.onChange = () => {
    if (game.phase !== previousPhase || game.paused !== previouslyPaused) {
      accumulator = 0;
      if (game.paused !== previouslyPaused || ['READY', 'INTRO', 'STARTUP', 'COMPLETE', 'RESULT'].includes(game.phase) || (previousPhase === 'STARTUP' && game.phase === 'TAKEOFF_ROLL')) input.clear();
      previousPhase = game.phase;
      previouslyPaused = game.paused;
    }
    ui.render();
    renderer.invalidate();
  };
  input.onCommand = action => {
    if (ui.error) return;
    if (action === 'space') game.space();
    else if (action !== 'T' || !input.held.has('S')) game.command(action);
  };
  input.onActivity = () => game.dismissStartupHint();
  input.onBlur = () => game.pause();
  renderer.onContextLost = () => {
    game.pause();
    ui.showError('画面连接已中断，正在等待浏览器恢复。');
  };
  renderer.onContextRestored = () => ui.clearError();
  wake();
} catch (error) {
  console.error('WebGL initialization failed', error);
  ui.showError('请开启浏览器硬件加速后刷新页面，或使用支持 WebGL 的桌面浏览器。');
}
