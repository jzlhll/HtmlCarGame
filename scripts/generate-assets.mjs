import { mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeAssetPack } from '../src/asset-pack.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'assets/generated');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const levelArg=process.argv.find(value=>value.startsWith('--level='));
if(levelArg){
  // 构建阶段直接驱动正式生成器；不创建WebGL、浏览器或第二套场景配方。
  globalThis.scheduler={postTask:async callback=>callback(),yield:async()=>{}};
  const { prepareSurfaceAssets,prepareSurfaceDetails,surfaceCache }=await import('../src/surface-assets.js');
  const { createRoute }=await import('../src/config.js');
  const { RouteWorld }=await import('../src/route-world.js');
  const { LandscapeView }=await import('../src/landscape-view.js');
  const { WeatherView }=await import('../src/weather-view.js');
  const { prepareAircraftTemplate }=await import('../src/models.js');
  const level=Number(levelArg.slice(8)),cache=surfaceCache(level),records=new Map();await cache.ready;cache.available=true;
  cache.request=async(key,value,write)=>{if(write){records.set(key,value);return true;}return records.get(key);};
  const run=async iterator=>{let value;while(true){const step=iterator.next(value);if(step.done)return step.value;value=step.value?.wait?await step.value.wait:undefined;}};
  const world=new RouteWorld(createRoute(level),{defer:true});await run(world.preparation);
  await prepareSurfaceAssets({levelId:level,urgent:true});
  await run(prepareAircraftTemplate());await run(new WeatherView(world).build());
  const landscape=new LandscapeView(world);await landscape.prepare();
  const detail=prepareSurfaceDetails({allowed:()=>true,upload:function*(){}});detail.setUrgent(true);detail.resume();await detail.done;
  const resources={};
  for(const [name,prefix]of cache.resources){
    // 叶片保留浏览器源图解码，避免Node缺少Canvas时写入不同的程序回退图。
    if(name==='base/foliage-color'||name.startsWith('base/')&&['paint-detail','asphalt-color','asphalt-detail','grass-color','concrete-color','facade-color','facade-detail','terrain-detail','panel-detail','metal-detail','rubber-detail'].includes(name.slice(5)))continue;
    const shards=new Map();
    for(const [key,value]of records)if(key===prefix||key.startsWith(prefix+'/')){
      const suffix=key.slice(prefix.length),parts=suffix.split('/');
      const shard=name==='scene/terrain'||name==='scene/weather'?suffix:name==='scene/streets'||name==='scene/country'?parts[1]:'all';
      if(!shards.has(shard))shards.set(shard,{});shards.get(shard)[suffix]=value;
    }
    if(!shards.size)continue;
    const packs=[];
    for(const group of shards.values()){
      const packed=encodeAssetPack(group),plain=encodeAssetPack(group,{predict:false}),predicted=gzipSync(packed,{level:9}),direct=gzipSync(plain,{level:9}),compressed=predicted.length<direct.length?predicted:direct,file=digest(compressed).slice(0,24)+'.bin.gz';
      await writeFile(path.join(output,file),compressed);packs.push({file,bytes:compressed.length,decodedBytes:packed.byteLength,records:Object.keys(group).length});
    }
    resources[prefix.replace('cloud-cockpit/','').replace('/resource/','/')]={packs};
  }
  await writeFile(path.join(output,`level-${level}.json`),JSON.stringify(resources));
  console.info('Level assets compiled '+JSON.stringify({level,groups:Object.keys(resources).length,records:records.size}));
}else{
  const files=[];
  for(const directory of ['src','scripts'])for(const entry of await readdir(path.join(root,directory),{recursive:true})){
    const file=path.join(root,directory,entry);if((await stat(file)).isFile()&&/\.(js|mjs|png)$/.test(file))files.push(file);
  }
  files.push(path.join(root,'package-lock.json'));
  const hash=createHash('sha256');for(const file of files.sort()){hash.update(path.relative(root,file));hash.update(await readFile(file));}
  const fingerprint=hash.digest('hex');let existing;
  try{existing=JSON.parse(await readFile(path.join(output,'manifest.json'),'utf8'));}catch{}
  let intact=existing?.fingerprint===fingerprint;
  if(intact)for(const pack of Object.values(existing.resources).flatMap(entry=>entry.packs)){
    try{const bytes=await readFile(path.join(output,pack.file));if(bytes.length!==pack.bytes||digest(bytes).slice(0,24)+'.bin.gz'!==pack.file)intact=false;}catch{intact=false;}
    if(!intact)break;
  }
  if(intact){console.info('Compiled assets are current');}else{
  await mkdir(output,{recursive:true});const resources={};
  for(const level of [1,2,3,4]){
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[fileURLToPath(import.meta.url),`--level=${level}`],{cwd:root,stdio:['ignore','pipe','inherit']});
      let lines='';child.stdout.on('data',chunk=>{lines+=chunk;});
      child.on('error',reject);child.on('close',code=>{if(code)reject(new Error('Asset compilation failed for level '+level));else{console.info(lines.trim().split('\n').at(-1));resolve();}});
    });
    Object.assign(resources,JSON.parse(await readFile(path.join(output,`level-${level}.json`),'utf8')));
    await rm(path.join(output,`level-${level}.json`));
  }
  const manifest={format:1,fingerprint,resources};await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest));
  const live=new Set(['manifest.json',...Object.values(resources).flatMap(entry=>entry.packs.map(pack=>pack.file))]);
  for(const file of await readdir(output))if(!live.has(file))await rm(path.join(output,file));
  let bytes=0;for(const file of live)bytes+=(await stat(path.join(output,file))).size;
  console.info('Shared assets compiled '+JSON.stringify({groups:Object.keys(resources).length,files:live.size,bytes}));
  }
}
