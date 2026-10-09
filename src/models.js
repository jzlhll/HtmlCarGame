import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VEHICLES, MAX_RANK, ARMORED_RANK, ARMORED_TANK, VEHICLE_LENGTH_SCALE, VEHICLE_WIDTH_SCALE, BICYCLE_WIDTH_SCALE, BICYCLE_TIRE_WIDTH, carColor } from './config.js';
const geometry={box:new THREE.BoxGeometry(1,1,1),barrel:new THREE.CylinderGeometry(.5,.5,1,10).rotateX(Math.PI/2),wheel:new THREE.CylinderGeometry(1,1,1,12),sphere:new THREE.IcosahedronGeometry(1,0),cone:new THREE.ConeGeometry(.5,1,6)};
geometry.bicycleTank=new THREE.SphereGeometry(.5,10,6);
// 车身下缘与上缘轻微收角，保留独立发动机盖、座舱和尾厢的轿车轮廓。
geometry.carBody=new THREE.BoxGeometry(1,1,1);
const bodyPositions=geometry.carBody.attributes.position;
for(let i=0;i<bodyPositions.count;i++){
  const top=bodyPositions.getY(i)>0;
  bodyPositions.setXYZ(i,bodyPositions.getX(i)*(top?.96:.88),bodyPositions.getY(i),bodyPositions.getZ(i)*(top?.96:1));
}
geometry.carBody.computeVertexNormals();
// 小汽车使用斜面座舱，玻璃贴合前后及两侧，车顶保持车身颜色。
geometry.carCabin=new THREE.BoxGeometry(1,1,1);
const cabinPositions=geometry.carCabin.attributes.position;
for(let i=0;i<cabinPositions.count;i++)if(cabinPositions.getY(i)>0)cabinPositions.setXYZ(i,cabinPositions.getX(i)*.86,cabinPositions.getY(i),cabinPositions.getZ(i)*(cabinPositions.getZ(i)<0?.56:.6));
geometry.carCabin.computeVertexNormals();
const windows={
  carFront:[[-.40,-.30,-.462],[.40,-.30,-.462],[.37,.35,-.319],[-.37,.35,-.319]],
  carRear:[[.40,-.30,.466],[-.40,-.30,.466],[-.37,.35,.336],[.37,.35,.336]],
};
for(const side of [-1,1])windows[side<0?'carLeft':'carRight']=[
  [side*.4906,-.28,-.35],[side*.4906,-.28,.35],[side*.4479,.33,.27],[side*.4479,.33,-.27],
];
for(const [name,points]of Object.entries(windows)){
  const pane=new THREE.BufferGeometry();pane.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  pane.setIndex(name==='carLeft'?[0,1,2,0,2,3]:[0,2,1,0,3,2]);pane.computeVertexNormals();geometry[name]=pane;
}
geometry.handlebar=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-.20,0,.08],[-.18,.035,-.015],[-.10,.05,-.065],[.10,.05,-.065],[.18,.035,-.015],[.20,0,.08]].map(point=>new THREE.Vector3(...point))),16,.023,5,false);
// 将握把角度烘焙到共享几何，横向加宽时不会同时拉长斜置的握把。
for(const side of [-1,1])geometry[side<0?'bicycleLeftGrip':'bicycleRightGrip']=new THREE.BoxGeometry(.055,.05,.09).rotateY(side*.25);
const materials=new Map();
let rainbowMaterial=null;
// 彩虹涂装用共享渐变贴图材质；所有彩虹车共用一份，避免逐帧改色和材质缓存膨胀。
function rainbowBodyMaterial(){
  if(!rainbowMaterial){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=32;
    const ctx=canvas.getContext('2d'),grad=ctx.createLinearGradient(0,0,128,0);
    for(const [i,c] of ['#ff4d4d','#ff9f2e','#ffe14d','#3ecf6a','#2eb8ff','#b05fff'].entries())grad.addColorStop(i/5,c);
    ctx.fillStyle=grad;ctx.fillRect(0,0,128,32);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.repeat.set(2,1);
    rainbowMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.6,metalness:.12});
    materials.set('rainbow',rainbowMaterial);
  }
  return rainbowMaterial;
}
export function material(color){if(color==='rainbow')return rainbowBodyMaterial();if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.08}));return materials.get(color);}
function part(group,color,size,position,shape='box'){
  const mesh=new THREE.Mesh(geometry[shape],material(color));mesh.scale.set(...size);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;if(shape==='wheel')mesh.userData.wheelRadius=size[0]*1.6;group.add(mesh);return mesh;
}
const templates=new Map();
export function vehicleModel(rank,player=false,bodyColor){
  // 玩家颜色来自颜色选择页；未指定时回落默认涂装，车流仍按各自车色。
  const c=player?bodyColor??carColor().hex:bodyColor??VEHICLES[rank].color;
  const key=rank+':'+player+':'+c;
  if(templates.has(key))return templates.get(key).clone(true);
  const v=VEHICLES[rank],g=new THREE.Group(),w=v.width/VEHICLE_WIDTH_SCALE,l=v.length/VEHICLE_LENGTH_SCALE;
  if(rank===1){
    // 粗轮胎、宽油箱和阶梯座垫形成摩托车轮廓，俯视时也能识别整块车身。
    for(const z of [-.33,.33]){
      const wheel=part(g,0x243232,[.22,BICYCLE_TIRE_WIDTH,.22],[0,.22,z],'wheel');wheel.rotation.z=Math.PI/2;
      part(g,c,[.20,.075,.24],[0,.45,z],'carBody');
    }
    part(g,0x263839,[.24,.13,.65],[0,.35,.04]);
    part(g,0xc4d1d4,[.29,.19,.28],[0,.40,.015],'carBody');
    for(const y of [.35,.40,.45])part(g,0x354c43,[.31,.025,.24],[0,y,.015]);
    const tank=part(g,c,[.38,.23,.36],[0,.64,-.08],'bicycleTank');tank.name='bicycleFuelTank';
    part(g,0xe0eef0,[.065,.012,.055],[0,.762,-.09]);
    part(g,0x263839,[.30,.105,.28],[0,.63,.17],'carBody');
    part(g,0x354c43,[.28,.07,.16],[0,.68,.30],'carBody');
    part(g,c,[.29,.10,.15],[0,.59,.35],'carBody');
    part(g,0xf5704d,[.23,.055,.035],[0,.615,.43]);
    for(const side of [-1,1]){
      const fork=part(g,0xc4d1d4,[.035,.36,.045],[side*.075,.45,-.29]);fork.rotation.x=-.18;
      part(g,c,[.11,.16,.26],[side*.135,.48,.16],'carBody');
      part(g,0xc4d1d4,[.055,.045,.15],[side*.20,.34,.07]);
      const exhaust=part(g,0xc4d1d4,[.065,.075,.31],[side*.18,.31,.22]);exhaust.rotation.x=-.12;
    }
    part(g,c,[1.12,1.12,1.12],[0,.77,-.28],'handlebar');
    for(const side of [-1,1])part(g,0x263839,[1.12,1.12,1.12],[side*.224,.77,-.19],side<0?'bicycleLeftGrip':'bicycleRightGrip');
    part(g,0x263839,[.29,.17,.085],[0,.64,-.335],'carBody');
    const headlight=part(g,0xffefb2,[.24,.12,.03],[0,.65,-.39]);headlight.name='bicycleHeadlight';
    const screen=part(g,0x365664,[.24,.15,.035],[0,.80,-.30]);screen.rotation.x=-.20;
    // 头盔骑手让远处两轮车更易辨认，四肢保持在车辆碰撞轮廓内。
    const rider=part(g,0x263839,[.22,.29,.20],[0,.91,.10],'carBody');rider.rotation.x=-.20;
    part(g,c,[.105,.115,.105],[0,1.15,.015],'sphere');
    part(g,0x365664,[.15,.06,.018],[0,1.16,-.082]);
    for(const side of [-1,1]){
      const arm=part(g,0x263839,[.055,.065,.29],[side*.16,.86,-.095]);arm.rotation.x=-.28;
      const leg=part(g,0x354c43,[.07,.25,.17],[side*.135,.64,.16]);leg.rotation.x=-.30;
    }
  }else if(rank===2){
    const front=part(g,0x243232,[.20,.095,.20],[0,.20,-l*.34],'wheel');front.rotation.z=Math.PI/2;
    for(const side of [-1,1]){const rear=part(g,0x243232,[.23,.12,.23],[side*w*.4,.23,l*.34],'wheel');rear.rotation.z=Math.PI/2;}
    part(g,c,[w*.22,.12,l*.82],[0,.30,0]);
    part(g,c,[w*.87,.14,l*.50],[0,.36,l*.17]);
    part(g,0x354c43,[w*.76,.035,l*.43],[0,.455,l*.17]);
    for(const side of [-1,1])part(g,c,[w*.055,.25,l*.50],[side*w*.42,.52,l*.17]);
    for(const z of [-l*.08,l*.42])part(g,c,[w*.85,.25,.045],[0,.52,z]);
    const fork=part(g,c,[.07,.35,.07],[0,.40,-l*.34]);fork.rotation.x=-.18;
    part(g,c,[.85,.85,.85],[0,.61,-l*.34],'handlebar');
    part(g,0x263839,[w*.32,.07,l*.12],[0,.56,-l*.12]);
    part(g,0xffefb2,[.09,.09,.06],[0,.48,-l*.37]);
  }else if(rank===MAX_RANK||rank===ARMORED_RANK){
    part(g,c,[w*.78,.39,l*.88],[0,.45,0]);
    for(const side of [-1,1]){part(g,0x273c33,[w*.2,.38,l],[side*w*.4,.22,0]);for(let z=-.85;z<=.85;z+=.34){const wheel=part(g,0x68816c,[.14,.15,.14],[side*w*.47,.24,z],'wheel');wheel.rotation.z=Math.PI/2;}}
    part(g,c,[w*.53,.3,l*.44],[0,.8,-.13]);
  }else{
    part(g,c,[w*(rank===3?.84:.95),.35,l*.94],[0,.38,0],rank===3?'carBody':'box');
    if(rank===3){
      const cabinSize=[w*.78,.32,l*.48],cabinPosition=[0,.70,l*.04];
      part(g,c,cabinSize,cabinPosition,'carCabin');
      for(const shape of ['carFront','carRear','carLeft','carRight'])part(g,0x365664,cabinSize,cabinPosition,shape);
      const trim=c==='rainbow'?0xe8edf2:new THREE.Color(c).lerp(new THREE.Color(0xffffff),.22).getHex();
      part(g,trim,[w*.70,.025,l*.23],[0,.555,-l*.32]);
      part(g,0x263839,[w*.32,.065,.025],[0,.38,-l*.477]);
      for(const end of [-1,1])part(g,0xc4d1d4,[w*.72,.065,.035],[0,.27,end*l*.476]);
      for(const side of [-1,1]){
        // 两侧镜壳突出车门且保持在碰撞宽度内，亮色镜片朝向后方，俯视仍能看清。
        part(g,0x263839,[w*.08,.04,l*.035],[side*w*.39,.69,-l*.14]);
        const mirror=part(g,trim,[w*.12,.10,l*.11],[side*w*.44,.69,-l*.14]);
        mirror.name=side<0?'leftMirror':'rightMirror';
        part(g,0xe0eef0,[w*.10,.075,.012],[side*w*.44,.69,-l*.081]);
        part(g,0xe0eef0,[w*.10,.012,l*.07],[side*w*.44,.746,-l*.14]);
      }
    }
    if(rank===4){part(g,c,[w*.94,.72,l*.6],[0,.85,l*.15]);part(g,0xdce3d8,[w*.89,.02,l*.58],[0,1.22,l*.15]);part(g,c,[w*.88,.51,.65],[0,.72,-l*.36]);part(g,0x244853,[w*.79,.22,.025],[0,.81,-l*.475]);}
    const positions=[-l*.3,l*.3];
    for(const side of [-1,1])for(const z of positions){const r=.19;const wheel=part(g,0x243334,[r,.13,r],[side*w*.43,r,z],'wheel');wheel.rotation.z=Math.PI/2;}
    for(const side of [-1,1]){part(g,rank===3?0xf5fbff:0xffefb2,[w*.18,.07,.035],[side*w*.3,.47,-l*.49]);part(g,0xf5704d,[w*.17,.06,.035],[side*w*.3,.45,l*.48]);}
  }
  if(rank===ARMORED_RANK){
    part(g,0x45463e,[w*.88,.28,l*.76],[0,1.13,0]);
    part(g,c,[w*.58,.42,l*.48],[0,1.48,-.12]);
    part(g,0xe5c16a,[w*.45,.06,l*.16],[0,1.78,-.12]);
    const barrelLength=ARMORED_TANK.barrelLength/VEHICLE_LENGTH_SCALE,barrel=part(g,0x454b42,[.16,.16,barrelLength],[0,1.58,-.3-barrelLength/2],'barrel');barrel.name='armoredBarrel';
    const muzzle=part(g,0x252e2a,[.24,.22,.20],[0,1.58,-.3-barrelLength]);muzzle.name='armoredMuzzle';
    for(const side of [-1,1])for(const z of [-.7,0,.7])part(g,0x4f5348,[w*.13,.45,.58],[side*w*.43,.65,z]);
  }
  const widthScale=rank===1?BICYCLE_WIDTH_SCALE:1;
  const scale=new THREE.Vector3(VEHICLE_WIDTH_SCALE*widthScale,1.6,VEHICLE_LENGTH_SCALE);
  g.children.forEach(mesh=>{
    if(mesh.userData.wheelRadius){
      mesh.scale.multiplyScalar(1.6);
      // 车轮转过 90 度，局部 Y 轴是车身横向，只加宽轮胎而不改变轮径。
      mesh.scale.y*=widthScale;
    }else mesh.scale.multiply(scale);
    mesh.position.multiply(scale);
  });
  if(rank===ARMORED_RANK){
    const base=new THREE.Box3().setFromObject(vehicleModel(MAX_RANK,false,c)),bounds=new THREE.Box3().setFromObject(g);
    g.scale.y=(base.max.y-base.min.y)*ARMORED_TANK.heightMultiplier/(bounds.max.y-bounds.min.y);
    g.position.y=base.min.y-bounds.min.y*g.scale.y;
  }
  if(rank===1){
    // 摩托车细节按材质合并到模板，只有车轮保持独立，避免车流逐帧遍历所有小部件。
    const groups=new Map();
    for(const mesh of [...g.children]){
      if(mesh.userData.wheelRadius)continue;
      mesh.updateMatrix();
      let group=groups.get(mesh.material);
      if(!group){group={parts:[],name:''};groups.set(mesh.material,group);}
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      group.parts.push(geometry.applyMatrix4(mesh.matrix));
      if(mesh.name)group.name=mesh.name;
      g.remove(mesh);
    }
    for(const [mat,group]of groups){
      const mesh=new THREE.Mesh(mergeGeometries(group.parts),mat);
      for(const part of group.parts)part.dispose();
      mesh.name=group.name;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
    }
  }
  templates.set(key,g);return g.clone(true);
}

export function cowModel(){
  if(templates.has('cow'))return templates.get('cow').clone(true);
  const g=new THREE.Group();
  part(g,0xf5f1df,[1.1,1.15,2.1],[0,1.35,0]);part(g,0xf5f1df,[.8,.85,.85],[0,1.68,-1.25]);part(g,0xd7a4a1,[.84,.42,.4],[0,1.4,-1.78]);
  for(const side of [-1,1]){
    part(g,0x292e2c,[.04,.58,.65],[side*.57,1.44,.35]);part(g,0x292e2c,[.04,.45,.55],[side*.57,1.24,-.46]);
    const ear=part(g,0xf5f1df,[.36,.18,.4],[side*.51,1.98,-1.22]);ear.rotation.z=side*.35;
    part(g,0xddd0a8,[.10,.35,.10],[side*.28,2.16,-1.18],'cone');part(g,0x292e2c,[.04,.10,.10],[side*.42,1.81,-1.48]);
    for(const end of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.35,.9,end*.73);leg.userData.cowLeg=side*end;g.add(leg);
      part(leg,0xf5f1df,[.24,.75,.25],[0,-.375,0]);part(leg,0x292e2c,[.29,.16,.32],[0,-.82,0]);
    }
  }
  part(g,0xd7a4a1,[.5,.23,.5],[0,.74,.27]);
  const tail=part(g,0xf5f1df,[.10,.8,.10],[0,1.04,1.14]);tail.userData.cowTail=true;
  part(g,0x292e2c,[.16,.23,.16],[0,.62,1.15]);
  for(const child of g.children)child.position.z+=.4;
  templates.set('cow',g);return g.clone(true);
}

export function horseModel(){
  if(templates.has('whiteHorse'))return templates.get('whiteHorse').clone(true);
  const g=new THREE.Group(),white=0xfaf8ee,mane=0xd8d5c5;
  part(g,white,[.55,.525,1.25],[0,1.55,.15],'sphere');
  const neck=part(g,white,[.62,1.25,.66],[0,2.12,-1.02]);neck.rotation.x=-.3;
  const head=part(g,white,[.275,.33,.46],[0,2.77,-1.53],'sphere');head.rotation.x=.18;
  part(g,0xd9d3c5,[.24,.15,.19],[0,2.57,-1.98],'sphere');
  const crest=part(g,mane,[.15,1.1,.18],[0,2.18,-.72]);crest.rotation.x=-.3;
  for(const side of [-1,1]){
    const ear=part(g,white,[.16,.43,.16],[side*.2,3.15,-1.34],'cone');ear.rotation.z=-side*.16;
    part(g,0x28393b,[.025,.055,.06],[side*.275,2.83,-1.7],'sphere');
    for(const end of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.37,1.5,end*.88);leg.userData.horsePhase=side*end>0?0:Math.PI;g.add(leg);
      part(leg,white,[.24,.72,.24],[0,-.36,0]);
      const knee=new THREE.Group();knee.position.y=-.68;knee.userData.horseKnee=true;leg.add(knee);
      part(knee,white,[.17,.64,.18],[0,-.32,0]);part(knee,0x6a6256,[.26,.18,.34],[0,-.68,-.06]);
    }
  }
  const tail=new THREE.Group();tail.position.set(0,1.65,1.48);tail.userData.horseTail=true;g.add(tail);
  const hair=part(tail,mane,[.25,.85,.33],[0,-.26,.25],'cone');hair.rotation.x=.4;
  templates.set('whiteHorse',g);return g.clone(true);
}

export function mudCoating(vehicle){
  const parts=vehicle.children.filter(part=>part.isMesh),coating=new THREE.InstancedMesh(geometry.sphere,material(0x65452b),parts.length*3);
  const patch=new THREE.Object3D(),size=new THREE.Vector3(),center=new THREE.Vector3(),matrix=new THREE.Matrix4();
  let index=0;
  for(const part of parts){
    if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
    const bounds=part.geometry.boundingBox;bounds.getSize(size);bounds.getCenter(center);part.updateMatrix();
    for(const side of [-1,1]){
      patch.position.set(center.x+side*(size.x*.5+.008),center.y-size.y*.13,center.z+Math.sin(index*2.4)*size.z*.18);
      patch.scale.set(.018,size.y*.29,size.z*.28);patch.updateMatrix();
      coating.setMatrixAt(index++,matrix.multiplyMatrices(part.matrix,patch.matrix));
    }
    patch.position.set(center.x+Math.sin(index)*size.x*.15,bounds.max.y+.008,center.z+Math.cos(index)*size.z*.15);
    patch.scale.set(size.x*.24,.018,size.z*.24);patch.updateMatrix();
    coating.setMatrixAt(index++,matrix.multiplyMatrices(part.matrix,patch.matrix));
  }
  coating.count=index;coating.visible=false;coating.frustumCulled=false;vehicle.add(coating);return coating;
}
