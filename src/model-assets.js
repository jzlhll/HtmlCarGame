import * as THREE from '../node_modules/three/build/three.module.js';

// 后台生成与当前画面共用缓存；重开和切关复用，不重复分配资源。
export const assetGeometries=new Map(),assetTextures=new Map();
export function cachedGeometry(key,create){
  let geometry=assetGeometries.get(key);
  if(!geometry){geometry=create();assetGeometries.set(key,geometry);}
  geometry.userData.assetKey=key;return geometry;
}
export function cachedGeometrySet(key,create){
  const prefix=key+'/',result={},seen=new Set();
  for(const [name,geometry]of assetGeometries)if(name.startsWith(prefix)){if(!seen.has(geometry)){geometry.userData.assetKey=name;seen.add(geometry);}result[name.slice(prefix.length)]=geometry;}
  if(Object.keys(result).length)return result;
  const geometries=create();for(const [name,geometry]of Object.entries(geometries)){if(!seen.has(geometry)){geometry.userData.assetKey=prefix+name;seen.add(geometry);}assetGeometries.set(prefix+name,geometry);}return geometries;
}
// 传输副本保留 Worker 内的原始几何，供后续模型继续合并复用。
export function collectModelAssets(sent){
  const geometries=[],textures=[],transfer=[],known=new Map();
  for(const [key,geometry]of assetGeometries){
    if(!known.has(geometry))known.set(geometry,key);
    if(sent.has(key))continue;
    sent.add(key);const alias=known.get(geometry);
    if(alias!==key){geometries.push({key,alias});continue;}
    const copy=attribute=>{const array=attribute.array.slice();transfer.push(array.buffer);return {array,itemSize:attribute.itemSize,normalized:attribute.normalized};};
    const attributes={};for(const [name,attribute]of Object.entries(geometry.attributes))attributes[name]=copy(attribute);
    geometries.push({key,attributes,index:geometry.index?copy(geometry.index):null});
  }
  for(const [key,texture]of assetTextures)if(!sent.has('texture:'+key)){
    sent.add('texture:'+key);const data=texture.data.slice();transfer.push(data.buffer);textures.push({key,data,width:texture.width,height:texture.height});
  }
  return {geometries,textures,transfer};
}
export function installModelAssets({geometries,textures}){
  for(const record of geometries){
    if(assetGeometries.has(record.key))continue;
    if(record.alias){const source=assetGeometries.get(record.alias);if(!source)throw new Error('Missing geometry alias: '+record.alias);assetGeometries.set(record.key,source);continue;}
    const geometry=new THREE.BufferGeometry(),attribute=value=>new THREE.BufferAttribute(value.array,value.itemSize,value.normalized);
    for(const [name,value]of Object.entries(record.attributes))geometry.setAttribute(name,attribute(value));
    if(record.index)geometry.setIndex(attribute(record.index));assetGeometries.set(record.key,geometry);
  }
  for(const {key,...texture}of textures)if(!assetTextures.has(key))assetTextures.set(key,texture);
}
