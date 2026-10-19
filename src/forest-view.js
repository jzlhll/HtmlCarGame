import * as THREE from 'three';
import { CanopyLOD } from './canopy-lod.js';
import { TREE_MODELS } from './config.js';

export function* createForestLOD(record,trees,centerZ=0,{treeNear=1800,treeFar=10500,treeField}={}) {
  const nearGroup=new THREE.Group(),farGroup=new THREE.Group(),bounds=new THREE.Box3(),matrix=new THREE.Matrix4(),color=new THREE.Color(),tint=new THREE.Color();
  const byType=Array.from({length:TREE_MODELS.species.length},()=>[]);
  for(let i=0;i<record.count;i++)byType[record.species[i]].push(i);
  for(const [type,ids]of byType.entries()){
    if(!ids.length)continue;
    const model=trees.bank[type],near=new THREE.InstancedMesh(model.geometry,model.material,ids.length);
    tint.setHex(TREE_MODELS.species[type].color);
    for(const [index,id]of ids.entries()){
      matrix.fromArray(record.matrices,id*16);near.setMatrixAt(index,matrix);
      color.fromArray(record.colors,id*3).lerp(tint,.65).multiplyScalar(1.13);near.setColorAt(index,color);
      if(index%128===0)yield;
    }
    near.position.z=-centerZ;near.computeBoundingBox();near.computeBoundingSphere();
    bounds.union(near.boundingBox);nearGroup.add(near);
    const far=new THREE.InstancedMesh(model.farGeometry,model.farMaterial,0);far.count=near.count;far.instanceMatrix=near.instanceMatrix;far.instanceColor=near.instanceColor;far.position.z=-centerZ;far.computeBoundingSphere();farGroup.add(far);yield;
  }
  bounds.min.z-=centerZ;bounds.max.z-=centerZ;
  const lod=new CanopyLOD(bounds);lod.position.z=centerZ;lod.addLevel(nearGroup,0,.12);lod.addLevel(farGroup,treeNear,.12);lod.addLevel(new THREE.Group(),treeFar,.12);
  if(treeField)yield* treeField.addMatrices(record.matrices,record.count,record.species);
  return lod;
}
