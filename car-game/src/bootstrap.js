import { APP_VERSION } from './version.js';
import { ResourceCache } from './resource-cache.js';
const overlay=document.getElementById('overlay');
let booting=false;
function progress({mode='ready',phase='检查本机资源',completed=0,total=1,warning=''}){
  let card=overlay.querySelector('.startup-card');
  if(!card){
    overlay.innerHTML='<section class="card startup-card" role="status" aria-live="polite"><h2></h2><p class="startup-version"></p><progress max="100" value="0" aria-label="资源准备进度"></progress><p class="startup-progress"></p><p class="startup-warning"></p></section>';
    card=overlay.querySelector('.startup-card');
  }
  card.querySelector('h2').textContent=mode==='upgrade'?'版本升级':mode==='initialize'?'首次准备':'正在准备游戏';
  card.querySelector('.startup-version').textContent='四季车途 · '+APP_VERSION;
  const percent=Math.floor(completed/total*100);card.querySelector('progress').value=percent;
  card.querySelector('.startup-progress').textContent=phase+' · '+percent+'%';
  card.querySelector('.startup-warning').textContent=warning;
}
async function boot(){
  if(booting)return;booting=true;progress({});
  try{
    const prepare=async()=>{
      const cache=await new ResourceCache().open();
      const known=/^v\d+\.\d+\.\d+$/.test(cache.previous?.appVersion??'');
      progress({mode:!known?'initialize':cache.previous.appVersion!==APP_VERSION?'upgrade':'ready',warning:cache.warning});
      // 先显示升级／初始化首屏，再加载引擎与生成器；完成持久化、清理后才开放开局。
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const {initializeModelAssets}=await import('./model-generation.js');await initializeModelAssets(cache,progress);
    };
    if(navigator.locks){progress({phase:'等待本机资源准备'});await navigator.locks.request('htmlCarGame:model-upgrade',prepare);}else await prepare();
    await import('./main.js');
  }catch(error){
    console.error('Game startup failed',error);
    overlay.innerHTML='<section class="card"><h2>资源准备未完成</h2><p>已保留可用资源与游戏记录，请关闭其他旧游戏页面后重试。</p><button class="button" type="button">重新准备</button></section>';
    overlay.querySelector('button').addEventListener('click',boot);
  }finally{booting=false;}
}
await boot();
