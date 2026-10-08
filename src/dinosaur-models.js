import * as THREE from 'three';
import { material } from './models.js';
import { DINOSAURS } from './config.js';

const shapes={body:new THREE.IcosahedronGeometry(.5,1),box:new THREE.BoxGeometry(1,1,1),horn:new THREE.ConeGeometry(.5,1,7)};
const templates=new Map();
function part(parent,color,size,position,shape='body'){
  const mesh=new THREE.Mesh(shapes[shape],material(color));mesh.scale.set(...size);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function limb(parent,color,x,y,z,phase){
  const leg=new THREE.Group();leg.position.set(x,y,z);leg.userData.dinoLeg=phase;parent.add(leg);
  part(leg,color,[.28,y,.32],[0,-y/2,0]);part(leg,0x5c5943,[.34,.16,.6],[0,-y+.08,-.12]);return leg;
}

// 恐龙模板共享几何与材质，头颈、四肢及尾巴保留独立动作节点。
export function dinosaurModel(kind='small'){
  if(templates.has(kind))return templates.get(kind).clone(true);
  const root=new THREE.Group(),small=kind==='small',long=kind==='diplodocus',stego=kind==='stegosaurus';
  const color=small?0xb9854f:long?0x89917b:stego?0x8d9860:0xa78c63;
  part(root,color,[small?.65:1.6,small?.8:1.5,small?1.15:2.7],[0,small?.75:1.65,0]);
  const tail=new THREE.Group();tail.position.set(0,small?.8:1.8,small?.45:1);tail.userData.dinoTail=true;root.add(tail);
  const tailMesh=part(tail,color,[small?.35:.6,small?.35:.65,small?1.2:long?5:2.6],[0,0,small?.5:long?2.2:1.1]);tailMesh.rotation.x=-.16;
  if(small){
    const neck=part(root,color,[.36,.65,.36],[0,1.12,-.53]);neck.rotation.x=-.45;
    part(root,color,[.48,.38,.7],[0,1.42,-.85]);
    for(const side of [-1,1]){limb(root,color,side*.25,.66,.12,side>0?0:Math.PI);part(root,color,[.12,.3,.12],[side*.3,.9,-.4]);part(root,0x202a22,[.035,.07,.08],[side*.245,1.48,-1]);}
  }else{
    for(const side of [-1,1])for(const end of [-1,1])limb(root,color,side*.55,1.25,end*.8,side*end>0?0:Math.PI);
    const neck=new THREE.Group();neck.position.set(0,1.9,-1);neck.userData.dinoNeck=long?'drink':'graze';root.add(neck);
    if(long){
      part(neck,color,[.65,.7,5.6],[0,.25,-2.5]);part(neck,color,[.6,.5,1],[0,.25,-5.35]);
      for(const side of [-1,1])part(neck,0x25302a,[.03,.08,.12],[side*.29,.4,-5.55]);
    }else{
      part(neck,color,[.8,.7,1.2],[0,-.4,-1.15]);
      if(!stego){
        const shield=part(neck,0xb89e6d,[1.75,1.55,.28],[0,.2,.15]);shield.rotation.x=-.35;
        for(const side of [-1,1]){const horn=part(neck,0xe3d4af,[.23,.95,.23],[side*.4,.5,-.8],'horn');horn.rotation.x=-.7;}
        const horn=part(neck,0xe3d4af,[.2,.55,.2],[0,.07,-1.18],'horn');horn.rotation.x=-.8;
      }
      for(const side of [-1,1])part(neck,0x25302a,[.04,.1,.12],[side*.41,-.06,-.7]);
    }
    if(stego){
      for(let i=0;i<7;i++)for(const side of [-1,1]){const plate=part(root,0xb77949,[.14,.8+Math.sin(i/6*Math.PI)*.65,.5],[side*.25,2.45,i*.4-1.2],'horn');plate.rotation.z=side*.18;}
      for(const side of [-1,1])for(const z of [1.7,2.1]){const spike=part(tail,0xe0d1ab,[.15,.75,.15],[side*.25,.3,z],'horn');spike.rotation.z=side*.7;}
    }
  }
  if(small){
    root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=new THREE.Vector3(DINOSAURS.smallWidth/size.x,DINOSAURS.smallHeight/size.y,DINOSAURS.smallLength/size.z);
    const content=new THREE.Group();for(const child of [...root.children])content.add(child);content.position.set(-center.x*scale.x,-bounds.min.y*scale.y,-center.z*scale.z);content.scale.copy(scale);root.add(content);
  }else root.scale.setScalar(long?2.1:1.6);
  templates.set(kind,root);return root.clone(true);
}
export function animateDinosaur(view,time,running=false,phase=0){
  view.traverse(node=>{
    if(node.userData.dinoLeg!==undefined)node.rotation.x=Math.sin(time*(running?10:1.8)+node.userData.dinoLeg+phase)*(running?.65:.035);
    if(node.userData.dinoTail)node.rotation.y=Math.sin(time*1.5+phase)*.12;
    if(node.userData.dinoNeck)node.rotation.x=node.userData.dinoNeck==='drink'?-.1+Math.sin(time*.35+phase)*.32:-.45+Math.sin(time*.35+phase)*.2;
  });
}
