import * as THREE from '../node_modules/three/build/three.module.js';
import { cachedGeometry, cachedGeometrySet } from './model-assets.js';
import { surfaceMaterial, roundedBoxGeometry, organicGeometry } from './model-surfaces.js';
import { tankerGeometries, tankerSignMaterial, tankerCabParts, tankerParts } from './tanker-model.js';
import { mergeGeometries } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { VEHICLES, RENDER_QUALITY, MAX_RANK, ARMORED_RANK, ARMORED_TANK, COW_CROSSING, VEHICLE_LENGTH_SCALE, VEHICLE_WIDTH_SCALE, BICYCLE_WIDTH_SCALE, BICYCLE_TIRE_WIDTH, carColor } from './config.js';
const vehicleShapes=cachedGeometrySet('vehicle',()=>{
const geometry={box:new THREE.BoxGeometry(1,1,1),barrel:new THREE.CylinderGeometry(.5,.5,1,10).rotateX(Math.PI/2),wheel:new THREE.CylinderGeometry(1,1,1,12),sphere:new THREE.IcosahedronGeometry(1,0),cone:new THREE.ConeGeometry(.5,1,6)};
geometry.bicycleTank=new THREE.SphereGeometry(.5,16,10);
geometry.helmet=new THREE.SphereGeometry(1,24,16);geometry.horseNeck=new THREE.LatheGeometry([[0,-.5],[.32,-.5],[.5,-.36],[.40,0],[.24,.5],[0,.5]].map(p=>new THREE.Vector2(...p)),12);geometry.rounded=roundedBoxGeometry();geometry.animal=new THREE.SphereGeometry(.5,20,14);geometry.limb=new THREE.CylinderGeometry(.33,.46,1,12);
// 轮胎断面包含圆肩和内嵌轮毂，一件几何即可保留金属轮毂与橡胶胎壁。
{
  const pieces=[],colored=(shape,color)=>{const c=new THREE.Color(color),values=new Float32Array(shape.attributes.position.count*3);for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}shape.setAttribute('color',new THREE.BufferAttribute(values,3));pieces.push(shape.index?shape.toNonIndexed():shape);};
  colored(new THREE.LatheGeometry([[.71,-.46],[.86,-.48],[.97,-.38],[1,-.22],[1,.22],[.97,.38],[.86,.48],[.71,.46]].map(p=>new THREE.Vector2(...p)),32),0x252928);
  colored(new THREE.LatheGeometry([[.57,-.48],[.70,-.50],[.74,-.44],[.74,.44],[.70,.50],[.57,.48]].map(p=>new THREE.Vector2(...p)),32),0xa5afb1);
  colored(new THREE.CylinderGeometry(.56,.56,.06,24),0x4d575c);
  for(const side of [-1,1]){
    colored(new THREE.CylinderGeometry(.19,.19,.09,20).translate(0,side*.48,0),0xb7c0c1);
    for(let spoke=0;spoke<7;spoke++)colored(new THREE.BoxGeometry(.105,.065,.48).translate(0,side*.47,.37).rotateY(spoke*Math.PI*2/7),0xc0c8c8);
    for(let bolt=0;bolt<5;bolt++)colored(new THREE.SphereGeometry(.035,6,4).translate(Math.cos(bolt*Math.PI*2/5)*.125,side*.54,Math.sin(bolt*Math.PI*2/5)*.125),0x626d73);
  }
  geometry.wheel=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();
}
// 轿车侧围保留真实轮拱开口，前后保险杠和引擎盖通过曲线过渡。
{
  const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(-.5,-.10);shape.quadraticCurveTo(-.49,.28,-.44,.36);shape.quadraticCurveTo(-.28,.49,0,.5);shape.quadraticCurveTo(.35,.50,.47,.33);shape.quadraticCurveTo(.51,.10,.5,-.5);
  const l=VEHICLES[3].length/VEHICLE_LENGTH_SCALE,rx=.223/(l*.94),ry=.223/.35,cy=(.19-.38)/.35;
  for(const center of [.3/.94,-.3/.94]){
    shape.lineTo(center+rx,-.5);
    for(let i=0;i<=24;i++){const angle=i*Math.PI/24;shape.lineTo(center+Math.cos(angle)*rx,Math.max(-.5,cy+Math.sin(angle)*ry));}
  }
  shape.lineTo(-.5,-.5);shape.closePath();
  geometry.sedanBody=new THREE.ExtrudeGeometry(shape,{depth:.94,bevelEnabled:true,bevelSize:.025,bevelThickness:.03,bevelSegments:4,curveSegments:12,steps:1});geometry.sedanBody.rotateY(-Math.PI/2).translate(.47,0,0);geometry.sedanBody.computeVertexNormals();
}
// SUV 保留轮拱开口，较直的车头侧围与高座舱形成不同于轿车的轮廓。
{
  const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(-.5,.18);shape.quadraticCurveTo(-.49,.39,-.44,.42);shape.lineTo(-.22,.50);shape.lineTo(.44,.50);shape.quadraticCurveTo(.50,.46,.50,.27);shape.lineTo(.50,-.5);
  const l=VEHICLES[3].length/VEHICLE_LENGTH_SCALE,rx=.258*1.6/(VEHICLE_LENGTH_SCALE*l*.94),ry=.258/.40,cy=(.21-.43)/.40;
  for(const center of [.3/.94,-.3/.94]){
    shape.lineTo(center+rx,-.5);
    for(let i=0;i<=24;i++){const angle=i*Math.PI/24;shape.lineTo(center+Math.cos(angle)*rx,Math.max(-.5,cy+Math.sin(angle)*ry));}
  }
  shape.lineTo(-.5,-.5);shape.closePath();
  geometry.suvBody=new THREE.ExtrudeGeometry(shape,{depth:.94,bevelEnabled:true,bevelSize:.025,bevelThickness:.03,bevelSegments:3,curveSegments:10,steps:1});geometry.suvBody.rotateY(-Math.PI/2).translate(.47,0,0);geometry.suvBody.computeVertexNormals();
  geometry.suvArch=new THREE.TorusGeometry(1,.06,4,20,Math.PI).rotateY(Math.PI/2);
}

// 车身下缘与上缘轻微收角，保留独立发动机盖、座舱和尾厢的轿车轮廓。
geometry.carBody=roundedBoxGeometry(.065);
const bodyPositions=geometry.carBody.attributes.position;
for(let i=0;i<bodyPositions.count;i++){
  const blend=bodyPositions.getY(i)+.5;
  bodyPositions.setXYZ(i,bodyPositions.getX(i)*(.88+blend*.08),bodyPositions.getY(i),bodyPositions.getZ(i)*(1-blend*.04));
}
geometry.carBody.computeVertexNormals();
geometry.cowBody=organicGeometry([[-.5,.015,.025,.02],[-.43,.28,.37,.015],[-.25,.47,.49],[.15,.5,.48],[.39,.36,.40,.015],[.5,.025,.05,.04]]);
geometry.cowHead=organicGeometry([[-.5,.28,.28,-.04],[-.3,.44,.35,-.03],[.10,.50,.48],[.34,.43,.48],[.5,.16,.22,.02]]);
geometry.log=new THREE.CylinderGeometry(.5,.5,1,12).rotateX(Math.PI/2);
geometry.cargoPile=new THREE.SphereGeometry(.5,16,10);
geometry.horseBody=organicGeometry([[-.5,.02,.03,.02],[-.38,.37,.48,.02],[-.18,.46,.5],[.16,.48,.43],[.38,.36,.42,.02],[.5,.015,.03,.05]]);
geometry.horseHead=organicGeometry([[-.5,.08,.13,-.06],[-.36,.27,.27,-.05],[0,.42,.44],[.28,.47,.48],[.5,.10,.12,.02]]);
geometry.limb=organicGeometry([[-.5,.47,.42],[-.27,.41,.38],[-.08,.30,.29],[.05,.29,.28],[.3,.25,.24],[.5,.20,.21]],20).rotateX(Math.PI/2);
geometry.hoof=roundedBoxGeometry(.20);
geometry.lens=new THREE.SphereGeometry(.5,16,10);

// 小汽车使用斜面座舱，玻璃贴合前后及两侧，车顶保持车身颜色。
geometry.carCabin=roundedBoxGeometry(.035);
const cabinPositions=geometry.carCabin.attributes.position;
for(let i=0;i<cabinPositions.count;i++){const blend=cabinPositions.getY(i)+.5;cabinPositions.setXYZ(i,cabinPositions.getX(i)*(1-.14*blend),cabinPositions.getY(i),cabinPositions.getZ(i)*(1-(cabinPositions.getZ(i)<0?.44:.4)*blend));}
geometry.carCabin.computeVertexNormals();
geometry.suvCabin=roundedBoxGeometry(.045);
const suvPositions=geometry.suvCabin.attributes.position;
for(let i=0;i<suvPositions.count;i++){const blend=suvPositions.getY(i)+.5;suvPositions.setXYZ(i,suvPositions.getX(i)*(1-.10*blend),suvPositions.getY(i),suvPositions.getZ(i)*(1-(suvPositions.getZ(i)<0?.38:.08)*blend));}
geometry.suvCabin.computeVertexNormals();
const windows={
  carFront:[[-.40,-.30,-.462],[.40,-.30,-.462],[.37,.35,-.319],[-.37,.35,-.319]],
  carRear:[[.40,-.30,.466],[-.40,-.30,.466],[-.37,.35,.336],[.37,.35,.336]],
  suvFront:[[-.40,-.30,-.464],[.40,-.30,-.464],[.37,.33,-.344],[-.37,.33,-.344]],
  suvRear:[[.40,-.30,.494],[-.40,-.30,.494],[-.37,.33,.469],[.37,.33,.469]],
};
for(const side of [-1,1])windows[side<0?'carLeft':'carRight']=[
  [side*.4906,-.28,-.35],[side*.4906,-.28,.35],[side*.4479,.33,.27],[side*.4479,.33,-.27],
];
for(const side of [-1,1])windows[side<0?'suvLeft':'suvRight']=[
  [side*.492,-.30,-.42],[side*.492,-.30,.43],[side*.4605,.33,.40],[side*.4605,.33,-.29],
];
for(const [name,points]of Object.entries(windows)){
  const pane=new THREE.BufferGeometry();pane.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  pane.setIndex(name==='carLeft'||name==='suvLeft'?[0,1,2,0,2,3]:[0,2,1,0,3,2]);pane.computeVertexNormals();geometry[name]=pane;
}
geometry.handlebar=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-.20,0,.08],[-.18,.035,-.015],[-.10,.05,-.065],[.10,.05,-.065],[.18,.035,-.015],[.20,0,.08]].map(point=>new THREE.Vector3(...point))),16,.023,5,false);
// 将握把角度烘焙到共享几何，横向加宽时不会同时拉长斜置的握把。
for(const side of [-1,1])geometry[side<0?'bicycleLeftGrip':'bicycleRightGrip']=new THREE.BoxGeometry(.055,.05,.09).rotateY(side*.25);
const lowGeometry={wheel:new THREE.CylinderGeometry(1,1,1,6),bicycleTank:new THREE.SphereGeometry(.5,6,4),rounded:new THREE.BoxGeometry(1,1,1),carBody:new THREE.BoxGeometry(1,1,1),sedanBody:geometry.sedanBody,carCabin:geometry.carCabin,suvBody:geometry.suvBody,suvCabin:geometry.suvCabin,barrel:new THREE.CylinderGeometry(.5,.5,1,6).rotateX(Math.PI/2)};
const lowWheelColors=new Float32Array(lowGeometry.wheel.attributes.position.count*3);lowWheelColors.fill(.12);lowGeometry.wheel.setAttribute('color',new THREE.BufferAttribute(lowWheelColors,3));
return {...geometry,...tankerGeometries(),...Object.fromEntries(Object.entries(lowGeometry).map(([name,shape])=>['low-'+name,shape]))};
});
const geometry=Object.fromEntries(Object.entries(vehicleShapes).filter(([name])=>!name.startsWith('low-'))),lowGeometry=Object.fromEntries(Object.entries(vehicleShapes).filter(([name])=>name.startsWith('low-')).map(([name,shape])=>[name.slice(4),shape]));
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
    rainbowMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.32,metalness:.38});
    materials.set('rainbow',rainbowMaterial);
  }
  return rainbowMaterial;
}
export function material(color){if(color==='rainbow')return rainbowBodyMaterial();if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.04}));return materials.get(color);}
function part(group,color,size,position,shape='box'){
  const role=shape==='tankerBody'?'paint':shape==='wheel'?'rubber':shape==='log'?'bark':shape==='cargoPile'?'stone':['animal','cowBody','cowHead','horseBody','horseHead','horseNeck','limb'].includes(shape)?(color===0xf5f1df?'cow':'hide'):['carFront','carRear','carLeft','carRight'].includes(shape)||color===0x365664||color===0x244853?'glass':color===0xc4d1d4||color===0xe0eef0?'metal':null;
  const mat=shape.startsWith('hazard')?tankerSignMaterial():role?surfaceMaterial(role,shape==='wheel'?0xffffff:color):color===group.userData.bodyColor&&color!=='rainbow'?surfaceMaterial('paint',color):material(color);
  const shapeGeometry=group.userData.lowDetail?(lowGeometry[shape]??geometry[shape]):geometry[shape];
  if(mat.vertexColors&&!shapeGeometry.attributes.color){const p=shapeGeometry.attributes.position,n=shapeGeometry.attributes.normal,colors=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const shade=.86+.14*Math.max(0,n.getY(i));colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;}shapeGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));}
  const mesh=new THREE.Mesh(shapeGeometry,mat);mesh.scale.set(...size);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;if(shape==='wheel')mesh.userData.wheelRadius=size[0]*1.6;group.add(mesh);return mesh;
}
const templates=new Map();
const mergedGeometry=new Map();
// 模板保存根节点局部边界，克隆后不必重新遍历全部部件计算包围体。
export function cacheModelBounds(model,padding=1){
  model.updateMatrixWorld(true);
  const inverse=model.matrixWorld.clone().invert(),box=new THREE.Box3();
  model.traverse(part=>{
    if(!part.isMesh)return;
    if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
    box.union(part.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,part.matrixWorld)));
  });
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  model.userData.batchBounds={center:sphere.center.toArray(),radius:sphere.radius+padding};
  return model;
}
export function vehicleModel(rank,player=false,bodyColor,lowDetail=false,truckStyle='box',carStyle='sedan'){
  if(rank!==4)truckStyle='box';
  if(rank!==3)carStyle='sedan';
  // 玩家颜色来自颜色选择页；未指定时回落默认涂装，车流仍按各自车色。
  const c=player?bodyColor??carColor().hex:bodyColor??VEHICLES[rank].color;
  const key=rank+':'+c+':'+lowDetail+':'+truckStyle+':'+carStyle;
  if(templates.has(key))return templates.get(key).clone(true);
  const v=VEHICLES[rank],g=new THREE.Group(),w=v.width/VEHICLE_WIDTH_SCALE,l=v.length/VEHICLE_LENGTH_SCALE;
  g.userData.lowDetail=lowDetail;g.userData.bodyColor=c;g.userData.truckStyle=truckStyle;g.userData.carStyle=carStyle;
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
    const rider=part(g,0x263839,[.22,.29,.20],[0,.91,.10],'animal');rider.rotation.x=-.20;
    part(g,c,[.105,.115,.105],[0,1.15,.015],'helmet');
    part(g,0x365664,[.15,.06,.018],[0,1.16,-.082]);
    for(const side of [-1,1]){
      const arm=part(g,0x263839,[.055,.065,.29],[side*.16,.86,-.095],'rounded');arm.rotation.x=-.28;
      const leg=part(g,0x354c43,[.07,.25,.17],[side*.135,.64,.16],'rounded');leg.rotation.x=-.30;
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
    for(const side of [-1,1]){
      part(g,c,[w*.15,.10,l*.20],[side*w*.37,.49,l*.30],'carBody');
      part(g,0xf5704d,[w*.10,.055,.025],[side*w*.34,.46,l*.427]);
    }
  }else if(rank===MAX_RANK||rank===ARMORED_RANK){
    part(g,c,[w*.78,.39,l*.88],[0,.45,0],'carBody');
    for(const side of [-1,1]){part(g,0x273c33,[w*.2,.38,l],[side*w*.4,.22,0]);for(let z=-.85;z<=.85;z+=.34){const wheel=part(g,0x68816c,[.14,.15,.14],[side*w*.47,.24,z],'wheel');wheel.rotation.z=Math.PI/2;}}
    part(g,c,[w*.53,.3,l*.44],[0,.8,-.13],'rounded');
    if(rank===MAX_RANK)part(g,0x455448,[.09,.09,l*.38],[0,.81,-l*.28],'barrel');
    part(g,0x35453c,[w*.24,.045,l*.17],[0,.925,-.13],'rounded');
    for(const z of [.25,.31,.37])part(g,0x27352e,[w*.53,.022,l*.025],[0,.66,l*z]);
    for(const side of [-1,1])for(let i=0;i<8;i++)part(g,0x43534b,[w*.19,.026,l*.085],[side*w*.4,.42,l*(-.44+i*.125)]);
    if(!lowDetail)for(const side of [-1,1]){
      for(let i=0;i<22;i++)for(const y of [.045,.42])part(g,0x4c5149,[w*.20,.027,l*.024],[side*w*.4,y,l*(-.46+i*.044)]);
      for(const z of [-l*.38,l*.26])part(g,0xc4d1d4,[.06,.05,.10],[side*w*.35,.64,z]);
      part(g,0x244853,[w*.10,.05,.06],[side*w*.15,.94,-l*.27]);
    }

  }else{
    const suv=rank===3&&carStyle==='suv';
    part(g,c,[w*(rank===3?(suv?.88:.84):.95),suv?.40:.35,l*.94],[0,suv?.43:.38,0],rank===3?(suv?'suvBody':'sedanBody'):'carBody');
    if(suv){
      const cabinSize=[w*.80,.44,l*.67],cabinPosition=[0,.80,l*.11];
      part(g,c,cabinSize,cabinPosition,'suvCabin');
      for(const shape of ['suvFront','suvRear','suvLeft','suvRight'])part(g,0x365664,cabinSize,cabinPosition,shape);
      part(g,c,[w*.70,.035,l*.28],[0,.635,-l*.32],'carBody');
      for(const side of [-1,1]){
        for(const z of [-l*.3,l*.3])part(g,0x263238,[.045,.245,.245*1.6/VEHICLE_LENGTH_SCALE],[side*w*.43,.21,z],'suvArch');
        const pillar=part(g,0x1c292d,[.025,.30,.045],[side*w*.375,.80,l*.04]);pillar.rotation.z=-side*.06;
        part(g,0x1c292d,[.022,.29,.035],[side*w*.374,.80,l*.29]);
        part(g,0x263238,[.035,.095,l*.46],[side*w*.44,.275,0],'rounded');
        for(const z of [-.09,.24]){
          part(g,0x263238,[.012,.30,.014],[side*w*.441,.46,l*z]);
          part(g,0xc4d1d4,[.022,.021,l*.055],[side*w*.443,.56,l*z]);
        }
        const rail=part(g,0x263238,[.040,.035,l*.48],[side*w*.29,1.045,l*.14],'rounded');rail.name='roofRail';
        for(const z of [-.06,.32])part(g,0xc4d1d4,[.045,.048,.042],[side*w*.29,1.025,l*z]);
        part(g,0x263839,[w*.08,.045,l*.035],[side*w*.395,.79,-l*.17]);
        const mirror=part(g,c,[w*.095,.08,l*.075],[side*w*.44,.80,-l*.17],'carBody');mirror.name=side<0?'leftMirror':'rightMirror';
        part(g,0xe0eef0,[w*.075,.045,.012],[side*w*.44,.80,-l*.13]);
        part(g,0xf5fbff,[w*.24,.055,.012],[side*w*.28,.52,-l*.494],'rounded');
        part(g,0xf5704d,[w*.055,.20,.012],[side*w*.36,.59,l*.494],'rounded');
      }
      for(const z of [-.025,.30])part(g,0x263238,[w*.59,.025,.038],[0,1.065,l*z]);
      part(g,0x263839,[w*.58,.16,.018],[0,.47,-l*.494],'rounded');
      for(let bar=0;bar<3;bar++)part(g,0xc4d1d4,[w*.48,.014,.008],[0,.42+bar*.048,-l*.498]);
      for(const end of [-1,1]){
        part(g,0x263238,[w*.87,.10,.022],[0,.28,end*l*.488],'rounded');
        part(g,0xc4d1d4,[w*.48,.035,.012],[0,.245,end*l*.493]);
        part(g,0xe8edf2,[w*.17,.052,.009],[0,.35,end*l*.495]);
      }
      part(g,c,[w*.66,.04,l*.08],[0,1.015,l*.42],'carBody');
      part(g,0xf5704d,[w*.28,.022,.017],[0,.99,l*.425]);
      part(g,0x1c292d,[w*.22,.015,.020],[0,.78,l*.447]);
      part(g,0xc4d1d4,[w*.15,.020,.020],[0,.55,l*.475]);
    }else if(rank===3){
      const cabinSize=[w*.78,.32,l*.48],cabinPosition=[0,.70,l*.04];
      part(g,c,cabinSize,cabinPosition,'carCabin');
      for(const shape of ['carFront','carRear','carLeft','carRight'])part(g,0x365664,cabinSize,cabinPosition,shape);
      for(const side of [-1,1]){
        const pillar=part(g,0x1c292d,[.017,.235,.033],[side*w*.352,.70,l*.045]);pillar.rotation.z=-side*.08;
        part(g,0x263238,[.013,.012,l*.71],[side*w*.421,.365,0]);
        part(g,0x263238,[.011,.185,.010],[side*w*.422,.435,l*.055]);
        part(g,0x263238,[.011,.13,.010],[side*w*.415,.44,-l*.20]);
        part(g,0xc4d1d4,[.018,.018,l*.045],[side*w*.424,.505,l*.16]);
        part(g,0xc4d1d4,[.018,.018,l*.045],[side*w*.424,.505,-l*.13]);
        for(const end of [-1,1]){
          part(g,0x202a2d,[w*.21,.085,.025],[side*w*.29,.435,end*l*.47],'rounded');
          part(g,end<0?0xf5fbff:0xf5704d,[w*.16,.048,.022],[side*w*.29,.45,end*l*.478],'rounded');
        }
      }
      for(let bar=0;bar<5;bar++)part(g,0xc4d1d4,[w*.27,.008,.028],[0,.35+bar*.017,-l*.48]);
      for(const end of [-1,1])part(g,0xe8edf2,[w*.18,.045,.014],[0,.30,end*l*.485]);
      for(const side of [-1,1]){const wiper=part(g,0x17252c,[w*.30,.009,.012],[side*w*.16,.65,-l*.159]);wiper.rotation.y=side*.08;}

      const trim=c==='rainbow'?0xe8edf2:new THREE.Color(c).lerp(new THREE.Color(0xffffff),.22).getHex();
      part(g,c,[w*.64,.010,l*.23],[0,.555,-l*.32],'carBody');
      part(g,0x263839,[w*.32,.065,.025],[0,.38,-l*.477]);
      for(const end of [-1,1])part(g,0xc4d1d4,[w*.72,.065,.035],[0,.27,end*l*.476]);
      for(const side of [-1,1]){
        // 两侧镜壳突出车门且保持在碰撞宽度内，亮色镜片朝向后方，俯视仍能看清。
        part(g,0x263839,[w*.08,.04,l*.035],[side*w*.39,.69,-l*.14]);
        const mirror=part(g,trim,[w*.095,.075,l*.08],[side*w*.44,.69,-l*.14],'carBody');
        mirror.name=side<0?'leftMirror':'rightMirror';
        part(g,0xc4d1d4,[.014,.022,l*.055],[side*w*.423,.53,l*.07]);
        part(g,0xe0eef0,[w*.075,.048,.012],[side*w*.44,.69,-l*.098]);
        part(g,0xe0eef0,[w*.075,.009,l*.045],[side*w*.44,.728,-l*.14]);
      }
    }
    if(rank===4){
      // 驾驶室、轮轴和整车接触尺寸一致，货台决定可辨认的车身轮廓。
      if(truckStyle==='tanker')tankerCabParts(g,c,w,l,part);
      else{
        part(g,c,[w*.88,.51,.65],[0,.72,-l*.36],'rounded');part(g,0x244853,[w*.79,.22,.025],[0,.81,-l*.475]);
        part(g,0x263839,[w*.6,.15,.025],[0,.55,-l*.478]);
      }
      if(truckStyle==='box'){
        part(g,c,[w*.94,.72,l*.6],[0,.85,l*.15],'rounded');part(g,0xdce3d8,[w*.89,.02,l*.58],[0,1.22,l*.15]);
        for(const side of [-1,1]){
          for(const z of [-.07,.09,.25,.41])part(g,0xc4d1d4,[.018,.58,.035],[side*w*.475,.86,l*z]);
          part(g,0xc4d1d4,[w*.4,.58,.016],[side*w*.235,.84,l*.453]);
          for(let stripe=0;stripe<9;stripe++)part(g,0xc4d1d4,[.015,.014,l*.53],[side*w*.476,.58+stripe*.063,l*.15]);
        }
      }else if(truckStyle==='flatbed'){
        part(g,0x4d5b57,[w*.94,.14,l*.61],[0,.59,l*.15]);
        for(const side of [-1,1])for(const z of [-.08,.16,.40])part(g,c,[.045,.50,.045],[side*w*.46,.89,l*z]);
        for(let row=0;row<2;row++)for(let log=0;log<3-row;log++)part(g,0x9b7951,[.28,.28,l*.52],[(log-(2-row)/2)*.29,.80+row*.25,l*.15],'log');
        for(const z of [-.04,.34]){part(g,0x2e3537,[w*.84,.032,.035],[0,1.10,l*z]);for(const side of [-1,1])part(g,0x2e3537,[.025,.47,.035],[side*w*.42,.89,l*z]);}
      }else if(truckStyle==='tipper'){
        part(g,0x333c38,[w*.81,.12,l*.54],[0,.67,l*.18]);
        for(const side of [-1,1]){
          const panel=part(g,c,[.10,.48,l*.56],[side*w*.43,.90,l*.18]);panel.rotation.z=-side*.12;
          part(g,0xc4d1d4,[.07,.045,l*.57],[side*w*.47,1.15,l*.18]);
          for(const z of [-.05,.17,.39])part(g,0x6a5141,[.13,.40,.045],[side*w*.44,.89,l*z]);
        }
        for(const z of [-.10,.46])part(g,c,[w*.89,.47,.07],[0,.89,l*z]);
        part(g,0x8d8c7b,[w*.73,.30,l*.44],[0,1.05,l*.18],'cargoPile');
        for(let i=0;i<7;i++)part(g,i%2?0xaaa696:0x777d72,[.20,.14,.25],[Math.sin(i*2.4)*w*.24,1.12+Math.sin(i)*.025,l*(.04+i*.043)],'animal');
      }else if(truckStyle==='tanker')tankerParts(g,c,w,l,lowDetail,part);
      if(truckStyle!=='tanker'){
        for(const side of [-1,1]){
          part(g,0x244853,[.014,.20,.30],[side*w*.444,.84,-l*.36]);
          part(g,0x263839,[w*.06,.12,.19],[side*w*.46,.79,-l*.44],'rounded');
          part(g,0x263839,[w*.36,.10,.10],[side*w*.22,.25,-l*.489],'rounded');
          part(g,0xc4d1d4,[w*.2,.045,.16],[side*w*.35,.27,-l*.19]);
          part(g,0x263839,[.015,.50,.018],[side*w*.445,.70,-l*.27]);
        }
        for(let bar=0;bar<5;bar++)part(g,0xc4d1d4,[w*.54,.016,.028],[0,.49+bar*.035,-l*.484]);
      }
    }
    const tanker=rank===4&&truckStyle==='tanker',positions=tanker?[-l*.34,l*.24,l*.38]:[-l*.3,l*.3];
    for(const side of [-1,1])for(const z of positions){
      const r=tanker?.22:suv?.21:.19,wheel=part(g,0x243334,[r,.13,r],[side*w*(suv?.423:.43),r,z],'wheel');wheel.rotation.z=Math.PI/2;
      if(tanker&&!lowDetail&&z>0){const inner=part(g,0x243334,[r,.13,r],[side*w*.31,r,z],'wheel');inner.rotation.z=Math.PI/2;}
    }
    if(rank!==3&&!tanker)for(const side of [-1,1]){part(g,rank===3?0xf5fbff:0xffefb2,[w*.18,.07,.035],[side*w*.3,.47,-l*.49]);part(g,0xf5704d,[w*.17,.06,.035],[side*w*.3,.45,l*.48]);}
  }
  if(rank===ARMORED_RANK){
    part(g,0x45463e,[w*.88,.28,l*.76],[0,1.13,0]);
    part(g,c,[w*.58,.42,l*.48],[0,1.48,-.12]);
    part(g,0xe5c16a,[w*.45,.06,l*.16],[0,1.78,-.12]);
    const barrelLength=ARMORED_TANK.barrelLength/VEHICLE_LENGTH_SCALE,barrel=part(g,0x454b42,[.16,.16,barrelLength],[0,1.58,-.3-barrelLength/2],'barrel');barrel.name='armoredBarrel';
    const muzzle=part(g,0x252e2a,[.24,.22,.20],[0,1.58,-.3-barrelLength]);muzzle.name='armoredMuzzle';
    for(const side of [-1,1])for(const z of [-.7,0,.7])part(g,0x4f5348,[w*.13,.45,.58],[side*w*.43,.65,z]);
  }
  if(lowDetail)for(const mesh of [...g.children]){
    // 车身、车窗、车轮、灯光及命名部件保持可识别，只去掉细小装饰。
    const color=mesh.material.color.getHex(),light=color===0xffefb2||color===0xf5fbff||color===0xf5704d;
    if(!mesh.name&&!light&&!mesh.userData.wheelRadius&&mesh.geometry===geometry.box&&Math.max(mesh.scale.x,mesh.scale.y,mesh.scale.z)<=RENDER_QUALITY.smallPartSize)g.remove(mesh);
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
    const base=new THREE.Box3().setFromObject(vehicleModel(MAX_RANK,false,c,lowDetail)),bounds=new THREE.Box3().setFromObject(g);
    g.scale.y=(base.max.y-base.min.y)*ARMORED_TANK.heightMultiplier/(bounds.max.y-bounds.min.y);
    g.position.y=base.min.y-bounds.min.y*g.scale.y;
  }
  {
    // 静态细节按材质合并到模板，只有车轮保持独立，避免车流逐帧遍历小部件。
    const groups=new Map();
    for(const mesh of [...g.children]){
      if(mesh.userData.wheelRadius)continue;
      mesh.updateMatrix();
      let group=groups.get(mesh.material);
      if(!group){group={parts:[],name:''};groups.set(mesh.material,group);}
      group.parts.push(mesh);
      if(mesh.name)group.name=mesh.name;
      g.remove(mesh);
    }
    for(const [mat,group]of groups){
      // 几何键只描述部件布局，车色与玩家身份不产生重复的顶点缓冲。
      const geometryKey=group.parts.map(part=>(part.geometry.userData.assetKey??part.geometry.type)+':'+part.matrix.elements.join(',')).join('|');
      let shared=mergedGeometry.get(geometryKey);
      if(!shared){
        shared=cachedGeometry('vehicle-merged:'+geometryKey,()=>{
        const pieces=group.parts.map(part=>{const piece=(part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone()).applyMatrix4(part.matrix);if(!piece.attributes.color){const color=new Float32Array(piece.attributes.position.count*3);color.fill(1);piece.setAttribute('color',new THREE.BufferAttribute(color,3));}return piece;});
        const result=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();return result;});mergedGeometry.set(geometryKey,shared);
      }
      const mesh=new THREE.Mesh(shared,mat);
      mesh.name=group.name;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
    }
  }
  cacheModelBounds(g);templates.set(key,g);return g.clone(true);
}

export function cowModel(){
  if(templates.has('cow'))return templates.get('cow').clone(true);
  const g=new THREE.Group(),white=0xf5f1df,black=0x171d1c,pink=0xd49a97;
  // 牛的肩胛、宽腹、短颈和宽额独立塑形，不复用马头与马颈。
  part(g,white,[1.36,1.25,2.12],[0,1.24,.20],'cowBody');
  part(g,white,[.90,.88,.70],[0,1.30,-.71],'animal');
  part(g,white,[.76,.76,.75],[0,1.48,-1.02],'cowHead');
  part(g,pink,[.69,.32,.36],[0,1.20,-1.39],'animal');
  part(g,0x8e625d,[.48,.022,.08],[0,1.10,-1.52],'rounded');
  for(const side of [-1,1]){
    const ear=part(g,white,[.37,.13,.24],[side*.43,1.72,-.93],'animal');ear.rotation.z=side*.18;
    part(g,pink,[.27,.035,.17],[side*.43,1.75,-.95],'animal');
    part(g,0xd7cfaf,[.10,.23,.10],[side*.26,1.92,-.95],'cone').rotation.z=-side*.48;
    part(g,0x8c8068,[.065,.15,.065],[side*.32,2.04,-.95],'cone').rotation.z=side*.30;
    part(g,0x51433b,[.045,.09,.12],[side*.32,1.57,-1.18],'animal');
    part(g,black,[.035,.055,.075],[side*.345,1.57,-1.21],'animal');
    part(g,0xe1e0d3,[.009,.014,.014],[side*.363,1.59,-1.23],'animal');
    part(g,0x473432,[.10,.065,.026],[side*.18,1.24,-1.56],'animal');
    for(const end of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.42,.87,end*.73+.14);leg.userData.cowLeg=side*end;g.add(leg);
      part(leg,white,[.36,.50,.38],[0,-.15,0],'animal');
      part(leg,white,[.21,.47,.21],[0,-.51,0],'limb');
      for(const toe of [-1,1])part(leg,black,[.115,.15,.27],[toe*.067,-.73,-.025],'hoof');
    }
  }
  part(g,pink,[.54,.25,.52],[0,.65,.47],'animal');
  for(const x of [-.13,.13])for(const z of [.33,.58])part(g,pink,[.07,.13,.07],[x,.48,z],'limb');
  const tail=part(g,white,[.09,.82,.09],[0,1.02,1.34],'limb');tail.userData.cowTail=true;
  part(g,black,[.16,.23,.17],[0,.61,1.35],'animal');
  const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const sx=COW_CROSSING.dimensions.length/size.x,sz=COW_CROSSING.dimensions.width/size.z;
  for(const child of g.children){child.position.x=(child.position.x-center.x)*sx;child.position.z=(child.position.z-center.z)*sz;child.scale.x*=sx;child.scale.z*=sz;}
  templates.set('cow',g);return g.clone(true);
}

export function horseModel(){
  if(templates.has('whiteHorse'))return templates.get('whiteHorse').clone(true);
  const g=new THREE.Group(),white=0xfaf8ee,mane=0xd8d5c5;
  part(g,white,[1.1,1.05,2.5],[0,1.55,.15],'horseBody');
  const neck=part(g,white,[.62,1.25,.66],[0,2.12,-1.02],'horseNeck');neck.rotation.x=-.3;
  const head=part(g,white,[.55,.52,.92],[0,2.72,-1.53],'horseHead');head.rotation.x=.18;
  part(g,0xd9d3c5,[.38,.26,.44],[0,2.57,-1.98],'animal');
  for(const side of [-1,1]){part(g,0x736f62,[.07,.04,.045],[side*.15,2.63,-2.17],'animal');part(g,white,[.46,.85,.72],[side*.28,1.48,-.76],'animal');part(g,white,[.52,.85,.78],[side*.28,1.51,.91],'animal');}
  const crest=part(g,mane,[.15,1.1,.18],[0,2.18,-.72]);crest.rotation.x=-.3;
  for(const side of [-1,1]){
    const ear=part(g,white,[.12,.26,.12],[side*.17,3.035,-1.36],'cone');ear.rotation.z=-side*.16;
    part(g,0x28393b,[.025,.045,.055],[side*.245,2.83,-1.7],'animal');
    for(const end of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.37,1.5,end*.88);leg.userData.horsePhase=side*end>0?0:Math.PI;g.add(leg);
      part(leg,white,[.28,.72,.30],[0,-.36,0],'limb');
      part(leg,white,[.34,.5,.5],[0,-.15,.04],'animal');
      const knee=new THREE.Group();knee.position.y=-.68;knee.userData.horseKnee=true;leg.add(knee);
      part(knee,white,[.17,.64,.18],[0,-.32,0],'limb');part(knee,0x6a6256,[.26,.18,.34],[0,-.68,-.06],'hoof');
    }
  }
  const tail=new THREE.Group();tail.position.set(0,1.65,1.48);tail.userData.horseTail=true;g.add(tail);
  const hair=part(tail,mane,[.25,.95,.33],[0,-.26,.25],'limb');hair.rotation.x=.4;
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
