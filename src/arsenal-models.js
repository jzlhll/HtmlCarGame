import * as THREE from 'three';
import { material } from './models.js';
import { COINS, ROCKETS } from './config.js';
const coinGeometry=new THREE.CylinderGeometry(.5,.5,.14,20).rotateX(Math.PI/2),faceGeometry=new THREE.PlaneGeometry(.83,.83);
const bodyGeometry=new THREE.CylinderGeometry(.5,.5,1,10).rotateX(Math.PI/2),noseGeometry=new THREE.ConeGeometry(.5,1,10).rotateX(-Math.PI/2),boxGeometry=new THREE.BoxGeometry(1,1,1);
const templates=new Map();
export function coinModel(large=false){
  const key=large?'large':'small';if(templates.has(key))return templates.get(key).clone(true);
  const root=new THREE.Group(),diameter=large?COINS.largeSize:COINS.smallSize;
  const mesh=new THREE.Mesh(coinGeometry,material(large?0xffd75b:0xe6b84b));root.add(mesh);
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#815722';ctx.font='bold 46px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(large?COINS.largeValue:COINS.smallValue),32,34);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const face=new THREE.MeshBasicMaterial({map:texture,alphaTest:.5});
  for(const side of [-1,1]){const number=new THREE.Mesh(faceGeometry,face);number.position.z=side*.071;number.rotation.y=side<0?Math.PI:0;root.add(number);}
  root.scale.setScalar(diameter);templates.set(key,root);return root.clone(true);
}
export function rocketModel(advanced=false){
  const key=advanced?'advancedRocket':'rocket';if(templates.has(key))return templates.get(key).clone(true);
  const root=new THREE.Group(),length=ROCKETS.modelLength,width=ROCKETS.modelWidth;
  const add=(geometry,color,size,z)=>{const mesh=new THREE.Mesh(geometry,material(color));mesh.scale.set(...size);mesh.position.z=z;root.add(mesh);return mesh;};
  add(bodyGeometry,advanced?0x77d9e6:0xe2e5d6,[width,width,length*.7],0);
  add(noseGeometry,advanced?0x327a99:0xc6553e,[width,width,length*.3],-length*.5);
  for(const side of [-1,1]){const fin=add(boxGeometry,0x344d4a,[width*.8,width*.15,length*.25],length*.28);fin.position.x=side*width*.5;}
  const flame=add(noseGeometry,0xffb347,[width*.6,width*.6,length*.45],length*.65);flame.rotation.y=Math.PI;
  templates.set(key,root);return root.clone(true);
}
