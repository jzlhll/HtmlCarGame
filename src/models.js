import * as THREE from 'three';
import { VEHICLES, VEHICLE_LENGTH_SCALE, VEHICLE_WIDTH_SCALE } from './config.js';
const geometry={box:new THREE.BoxGeometry(1,1,1),wheel:new THREE.CylinderGeometry(1,1,1,12),sphere:new THREE.IcosahedronGeometry(1,0)};
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
const materials=new Map();
export function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.08}));return materials.get(color);}
function part(group,color,size,position,shape='box'){
  const mesh=new THREE.Mesh(geometry[shape],material(color));mesh.scale.set(...size);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;if(shape==='wheel')mesh.userData.wheelRadius=size[0]*1.6;group.add(mesh);return mesh;
}
const templates=new Map();
export function vehicleModel(rank,player=false,appearance='default',bodyColor){
  const tractor=rank===3&&!player&&appearance==='tractor';
  const c=player?0xf5cc58:bodyColor??(tractor?0x73964a:VEHICLES[rank].color);
  const key=rank+':'+player+':'+tractor+':'+c;
  if(templates.has(key))return templates.get(key).clone(true);
  const v=VEHICLES[rank],g=new THREE.Group(),w=v.width/VEHICLE_WIDTH_SCALE,l=v.length/VEHICLE_LENGTH_SCALE;
  if(rank===1){
    for(const z of [-.33,.33]){const wheel=part(g,0x243232,[.19,.065,.19],[0,.21,z],'wheel');wheel.rotation.z=Math.PI/2;}
    const frame=part(g,c,[.09,.11,.7],[0,.38,0]);frame.rotation.x=.1;
    part(g,c,[1,1,1],[0,.59,-.34],'handlebar');
    for(const side of [-1,1]){const grip=part(g,0x263839,[.055,.05,.09],[side*.20,.59,-.26]);grip.rotation.y=side*.25;}
    part(g,c,[.045,.12,.045],[0,.55,-.33]);part(g,0x263839,[.18,.05,.15],[0,.56,.16]);
    const fork=part(g,c,[.065,.36,.065],[0,.37,-.33]);fork.rotation.x=-.17;
    part(g,0xd2e2d4,[.06,.31,.07],[0,.47,.15]);
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
  }else if(rank===6){
    part(g,c,[w*.78,.39,l*.88],[0,.45,0]);
    for(const side of [-1,1]){part(g,0x273c33,[w*.2,.38,l],[side*w*.4,.22,0]);for(let z=-.85;z<=.85;z+=.34){const wheel=part(g,0x68816c,[.14,.15,.14],[side*w*.47,.24,z],'wheel');wheel.rotation.z=Math.PI/2;}}
    part(g,c,[w*.53,.3,l*.44],[0,.8,-.13]);part(g,0x627a63,[.13,.13,l*.4],[0,.85,-l*.3]);
  }else{
    part(g,c,[w*(rank===3&&!tractor?.84:.95),.35,l*.94],[0,.38,0]);
    if(rank===3&&!tractor){
      const cabinSize=[w*.78,.32,l*.5],cabinPosition=[0,.70,0];
      part(g,c,cabinSize,cabinPosition,'carCabin');
      for(const shape of ['carFront','carRear','carLeft','carRight'])part(g,0x365664,cabinSize,cabinPosition,shape);
      for(const side of [-1,1]){
        part(g,0x263839,[w*.07,.035,l*.035],[side*w*.414,.67,-l*.14]);
        part(g,c,[w*.10,.075,l*.085],[side*w*.45,.67,-l*.14]);
        part(g,0x9ab8c3,[w*.075,.05,.008],[side*w*.45,.67,-l*.096]);
      }
    }
    if(tractor){part(g,c,[w*.62,.42,.7],[0,.78,.22]);part(g,0x264d45,[w*.56,.24,.05],[0,.81,-.13]);part(g,c,[w*.62,.18,l*.38],[0,.56,-l*.28]);part(g,0x292f2b,[.05,.5,.05],[w*.23,.85,-l*.27]);}
    if(rank===4||rank===5){part(g,c,[w*.94,.72,l*.6],[0,.85,l*.15]);part(g,0xdce3d8,[w*.89,.02,l*.58],[0,1.22,l*.15]);part(g,c,[w*.88,.51,.65],[0,.72,-l*.36]);part(g,0x244853,[w*.79,.22,.025],[0,.81,-l*.475]);}
    const positions=rank===5 ? [-l*.32,l*.14,l*.35]:[-l*.3,l*.3];
    for(const side of [-1,1])for(const z of positions){const r=tractor&&z>0?.32:.19;const wheel=part(g,0x243334,[r,.13,r],[side*w*.43,r,z],'wheel');wheel.rotation.z=Math.PI/2;}
    for(const side of [-1,1]){part(g,0xffefb2,[w*.18,.07,.035],[side*w*.3,.47,-l*.49]);part(g,0xf5704d,[w*.17,.06,.035],[side*w*.3,.45,l*.48]);}
  }
  const scale=new THREE.Vector3(VEHICLE_WIDTH_SCALE,1.6,VEHICLE_LENGTH_SCALE);
  g.children.forEach(mesh=>{if(mesh.userData.wheelRadius)mesh.scale.multiplyScalar(1.6);else mesh.scale.multiply(scale);mesh.position.multiply(scale);});
  templates.set(key,g);return g.clone(true);
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
