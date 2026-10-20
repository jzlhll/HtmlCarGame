import * as THREE from 'three';
import { CanopyLOD } from './canopy-lod.js';
import { TREE_MODELS, COUNTRYSIDE } from './config.js';

// 在准备期按空间块分组，靠近一棵树不会把整片十二公里森林都切成近模。
export function* createForestLOD(record,trees,centerZ=0,{treeNear=COUNTRYSIDE.treeNear,treeFar=COUNTRYSIDE.treeFar,treeField}={}) {
  const root=new THREE.Group(),chunks=new Map(),size=TREE_MODELS.chunkSize,matrix=new THREE.Matrix4(),color=new THREE.Color(),tint=new THREE.Color();
  root.name='Forest chunks';const rangeBounds=new THREE.Box3(),visibleDistance=Math.max(treeFar,TREE_MODELS.visibleDistance);
  for(let i=0;i<record.count;i++){
    const offset=i*16,x=record.matrices[offset+12],z=record.matrices[offset+14],key=Math.floor(x/size)+':'+Math.floor((z-centerZ)/size);
    let chunk=chunks.get(key);if(!chunk)chunks.set(key,chunk=Array.from({length:TREE_MODELS.species.length},()=>[]));
    chunk[record.species[i]].push(i);if(i%128===0)yield;
  }
  for(const byType of chunks.values()){
    const levels=[new THREE.Group(),new THREE.Group(),new THREE.Group()],bounds=new THREE.Box3();
    for(const [type,ids]of byType.entries()){
      if(!ids.length)continue;
      const model=trees.bank[type],near=new THREE.InstancedMesh(model.geometry,model.material,ids.length);tint.setHex(TREE_MODELS.species[type].color);
      for(const [index,id]of ids.entries()){
        matrix.fromArray(record.matrices,id*16);near.setMatrixAt(index,matrix);
        color.fromArray(record.colors,id*3).lerp(tint,.65).multiplyScalar(1.13);near.setColorAt(index,color);
        if(index%64===0)yield;
      }
      near.position.z=-centerZ;near.computeBoundingBox();near.computeBoundingSphere();bounds.union(near.boundingBox);levels[0].add(near);
      for(const [index,geometry,material]of [[1,model.midGeometry,model.midMaterial],[2,model.farGeometry,model.farMaterial]]){
        const mesh=new THREE.InstancedMesh(geometry,material,0);mesh.count=near.count;mesh.instanceMatrix=near.instanceMatrix;mesh.instanceColor=near.instanceColor;mesh.position.z=-centerZ;mesh.computeBoundingBox();mesh.computeBoundingSphere();bounds.union(mesh.boundingBox);levels[index].add(mesh);
      }yield;
    }
    rangeBounds.union(bounds);bounds.min.z-=centerZ;bounds.max.z-=centerZ;
    const lod=new CanopyLOD(bounds);lod.position.z=centerZ;lod.addLevel(levels[0],0,.12);lod.addLevel(levels[1],treeNear,.12);lod.addLevel(levels[2],TREE_MODELS.midDistance,.12);lod.addLevel(new THREE.Group(),visibleDistance,.12);root.add(lod);yield;
  }
  // 接触索引只登记原始记录一次，不能随LOD块数重复添加。
  if(treeField)yield* treeField.addMatrices(record.matrices,record.count,record.species);
  if(rangeBounds.isEmpty())return root;
  // 外层先隐藏整片超出树木视距的模板，避免每帧遍历其中全部细节块。
  const range=new CanopyLOD(rangeBounds);range.name='Forest range';range.addLevel(root,0,.12);range.addLevel(new THREE.Group(),visibleDistance,.12);return range;
}
