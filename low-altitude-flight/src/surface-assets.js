import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SURFACE_APPEARANCE, LANDSCAPE, AIRCRAFT, LOOP_WORLD, COUNTRYSIDE, JOURNEY, WORLD_TRAVEL, WORLD_BOUNDARY, REGION_BLEND, CITY_STREETS, WEATHER, LEVELS, WORLD_HEIGHT, TREE_CONTACT, TREE_MODELS, TREE_HEIGHTS, REGIONAL_WATER, FOLIAGE_TEXTURE, ROCK_SURFACE, FACADE_SURFACE, TOURISM, SCENERY_DETAIL, createRoute } from './config.js';
import { fuselageGeometry, aircraftDoorGeometry, engineGeometry, fanGeometry, treeCrownGeometry, wingGeometry } from './model-geometry.js';
import { surfacePixels, terrainPixels, environmentPixels, mipmapPixels } from './surface-recipes.js';
import { GenerationQueue } from './generation-queue.js';
import { SurfaceCache } from './surface-cache.js';
import { PixelWorker } from './pixel-worker.js';
import { loopTerrainData } from './loop-world.js';
import { boundaryData } from './world-boundary.js';
import { SCENERY_SHAPES, sceneryGeometry } from './scenery-primitives.js';
import { treeProfiles } from './tree-species.js';

const textures = new Map(), geometries = new Map();
const textureNames = ['asphalt-color','asphalt-detail','paint-detail','panel-detail','metal-detail','terrain-detail','environment','grass-color','concrete-color','facade-color','facade-detail','rubber-detail','foliage-color'];
let preparation, baseQueue, detailQueue, cache, boundarySettings=WORLD_BOUNDARY;
export const sceneCacheStats={hits:0,misses:0};
const pixelWorker=new PixelWorker();

export function surfaceCache(levelId = 1) {
  if (!cache) {boundarySettings=createRoute(levelId).boundary;cache = new SurfaceCache(levelId, resourceManifest(levelId));}
  return cache;
}

export function prepareSurfaceAssets({levelId = 1, urgent = false, onProgress} = {}) {
  if (preparation && baseQueue.state !== 'failed') return preparation;
  surfaceCache(levelId);
  baseQueue = new GenerationQueue(generateBase(), {urgent, name: 'essential'});
  baseQueue.stats.total = textureNames.length + geometryFactories().length;
  baseQueue.onProgress = onProgress;
  baseQueue.onPause = () => pixelWorker.stop();
  preparation = baseQueue.done.then(stats => ({...stats, textures: textures.size, geometries: geometries.size, persistent: cache.available}));
  baseQueue.resume();
  return preparation;
}

export function setSurfacePreparationUrgent(urgent = true) { baseQueue?.setUrgent(urgent); }

export function prepareSurfaceDetails({allowed, upload}) {
  if (detailQueue && detailQueue.state !== 'failed') return detailQueue;
  detailQueue = new GenerationQueue(generateDetails(upload), {allowed, name: 'detail'});
  detailQueue.stats.total = SURFACE_APPEARANCE.detailTextures.length;
  detailQueue.onPause=()=>pixelWorker.stop();
  void detailQueue.done.then(()=>pixelWorker.stop(),()=>pixelWorker.stop());
  return detailQueue;
}

export function surfaceGenerationStats() {
  let textureBytes = 0;
  for (const texture of textures.values()) textureBytes += texture.image.width * texture.image.height * 4 * 4 / 3;
  return {workerActive:Boolean(pixelWorker.pending), workerPresent:Boolean(pixelWorker.worker), essential: baseQueue?.snapshot(), detail: detailQueue?.snapshot(), persistent: cache?.available,
    scene:{...sceneCacheStats}, textureBytes: Math.ceil(textureBytes), sizes: Object.fromEntries([...textures].map(([name,texture])=>[name,[texture.image.width,texture.image.height]]))};
}

// 分块持久化，避免一次克隆大像素缓冲；元数据最后写入，未完成记录不会作为命中。
function* writeRecord(name, record) {
  if (!cache.available) return;
  if (record.kind === 'pixels') {
    const levels=record.mipmaps||[{data:record.data,width:record.width,height:record.height}], metadata=[];
    for (const [index,level] of levels.entries()) {
      const chunks=Math.ceil(level.data.length/524288);
      for (let chunk=0;chunk<chunks;chunk++) {
        yield {wait:cache.write(`${name}/level/${index}/part/${chunk}`,level.data.slice(chunk*524288,(chunk+1)*524288))};
        if (!cache.available) return;
      }
      metadata.push({width:level.width,height:level.height,chunks});
    }
    yield {wait:cache.write(name,{kind:'pixels',width:record.width,height:record.height,manual:Boolean(record.mipmaps),levels:metadata})};
  } else yield {wait:cache.write(name,record)};
}

function* readRecord(name) {
  if (!cache.readable) return undefined;
  const record=yield {wait:cache.read(name)};
  if (record?.kind!=='pixels') return record;
  if (!Number.isInteger(record.width)||!Number.isInteger(record.height)||record.width<=0||record.height<=0||record.width>SURFACE_APPEARANCE.detailTextureSize||record.height>SURFACE_APPEARANCE.detailTextureSize) return undefined;
  const metadata=record.levels||[{width:record.width,height:record.height,chunks:record.chunks}],levels=[];
  if (metadata.length!== (record.manual?Math.floor(Math.log2(Math.max(record.width,record.height)))+1:1)) return undefined;
  for (const [index,level] of metadata.entries()) {
    const width=Math.max(1,record.width>>index),height=Math.max(1,record.height>>index),length=width*height*4;
    if (level.width!==width||level.height!==height||level.chunks!==Math.ceil(length/524288)) return undefined;
    const data=new Uint8Array(length);yield;
    for (let chunk=0;chunk<level.chunks;chunk++) {
      const key=record.levels?`${name}/level/${index}/part/${chunk}`:`${name}/part/${chunk}`;
      const part=yield {wait:cache.read(key)};
      if (!(part instanceof Uint8Array)||part.length!==Math.min(524288,length-chunk*524288)) return undefined;
      data.set(part,chunk*524288);yield;
    }
    levels.push({data,width,height});
  }
  return {...record,data:levels[0].data,mipmaps:record.manual?levels:undefined};
}

function sizeFor(name, detail = false) {
  const settings=SURFACE_APPEARANCE;
  const base = name==='foliage-color'?FOLIAGE_TEXTURE.size:name==='panel-detail'?settings.panelSize:name==='metal-detail'?settings.metalSize:name==='terrain-detail'?LANDSCAPE.terrain.textureSize:settings.textureSize;
  return detail ? Math.min(settings.detailTextureSize,base*(name.startsWith('facade-')||name==='terrain-detail'?4:2)) : base;
}

function* pixelsFor(name, width, height, queue, manual = false) {
  while (true) {
    const result=yield {wait:pixelWorker.request(name,width,height,manual)};
    if (result===null) break;
    if (result.cancelled) continue;
    queue.stats.workerCpuMs=(queue.stats.workerCpuMs||0)+result.cpuMs;
    queue.stats.maxWorkerBatchMs=Math.max(queue.stats.maxWorkerBatchMs||0,result.maxBatchMs);
    return {data:result.pixels,mipmaps:result.mipmaps};
  }
  const data=yield* (name==='environment'?environmentPixels(width,height):name==='terrain-detail'?terrainPixels(width):surfacePixels(name,width));
  return {data,mipmaps:manual?yield* mipmapPixels(data,width,height,name.endsWith('-color')):undefined};
}

function textureFrom(name, record) {
  const texture=new THREE.DataTexture(record.data,record.width,record.height);
  texture.colorSpace=name.endsWith('-color')||name==='environment'?THREE.SRGBColorSpace:THREE.NoColorSpace;
  texture.flipY=true; texture.generateMipmaps=true; texture.minFilter=THREE.LinearMipmapLinearFilter; texture.magFilter=THREE.LinearFilter;
  if (name==='environment') texture.mapping=THREE.EquirectangularReflectionMapping;
  else {texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;}
  if (record.mipmaps) {texture.mipmaps=record.mipmaps;texture.generateMipmaps=false;}
  if(name==='foliage-color'){texture.flipY=false;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;}
  texture.userData.assetName=name;texture.needsUpdate=true; return texture;
}

export function geometryRecord(geometry) {
  return {kind:'geometry',type:geometry.type,attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([name,attribute])=>{
    let array=attribute.array,normalized=attribute.normalized;
    // 法线与0–1色彩采用16位归一化存储；位置、UV和碰撞数据保持原Float32。
    if(array instanceof Float32Array&&['normal','color','biome'].includes(name)&&array.every(value=>Number.isFinite(value)&&value>=(name==='normal'?-1:0)&&value<=1)){
      const signed=name==='normal',limit=signed?32767:65535;array=(signed?Int16Array:Uint16Array).from(array,value=>Math.round(value*limit));normalized=true;
    }
    return [name,{array,itemSize:attribute.itemSize,normalized}];
  })),index:geometry.index?.array};
}

export function* geometryFrom(record) {
  if (record?.kind!=='geometry' || !record.attributes?.position || !record.attributes?.normal) return undefined;
  const position=record.attributes.position, count=position.array?.length/3;
  if (!(position.array instanceof Float32Array) || !Number.isInteger(count) || position.itemSize!==3) return undefined;
  for(const attribute of Object.values(record.attributes)){
    if(!(attribute.array instanceof Float32Array||attribute.normalized&&(attribute.array instanceof Int16Array||attribute.array instanceof Uint16Array))||attribute.array.length!==count*attribute.itemSize)return undefined;
    for(let offset=0;offset<attribute.array.length;offset+=16384){
      for(let i=offset;i<Math.min(offset+16384,attribute.array.length);i++)if(!Number.isFinite(attribute.array[i]))return undefined;
      yield;
    }
  }
  if(record.index){
    if(!(record.index instanceof Uint16Array||record.index instanceof Uint32Array))return undefined;
    for(let offset=0;offset<record.index.length;offset+=16384){
      for(let i=offset;i<Math.min(offset+16384,record.index.length);i++)if(record.index[i]>=count)return undefined;
      yield;
    }
  }
  const geometry=new THREE.BufferGeometry(); geometry.type=record.type;
  for (const [name,attribute] of Object.entries(record.attributes)) geometry.setAttribute(name,new THREE.BufferAttribute(attribute.array,attribute.itemSize,attribute.normalized));
  if (record.index) geometry.setIndex(new THREE.BufferAttribute(record.index,1));
  return geometry;
}

function* generateBase() {
  yield {wait:cache.ready};
  for (const name of textureNames) {
    yield {task:name};
    if (textures.has(name)) {baseQueue.stats.completed=(baseQueue.stats.completed||0)+1;yield 'boundary';continue;}
    const detailKey=`detail/${name}`,prebuiltDetail=SURFACE_APPEARANCE.detailTextures.includes(name)&&cache.prebuilt.has(cache.key(detailKey));
    const size=sizeFor(name,prebuiltDetail),[width,height]=name==='environment'?SURFACE_APPEARANCE.environmentSize:[size,size],key=prebuiltDetail?detailKey:`base/${name}`;
    let record=yield* readRecord(key);
    const hit=record?.kind==='pixels' && record.width===width && record.height===height;
    if (hit) baseQueue.stats.hits++;
    else {baseQueue.stats.misses++; const pixels=yield* pixelsFor(name,width,height,baseQueue); record={kind:'pixels',width,height,...pixels};}
    textures.set(name,textureFrom(name,record)); baseQueue.stats.completed=(baseQueue.stats.completed||0)+1; yield 'boundary';
    if (!hit) yield* writeRecord(key,record);
  }
  for (const [name,create] of geometryFactories()) {
    yield 'boundary'; yield {task:name};
    if (geometries.has(name)) {baseQueue.stats.completed=(baseQueue.stats.completed||0)+1;continue;}
    const key=`base/${name}`, record=yield* readRecord(key);
    let geometry=yield* geometryFrom(record);
    const hit=Boolean(geometry);
    if (hit) baseQueue.stats.hits++;
    else {baseQueue.stats.misses++; const result=create(); geometry=typeof result.next==='function'?yield* result:result;}
    geometry.userData.sharedAsset=true; geometries.set(name,geometry);
    baseQueue.stats.completed=(baseQueue.stats.completed||0)+1; yield 'boundary';
    if (!hit) yield* writeRecord(key,geometryRecord(geometry));
  }
}

function* generateDetails(upload) {
  for (const name of SURFACE_APPEARANCE.detailTextures) {
    yield {task:name};
    const texture=textures.get(name), size=sizeFor(name,true), key=`detail/${name}`;
    if (texture.image.width===size && texture.mipmaps.length>0) {detailQueue.stats.completed=(detailQueue.stats.completed||0)+1;yield 'boundary';continue;}
    const bytes=surfaceGenerationStats().textureBytes+size*size*4*4/3;
    if (bytes>SURFACE_APPEARANCE.generatedTextureBudgetMb*1024*1024) continue;
    let record=yield* readRecord(key);
    const hit=record?.kind==='pixels' && record.width===size && record.height===size && record.mipmaps;
    if (hit) detailQueue.stats.hits++;
    else {detailQueue.stats.misses++;const pixels=yield* pixelsFor(name,size,size,detailQueue,true);record={kind:'pixels',width:size,height:size,...pixels};}
    yield 'boundary';
    // 下一批才替换并上传；若T或位移已关闭窗口，队列不会执行到这里。
    const upgraded=textureFrom(name,record);
    try {
      const steps=upload(upgraded,texture);
      if (steps?.next) while (true) {
        const startedAt=performance.now(),step=steps.next(),elapsed=performance.now()-startedAt;
        detailQueue.stats.uploadCpuMs=(detailQueue.stats.uploadCpuMs||0)+elapsed;
        detailQueue.stats.maxUploadMs=Math.max(detailQueue.stats.maxUploadMs||0,elapsed);
        if (step.done) break;
        yield step.value;
      }
    } catch (error) {upgraded.dispose();throw error;}
    textures.set(name,upgraded); detailQueue.stats.uploads++; detailQueue.stats.completed=(detailQueue.stats.completed||0)+1; yield 'boundary';
    if (!hit) yield* writeRecord(key,record);
  }
}

export function resourceManifest(levelId) {
  const route=createRoute(levelId),tourism={...TOURISM,cities:TOURISM.cities.filter(city=>city.level<=Math.max(3,Number(levelId)))},arc=route.arc;
  const settings=SURFACE_APPEARANCE, selected=names=>Object.fromEntries(names.map(name=>[name,settings[name]]));
  const entries=[];
  for (const quality of ['base','detail']) for (const name of quality==='base'?textureNames:settings.detailTextures) {
    const size=sizeFor(name,quality==='detail'), dimensions=name==='environment'?settings.environmentSize:[size,size];
    entries.push([`${quality}/${name}`, {dimensions,...(name==='foliage-color'?{recipe:FOLIAGE_TEXTURE.recipe,foliageSeed:FOLIAGE_TEXTURE.seed,source:FOLIAGE_TEXTURE.source}:name==='terrain-detail'?{recipe:ROCK_SURFACE.recipe}:name.startsWith('facade')?{recipe:FACADE_SURFACE.recipe}:{}), seed:name==='terrain-detail'?LANDSCAPE.seed:name==='environment'?null:settings.seed,
      mipmaps:quality==='detail', color:name.endsWith('-color')||name==='environment'}]);
  }
  for (const [name] of geometryFactories()) {
    let dependencies={};
    if (name==='fuselage') dependencies=selected(['aircraftSegments','fuselageStepMetres']);
    else if (name.startsWith('engine-')) dependencies=selected([name==='engine-fan'?'fanBlades':'engineSegments']);
    else if (name==='tire') dependencies=selected(['wheelTubeSegments','wheelSegments']);
    else if (name==='window-trim') dependencies=selected(['windowTrimSegments']);
    else if (name==='cockpit-box') dependencies=selected(['cockpitSegments','cockpitRadius']);
    else if (/^(main-wing|wing-leading|tailplane)-/.test(name)) dependencies=selected(['wingSpanSegments','wingChordSegments']);
    else if (name.startsWith('door-')) dependencies={...selected(['doorWidth','doorHeight','doorBorder']),
      position:settings.doorPositions[Number(name.split('-').at(-1))], bodyHeight:AIRCRAFT.bodyHeight};
    if (name.startsWith('loop-terrain-')) {
      const variant=Number(name.split('-').at(-1));
      dependencies={...LOOP_WORLD,variant,...(variant===2?{city:{columns:LANDSCAPE.city.columns,rows:LANDSCAPE.city.loopRows,spacing:LANDSCAPE.city.spacing,roadWidths:CITY_STREETS.widths}}:{})};
    }
    if(name.startsWith('scenery-'))dependencies={settings:SCENERY_DETAIL,shape:name.slice(8)};
    if(name.startsWith('boundary-'))dependencies={...boundarySettings,side:Number(name.split('-').at(-1))};
    entries.push([`base/${name}`,dependencies]);
  }
  const waterShape=Object.fromEntries(['recipe','riverSamples','islandSamples','lakeSubdivisions'].map(k=>[k,REGIONAL_WATER[k]]));
  // 旧田园签名曾包含不参与生成的部署预算；保留其原值，预算调整不重建兼容地景。
  const countryTerrain={...LANDSCAPE,terrain:{...LANDSCAPE.terrain,resourceBudgetMb:25}};
  const waterGeometry=Object.fromEntries(Object.entries(REGIONAL_WATER).filter(([key])=>!key.startsWith('wave')));
  entries.push(['scene/weather',{geometryRecipe:2,settings:WEATHER,levels:LEVELS.filter(level=>level.id<=Math.max(3,Number(levelId))),height:WORLD_HEIGHT.displayScale,...(arc?{arc}:{})}]);
  entries.push(['scene/streets',{settings:CITY_STREETS,tourism,city:LANDSCAPE.city,changsha:JOURNEY.changsha,changshaWest:JOURNEY.changshaWest,water:{...waterShape,shoreWidth:REGIONAL_WATER.shoreWidth},island:JOURNEY.island,lake:JOURNEY.lake,landmarks:LANDSCAPE.landmarks,...(arc?{arc}:{})}]);
  entries.push(['scene/water',{settings:waterGeometry,island:JOURNEY.island,lake:JOURNEY.lake}]);
  entries.push(['scene/terrain',{terrain:LANDSCAPE.terrain,landscape:LANDSCAPE,journey:JOURNEY,route:{id:route.id,arc:route.arc,destination:route.destination,boundary:route.boundary},tourism,treeHeights:TREE_HEIGHTS,trees:TREE_MODELS.species,recipe:1}]);
  entries.push(['scene/aircraft',{aircraft:AIRCRAFT,surface:selected(['aircraftSegments','fuselageStepMetres','engineSegments','fanBlades','wheelTubeSegments','wheelSegments','windowTrimSegments','wingSpanSegments','wingChordSegments','doorPositions','doorWidth','doorHeight','doorBorder','paintBump','rubberBump','metalBump']),recipe:1}]);
  entries.push(['scene/trees',{profiles:treeProfiles,recipe:TREE_MODELS.recipe,seed:TREE_MODELS.seed,nearDetail:TREE_MODELS.nearDetail,farDetail:TREE_MODELS.farDetail,branchSegments:TREE_MODELS.branchSegments,farCrownGroups:TREE_MODELS.farCrownGroups,leaflets:TREE_MODELS.leaflets,midLeafCards:TREE_MODELS.midLeafCards}]);
  entries.push(['scene/country',{recipe:COUNTRYSIDE.cacheRecipe,tourism,water:waterShape,trees:{models:TREE_MODELS.species.map(({id,height,width,tall})=>({id,height,width,tall})),heights:TREE_HEIGHTS,unitHeight:TREE_CONTACT.unitHeight},country:COUNTRYSIDE,terrain:countryTerrain,journey:JOURNEY,world:WORLD_TRAVEL,loop:LOOP_WORLD,blend:REGION_BLEND,...(arc?{arc,destination:route.destination,approachRecipe:1}:{})}]);
  return entries;
}

function geometryFactories() {
  const settings=SURFACE_APPEARANCE;
  const factories = [
    ['fuselage', fuselageGeometry],
    ['engine-shell', () => engineGeometry('shell')],
    ['engine-duct', () => engineGeometry('duct')],
    ['engine-exhaust', () => engineGeometry('exhaust')],
    ['engine-fan', fanGeometry],
    ['tree-crown', treeCrownGeometry],
    ['tree-crown-far', () => treeCrownGeometry(true)],
    ['tire', () => new THREE.TorusGeometry(0.36, 0.12, settings.wheelTubeSegments, settings.wheelSegments).rotateX(Math.PI / 2)],
    ['window-trim', () => new THREE.TorusGeometry(1, 0.05, 4, settings.windowTrimSegments).rotateY(Math.PI / 2)],
    ['cockpit-box', () => new RoundedBoxGeometry(1, 1, 1, settings.cockpitSegments, settings.cockpitRadius)],
  ];
  for (const side of [-1, 1]) {
    const main = [[0,-3],[4,-2.3],[17.5,5.5],[17.5,7.2],[5.5,3],[0,4.8]].map(([x,z])=>[x*side,z]);
    const tail = [[0,0],[6.2,3.1],[6.2,4.2],[0,3]].map(([x,z])=>[x*side,z]);
    factories.push([`main-wing-${side}`,()=>wingGeometry(main,0.3)], [`wing-leading-${side}`,()=>wingGeometry(main,0.3,true)], [`tailplane-${side}`,()=>wingGeometry(tail,0.16)]);
  }
  for (const side of [-1, 1]) settings.doorPositions.forEach((z, index) => factories.push([`door-${side}-${index}`, () => aircraftDoorGeometry(side, z)]));
  for (let variant=0;variant<LOOP_WORLD.variants;variant++) factories.push([`loop-terrain-${variant}`,function* () {
    const data=yield* loopTerrainData(variant), geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
    geometry.setAttribute('biome',new THREE.BufferAttribute(data.biomes,4));
    geometry.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));
    geometry.setIndex(new THREE.BufferAttribute(data.indices,1));yield;
    return geometry;
  }]);
  for(let side=0;side<4;side++)factories.push([`boundary-${side}`,function*(){
    const data=yield* boundaryData(side,boundarySettings),g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
    g.setAttribute('color',new THREE.BufferAttribute(data.colors,3));
    g.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));g.setIndex(new THREE.BufferAttribute(data.indices,1));
    g.computeVertexNormals();yield;return g;
  }]);
  for(const shape of SCENERY_SHAPES)factories.push([`scenery-${shape}`,()=>sceneryGeometry(shape)]);
  return factories;
}

export function surfaceTexture(name) {
  const texture=textures.get(name); if (!texture) throw new Error(`Surface texture not prepared: ${name}`); return texture;
}

export function modelGeometry(name) {
  const geometry=geometries.get(name); if (!geometry) throw new Error(`Model geometry not prepared: ${name}`); return geometry;
}
