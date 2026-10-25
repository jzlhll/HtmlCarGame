import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_STREETS } from './config.js';
import { surfaceCache } from './surface-assets.js';

export const streetCacheStats={hits:0,misses:0};
const streetResources={};

function roadMaterial() {
  const material=new THREE.MeshStandardMaterial({roughness:1,metalness:0,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6});
  material.customProgramCacheKey=()=> 'city-streets-filtered-v1';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 streetInfo;varying vec3 vStreetInfo;varying vec2 vStreetUv;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvStreetInfo=streetInfo;vStreetUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vStreetInfo;varying vec2 vStreetUv;
      float streetLine(float distance,float halfWidth,float footprint){
        float aa=max(.03,footprint*.65);
        return (1.0-smoothstep(halfWidth-aa,halfWidth+aa,abs(distance)))*(1.0-smoothstep(.8,3.5,footprint));
      }`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float width=vStreetInfo.x,kind=vStreetInfo.y,across=vStreetUv.x,along=vStreetUv.y;
      float fx=fwidth(across),fz=fwidth(along),edge=abs(across)/width;
      vec3 pavement=mix(vec3(.105,.117,.122),vec3(.31,.32,.30),smoothstep(.40,.45,edge));
      float markings=0.0;
      if(kind>.5){
        float lanes=kind>2.5?3.0:kind>1.5?2.0:1.0,laneWidth=width*.72/(lanes*2.0);
        float stripe=streetLine(mod(across+laneWidth*.5,laneWidth)-laneWidth*.5,.55,fx);
        float dash=streetLine(mod(along,24.0)-12.0,5.5,fz);
        markings=stripe*dash*(1.0-smoothstep(.33,.37,edge));
        markings=max(markings,streetLine(abs(across)-width*.375,.7,fx));
        float median=streetLine(across,width*.018,fx);
        pavement=mix(pavement,kind>2.5?vec3(.19,.23,.14):vec3(.55,.43,.17),median);
        float ends=min(along,vStreetInfo.z-along);
        float crosswalk=streetLine(mod(along,6.0)-3.0,1.15,fz)*smoothstep(7.0,9.0,ends)*(1.0-smoothstep(19.0,22.0,ends))*(1.0-smoothstep(.32,.37,edge));
        markings=max(markings,crosswalk);
      }
      diffuseColor.rgb=mix(pavement,vec3(.68,.69,.62),markings);
    `);
    // 对数深度下显式保留路面层级，不依赖仅作用固定管线的偏移。
    shader.fragmentShader=shader.fragmentShader.replace('#include <logdepthbuf_fragment>','#include <logdepthbuf_fragment>\n#ifdef USE_LOGDEPTHBUF\ngl_FragDepth=max(0.0,gl_FragDepth-0.000002);\n#endif');
  };
  return material;
}

function valid(record) {
  if(!record||!(record.positions instanceof Float32Array)||record.positions.length%18||!(record.uv instanceof Float32Array)||record.uv.length!==record.positions.length/3*2||!(record.info instanceof Float32Array)||record.info.length!==record.positions.length||!(record.matrices instanceof Float32Array)||record.matrices.length%16||!(record.colors instanceof Float32Array)||record.colors.length!==record.matrices.length/16*3)return false;
  return [record.positions,record.uv,record.info,record.matrices,record.colors].every(values=>values.every(Number.isFinite));
}

function* generateRecords(network) {
  const chunks=new Map(),size=CITY_STREETS.chunkSize;
  const chunk=(x,z)=>{const key=Math.floor(x/size)+':'+Math.floor(z/size);if(!chunks.has(key))chunks.set(key,{positions:[],uv:[],info:[],matrices:[],colors:[]});return chunks.get(key);};
  for(const [index,p]of network.patches.entries()){
    // 长条路面按空间块切分，以便独立裁剪。
    for(let x=p.minX;x<p.maxX-.001;){const x1=Math.min(p.maxX,(Math.floor(x/size)+1)*size);for(let z=p.minZ;z<p.maxZ-.001;){const z1=Math.min(p.maxZ,(Math.floor(z/size)+1)*size),c=chunk((x+x1)/2,(z+z1)/2);
      for(const [px,pz]of [[x,z],[x,z1],[x1,z],[x1,z],[x,z1],[x1,z1]]){
        c.positions.push(px,CITY_STREETS.elevation,pz);
        // 被地标裁开的片段仍沿用原道路中心线。
        c.uv.push(p.axis===0?px-p.center:pz-p.center,p.axis===0?pz-p.start:px-p.start);
        c.info.push(p.width,p.kind,p.end-p.start);
      }z=z1;}x=x1;}
    if(index%48===0)yield;
  }
  const pose=new THREE.Object3D(),color=new THREE.Color();
  for(const [index,car]of network.cars.entries()){
    const c=chunk(car.x,car.z);pose.position.set(car.x,CITY_STREETS.elevation,car.z);pose.rotation.set(0,car.heading,0);pose.scale.set(car.width,car.height,car.length);pose.updateMatrix();c.matrices.push(...pose.matrix.elements);color.setHex(car.color);c.colors.push(color.r,color.g,color.b);if(index%64===0)yield;
  }
  const result=[];for(const record of chunks.values()){for(const key of Object.keys(record))record[key]=new Float32Array(record[key]);result.push(record);yield;}return result;
}

export function* createCityStreets(network,shared=streetResources) {
  const cache=surfaceCache(),key='scene/streets/'+network.id,records=[];
  const meta=cache.readable?yield {wait:cache.read(key+'/meta')}:null;
  let hit=meta?.recipe===CITY_STREETS.recipe&&Number.isInteger(meta.count)&&meta.count>0&&meta.count<256;
  if(hit)for(let i=0;i<meta.count;i++){const record=yield {wait:cache.read(key+'/'+i)};if(!valid(record)){hit=false;break;}records.push(record);yield;}
  if(hit)streetCacheStats.hits++;
  else {
    streetCacheStats.misses++;records.length=0;records.push(...yield* generateRecords(network));
    if(cache.available){for(const [index,record]of records.entries()){yield {wait:cache.write(key+'/'+index,record)};if(!cache.available)break;}if(cache.available)yield {wait:cache.write(key+'/meta',{recipe:CITY_STREETS.recipe,count:records.length})};}
  }
  shared.road??=roadMaterial();shared.body??=new THREE.BoxGeometry(1,.5,1).translate(0,.4,0);shared.glass??=new THREE.BoxGeometry(.84,.34,.52).translate(0,.72,-.04);
  if(!shared.wheels){const parts=[];for(const x of [-.5,.5])for(const z of [-.32,.32])parts.push(new THREE.BoxGeometry(.12,.3,.2).translate(x,.18,z));shared.wheels=mergeGeometries(parts);parts.forEach(g=>g.dispose());}
  shared.paint??=new THREE.MeshStandardMaterial({roughness:.65,metalness:.12});shared.windows??=new THREE.MeshStandardMaterial({color:0x253c47,roughness:.5,metalness:.08});shared.rubber??=new THREE.MeshStandardMaterial({color:0x202426,roughness:1});
  const group=new THREE.Group();group.name='City streets: '+network.id;
  for(const record of records){
    if(record.positions.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(record.positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(record.uv,2));geometry.setAttribute('streetInfo',new THREE.BufferAttribute(record.info,3));const normals=new Float32Array(record.positions.length);for(let i=1;i<normals.length;i+=3)normals[i]=1;geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.computeBoundingSphere();group.add(new THREE.Mesh(geometry,shared.road));yield;}
    if(record.matrices.length){
      const cars=new THREE.Group(),matrix=new THREE.InstancedBufferAttribute(record.matrices,16),colors=new THREE.InstancedBufferAttribute(record.colors,3);
      for(const [geometry,material,tinted]of [[shared.body,shared.paint,true],[shared.glass,shared.windows,false],[shared.wheels,shared.rubber,false]]){const mesh=new THREE.InstancedMesh(geometry,material,0);mesh.count=matrix.count;mesh.instanceMatrix=matrix;if(tinted)mesh.instanceColor=colors;mesh.computeBoundingSphere();cars.add(mesh);yield;}
      const box=new THREE.Box3().setFromObject(cars),center=box.getCenter(new THREE.Vector3()),lod=new THREE.LOD();lod.position.copy(center);cars.position.copy(center).negate();lod.addLevel(cars,0,.12);lod.addLevel(new THREE.Group(),CITY_STREETS.carFar,.12);group.add(lod);
    }
    yield 'boundary';
  }
  console.info('City streets prepared '+JSON.stringify({id:network.id,cacheHit:hit,chunks:records.length,cars:network.cars.length}));
  return group;
}
