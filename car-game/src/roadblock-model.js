import * as THREE from '../node_modules/three/build/three.module.js';
import { mergeGeometries } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { cachedGeometry } from './model-assets.js';
import { ROADBLOCKS } from './config.js';
let sharedMaterial;
export function roadblockMaterial(){return sharedMaterial??=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.63,metalness:.22});}
// 双层交叉钢梁、反光条、连接板与底脚共享一件顶点色几何，厚度与接触框一致。
export function roadblockGeometry(){return cachedGeometry('roadblock:solid',()=>{
  const pieces=[],box=new THREE.BoxGeometry(1,1,1),bolt=new THREE.IcosahedronGeometry(1,0),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
  const add=(shape,color,size,position,angle=0)=>{
    rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);matrix.compose(new THREE.Vector3(...position),rotation,new THREE.Vector3(...size));
    const geometry=(shape.index?shape.toNonIndexed():shape.clone()),normal=geometry.attributes.normal,colors=new Float32Array(geometry.attributes.position.count*3),rgb=new THREE.Color(color);
    for(let i=0;i<normal.count;i++){const shade=shape===box&&Math.abs(normal.getZ(i))<.5?.70:1;colors[i*3]=rgb.r*shade;colors[i*3+1]=rgb.g*shade;colors[i*3+2]=rgb.b*shade;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.applyMatrix4(matrix);pieces.push(geometry);
  };
  const width=ROADBLOCKS.width,height=ROADBLOCKS.height,depth=ROADBLOCKS.depth,beamWidth=.25,length=Math.hypot(width-.32,height-.30),angle=Math.atan2(width-.32,height-.30),beamDepth=(depth-.07)/2;
  for(const direction of [-1,1]){
    const z=direction*depth*.23;
    add(box,0xd94431,[beamWidth,length,beamDepth],[0,height/2,z],direction*angle);
    for(const edge of [-1,1]){
      const x=edge*(beamWidth/2-.015),y=0;
      add(box,0x444b4b,[.030,length,beamDepth*.96],[x*Math.cos(angle),height/2+x*Math.sin(direction*angle),z],direction*angle);
    }
    for(const face of [-1,1])for(let stripe=-2;stripe<=2;stripe++){
      const y=stripe*length*.17;
      add(box,0xf6ecd4,[beamWidth*.83,.22,.014],[-y*Math.sin(direction*angle),height/2+y*Math.cos(angle),z+face*(beamDepth/2+.009)],direction*angle);
    }
  }
  for(const side of [-1,1]){
    add(box,0x414a4b,[.72,.12,depth],[side*(width/2-.38),.06,0]);
    add(box,0x697274,[.23,.31,depth*.65],[side*(width/2-.38),.23,0]);
  }
  for(const face of [-1,1]){
    add(box,0x4c5556,[.38,.38,.025],[0,height/2,face*(depth/2-.02)]);
    for(const x of [-.115,.115])for(const y of [-.115,.115])add(bolt,0xc4cdd0,[.035,.035,.012],[x,height/2+y,face*(depth/2-.014)]);
  }
  const result=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();box.dispose();bolt.dispose();return result;
});}
