import { MODEL_APPEARANCE, MODEL_PREWARM } from './config.js';
import { installModelAssets, collectModelAssets, assetGeometries, assetTextures } from './model-assets.js';
import { modelJobs, generateModelJob } from './model-jobs.js';
import { resourcePlan } from './resource-plan.js';
import { APP_VERSION, CACHE_FORMAT_VERSION } from './version.js';

const memoryResources=new Map();
let initialization=null,prepared=false,worker=null,pendingJob=null,workerKnown=new Set(),fallback=false;
let status={warning:'',generated:0,restored:0,groups:0,persistent:false};
const yieldWork=()=>new Promise(resolve=>globalThis.scheduler?.yield?scheduler.yield().then(resolve):setTimeout(resolve,0));
const assertNotPlaying=()=>{if(globalThis.window?.__game?.state==='RUNNING')throw new Error('Model generation is forbidden while playing');};
function validate(data){
  if(!data||!Array.isArray(data.geometries)||!Array.isArray(data.textures)||data.geometries.length>2000||data.textures.length>32)throw new Error('Invalid resource payload');
  const names=new Set(assetGeometries.keys());let bytes=0;
  for(const geometry of data.geometries){
    if(typeof geometry.key!=='string'||geometry.key.length>60000)throw new Error('Invalid geometry key');
    if(geometry.alias){if(!names.has(geometry.alias))throw new Error('Missing geometry dependency');}
    else{
      const position=geometry.attributes?.position;if(!position||position.itemSize!==3||!position.array?.length)throw new Error('Invalid geometry positions');
      const count=position.array.length/3;
      for(const attribute of [...Object.values(geometry.attributes),...(geometry.index?[geometry.index]:[])]){
        if(!ArrayBuffer.isView(attribute.array)||attribute.array instanceof DataView||!Number.isInteger(attribute.itemSize)||attribute.itemSize<1)throw new Error('Invalid geometry attribute');
        if(attribute!==geometry.index&&attribute.array.length!==count*attribute.itemSize)throw new Error('Mismatched geometry attribute');
        bytes+=attribute.array.byteLength;
        const array=attribute.array;
        for(let i=0;i<array.length;i++)if(!Number.isFinite(array[i]))throw new Error('Invalid geometry values');
      }
      if(!Number.isInteger(count)||(geometry.index&&(geometry.index.itemSize!==1||!(geometry.index.array instanceof Uint16Array||geometry.index.array instanceof Uint32Array))))throw new Error('Invalid geometry indices');
      if(geometry.index){const array=geometry.index.array;for(let i=0;i<array.length;i++)if(array[i]<0||array[i]>=count)throw new Error('Invalid geometry indices');}
    }
    names.add(geometry.key);
  }
  for(const texture of data.textures){if(typeof texture.key!=='string'||!Number.isInteger(texture.width)||!Number.isInteger(texture.height)||texture.width<1||texture.height<1||!(texture.data instanceof Uint8Array)||texture.data.length!==texture.width*texture.height*4)throw new Error('Invalid texture pixels');bytes+=texture.data.byteLength;}
  if(bytes>64*1024*1024)throw new Error('Resource payload too large');
}
function stopWorker(){worker?.terminate();worker=null;workerKnown=new Set();}
function ensureWorker(){
  if(worker||fallback)return;
  try{
    worker=new Worker(new URL('./model-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(!pendingJob||data.id!==pendingJob.id)return;
      const pending=pendingJob;pendingJob=null;if(data.error)pending.reject(new Error(data.error));else pending.resolve(data.assets);
    };
    worker.onerror=event=>{event.preventDefault();const pending=pendingJob;pendingJob=null;pending?.reject(new Error(event.message));};
    worker.onmessageerror=()=>{const pending=pendingJob;pendingJob=null;pending?.reject(new Error('Model transfer failed'));};
  }catch(error){fallback=true;console.warn('Model worker unavailable, using cooperative generation',error);}
}
async function generate(job){
  assertNotPlaying();ensureWorker();
  if(worker){
    try{
      const {transfer,...assets}=collectModelAssets(workerKnown);
      if(assets.geometries.length||assets.textures.length)worker.postMessage({restore:assets},transfer);
      return await new Promise((resolve,reject)=>{pendingJob={id:job.id,resolve,reject};worker.postMessage({id:job.id});});
    }catch(error){stopWorker();fallback=true;console.warn('Model worker failed, using cooperative generation',error);}
  }
  const sent=new Set([...assetGeometries.keys(),...[...assetTextures.keys()].map(key=>'texture:'+key)]);let slice=performance.now();
  await generateModelJob(job,async()=>{assertNotPlaying();if(performance.now()-slice>=MODEL_PREWARM.idleSliceMs){await yieldWork();slice=performance.now();}});
  const {transfer,...assets}=collectModelAssets(sent);return assets;
}
async function initialize(cache,progress){
  const started=performance.now(),resources=resourcePlan(),total=modelJobs.length,keys=resources.map(resource=>resource.key);
  const previous=/^v\d+\.\d+\.\d+$/.test(cache.previous?.appVersion??'')?cache.previous:null,upgrading=!!previous&&(previous.appVersion!==APP_VERSION||previous.keys?.join('|')!==keys.join('|'));
  let count=0,maxInstallMs=0;
  status={warning:cache.warning,generated:0,restored:0,groups:resources.length,persistent:cache.persistent};
  const report=phase=>progress?.({mode:!previous?'initialize':upgrading?'upgrade':'ready',phase,completed:count,total,version:APP_VERSION,persistent:cache.persistent,warning:cache.warning});
  report('读取模型缓存');
  try{
    assertNotPlaying();const cachedResources=await cache.readMany(keys);
    for(const resource of resources){
      assertNotPlaying();const cached=cachedResources.get(resource.key);cachedResources.delete(resource.key);let restored=false;
      if(cached?.format===CACHE_FORMAT_VERSION&&cached.id===resource.id){
        try{validate(cached.data);
          if(resource.id.startsWith('texture:')&&!cached.data.textures.some(texture=>'texture:'+texture.key===resource.id)||!resource.id.startsWith('texture:')&&!cached.data.geometries.length)throw new Error('Incomplete cached resource');
          const install=performance.now();installModelAssets(cached.data);maxInstallMs=Math.max(maxInstallMs,performance.now()-install);restored=true;}
        catch(error){console.warn('Cached model resource invalid, rebuilding',resource.id,error);}
      }
      if(restored){count+=resource.jobs.length;status.restored+=resource.jobs.length;report('恢复模型缓存');}
      else{
        let memory=memoryResources.get(resource.key);
        if(!memory){memory={data:{geometries:[],textures:[]},done:new Set()};memoryResources.set(resource.key,memory);}
        const {data}=memory;
        for(const job of resource.jobs){
          if(memory.done.has(job.id)){count++;report('复用已完成资源');continue;}
          const geometryKeys=new Set(assetGeometries.keys()),textureKeys=new Set(assetTextures.keys());
          const result=await generate(job);validate(result);
          const added=result.geometries.filter(geometry=>!geometryKeys.has(geometry.key));
          const textures=result.textures.filter(texture=>!textureKeys.has(texture.key));
          data.geometries.push(...added);data.textures.push(...textures);
          const install=performance.now();installModelAssets(result);maxInstallMs=Math.max(maxInstallMs,performance.now()-install);
          for(const geometry of result.geometries)workerKnown.add(geometry.key);for(const texture of result.textures)workerKnown.add('texture:'+texture.key);
          memory.done.add(job.id);count++;status.generated++;report('准备模型与场景');await yieldWork();
        }
        await cache.write(resource,data);report('保存模型缓存');
      }
      await yieldWork();
    }
    stopWorker();report('清理旧模型缓存');const recorded=await cache.finish(resources);
    status.warning=cache.warning;status.persistent=cache.persistent;status.recorded=recorded;status.cleaned=cache.cleaned;status.milliseconds=Math.round(performance.now()-started);status.maxInstallMs=maxInstallMs;prepared=true;memoryResources.clear();
    progress?.({mode:'complete',phase:recorded?'准备完成':'本次页面准备完成',completed:total,total,version:APP_VERSION,persistent:cache.persistent,warning:cache.warning});
    if(MODEL_APPEARANCE.profile)console.info('Game resource initialization',JSON.stringify({...status,geometries:assetGeometries.size,textures:assetTextures.size}));
  }finally{stopWorker();cache.close();}
}
export function initializeModelAssets(cache,progress){
  if(!initialization)initialization=initialize(cache,progress).catch(error=>{initialization=null;throw error;});
  return initialization;
}
export async function prepareModelAssets(){
  if(!initialization)throw new Error('Model resource initialization is required');
  await initialization;if(!prepared)throw new Error('Model resources are not ready');
}
export function modelCacheStatus(){return status;}
// 离开时停止在途任务；未提交完成标记时，下次仍按原记录继续核对。
window.addEventListener('pagehide',()=>{const pending=pendingJob;pendingJob=null;stopWorker();pending?.reject(new Error('Model preparation interrupted'));});
