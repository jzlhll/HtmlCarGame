import { SaveStore } from './storage.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { GameRenderer } from './render.js';
import { GameAudio } from './audio.js';
const container=document.getElementById('game');
const store=new SaveStore(),input=new Input(container);
let ui;
const audio=new GameAudio();
const game=new Game(store,input,message=>ui?.notify(message));game.audio=audio;ui=new UI(game);
input.onSpace=()=>{if(!ui.resetConfirm)game.space();};input.onBlur=()=>game.pause();
try{
  const renderer=new GameRenderer(document.getElementById('scene'));game.renderer=renderer;
  let last=performance.now(),accumulator=0,frameId=null,inFrame=false;
  const frame=now=>{
    frameId=null;inFrame=true;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(game.state==='RUNNING'){
      accumulator+=dt;
      while(accumulator>=1/120){game.step(1/120);accumulator-=1/120;if(game.state!=='RUNNING'){accumulator=0;break;}}
    }else accumulator=0;
    game.animate(dt);
    if(game.state==='RUNNING'||game.state==='DYING'||renderer.needsFrame(game))renderer.draw(game,dt);
    ui.update(dt);audio.update(dt,game);inFrame=false;
    if(game.state==='RUNNING'||game.state==='DYING'||renderer.needsFrame(game))frameId=requestAnimationFrame(frame);
  };
  const wake=()=>{
    if(frameId!==null||inFrame)return;
    last=performance.now();frameId=requestAnimationFrame(frame);
  };
  renderer.onInvalidate=wake;
  const onChange=game.onChange;
  game.onChange=()=>{onChange();renderer.invalidate();audio.setState(game.state);};
  wake();
}catch(error){
  console.error('WebGL initialization failed',error);
  document.getElementById('overlay').innerHTML='<section class="card"><h2>浏览器无法创建 3D 画面</h2><p>请在浏览器设置中启用硬件加速，再刷新页面。</p></section>';input.onSpace=()=>{};
}
window.addEventListener('storage',event=>{
  if(event.key!==SaveStore.key)return;
  if(['READY','RESULT'].includes(game.state)){store.load();ui.render();}
  else{store.warning='另一个页面更新了本机记录，请只在一个页面游玩。';ui.warning();}
});
container.focus({preventScroll:true});
