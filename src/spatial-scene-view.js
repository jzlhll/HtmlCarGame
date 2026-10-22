import * as THREE from 'three';
import { GEAR_PREVIEW, WORLD_VARIATION } from './config.js';

// 只绑定真实世界对象；索引和大型实例子组在准备期创建，游玩时仅筛选既有引用。
export class SpatialSceneView {
  constructor(source) {
    this.source=source;this.scene=new THREE.Scene();this.scene.matrixWorldAutoUpdate=false;
    this.warmup=new THREE.Scene();this.warmup.matrixWorldAutoUpdate=false;
    this.dynamic=[];this.cells=new Map();this.large=[];this.loopGroups=[];
    this.selected=[];this.seen=new Set();this.parts=new Map();this.warmed=new Set();
    this.frustum=new THREE.Frustum();this.projectionView=new THREE.Matrix4();this.viewBounds=new THREE.Box3();
    this.corner=new THREE.Vector3();this.stats={roots:0,selected:0,candidates:0,partitions:0};
  }

  *prepare(roots,loop) {
    this.warmup.fog=this.source.fog;this.warmup.environment=this.source.environment;
    const fixed=new Set(roots),slotGroups=new Set(loop.slots.map(slot=>slot.group));
    for(const object of this.source.children)if(!fixed.has(object)&&!object.isCamera){
      this.dynamic.push(object);
      if(object.isLight)this.warmup.children.push(object);
    }
    const stack=[...roots];let visited=0;
    while(stack.length){
      const object=stack.pop();
      if(slotGroups.has(object))continue;
      if(object.isLOD||object.geometry){
        for(const record of yield* this.records(object)){this.insert(record);this.stats.roots++;}
      }else stack.push(...object.children);
      if(++visited%64===0)yield;
    }
    // 循环模板用各自局部索引；槽位移动只使对应世界包围盒失效。
    for(const slot of loop.slots)for(const group of slot.group.children){
      const entries=[],pending=[group],bounds=new THREE.Box3(),inverse=group.matrixWorld.clone().invert();
      while(pending.length){
        const object=pending.pop();
        if(object.isLOD||object.geometry){
          for(const record of yield* this.records(object)){entries.push(record);bounds.union(record.worldBounds);this.stats.roots++;}
        }else pending.push(...object.children);
        if(++visited%64===0)yield;
      }
      bounds.applyMatrix4(inverse);
      this.loopGroups.push({object:group,entries,bounds,worldBounds:bounds.clone().applyMatrix4(group.matrixWorld),matrix:group.matrixWorld.clone()});yield;
    }
    this.scene.children=this.selected;
  }

  *records(source) {
    const varying=[];for(let parent=source;parent&&parent!==this.source;parent=parent.parent)varying.push(parent);
    const custom=source.geometry&&Object.values(source.geometry.attributes).some(attribute=>attribute.isInstancedBufferAttribute);
    const split=source.isInstancedMesh&&source.count>=GEAR_PREVIEW.instanceSplitCount&&!source.morphTexture&&!custom&&!varying.some(object=>object.userData.variableInstances);
    const parts=split?yield* this.partition(source):null;
    const objects=parts||[source],result=[];
    for(const object of objects){
      const gates=object===source?varying.slice(1):varying;
      let bounds;
      if(object.isCanopyLOD)bounds=object.localBounds.clone();
      else if(object.isInstancedMesh){if(!object.boundingBox)object.computeBoundingBox();bounds=object.boundingBox.clone();}
      else if(object.geometry){if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();bounds=object.geometry.boundingBox.clone();}
      else{
        bounds=new THREE.Box3().setFromObject(object);bounds.applyMatrix4(object.matrixWorld.clone().invert());
      }
      // 重开时楼房实例可在原位置两侧抖动，保守覆盖所有允许位置。
      if(varying.some(value=>value.userData.variableInstances)){
        const margin=WORLD_VARIATION.cityJitter*2;bounds.min.x-=margin;bounds.max.x+=margin;bounds.min.z-=margin;bounds.max.z+=margin;
      }
      if(bounds.isEmpty())continue;
      result.push({object,source,gates,bounds,worldBounds:bounds.clone().applyMatrix4(source.matrixWorld),matrix:source.matrixWorld.clone()});
      if(result.length%64===0)yield;
    }
    return result;
  }

  *partition(source) {
    let geometries=this.parts.get(source.instanceMatrix);
    if(!geometries)this.parts.set(source.instanceMatrix,geometries=new Map());
    const key=source.geometry.id+':'+(source.instanceColor?.id??'')+':'+source.count;
    let parts=geometries.get(key);
    if(!parts){
      const geometry=source.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
      const buckets=new Map(),matrix=new THREE.Matrix4(),bounds=new THREE.Box3(),center=new THREE.Vector3(),size=GEAR_PREVIEW.instanceCellSize;
      for(let i=0;i<source.count;i++){
        matrix.fromArray(source.instanceMatrix.array,i*16);bounds.copy(geometry.boundingBox).applyMatrix4(matrix);bounds.getCenter(center);
        const key=Math.floor(center.x/size)+':'+Math.floor(center.y/size)+':'+Math.floor(center.z/size);
        if(!buckets.has(key))buckets.set(key,{ids:[],bounds:new THREE.Box3()});
        const bucket=buckets.get(key);bucket.ids.push(i);bucket.bounds.union(bounds);if(i%64===0)yield;
      }
      parts=[];
      if(buckets.size>1)for(const bucket of buckets.values()){
        const matrices=new Float32Array(bucket.ids.length*16),colors=source.instanceColor?new Float32Array(bucket.ids.length*3):null;
        for(const [i,id]of bucket.ids.entries()){
          matrices.set(source.instanceMatrix.array.subarray(id*16,id*16+16),i*16);
          if(colors)colors.set(source.instanceColor.array.subarray(id*3,id*3+3),i*3);
          if(i%64===0)yield;
        }
        parts.push({count:bucket.ids.length,matrix:new THREE.InstancedBufferAttribute(matrices,16),color:colors?new THREE.InstancedBufferAttribute(colors,3):null,bounds:bucket.bounds});yield;
      }
      geometries.set(key,parts);
    }
    if(!parts.length)return null;
    const objects=[];
    for(const part of parts){
      const object=new THREE.InstancedMesh(source.geometry,source.material,0);
      object.count=part.count;object.instanceMatrix=part.matrix;object.instanceColor=part.color;
      object.boundingBox=part.bounds;object.boundingSphere=part.bounds.getBoundingSphere(new THREE.Sphere());
      object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false;object.matrixWorld=source.matrixWorld;
      object.layers.mask=source.layers.mask;object.renderOrder=source.renderOrder;object.receiveShadow=source.receiveShadow;object.castShadow=source.castShadow;
      object.name='Spatial instances';objects.push(object);
      if(!this.warmed.has(part)){this.warmed.add(part);this.warmup.children.push(object);this.stats.partitions++;}
      if(objects.length%64===0)yield;
    }
    return objects;
  }

  insert(record) {
    const size=GEAR_PREVIEW.spatialCellSize,bounds=record.worldBounds;
    const left=Math.floor(bounds.min.x/size),right=Math.floor(bounds.max.x/size),back=Math.floor(bounds.min.z/size),front=Math.floor(bounds.max.z/size);
    if((right-left+1)*(front-back+1)>GEAR_PREVIEW.spatialMaxCells){this.large.push(record);return;}
    for(let z=back;z<=front;z++)for(let x=left;x<=right;x++){
      const key=x+':'+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(record);
    }
  }

  select(camera) {
    const scene=this.scene;scene.background=this.source.background;scene.fog=this.source.fog;scene.environment=this.source.environment;scene.overrideMaterial=this.source.overrideMaterial;
    this.selected.length=0;this.seen.clear();this.stats.candidates=0;
    for(const object of this.dynamic)this.selected.push(object);
    this.frustum.setFromProjectionMatrix(this.projectionView.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);
    this.viewBounds.makeEmpty();
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])this.viewBounds.expandByPoint(this.corner.set(x,y,z).unproject(camera));
    const size=GEAR_PREVIEW.spatialCellSize,bounds=this.viewBounds;
    for(let z=Math.floor(bounds.min.z/size);z<=Math.floor(bounds.max.z/size);z++)for(let x=Math.floor(bounds.min.x/size);x<=Math.floor(bounds.max.x/size);x++){
      const records=this.cells.get(x+':'+z);if(records)for(const record of records)this.consider(record);
    }
    for(const record of this.large)this.consider(record);
    for(const group of this.loopGroups){
      if(!group.object.visible||!group.object.parent.visible)continue;
      if(!group.matrix.equals(group.object.matrixWorld)){group.matrix.copy(group.object.matrixWorld);group.worldBounds.copy(group.bounds).applyMatrix4(group.matrix);}
      if(this.frustum.intersectsBox(group.worldBounds))for(const record of group.entries)this.consider(record);
    }
    this.stats.selected=this.selected.length;return scene;
  }

  consider(record) {
    if(this.seen.has(record))return;this.seen.add(record);this.stats.candidates++;
    if(!record.object.visible||record.gates.some(object=>!object.visible))return;
    if(!record.matrix.equals(record.source.matrixWorld)){record.matrix.copy(record.source.matrixWorld);record.worldBounds.copy(record.bounds).applyMatrix4(record.matrix);}
    if(this.frustum.intersectsBox(record.worldBounds))this.selected.push(record.object);
  }
}
