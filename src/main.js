import { GAME, FLIGHT, FLIGHT_PHASES, AIRCRAFT, SURFACE_APPEARANCE } from './config.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { GameRenderer } from './render.js';
import { FlightAudio } from './audio.js';
import { APP_VERSION, VersionUpgrade } from './version.js';
import { prepareSurfaceAssets, setSurfacePreparationUrgent, prepareSurfaceDetails, surfaceGenerationStats, surfaceCache } from './surface-assets.js';

const moduleLoadedAt = performance.now(), container = document.getElementById('game');
const game = new Game(new URLSearchParams(location.search).get('level'));
const worldPreparedAt = performance.now(), input = new Input(container), ui = new UI(game, container), audio = new FlightAudio(container);
let renderer, details, sceneReady, scenePrepared = false, enterPending = false, startupReady = false, startupRunning = false;
const versionUpgrade = new VersionUpgrade(surfaceCache(game.route.id), ui);
let preparationRun = game.runId, hasAccelerated = false, lastGenerationAllowed;
let inFrame = false, uiNeedsRender = false, frameId = null, last = performance.now(), accumulator = 0;
let previousPhase = game.phase, previouslyPaused = game.paused, controlRequestedAt;
audio.update(game); game.onEvent = event => audio.receive(event, game);

function detailAllowed() {
  if (!renderer || renderer.contextLost || ui.error || document.hidden) return false;
  if (game.paused || game.phase === 'RESULT') return true;
  return !hasAccelerated && game.aircraft.onGround && ['READY','INTRO','STARTUP','TAKEOFF_ROLL'].includes(game.phase);
}

function updateGenerationWindow(reason) {
  if (preparationRun !== game.runId) { preparationRun = game.runId; hasAccelerated = false; }
  const a = game.aircraft;
  if (!game.paused && (input.held.has('T') || a.airspeed > 0.001*FLIGHT.kmhPerMps || Math.hypot(a.velocity.x,a.velocity.y,a.velocity.z) > 0.001
      || ['x','y','z'].some(axis => Math.abs(a.position[axis]-AIRCRAFT.initialPosition[axis]) > 0.001))) hasAccelerated = true;
  if (!details) return;
  const allowed = detailAllowed();
  if (allowed) details.resume(); else details.pause();
  if (lastGenerationAllowed !== allowed) {
    lastGenerationAllowed = allowed;
    console.info('Generation window changed ' + JSON.stringify({allowed, reason, phase:game.phase, runId:game.runId, accelerated:hasAccelerated, workerActive:surfaceGenerationStats().workerActive, detail:details.snapshot()}));
  }
}

function wake() {
  if (frameId !== null || inFrame || !renderer || !scenePrepared) return;
  last = performance.now(); frameId = requestAnimationFrame(frame);
}

function frame(now) {
  frameId = null;
  if (ui.preparing || !scenePrepared) return;
  inFrame = true;
  const dt = Math.min(GAME.maxFrameSeconds,(now-last)/1000); last=now;
  const active = game.active && !renderer.contextLost;
  if (active && details) details.sliceMs = Math.min(SURFACE_APPEARANCE.generationSliceMs,dt>0.022?SURFACE_APPEARANCE.generationSliceMs/2:Math.max(1.5,dt*250));
  updateGenerationWindow('frame');
  if (active) {
    accumulator += dt;
    while (accumulator >= GAME.fixedStep) { accumulator -= GAME.fixedStep; game.step(GAME.fixedStep,input.held); }
  } else accumulator=0;
  updateGenerationWindow('movement');
  try {
    const renderUI=uiNeedsRender; uiNeedsRender=false;
    if (renderUI) ui.render();
    if (active && (game.phase==='INTRO' || game.phase==='CRASH' || FLIGHT_PHASES.includes(game.phase) || (game.phase==='STARTUP' && game.aircraft.systems.engine!=='OFF'))) renderer.dirty=true;
    renderer.draw(game,accumulator); if (!renderUI) ui.update(); audio.update(game);
    if (controlRequestedAt!==undefined && game.phase==='STARTUP') {
      const milliseconds=Math.round(performance.now()-controlRequestedAt);
      console.info('Flight control ready ' + JSON.stringify({totalMs:milliseconds,runId:game.runId,level:game.route.id}));
      if (milliseconds>GAME.scenePrepareLimitSeconds*1000) console.warn('Flight preparation exceeded budget ' + milliseconds);
      controlRequestedAt=undefined;
    }
  } catch (error) {
    console.error('Scene update failed',error); game.pause(); details?.pause();
    ui.showError('请刷新页面重试，并确认浏览器已开启硬件加速。'); inFrame=false; return;
  }
  inFrame=false;
  if (game.active && !renderer.contextLost) frameId=requestAnimationFrame(frame);
}

game.onChange = () => {
  updateGenerationWindow('state'); audio.update(game);
  if (game.phase!==previousPhase || game.paused!==previouslyPaused) {
    accumulator=0;
    if (game.paused!==previouslyPaused || ['READY','INTRO','STARTUP','CRASH','COMPLETE','RESULT'].includes(game.phase) || (previousPhase==='STARTUP' && game.phase==='TAKEOFF_ROLL')) input.clear();
    previousPhase=game.phase; previouslyPaused=game.paused;
  }
  uiNeedsRender=true;
  if (game.phase==='READY') ui.render();
  renderer?.invalidate();
};

async function requestEnter() {
  if (!startupReady || ui.upgrading || ui.error || enterPending || game.phase!=='READY') return;
  enterPending=true; controlRequestedAt=performance.now();
  try {
    if (!scenePrepared) { ui.setPreparing(true,0); setSurfacePreparationUrgent(); await prepareScene(); }
    details?.pause(); ui.setPreparing(false);
    console.info('Flight loading completed ' + JSON.stringify({loadingMs:Math.round(performance.now()-controlRequestedAt),runId:game.runId}));
    game.enterCockpit();
  } catch (error) {
    console.error('Scene initialization failed',error); ui.showError('场景加载失败，请刷新页面重试，并确认浏览器已开启硬件加速。');
  } finally { enterPending=false; }
}

ui.onEnter=requestEnter;
input.onCommand = action => {
  if (!startupReady || ui.upgrading || ui.error || ui.preparing) return;
  if (action==='space') {
    if (game.phase==='READY') void requestEnter();
    else { details?.pause(); game.space(); }
  } else {
    if (action==='T' && !game.paused && ['STARTUP','TAKEOFF_ROLL'].includes(game.phase)) {
      hasAccelerated=true; details?.pause(); updateGenerationWindow('thrust');
    }
    if (action!=='T' || !input.held.has('S')) game.command(action);
  }
};
input.onActivity=()=>game.dismissStartupHint(); input.onBlur=()=>game.pause();
window.addEventListener('pagehide',()=>details?.pause());
document.addEventListener('visibilitychange',()=>updateGenerationWindow('visibility'));
window.addEventListener('pageshow',()=>updateGenerationWindow('visible'));

function ensureDetails() {
  details=prepareSurfaceDetails({allowed:detailAllowed,upload:(texture,previous)=>renderer.prepareSurfaceTexture(previous,texture)});
  details.onProgress=stats=>versionUpgrade.progress(50+Math.round((stats.completed||0)/stats.total*45),'正在分批更新精细纹理并保存。');
  void details.done.then(stats=>console.info('Detail quality ready ' + JSON.stringify({...stats,...surfaceGenerationStats()})),error=>console.info('Detail preparation deferred ' + error.message));
}

function prepareScene() {
  if (sceneReady) return sceneReady;
  sceneReady=(async()=>{
    const assetStartedAt=performance.now();
    const assetGeneration=await prepareSurfaceAssets({levelId:game.route.id,urgent:enterPending||versionUpgrade.required,onProgress:stats=>{
      if (ui.preparing && !ui.upgrading) ui.setPreparing(true,Math.min(95,Math.round((stats.completed||0)/stats.total*95)));
      versionUpgrade.progress(Math.round((stats.completed||0)/stats.total*38),'正在检查、更新并保存必需的模型与纹理。');
    }});
    const assetsPreparedAt=performance.now();
    if (!renderer) {
      renderer=new GameRenderer(document.getElementById('scene'),game.world);
      renderer.onInvalidate=wake;
      renderer.onContextLost=()=>{details?.pause();game.pause();ui.showError('画面连接已中断，正在等待浏览器恢复。');};
      renderer.onContextRestored=()=>{ui.clearError();updateGenerationWindow('context');};
    }
    const sceneryPreparedAt=performance.now();
    versionUpgrade.progress(40,'正在准备三维画面。');
    const firstSubmitAt=performance.now(); renderer.draw(game);
    const firstFrameMs=Math.round(performance.now()-firstSubmitAt), gpuPreparation=await renderer.prepare();
    scenePrepared=true; document.getElementById('light-preview')?.remove();
    ensureDetails();
    const preparedAt=performance.now();
    console.info('Scene prepared ' + JSON.stringify({version:APP_VERSION,navigationMs:Math.round(preparedAt),modulesMs:Math.round(moduleLoadedAt),worldMs:Math.round(worldPreparedAt-moduleLoadedAt),
      assetsMs:Math.round(assetsPreparedAt-assetStartedAt),sceneryMs:Math.round(sceneryPreparedAt-assetsPreparedAt),gpuMs:Math.round(preparedAt-sceneryPreparedAt),firstFrameMs,gpuPreparation,assetGeneration}));
    updateGenerationWindow('scene'); renderer.resize(); wake();
  })().catch(error=>{sceneReady=undefined;throw error;});
  return sceneReady;
}

async function startStartup() {
  if (startupRunning) return;
  startupRunning=true; startupReady=false; ui.setPreparing(true);
  try {
    const required=await versionUpgrade.check();
    if (required) {
      await prepareScene();
      if (details.state==='failed') ensureDetails();
      details.setUrgent(true); details.resume();
      const stats=await details.done;
      if (stats.completed!==stats.total) throw new Error('Required upgrade resources are incomplete');
      await versionUpgrade.complete();
      details.setUrgent(false);
    }
    input.clear(); startupReady=true; ui.setPreparing(false); wake();
    if (!required) void prepareScene().catch(error=>{
      console.error('Scene initialization failed',error); ui.showError('场景加载失败，请刷新页面重试，并确认浏览器已开启硬件加速。');
    });
  } catch (error) {
    details?.pause(); versionUpgrade.fail(error);
  } finally { startupRunning=false; }
}

ui.onUpgradeRetry=()=>void startStartup();
// 先显示版本检查和轻量预览，完成版本判断后才读取或更新完整场景。
new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))).then(()=>{
  const firstScreenAt=performance.now();
  console.info('First screen visible ' + JSON.stringify({version:APP_VERSION,resourcesReadyMs:Math.round(moduleLoadedAt),afterResourcesMs:Math.round(firstScreenAt-moduleLoadedAt),navigationMs:Math.round(firstScreenAt)}));
  return startStartup();
});
