import * as THREE from 'three';
import { LANDSCAPE, SCENERY_DETAIL } from './config.js';
import { CanopyLOD } from './canopy-lod.js';
import { modelGeometry } from './surface-assets.js';
import { createSceneryMaterial, sceneryFinish } from './scenery-material.js';

// 预制原型由必需资源缓存恢复，所有构件按空间块实例化，飞行中不创建模型。
export function* createTourismView(parts) {
  const group=new THREE.Group(),batches=new Map(),pose=new THREE.Object3D(),color=new THREE.Color(),material=createSceneryMaterial();
  for(const [index,part]of parts.entries()){
    const key=`${Math.floor(part.x/LANDSCAPE.city.chunkSize)},${Math.floor(part.z/LANDSCAPE.city.chunkSize)}:${part.shape}`;
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(part);if(index%128===0)yield;
  }
  for(const selected of batches.values()){
    const source=modelGeometry('scenery-'+selected[0].shape),geometry=new THREE.BufferGeometry();
    for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);if(source.index)geometry.setIndex(source.index);
    const styles=new Float32Array(selected.length*4);geometry.setAttribute('scenerySurface',new THREE.InstancedBufferAttribute(styles,4));
    const mesh=new THREE.InstancedMesh(geometry,material,selected.length);
    for(const [index,part]of selected.entries()){
      pose.position.set(part.x,part.y,part.z);pose.rotation.set(0,part.heading||0,0);pose.scale.set(part.width,part.height,part.depth);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);mesh.setColorAt(index,color.setHex(part.color));
      styles.set([sceneryFinish(part),(Math.abs(part.x*.013+part.z*.017)%1)*20,part.width,part.height],index*4);if(index%64===0)yield;
    }
    mesh.computeBoundingSphere();mesh.receiveShadow=true;
    if(['sphere','roof'].includes(selected[0].shape)){
      const source=modelGeometry('scenery-'+selected[0].shape+'-far'),farGeometry=new THREE.BufferGeometry();
      for(const [name,attribute]of Object.entries(source.attributes))farGeometry.setAttribute(name,attribute);farGeometry.setAttribute('scenerySurface',geometry.attributes.scenerySurface);
      const far=new THREE.InstancedMesh(farGeometry,material,0);far.count=mesh.count;far.instanceMatrix=mesh.instanceMatrix;far.instanceColor=mesh.instanceColor;far.receiveShadow=true;far.computeBoundingSphere();
      mesh.computeBoundingBox();const lod=new CanopyLOD(mesh.boundingBox);lod.userData.detailKind='architecture';lod.addLevel(mesh,0,.12);lod.addLevel(far,SCENERY_DETAIL.detailDistance,.12);group.add(lod);
    }else group.add(mesh);yield;
  }
  return group;
}
