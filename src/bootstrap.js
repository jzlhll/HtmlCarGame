import { validateConfig, WORLD, RENDERING } from './config.js';
import { Storage } from './storage.js';
import { Audio } from './audio.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { prepareAssets } from './assets.js';
const query=new URLSearchParams(location.search);
const navigationStart=performance.now(),storage=new Storage(query.get('debug')==='1',query.get('testAccount')),audio=new Audio(storage),game=new Game(storage,audio),ui=new UI(game,storage,audio);
const input=new Input(game,code=>ui.action(code));game.input=input;
let reviewFocused=document.hasFocus(),scene=null,lastTime=performance.now(),accumulator=0,frameHandle=0,reviewTimer=0,inFrame=false,sceneDirty=true,sceneState='',activeReview=false,lastRenderTime=0,renderAccumulator=0;
if(query.has('seed')){const seed=Number(query.get('seed'));if(Number.isFinite(seed))ui.seed=seed;}
const animated=()=>game.state==='playing'||!ui.dialogMode&&['menu','instructions','tutorial','preparing','prepareFailed','preview'].includes(game.state);
function requestFrame(redraw=true){sceneDirty=sceneDirty||redraw;if(!scene||inFrame||document.hidden)return;clearTimeout(reviewTimer);reviewTimer=0;if(!frameHandle){if(!activeReview)lastTime=performance.now();frameHandle=requestAnimationFrame(frame);}}
function advanceReview(now){if(activeReview&&game.state==='review')game.updateReview(Math.min(Math.max(0,(now-lastTime)/1000),1.1));lastTime=now;activeReview=game.state==='review'&&!document.hidden&&reviewFocused;}
function autoPause(){if(game.state==='playing'){game.pause();ui.render();}input.clear();accumulator=0;audio.stop();requestFrame();}
window.addEventListener('blur',()=>{advanceReview(performance.now());reviewFocused=false;activeReview=false;autoPause();});
window.addEventListener('focus',()=>{reviewFocused=true;lastTime=performance.now();requestFrame();});
document.addEventListener('visibilitychange',()=>{advanceReview(performance.now());if(document.hidden){autoPause();cancelAnimationFrame(frameHandle);frameHandle=0;clearTimeout(reviewTimer);reviewTimer=0;activeReview=false;}else{lastTime=performance.now();requestFrame();}});
screen.orientation?.addEventListener('change',autoPause);
function frame(now){
  frameHandle=0;inFrame=true;const delta=Math.max(0,(now-lastTime)/1000);advanceReview(now);
  if(delta>WORLD.maxFrameSeconds&&game.state==='playing')autoPause();
  if(game.state==='playing'){accumulator+=Math.min(delta,WORLD.maxFrameSeconds);while(accumulator>=WORLD.step){game.update(WORLD.step);accumulator-=WORLD.step;if(game.state!=='playing'){accumulator=0;break;}}}else accumulator=0;
  const moving=animated(),quality=RENDERING.qualities[storage.settings.renderQuality],interval=1000/quality.menuFPS;
  if(moving)renderAccumulator+=Math.min(delta,WORLD.maxFrameSeconds);
  // 只节流非战斗画面的提交，累计背景时间，固定逻辑步继续逐帧推进。
  const forced=sceneDirty||sceneState!==game.state;
  if(forced||moving&&(game.state==='playing'||now-lastRenderTime>=interval-.5)){
    scene?.render(game,renderAccumulator);renderAccumulator=0;lastRenderTime=forced||game.state==='playing'?now:lastRenderTime+Math.max(1,Math.floor((now-lastRenderTime+.5)/interval))*interval;sceneDirty=false;sceneState=game.state;ui.render();
  }else if(game.state==='review')ui.render();inFrame=false;activeReview=game.state==='review'&&!document.hidden&&reviewFocused;
  if(document.hidden)return;
  if(animated())frameHandle=requestAnimationFrame(frame);
  else if(activeReview){const untilNextSecond=(game.reviewRemaining-Math.ceil(game.reviewRemaining)+1)*1000;reviewTimer=setTimeout(()=>{reviewTimer=0;requestFrame(false);},Math.max(16,Math.min(1000,untilNextSecond+1)));}
}
async function boot(){try{validateConfig();ui.progress('准备本地账号',5);await storage.cleanup;const sceneTask=(async()=>{const started=performance.now(),module=await import('./scene.js');return {Scene:module.Scene,milliseconds:performance.now()-started};})(),prepared=await Promise.allSettled([prepareAssets((label,percent)=>ui.progress(label,percent)),sceneTask]),failed=prepared.find(result=>result.status==='rejected');if(failed)throw failed.reason;const assets=prepared[0].value,{Scene,milliseconds}=prepared[1].value;assets.metrics.sceneImportMilliseconds=milliseconds;const sceneStart=performance.now();scene=new Scene(document.getElementById('scene'),assets.data,storage.settings);scene.onResize=width=>game.setPlayWidth(width);game.setPlayWidth(scene.viewWidth);game.collectionTarget=type=>scene.collectionTarget(type);assets.metrics.sceneConstructionMilliseconds=performance.now()-sceneStart;ui.progress('预热星空与座驾',90);scene.render(game,0);const warmupStart=performance.now();await scene.warmup();await scene.prepareRecapImages();ui.recapImages=scene.recapImages;assets.metrics.warmupMilliseconds=performance.now()-warmupStart;assets.metrics.navigationMilliseconds=performance.now()-navigationStart;ui.invalidate=()=>{if(!inFrame)requestFrame();};scene.invalidate=requestFrame;ui.ready(assets.metrics);console.info('English Air Combat ready',JSON.stringify(assets.metrics));if(query.get('debug')==='1'){document.body.dataset.debug='true';const badge=document.createElement('div');badge.textContent='调试模式 · TEST01–09 · 种子 '+(ui.seed??'随机');badge.className='debug-badge';document.getElementById('flight-frame').append(badge);window.__airCombat={snapshot:()=>({state:game.state,remaining:game.remaining,elapsed:game.elapsed,victoryRemaining:game.victoryRemaining,supplies:game.supplies.map(item=>({...item})),level:game.level,roster:game.roster.map(entry=>entry.word),reviewRemaining:game.reviewRemaining,ammo:game.ammo,score:game.score,words:game.words.map(word=>({id:word.id,kind:word.kind||'spelling',mode:word.mode,options:word.options?.map(option=>({...option})),selectedOption:word.selectedOption,word:word.entry.word,x:word.x,y:word.y,blanks:word.blanks,cursor:word.cursor,state:word.state,letters:word.letters.map(item=>({...item}))})),enemies:game.enemies.map(item=>({...item})),metrics:assets.metrics,render:{calls:scene.renderer.info.render.calls,triangles:scene.renderer.info.render.triangles}})};}lastTime=performance.now();requestFrame();}catch(error){console.error('English Air Combat preparation failed',error);ui.failure(error);}}
window.addEventListener('pagehide',()=>{advanceReview(performance.now());activeReview=false;ui.speech.stop();if(game.state==='review')storage.saveReview(game.result,game.reviewRemaining);cancelAnimationFrame(frameHandle);frameHandle=0;clearTimeout(reviewTimer);reviewTimer=0;audio.stop();input.clear();});
window.addEventListener('pageshow',event=>{if(event.persisted){lastTime=performance.now();autoPause();requestFrame();}});
boot();
