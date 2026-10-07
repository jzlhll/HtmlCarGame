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
  let frameId = null, last = performance.now(), accumulator = 0;
  const frame = now => {
    frameId = null;
    const dt = Math.min(GAME.maxFrameSeconds, (now - last) / 1000);
    last = now;
    const active = game.phase === 'PREVIEW' && !game.paused && !renderer.contextLost;
    if (active) {
      accumulator += dt;
      while (accumulator >= GAME.fixedStep) {
        game.step(GAME.fixedStep);
        accumulator -= GAME.fixedStep;
      }
    } else accumulator = 0;
    try {
      renderer.draw(game);
      ui.update();
    } catch (error) {
      console.error('Scene update failed', error);
      game.pause();
      ui.showError('请刷新页面重试，并确认浏览器已开启硬件加速。');
      return;
    }
    if (active) frameId = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (frameId !== null) return;
    last = performance.now();
    frameId = requestAnimationFrame(frame);
  };
  renderer.onInvalidate = wake;
  game.onChange = () => {
    accumulator = 0;
    input.clear();
    ui.render();
    renderer.invalidate();
  };
  input.onCommand = action => {
    if (action === 'space' && !ui.error) game.space();
  };
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
