import { MODEL_APPEARANCE } from './config.js';
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
input.onSpace=()=>{if(!ui.resetConfirm&&!input.landscape)game.space();};input.onBlur=()=>{game.pause();audio.setState(game.state);};
window.addEventListener('focus',()=>{if(game.state==='DYING'){audio.setState(game.state);game.renderer?.invalidate();}});
input.onKey=event=>!ui.resetConfirm&&!input.landscape&&game.keyboardMode.handleKey(event,game);
input.onQuiz=(choice,repeat)=>{if(game.state!=='QUIZ')return false;if(!repeat)game.answerQuiz(choice);return true;};
input.onWeapon=key=>game.weaponAction(key);
input.onLayoutChange=()=>{if(input.landscape&&game.state==='RUNNING')game.pause();else ui.render();};
try{
  const renderer=new GameRenderer(document.getElementById('scene'));game.renderer=renderer;renderer.setCarColor(game.carColor);
  let last=performance.now(),accumulator=0,frameId=null,quizTimerId=null,inFrame=false,navigationReady=false;
  const frame=now=>{
    frameId=null;if(quizTimerId!==null){clearTimeout(quizTimerId);quizTimerId=null;}inFrame=true;
    const interval=(now-last)/1000,dt=Math.min(.05,interval);last=now;
    const logicStart=performance.now();
    let animating=false,failed=false;
    try{
      if(game.state==='RUNNING'){
        accumulator+=dt;
        while(accumulator>=1/120){game.step(1/120);accumulator-=1/120;if(game.state!=='RUNNING'){accumulator=0;break;}}
      }else accumulator=0;
      game.renderAlpha=game.state==='RUNNING'?accumulator*120:1;
      game.animate(dt);
      animating=game.state==='RUNNING'||game.state==='DYING'&&!document.hidden&&document.hasFocus()||game.state==='CAUGHT'||game.state==='LEVEL_EXIT';
      if(animating||renderer.needsFrame(game)){
        const drawStart=performance.now();renderer.draw(game,dt);
        renderer.updateQuality(interval,game.state==='RUNNING',game,{logicMs:drawStart-logicStart,renderMs:performance.now()-drawStart,staticMs:renderer.staticMs??0});
      }
      ui.update(dt);audio.update(dt,game);
      if(game.state==='READY'&&!navigationReady){
        navigationReady=true;performance.measure('game-navigation-ready',{start:0,end:performance.now()});
        if(MODEL_APPEARANCE.profile)console.info('Game navigation ready',JSON.stringify({milliseconds:Math.round(performance.getEntriesByName('game-navigation-ready')[0].duration),cores:navigator.hardwareConcurrency,pixelRatio:devicePixelRatio,width:container.clientWidth,height:container.clientHeight}));
      }
    }catch(error){
      // 异常不能把 inFrame 留在锁定状态，暂停后仍可操作重置。
      failed=true;accumulator=0;console.error('Game frame failed',error);game.pause();audio.setState('PAUSED');
      const notice='游戏运行异常，已暂停；可重置本局。';ui.notify(notice);
      // 失败帧停止调度后，临时提示仍须在三秒内消失。
      setTimeout(()=>{if(ui.toast.textContent===notice){ui.toast.hidden=true;ui.toastSeconds=0;}},2800);
    }finally{inFrame=false;}
    if(!failed&&(animating||renderer.needsFrame(game)))frameId=requestAnimationFrame(frame);
    else if(!failed&&game.state==='QUIZ'&&game.quiz?.helpRemaining===undefined){
      const remaining=game.quizRemaining(),untilSecond=remaining-Math.max(0,Math.ceil(remaining)-1);
      quizTimerId=setTimeout(wake,Math.max(16,untilSecond*1000+5));
    }
  };
  const wake=()=>{
    if(quizTimerId!==null){clearTimeout(quizTimerId);quizTimerId=null;}
    if(frameId!==null||inFrame)return;
    last=performance.now();frameId=requestAnimationFrame(frame);
  };
  renderer.onInvalidate=wake;
  const onChange=game.onChange;
  game.onChange=()=>{onChange();renderer.invalidate();audio.setState(game.state);};
  // 首次导航先完成本关模板、着色器与缓冲上传，再开放开始入口。
  game.state='PREPARING';game.onChange();renderer.draw(game,0);
  await renderer.prepare(game);game.state='READY';game.onChange();wake();
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
