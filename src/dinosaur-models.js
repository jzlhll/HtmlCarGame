import * as THREE from 'three';
import { material } from './models.js';
import { DINOSAURS } from './config.js';

const shapes={body:new THREE.IcosahedronGeometry(.5,1),box:new THREE.BoxGeometry(1,1,1),horn:new THREE.ConeGeometry(.5,1,7)};
const templates=new Map();
const animations=new WeakMap();
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
  if(kind==='chaser'){
    const root=new THREE.Group(),color=0x657951,belly=0xb1ad7c;
    root.userData.dinoRunner=true;
    part(root,color,[3.8,4.2,7],[0,5.3,0]);
    part(root,belly,[2.8,2.9,4.7],[0,4.4,-1.1]);
    const tail=new THREE.Group();tail.position.set(0,5.3,2.4);tail.userData.dinoTail=true;root.add(tail);
    const tip=part(tail,color,[2.5,2.6,10],[0,-.2,4.2]);tip.rotation.x=.13;
    part(root,color,[2.5,3.8,3],[0,7.1,-3.1]);
    part(root,color,[3.3,2.4,4.6],[0,8.5,-5.1]);
    part(root,belly,[2.8,.7,4.1],[0,7.55,-5.2],'box');
    part(root,0x26372a,[2.85,.18,3.6],[0,7.94,-5.45],'box');
    for(const side of [-1,1]){
      part(root,0xead184,[.12,.48,.55],[side*1.6,8.95,-5.9]);
      part(root,0x172920,[.13,.3,.25],[side*1.65,8.97,-6]);
      for(let i=0;i<4;i++){const tooth=part(root,0xf1e5b8,[.23,.44,.23],[side*1.25,7.82,-4.5-i*.65],'horn');tooth.rotation.z=Math.PI;}
      const leg=new THREE.Group();leg.position.set(side*1.55,4.2,.45);leg.userData.dinoLeg=side>0?0:Math.PI;root.add(leg);
      part(leg,color,[1.6,2.9,2.2],[0,-1.25,.2]);
      part(leg,color,[.95,2.1,1.05],[0,-3.05,.7]);
      part(leg,0x88936a,[1.6,.55,2.5],[0,-3.91,-.1]);
      for(const toe of [-1,0,1]){part(leg,0xd4c69a,[.32,.32,.85],[toe*.48,-3.94,-1.35-(toe===0?.2:0)]);}
      const arm=part(root,color,[.6,1.8,.7],[side*1.8,5.9,-2.5]);arm.rotation.x=-.6;
      part(root,0xd4c69a,[.65,.35,.55],[side*1.8,5.15,-3.1]);
    }
    normalize(root,DINOSAURS.chaserWidth,DINOSAURS.chaserHeight,DINOSAURS.chaserLength);
    const content=root.children[0];
    for(const leg of content.children)if(leg.userData.dinoLeg!==undefined)leg.position.x=(leg.userData.dinoLeg===0?1:-1)*DINOSAURS.footSpread/content.scale.x;
    templates.set(kind,root);return root.clone(true);
  }
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
    normalize(root,DINOSAURS.smallWidth,DINOSAURS.smallHeight,DINOSAURS.smallLength);
  }else{root.userData.dinoScale=long?DINOSAURS.diplodocusScale:DINOSAURS.grazerScale;root.scale.setScalar(root.userData.dinoScale);}
  templates.set(kind,root);return root.clone(true);
}
function normalize(root,width,height,length){
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scale=new THREE.Vector3(width/size.x,height/size.y,length/size.z);
  const content=new THREE.Group();for(const child of [...root.children])content.add(child);content.position.set(-center.x*scale.x,-bounds.min.y*scale.y,-center.z*scale.z);content.scale.copy(scale);root.add(content);
}
export function animateDinosaur(view,time,running=false,phase=0,hop=0,jumpSide=0){
  let nodes=animations.get(view);
  if(!nodes){nodes=[];view.traverse(node=>{if(node.userData.dinoLeg!==undefined||node.userData.dinoTail||node.userData.dinoNeck)nodes.push(node);});animations.set(view,nodes);}
  for(const node of nodes){
    if(node.userData.dinoLeg!==undefined){
      if(view.userData.dinoRunner&&jumpSide)node.rotation.x=(node.userData.dinoLeg===0?1:-1)===jumpSide?-.25*hop:.65*hop;
      else node.rotation.x=Math.sin((view.userData.dinoRunner?phase*Math.PI*2:time*(running?10:1.8)+phase)+node.userData.dinoLeg)*(view.userData.dinoRunner?.4:running?.65:.035);
    }
    if(node.userData.dinoTail)node.rotation.y=Math.sin(view.userData.dinoRunner?phase*Math.PI*2:time*1.5+phase)*.12;
    if(node.userData.dinoNeck)node.rotation.x=node.userData.dinoNeck==='drink'?-.1+Math.sin(time*.35+phase)*.32:-.45+Math.sin(time*.35+phase)*.2;
  }
}
