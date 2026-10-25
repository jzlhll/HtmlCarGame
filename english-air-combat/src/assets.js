import { BACKGROUND, CHOICES, BOSS_VISUALS, MODEL_GEOMETRY, RENDERING } from './config.js';
import { APP_VERSION, GENERATOR_VERSION, CACHE_FORMAT_VERSION } from './version.js';
import { RESOURCE_SOURCES } from './resource-sources.js';
import { generateBossResources } from './boss-assets.js';
import { validBossModels } from './boss-model.js';
import { supplySpriteRecipe, generateSupplySprite, decodeSupplySprite } from './supply-sprite.js';
const DB='english-air-combat-assets';
const settings={...BACKGROUND,carrier:CHOICES.carrier,geometry:MODEL_GEOMETRY};
const legacyKey=JSON.stringify({group:RESOURCE_SOURCES.space,engine:RESOURCE_SOURCES.engine,generator:GENERATOR_VERSION,format:CACHE_FORMAT_VERSION,settings});
// 只有参与顶点、像素及布局生成的参数进入指纹，速度和蒙版调参继续复用资源。
const generatedSettings=Object.fromEntries(['seed','stars','starTravel','largeGlows','glowStars','galaxyStars','galaxySourceRadius','textureWidth','textureHeight','constellations','constellationStarSize'].map(name=>[name,settings[name]]));
generatedSettings.geometry=settings.geometry;
generatedSettings.models=settings.models.map(({kind,radius,texture})=>({kind,radius,texture}));generatedSettings.carrier={palette:settings.carrier.palette};
const key=JSON.stringify({group:RESOURCE_SOURCES.space,engine:RESOURCE_SOURCES.engine,generator:GENERATOR_VERSION,format:CACHE_FORMAT_VERSION,settings:generatedSettings});
function openDB(){return new Promise((resolve,reject)=>{let finished=false;const timer=setTimeout(()=>{finished=true;reject(new Error('Asset cache open timed out'));},1500);const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('assets');request.onsuccess=()=>{clearTimeout(timer);if(finished)request.result.close();else{finished=true;resolve(request.result);}};request.onerror=()=>{clearTimeout(timer);finished=true;reject(request.error);};request.onblocked=()=>{clearTimeout(timer);finished=true;reject(new Error('Asset cache is blocked'));};});}
function compareVersion(a,b){const left=String(a||'v0.0.0').slice(1).split('.').map(Number),right=b.slice(1).split('.').map(Number);for(let i=0;i<3;i++){const difference=(left[i]||0)-(right[i]||0);if(difference)return difference;}return 0;}
// 成功记录和清理处于同一事务，旧页面不能清理或覆盖较新页面的资源。
function finalize(db,spriteKey,bossKey){return new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets'),metadata=store.get('meta:completed');metadata.onsuccess=()=>{if(compareVersion(metadata.result?.version,APP_VERSION)>0)return;const cursor=store.openCursor();cursor.onsuccess=()=>{const item=cursor.result;if(item){if(item.key!==key&&item.key!=='meta:completed'&&item.key!==spriteKey&&item.key!==bossKey)item.delete();item.continue();}};store.put({version:APP_VERSION,key},'meta:completed');};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function transact(db,mode,operation){return new Promise((resolve,reject)=>{const tx=db.transaction('assets',mode),store=tx.objectStore('assets');let result;const request=operation(store);if(request)request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Asset transaction aborted'));});}
function validConstellations(charts){
  return Array.isArray(charts)&&charts.length===BACKGROUND.constellations.length&&charts.every((chart,i)=>{
    const definition=BACKGROUND.constellations[i];
    return chart.kind===definition.kind&&chart.positions instanceof Float32Array&&chart.positions.length===definition.stars.length*3&&chart.positions.every(Number.isFinite)&&chart.sizes instanceof Float32Array&&chart.sizes.length===definition.stars.length&&chart.sizes.every(size=>Number.isFinite(size)&&size>0)&&chart.lines instanceof Float32Array&&chart.lines.length===definition.links.length*6&&chart.lines.every(Number.isFinite);
  });
}
function validGeometry(data,{segments,rows}={}){
  if(!(data?.positions instanceof Float32Array)||!data.positions.length||data.positions.length%3!==0||!data.positions.every(Number.isFinite)||!(data.normals instanceof Float32Array)||data.normals.length!==data.positions.length||!data.normals.every(Number.isFinite))return false;
  const count=data.positions.length/3;
  if(data.uvs&&(!(data.uvs instanceof Float32Array)||data.uvs.length!==count*2||!data.uvs.every(Number.isFinite)))return false;
  if(segments!==undefined)return count===(segments+1)*(rows+1)&&data.uvs instanceof Float32Array&&data.indices instanceof Uint16Array&&data.indices.length===segments*rows*6&&data.indices.every(index=>index<count);
  return data.positions.length%9===0;
}
function valid(data){return validGeometry(data?.carrier)&&data.carrier.colors instanceof Float32Array&&data.carrier.colors.length===data.carrier.positions.length&&data.carrier.colors.every(value=>Number.isFinite(value)&&value>=0&&value<=1)&&validConstellations(data?.constellations)&&data?.stars instanceof Float32Array&&data.stars.length===BACKGROUND.stars*4&&data.stars.every(Number.isFinite)&&data.galaxy instanceof Float32Array&&data.galaxy.length===BACKGROUND.galaxyStars*7&&data.galaxy.every(Number.isFinite)&&validGeometry(data.sphere,MODEL_GEOMETRY.sphere)&&validGeometry(data.aircraftSphere,MODEL_GEOMETRY.aircraftSphere)&&validGeometry(data.ship)&&data.pixels?.length===BACKGROUND.models.filter(model=>model.texture!==null).length&&data.pixels.every(p=>p instanceof Uint8Array&&p.length===BACKGROUND.textureWidth*BACKGROUND.textureHeight*4)&&data.plan?.length===BACKGROUND.models.length&&data.plan.every((p,i)=>p.planet===i&&p.scale===BACKGROUND.models[i].radius&&Math.abs(p.x)<0.5&&[p.x,p.scale,p.tilt].every(Number.isFinite));}
async function generate(){
  if(typeof Worker==='undefined'){
    const {assetTasks}=await import('./resource-worker.js'),tasks=assetTasks(settings);let step;
    do{
      const start=performance.now();do{step=tasks.next();}while(!step.done&&performance.now()-start<RENDERING.generationBatchMilliseconds);
      if(!step.done){if(globalThis.scheduler?.yield)await scheduler.yield();else await new Promise(resolve=>setTimeout(resolve,0));}
    }while(!step.done);
    return step.value;
  }
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./resource-worker.js',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(new Error('Asset worker timed out'));},15000);const stop=()=>{clearTimeout(timer);worker.terminate();};worker.onmessage=event=>{stop();event.data.error?reject(new Error(event.data.error)):resolve(event.data.data);};worker.onerror=event=>{stop();reject(new Error(event.message||'Asset worker failed'));};worker.postMessage(settings);});
}
export async function prepareAssets(progress){
  const start=performance.now();let db=null,persistent=true,upgrading=false,completed=0;
  const advance=weight=>{completed+=weight;progress(upgrading?'版本升级 · 准备场景资源':'准备场景资源',20+completed);};
  progress('准备星海',10);
  try{
    try{db=await openDB();const previous=await transact(db,'readonly',store=>store.get('meta:completed'));upgrading=!!previous?.version&&compareVersion(previous.version,APP_VERSION)<0;if(upgrading)progress('版本升级',15);}catch(error){persistent=false;console.warn('Persistent asset cache unavailable',error);}
    const bossSettings=Object.fromEntries(Object.entries(BOSS_VISUALS).filter(([name])=>!['tentacleSway','tentacleSpeed','rage'].includes(name)));for(const kind of ['mini','final'])bossSettings[kind]=Object.fromEntries(Object.entries(BOSS_VISUALS[kind]).filter(([name])=>!['scale','yOffset'].includes(name)));
    const bossKey='boss:'+JSON.stringify({source:RESOURCE_SOURCES.boss,format:2,settings:bossSettings}),recipe=supplySpriteRecipe(),spriteKey='sprite:supply:'+JSON.stringify(recipe);
    progress(upgrading?'版本升级 · 准备场景资源':'准备场景资源',20);
    const spaceTask=(async()=>{
      const started=performance.now();let data=null;
      if(db){try{data=await transact(db,'readonly',store=>store.get(key));if(!valid(data)){data=await transact(db,'readonly',store=>store.get(legacyKey));if(valid(data))await transact(db,'readwrite',store=>store.put(data,key));else data=null;}}catch(error){persistent=false;console.warn('Space cache read failed',error);}}
      const hit=!!data;
      if(!data){data=await generate();if(!valid(data))throw new Error('Generated asset data is invalid');if(db){try{await transact(db,'readwrite',store=>store.put(data,key));}catch(error){persistent=false;console.warn('Asset cache write failed',error);}}}
      return {data,hit,milliseconds:performance.now()-started};
    })().then(result=>{advance(30);return result;});
    const bossTask=(async()=>{
      const started=performance.now();let data=null;
      if(db){try{data=await transact(db,'readonly',store=>store.get(bossKey));if(!validBossModels(data))data=null;}catch(error){persistent=false;console.warn('Boss cache read failed',error);}}
      const hit=!!data;
      if(!data){data=await generateBossResources(BOSS_VISUALS);if(!validBossModels(data))throw new Error('Generated boss data is invalid');if(db){try{await transact(db,'readwrite',store=>store.put(data,bossKey));}catch(error){persistent=false;console.warn('Boss cache write failed',error);}}}
      return {data,hit,milliseconds:performance.now()-started};
    })().then(result=>{advance(15);return result;});
    const spriteTask=(async()=>{
      const started=performance.now();let data=null,hit=false;
      try{
        let source=db?await transact(db,'readonly',store=>store.get(spriteKey)):null;
        if(typeof source==='string'&&source.startsWith('data:image/png;')){try{data=await decodeSupplySprite(source);hit=true;}catch{source=null;}}
        if(!data){source=await generateSupplySprite(recipe);data=await decodeSupplySprite(source);if(db)await transact(db,'readwrite',store=>store.put(source,spriteKey));}
      }catch(error){console.warn('Supply sprite preparation failed',error);if(db)persistent=false;}
      return {data,hit,milliseconds:performance.now()-started};
    })().then(result=>{advance(10);return result;});
    // 必需资源失败时也等其余任务和 Worker 停止，再交给启动入口处理错误。
    const results=await Promise.allSettled([spaceTask,bossTask,spriteTask]),failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
    const [space,boss,sprite]=results.map(result=>result.value);
    progress('恢复场景与字母资源',75);
    if(persistent&&db){try{await finalize(db,spriteKey,bossKey);}catch(error){persistent=false;console.warn('Asset cache finalization failed',error);}}
    return {data:{...space.data,supplySprite:sprite.data,bossModels:boss.data},metrics:{hit:space.hit,persistent,spaceMilliseconds:space.milliseconds,bossHit:boss.hit,bossMilliseconds:boss.milliseconds,spriteHit:sprite.hit,spriteReady:!!sprite.data,spriteMilliseconds:sprite.milliseconds,assetMilliseconds:performance.now()-start,workerStopped:true}};
  }finally{db?.close();}
}
