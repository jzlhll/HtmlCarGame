import * as THREE from '../node_modules/three/build/three.module.js';
import { cachedGeometry, cachedGeometrySet } from './model-assets.js';
import { mergeGeometries } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { material, cacheModelBounds } from './models.js';
import { surfaceMaterial } from './model-surfaces.js';
import { DINOSAURS } from './config.js';

// 环形截面构成收细的躯干与尾巴，避免把动物拼成一串球体。
function profileGeometry(sections,sides=28){
  const curve=new THREE.CatmullRomCurve3(sections.map(([z,width,height])=>new THREE.Vector3(width,height,z)),false,'catmullrom',.35);
  const rings=sections.length*5,positions=[],uvs=[],colors=[],indices=[];
  for(let ring=0;ring<=rings;ring++){
    const t=ring/rings,p=curve.getPoint(t),index=Math.min(sections.length-2,Math.floor(t*(sections.length-1))),blend=t*(sections.length-1)-index;
    const z=p.z,width=Math.max(.002,p.x),height=Math.max(.002,p.y),y=(sections[index][3]??0)*(1-blend)+(sections[index+1][3]??0)*blend;
    for(let side=0;side<=sides;side++){
      const angle=side/sides*Math.PI*2;
      const vertical=Math.sin(angle),muscle=1+.015*Math.sin(z*23+angle*3);
      positions.push(Math.cos(angle)*width*muscle,y+vertical*height,z);uvs.push(side/sides,ring/rings);
      const shade=.78+.22*Math.max(0,vertical)+.055*Math.sin(z*17+angle*.5);colors.push(shade*.98,shade,shade*.93);
      if(ring&&side){const a=(ring-1)*(sides+1)+side-1,b=ring*(sides+1)+side-1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function plateGeometry(){
  const shape=new THREE.Shape();shape.moveTo(-.42,0);shape.lineTo(-.53,.3);shape.lineTo(-.38,.78);shape.lineTo(-.1,1);shape.lineTo(.22,.88);shape.lineTo(.48,.48);shape.lineTo(.38,0);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false});geometry.rotateY(Math.PI/2);geometry.translate(-.035,0,0);return geometry;
}
function frillGeometry(){
  const shape=new THREE.Shape();
  for(let i=0;i<=32;i++){
    const a=i/32*Math.PI*2,r=1+(i%2?.035:0),x=Math.cos(a)*r,y=Math.sin(a)*r;
    if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:true,bevelThickness:.025,bevelSize:.035,bevelSegments:1});geometry.translate(0,0,-.05);return geometry;
}
let shapes;
function dinosaurShapes(){return shapes??=cachedGeometrySet('dinosaur',()=>({body:new THREE.SphereGeometry(.5,24,16),skin:new THREE.SphereGeometry(.5,28,18),box:new THREE.BoxGeometry(1,1,1),horn:new THREE.ConeGeometry(.5,1,10),plate:plateGeometry(),frill:frillGeometry(),
  torso:profileGeometry([[-.5,.01,.01],[-.42,.27,.31],[-.25,.46,.45],[0,.5,.5],[.23,.44,.44],[.41,.26,.27],[.5,.01,.01]]),
  tail:profileGeometry([[0,.5,.5],[.16,.41,.4,.01],[.35,.29,.28,.02],[.57,.17,.16,.05],[.78,.07,.07,.09],[1,.006,.006,.14]]),
  skull:profileGeometry([[-.53,.002,.002,-.06],[-.50,.27,.24,-.06],[-.42,.31,.28,-.03],[-.22,.35,.32],[.05,.48,.43],[.28,.5,.45],[.46,.34,.35],[.50,.002,.002]]),
}));}
const skinMaterial=color=>surfaceMaterial('skin',color);
const templates=new Map();
const animations=new WeakMap();
function part(parent,color,size,position,shape='body'){
  const mat=['body','skin','torso','tail','skull','frill'].includes(shape)?skinMaterial(color):material(color),geometry=shapes[shape];
  if(mat.vertexColors&&!geometry.attributes.color){const n=geometry.attributes.normal,colors=new Float32Array(n.count*3);for(let i=0;i<n.count;i++){const shade=.83+.17*Math.max(0,n.getY(i));colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));}
  const mesh=new THREE.Mesh(geometry,mat);mesh.scale.set(...size);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function limb(parent,color,x,y,z,phase){
  const leg=new THREE.Group();leg.position.set(x,y,z);leg.userData.dinoLeg=phase;parent.add(leg);
  part(leg,color,[.28,y,.32],[0,-y/2,0]);part(leg,0x5c5943,[.34,.16,.6],[0,-y+.08,-.12]);return leg;
}

// 恐龙模板共享几何与材质，头颈、四肢及尾巴保留独立动作节点。
export function dinosaurModel(kind='small'){
  dinosaurShapes();
  if(templates.has(kind))return templates.get(kind).clone(true);
  if(kind==='chaser'){
    const root=new THREE.Group(),color=0x6a7060,belly=0x979780;
    root.userData.dinoRunner=true;
    // 霸王龙水平躯干、强壮骨盆与连续收细的尾巴，头颅前窄后宽。
    const torso=part(root,color,[3.9,4.5,7.8],[0,5.25,.2],'torso');torso.rotation.x=.08;
    part(root,belly,[3.0,2.9,5.6],[0,4.3,-.45],'skin');
    part(root,color,[3.65,3.7,3.9],[0,5.0,2.2],'skin');
    const tail=new THREE.Group();tail.position.set(0,5.15,2.5);tail.userData.dinoTail=true;root.add(tail);
    part(tail,color,[3.1,3.25,10.8],[0,0,0],'tail');
    const neck=part(root,color,[2.75,3.6,3.8],[0,6.35,-3.2],'skin');neck.rotation.x=-.4;
    part(root,color,[3.15,2.25,5.5],[0,7.48,-5.05],'skull');
    const jaw=part(root,belly,[2.6,.7,4.75],[0,6.34,-5.2],'skull');jaw.rotation.x=-.02;
    part(root,0x3f493c,[2.58,.035,4.1],[0,6.69,-5.48],'skin');
    for(const side of [-1,1]){
      const brow=part(root,color,[.46,.48,1.05],[side*1.24,7.87,-4.42],'skin');brow.rotation.z=side*.12;
      part(root,0x766448,[.09,.17,.20],[side*1.415,7.73,-4.57],'skin');
      part(root,0x171c15,[.06,.095,.11],[side*1.455,7.74,-4.59],'skin');
      part(root,0x3e483b,[.07,.12,.22],[side*.66,7.52,-7.27],'skin');
      for(let i=0;i<7;i++){const tooth=part(root,0xab9f83,[.13,.16,.12],[side*(.75+i*.06),6.65,-7.04+i*.44],'horn');tooth.rotation.z=Math.PI;}
      const leg=new THREE.Group();leg.position.set(side*1.45,4.45,1.3);leg.userData.dinoLeg=side>0?0:Math.PI;root.add(leg);
      const thigh=part(leg,color,[1.75,3.15,2.6],[0,-1.0,-.1],'skin');thigh.rotation.x=-.35;
      const shin=part(leg,color,[.94,2.3,1.1],[0,-2.9,.35],'skin');shin.rotation.x=.34;
      part(leg,color,[.7,1.1,.75],[0,-3.68,.48],'skin');
      for(const toe of [-1,0,1]){
        const foot=part(leg,0x777a67,[.42,.38,1.9],[toe*.42,-4.2,-.18-(toe===0?.15:0)],'skin');foot.rotation.y=toe*.12;
        const claw=part(leg,0x575343,[.23,.35,.28],[toe*.51,-4.19,-1.14-(toe===0?.14:0)],'horn');claw.rotation.x=-Math.PI/2;
      }
      const arm=part(root,color,[.44,1.2,.55],[side*1.55,5.55,-2.95],'skin');arm.rotation.x=-.6;
      part(root,color,[.34,.45,.62],[side*1.65,5.12,-3.47],'skin');
      for(const digit of [-1,1]){const claw=part(root,0x575343,[.10,.28,.10],[side*1.65+digit*.10,4.95,-3.68],'horn');claw.rotation.x=-.7;}
    }
    normalize(root,DINOSAURS.chaserWidth,DINOSAURS.chaserHeight,DINOSAURS.chaserLength);
    const content=root.children[0];
    // 保持模型脚掌与既有踩踏中心一致，缩放后仍使用相同的道路落点。
    content.position.z=DINOSAURS.footBack-1.12*content.scale.z;
    for(const leg of content.children)if(leg.userData.dinoLeg!==undefined)leg.position.x=(leg.userData.dinoLeg===0?1:-1)*DINOSAURS.footSpread/content.scale.x;
    root.traverse(node=>{if(node.isMesh)node.castShadow=false;});
    mergeDinosaurParts(root,kind);cacheModelBounds(root,8);templates.set(kind,root);return root.clone(true);
  }
  if(kind==='triceratops'||kind==='stegosaurus'){
    const root=grazerModel(kind);root.updateMatrixWorld(true);const floor=new THREE.Box3().setFromObject(root).min.y;
    for(const child of root.children)child.position.y-=floor;
    root.userData.dinoScale=DINOSAURS.grazerScale;root.scale.setScalar(root.userData.dinoScale);
    mergeDinosaurParts(root,kind);cacheModelBounds(root,3);templates.set(kind,root);return root.clone(true);
  }
  const root=new THREE.Group(),small=kind==='small',color=small?0xb9854f:0x89917b;
  part(root,color,[small?.65:1.6,small?.8:1.5,small?1.15:2.7],[0,small?.75:1.65,0],'torso');
  const tail=new THREE.Group();tail.position.set(0,small?.8:1.8,small?.45:1);tail.userData.dinoTail=true;root.add(tail);
  const tailMesh=part(tail,color,[small?.35:.6,small?.35:.65,small?1.8:4.7],[0,0,0],'tail');tailMesh.rotation.x=-.16;
  if(small){
    const neck=part(root,color,[.36,.65,.36],[0,1.12,-.53]);neck.rotation.x=-.45;
    part(root,color,[.48,.38,.7],[0,1.42,-.85],'skull');
    part(root,0xc9ad7d,[.38,.13,.52],[0,1.26,-.89],'skin');
    for(const side of [-1,1]){limb(root,color,side*.25,.66,.12,side>0?0:Math.PI);part(root,color,[.12,.3,.12],[side*.3,.9,-.4]);part(root,0x202a22,[.035,.07,.08],[side*.245,1.48,-1]);}
    normalize(root,DINOSAURS.smallWidth,DINOSAURS.smallHeight,DINOSAURS.smallLength);
  }else{
    for(const side of [-1,1])for(const end of [-1,1])limb(root,color,side*.55,1.25,end*.8,side*end>0?0:Math.PI);
    const neck=new THREE.Group();neck.position.set(0,1.9,-1);neck.userData.dinoNeck='drink';root.add(neck);
    const throat=part(neck,color,[.65,.7,5.6],[0,.25,-2.5],'torso');throat.rotation.x=-.035;part(neck,color,[.6,.5,1],[0,.25,-5.35],'skull');
    for(const side of [-1,1])part(neck,0x25302a,[.03,.08,.12],[side*.29,.4,-5.55]);
    root.userData.dinoScale=DINOSAURS.diplodocusScale;root.scale.setScalar(root.userData.dinoScale);
  }
  mergeDinosaurParts(root,kind);cacheModelBounds(root,3);templates.set(kind,root);return root.clone(true);
}
function grazerModel(kind){
  const root=new THREE.Group(),stego=kind==='stegosaurus',color=stego?0x74776a:0x817963,belly=stego?0x9d9b82:0xa39a7e;
  // 剑龙后躯更高、头更小；三角龙宽厚躯干与大头形成不同体态。
  const torso=part(root,color,stego?[2.5,2.7,4.4]:[2.5,2.4,4.2],[0,stego?2.22:2.03,0],'torso');torso.rotation.x=stego?-.13:0;
  part(root,belly,[2.06,1.5,3.15],[0,1.5,0],'skin');
  for(const side of [-1,1])for(const end of [-1,1]){
    const front=end<0,height=stego?(front?1.55:2.1):1.7;
    const leg=new THREE.Group();leg.position.set(side*.79,height,end*1.3);leg.userData.dinoLeg=side*end>0?0:Math.PI;root.add(leg);
    part(leg,color,[front?.61:.78,height*.79,.79],[side*(front?.06:0),-height*.34,0],'skin');
    const shin=part(leg,color,[.44,height*.62,.49],[side*(front?.12:0),-height*.69,.08],'skin');shin.rotation.z=side*(front?.1:.025);
    part(leg,0x726c5b,[.65,.30,.83],[side*(front?.17:0),-height+.16,-.06],'skin');
    for(const toe of [-1,0,1])part(leg,0xa59c85,[.12,.10,.20],[side*(front?.17:0)+toe*.19,-height+.12,-.4],'skin');
  }
  const tail=new THREE.Group();tail.position.set(0,stego?2.35:2.1,1.55);tail.userData.dinoTail=true;root.add(tail);
  const tailMesh=part(tail,color,[stego?1.35:1.0,stego?1.2:.95,stego?4.8:3.05],[0,0,0],'tail');tailMesh.rotation.x=.08;
  const neck=new THREE.Group();neck.position.set(0,stego?1.65:2.1,-1.55);neck.userData.dinoNeck='graze';root.add(neck);
  if(stego){
    const throat=part(neck,color,[.64,.65,1.5],[0,-.2,-.6],'skin');throat.rotation.x=.25;
    part(neck,color,[.50,.43,.95],[0,-.35,-1.43],'skull');
    part(neck,0x5d6052,[.34,.21,.42],[0,-.46,-1.78],'skin');
    for(const side of [-1,1])part(neck,0x292e24,[.04,.065,.065],[side*.24,-.26,-1.31],'skin');
    // 两列交错的薄菱形骨板，从颈部到背部渐大，再沿尾部收小。
    for(let i=0;i<15;i++){
      const z=-2.4+i*.34,profile=Math.sin(i/14*Math.PI),height=.36+profile*1.42,side=i%2?1:-1;
      const plate=part(root,0x817058,[1,height,.7+profile*.28],[side*.20,2.75+profile*.64,z],'plate');plate.rotation.z=-side*.08;
    }
    for(const z of [3.3,3.9])for(const side of [-1,1]){
      const spike=part(tail,0xb7ae8c,[.22,1.45,.22],[side*.18,.16,z],'horn');spike.rotation.set(.5,0,-side*.92);
    }
  }else{
    part(neck,color,[1.30,1.12,1.75],[0,-.20,-.52],'skull');
    part(neck,0x6d6652,[.65,.63,.74],[0,-.35,-1.3],'skin');
    const beak=part(neck,0x514e41,[.40,.38,.37],[0,-.36,-1.6],'skull');beak.rotation.x=.2;
    const frill=part(neck,0x8d8268,[1.12,1.12,1],[0,.36,.20],'frill');frill.rotation.x=-.25;
    for(const side of [-1,1]){
      const brow=part(neck,color,[.35,.32,.56],[side*.46,.27,-.64],'skin');brow.rotation.z=side*.12;
      const horn=part(neck,0xc1b596,[.30,1.55,.30],[side*.48,.72,-.99],'horn');horn.rotation.set(-.9,0,side*.08);
      part(neck,0x272a20,[.06,.085,.10],[side*.61,.06,-.74],'skin');
      part(neck,color,[.23,.25,.27],[side*.67,-.27,-.42],'skin');
    }
    const nose=part(neck,0xc1b596,[.24,.62,.24],[0,.17,-1.37],'horn');nose.rotation.x=-.36;
    for(let i=0;i<11;i++){
      const a=i/10*Math.PI,edge=part(neck,0x9b8e71,[.16,.16,.12],[Math.cos(a)*1.10,.36+Math.sin(a)*1.12,.17],'horn');edge.rotation.z=a-Math.PI/2;
    }
  }
  return root;
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

// 只合并动作节点内部的固定部件，腿、头颈和尾巴仍保持原有独立动画。
function mergeDinosaurParts(root,kind){
  let nodeIndex=0;
  root.traverse(node=>{
    const index=nodeIndex++,groups=new Map();
    for(const mesh of node.children)if(mesh.isMesh){let pieces=groups.get(mesh.material);if(!pieces){pieces=[];groups.set(mesh.material,pieces);}pieces.push(mesh);}
    let groupIndex=0;
    for(const [mat,parts]of groups){
      const key='dinosaur-merged:'+kind+':'+index+':'+groupIndex++;if(parts.length<2)continue;
      const geometry=cachedGeometry(key,()=>{
        const pieces=parts.map(mesh=>{mesh.updateMatrix();const piece=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);if(!piece.attributes.color){const colors=new Float32Array(piece.attributes.position.count*3);colors.fill(1);piece.setAttribute('color',new THREE.BufferAttribute(colors,3));}return piece;});
        const result=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();return result;
      });
      const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=parts[0].castShadow;mesh.receiveShadow=parts[0].receiveShadow;
      for(const part of parts)node.remove(part);node.add(mesh);
    }
  });
}
