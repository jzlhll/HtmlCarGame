import { bossModelTasks } from './boss-model.js';
export async function generateBossResources(settings){
  if(typeof Worker==='undefined'){
    const tasks=bossModelTasks(settings);let step;do{const start=performance.now();do{step=tasks.next();}while(!step.done&&performance.now()-start<4);if(!step.done)await new Promise(resolve=>setTimeout(resolve,0));}while(!step.done);return step.value;
  }
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./boss-worker.js',import.meta.url),{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(new Error('Boss worker timed out'));},15000),stop=()=>{clearTimeout(timer);worker.terminate();};worker.onmessage=event=>{stop();event.data.error?reject(new Error(event.data.error)):resolve(event.data.data);};worker.onerror=event=>{stop();reject(new Error(event.message||'Boss worker failed'));};worker.postMessage(settings);});
}
