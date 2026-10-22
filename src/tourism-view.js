import * as THREE from 'three';
import { sceneryShape } from './tourism-layout.js';
import { LANDSCAPE } from './config.js';

// 共享少量单位原型，按空间块和形状实例化；飞行中不生成景点资源。
export function* createTourismView(parts) {
  const group=new THREE.Group(),geometries=new Map(),batches=new Map(),pose=new THREE.Object3D(),color=new THREE.Color();
  const material=new THREE.MeshStandardMaterial({roughness:.78,metalness:.06});
  for(const part of parts){
    const key=`${Math.floor(part.x/LANDSCAPE.city.chunkSize)},${Math.floor(part.z/LANDSCAPE.city.chunkSize)}:${part.shape}`;
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(part);
  }
  for(const selected of batches.values()){
    const kind=selected[0].shape;
    if(!geometries.has(kind)){
      const {vertices,faces}=sceneryShape(kind),positions=[];
      for(const face of faces)for(let i=1;i<face.length-1;i++){
        const a=vertices[face[0]],b=vertices[face[i]],c=vertices[face[i+1]],u=b.map((v,k)=>v-a[k]),v=c.map((n,k)=>n-a[k]);
        const dot=(u[1]*v[2]-u[2]*v[1])*a[0]+(u[2]*v[0]-u[0]*v[2])*a[1]+(u[0]*v[1]-u[1]*v[0])*a[2];
        positions.push(...a,...(dot<0?c:b),...(dot<0?b:c));
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometries.set(kind,geometry);
    }
    const mesh=new THREE.InstancedMesh(geometries.get(kind),material,selected.length);
    for(const [index,part]of selected.entries()){
      pose.position.set(part.x,part.y,part.z);pose.rotation.set(0,part.heading||0,0);pose.scale.set(part.width,part.height,part.depth);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);mesh.setColorAt(index,color.setHex(part.color));
    }
    mesh.computeBoundingSphere();group.add(mesh);yield;
  }
  return group;
}
