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
// 暴露调试句柄,供 Agent 验证脚本读取状态与构造确定性场景;生产游玩不依赖它。
window.__game=game;
input.onSpace=()=>{if(!ui.resetConfirm&&!input.landscape)game.space();};input.onBlur=()=>game.pause();
input.onQuiz=(choice,repeat)=>{if(game.state!=='QUIZ')return false;if(!repeat)game.answerQuiz(choice);return true;};
input.onWeapon=key=>game.weaponAction(key);
input.onLayoutChange=()=>{if(input.landscape&&game.state==='RUNNING')game.pause();else ui.render();};
try{
  const renderer=new GameRenderer(document.getElementById('scene'));game.renderer=renderer;renderer.setCarColor(game.carColor);
  let last=performance.now(),accumulator=0,frameId=null,inFrame=false;
  const frame=now=>{
    frameId=null;inFrame=true;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    let animating=false,failed=false;
    try{
      if(game.state==='RUNNING'){
        accumulator+=dt;
        while(accumulator>=1/120){game.step(1/120);accumulator-=1/120;if(game.state!=='RUNNING'){accumulator=0;break;}}
      }else accumulator=0;
      game.renderAlpha=game.state==='RUNNING'?accumulator*120:1;
      game.animate(dt);
      animating=game.state==='RUNNING'||game.state==='DYING'||game.state==='CAUGHT'||game.state==='LEVEL_EXIT';
      if(animating||renderer.needsFrame(game))renderer.draw(game,dt);
      ui.update(dt);audio.update(dt,game);
    }catch(error){
      // 异常不能把 inFrame 留在锁定状态，暂停后仍可操作重置。
      failed=true;accumulator=0;console.error('Game frame failed',error);game.pause();audio.setState('PAUSED');
      const notice='游戏运行异常，已暂停；可重置本局。';ui.notify(notice);
      // 失败帧停止调度后，临时提示仍须在三秒内消失。
      setTimeout(()=>{if(ui.toast.textContent===notice){ui.toast.hidden=true;ui.toastSeconds=0;}},2800);
    }finally{inFrame=false;}
    if(!failed&&(animating||game.state==='QUIZ'||renderer.needsFrame(game)))frameId=requestAnimationFrame(frame);
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
