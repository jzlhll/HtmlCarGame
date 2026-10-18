import * as THREE from 'three';
import { COUNTRYSIDE } from './config.js';
import { surfaceCache, sceneCacheStats } from './surface-assets.js';

const attributes=['position','normal','color','uv','landUse'];

// 持久层只保存数值缓冲；材质、GPU对象和树冠纹理仍由当前渲染器持有。
export function* restoreCountryside(key,fieldMaterial,roadMaterial,trees,centerZ,{treeNear=COUNTRYSIDE.treeNear,treeFar=COUNTRYSIDE.treeFar}={}) {
  const cache=surfaceCache();
  if(!cache.available){sceneCacheStats.misses++;return null;}
  const meta=yield {wait:cache.read(key+'/meta')};
  if(!meta||meta.recipe!==COUNTRYSIDE.cacheRecipe||!Number.isInteger(meta.count)||meta.count<1||meta.count>100){sceneCacheStats.misses++;return null;}
  const records=[];
  for(let i=0;i<meta.count;i++){
    const record=yield {wait:cache.read(key+'/geometry/'+i)};
    const count=record?.attributes?.position?.length/3;
    if(!Number.isInteger(count)||count<1||!['field','road'].includes(record.role)||!(record.indices instanceof Uint16Array||record.indices instanceof Uint32Array)||record.indices.some(value=>value>=count)){sceneCacheStats.misses++;return null;}
    for(const name of attributes){
      const value=record.attributes[name];if(value===undefined)continue;
      const size=name==='uv'?2:name==='landUse'?1:3;
      if(!(value instanceof Float32Array)||value.length!==count*size||!value.every(Number.isFinite)){sceneCacheStats.misses++;return null;}
    }
    if(!record.attributes.normal||!record.attributes.color||!record.attributes.uv||record.role==='field'&&!record.attributes.landUse){sceneCacheStats.misses++;return null;}
    records.push(record);yield;
  }
  let forest;
  if(meta.forest){
    forest=yield {wait:cache.read(key+'/forest')};
    if(!forest||!Number.isInteger(forest.count)||forest.count<0||!(forest.matrices instanceof Float32Array)||forest.matrices.length!==forest.count*16||!(forest.colors instanceof Float32Array)||forest.colors.length!==forest.count*3||!forest.matrices.every(Number.isFinite)||!forest.colors.every(Number.isFinite)){sceneCacheStats.misses++;return null;}
  }
  const group=new THREE.Group();
  for(const record of records){
    const geometry=new THREE.BufferGeometry();
    for(const name of attributes)if(record.attributes[name])geometry.setAttribute(name,new THREE.BufferAttribute(record.attributes[name],name==='uv'?2:name==='landUse'?1:3));
    geometry.setIndex(new THREE.BufferAttribute(record.indices,1));geometry.computeBoundingSphere();group.add(new THREE.Mesh(geometry,record.role==='field'?fieldMaterial:roadMaterial));yield;
  }
  if(forest&&trees){
    const near=new THREE.InstancedMesh(trees.geometry,trees.material,0);near.count=forest.count;
    near.instanceMatrix=new THREE.InstancedBufferAttribute(forest.matrices,16);near.instanceColor=new THREE.InstancedBufferAttribute(forest.colors,3);near.position.z=-centerZ;near.computeBoundingSphere();yield;
    const lod=new THREE.LOD();lod.position.z=centerZ;lod.addLevel(near,0,.12);
    if(trees.farGeometry){const far=new THREE.InstancedMesh(trees.farGeometry,trees.farMaterial,0);far.count=near.count;far.instanceMatrix=near.instanceMatrix;far.instanceColor=near.instanceColor;far.position.z=-centerZ;far.boundingSphere=near.boundingSphere.clone();far.boundingSphere.radius+=4;lod.addLevel(far,treeNear,.12);}
    lod.addLevel(new THREE.Group(),treeFar,.12);group.add(lod);
  }
  sceneCacheStats.hits++;return group;
}

export function* saveCountryside(key,group,fieldMaterial) {
  const cache=surfaceCache();if(!cache.available)return;
  const records=[];let forest;
  group.traverse(object=>{
    if(object.isInstancedMesh&&!forest)forest=object;
    else if(object.isMesh&&!object.isInstancedMesh)records.push(object);
  });
  for(const [index,mesh]of records.entries()){
    const values={};for(const name of attributes)if(mesh.geometry.attributes[name])values[name]=mesh.geometry.attributes[name].array;
    yield {wait:cache.write(key+'/geometry/'+index,{role:mesh.material===fieldMaterial?'field':'road',attributes:values,indices:mesh.geometry.index.array})};
    if(!cache.available)return;
  }
  if(forest){
    yield {wait:cache.write(key+'/forest',{count:forest.count,matrices:forest.instanceMatrix.array.slice(0,forest.count*16),colors:forest.instanceColor?forest.instanceColor.array.slice(0,forest.count*3):new Float32Array(forest.count*3)})};
    if(!cache.available)return;
  }
  // 全部缓冲写入成功后登记目录，未完成的数据不会作为命中。
  yield {wait:cache.write(key+'/meta',{recipe:COUNTRYSIDE.cacheRecipe,count:records.length,forest:Boolean(forest)})};
}
