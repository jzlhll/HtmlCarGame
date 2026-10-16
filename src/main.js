import { GAME, FLIGHT_PHASES } from './config.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { GameRenderer } from './render.js';
import { FlightAudio } from './audio.js';

const moduleLoadedAt = performance.now();
const container = document.getElementById('game');
const game = new Game(new URLSearchParams(location.search).get('level'));
const worldPreparedAt = performance.now();
const input = new Input(container);
const ui = new UI(game, container);
const audio = new FlightAudio(container);
audio.update(game);
game.onEvent = event => audio.receive(event, game);

try {
  const renderer = new GameRenderer(document.getElementById('scene'), game.world);
  const sceneryPreparedAt = performance.now();
  let inFrame = false, uiNeedsRender = false;
  let previousPhase = game.phase, previouslyPaused = game.paused;
  let frameId = null, last = performance.now(), accumulator = 0;
  const frame = now => {
    frameId = null;
    if (ui.preparing) return;
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
      const renderUI = uiNeedsRender; uiNeedsRender = false;
      if (renderUI) ui.render();
      if (active && ((game.phase === 'INTRO' || FLIGHT_PHASES.includes(game.phase)) || (game.phase === 'STARTUP' && game.aircraft.systems.engine !== 'OFF'))) renderer.dirty = true;
      renderer.draw(game, accumulator);
      if (!renderUI) ui.update();
      audio.update(game);
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
    audio.update(game);
    if (game.phase !== previousPhase || game.paused !== previouslyPaused) {
      accumulator = 0;
      if (game.paused !== previouslyPaused || ['READY', 'INTRO', 'STARTUP', 'COMPLETE', 'RESULT'].includes(game.phase) || (previousPhase === 'STARTUP' && game.phase === 'TAKEOFF_ROLL')) input.clear();
      previousPhase = game.phase;
      previouslyPaused = game.paused;
    }
    uiNeedsRender = true;
    renderer.invalidate();
  };
  input.onCommand = action => {
    if (ui.error || ui.preparing) return;
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
  ui.setPreparing(true);
  renderer.draw(game);
  await renderer.prepare();
  ui.setPreparing(false);
  const scenePreparedAt = performance.now();
  const preparation = {totalMs: Math.round(scenePreparedAt), modulesMs: Math.round(moduleLoadedAt),
    worldMs: Math.round(worldPreparedAt - moduleLoadedAt), sceneryMs: Math.round(sceneryPreparedAt - worldPreparedAt),
    gpuMs: Math.round(scenePreparedAt - sceneryPreparedAt)};
  performance.measure('Flight scene preparation', {start: 0, end: scenePreparedAt});
  console.info('Scene prepared ' + JSON.stringify(preparation));
  if (scenePreparedAt > GAME.scenePrepareLimitSeconds * 1000) console.warn('Scene preparation exceeded budget ' + JSON.stringify(preparation));
  renderer.resize();
  wake();
} catch (error) {
  console.error('WebGL initialization failed', error);
  ui.showError('请开启浏览器硬件加速后刷新页面，或使用支持 WebGL 的桌面浏览器。');
}
