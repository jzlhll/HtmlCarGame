import * as THREE from 'three';
import { CanopyLOD } from './canopy-lod.js';
import { TREE_MODELS, VIEW_DISTANCE } from './config.js';

// 树木始终使用同一完整模型；空间分块只控制可见性，不在飞近时替换冠形或枝叶。
export function* createForestLOD(record,trees,centerZ=0,{treeField}={}) {
  const root=new THREE.Group(),chunks=new Map(),size=TREE_MODELS.chunkSize,matrix=new THREE.Matrix4(),color=new THREE.Color(),tint=new THREE.Color();
  root.name='Forest chunks';const rangeBounds=new THREE.Box3(),visibleDistance=TREE_MODELS.visibleDistance*VIEW_DISTANCE.scale;
  for(let i=0;i<record.count;i++){
    const offset=i*16,x=record.matrices[offset+12],z=record.matrices[offset+14],key=Math.floor(x/size)+':'+Math.floor((z-centerZ)/size);
    let chunk=chunks.get(key);if(!chunk)chunks.set(key,chunk=Array.from({length:TREE_MODELS.species.length},()=>[]));
    chunk[record.species[i]].push(i);if(i%128===0)yield;
  }
  for(const byType of chunks.values()){
    const group=new THREE.Group(),bounds=new THREE.Box3();
    for(const [type,ids]of byType.entries()){
      if(!ids.length)continue;
      const model=trees.bank[type],mesh=new THREE.InstancedMesh(model.geometry,model.material,ids.length);tint.setHex(TREE_MODELS.species[type].color);
      for(const [index,id]of ids.entries()){
        matrix.fromArray(record.matrices,id*16);mesh.setMatrixAt(index,matrix);
        color.fromArray(record.colors,id*3).lerp(tint,.65).multiplyScalar(1.13);mesh.setColorAt(index,color);
        if(index%64===0)yield;
      }
      mesh.position.z=-centerZ;mesh.computeBoundingBox();mesh.computeBoundingSphere();
      bounds.union(mesh.boundingBox);group.add(mesh);yield;
    }
    rangeBounds.union(bounds);bounds.min.z-=centerZ;bounds.max.z-=centerZ;
    // 远端平滑淡出后才隐藏，主视口和脚部小窗各自执行同源保守裁剪。
    const visibility=new CanopyLOD(bounds);visibility.name='Forest fixed';visibility.position.z=centerZ;
    visibility.addLevel(group,0,.12);visibility.addLevel(new THREE.Group(),visibleDistance,0);root.add(visibility);yield;
  }
  if(treeField)yield* treeField.addMatrices(record.matrices,record.count,record.species);
  if(rangeBounds.isEmpty())return root;
  const range=new CanopyLOD(rangeBounds);range.name='Forest range';range.userData.spatialExpand=true;range.addLevel(root,0,.12);range.addLevel(new THREE.Group(),visibleDistance,0);return range;
}
