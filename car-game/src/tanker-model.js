import * as THREE from '../node_modules/three/build/three.module.js';
import { mergeGeometries } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { roundedBoxGeometry } from './model-surfaces.js';
import { TANKER_APPEARANCE, VEHICLE_WIDTH_SCALE, VEHICLE_LENGTH_SCALE } from './config.js';

let signMaterial;
export function tankerSignMaterial(){
  signMaterial??=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.03,side:THREE.DoubleSide});
  return signMaterial;
}
// 标牌用共享顶点色几何，后台可直接传输，不依赖字体、图片或运行时画布。
function placard(kind){
  const pieces=[];
  const add=(shape,color,z)=>{
    const geometry=new THREE.ShapeGeometry(shape,10).toNonIndexed().translate(0,0,z),rgb=new THREE.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=rgb.r;colors[i+1]=rgb.g;colors[i+2]=rgb.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(geometry);
  };
  const polygon=points=>new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const rect=(x,y,w,h,color,z)=>add(polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]),color,z);
  if(kind==='fire'){
    for(const [r,color,z] of [[.5,0x202729,0],[.475,0xf7f2df,.001],[.443,0xc92d25,.002]])add(polygon([[0,r],[r,0],[0,-r],[-r,0]]),color,z);
    const flame=new THREE.Shape();flame.moveTo(-.15,-.07);flame.bezierCurveTo(-.28,.02,-.12,.16,-.15,.27);flame.bezierCurveTo(-.08,.24,-.05,.17,-.02,.18);flame.bezierCurveTo(.01,.26,-.025,.315,.045,.37);flame.bezierCurveTo(.045,.24,.22,.20,.21,.05);flame.bezierCurveTo(.21,-.03,.15,-.09,.10,-.09);flame.closePath();add(flame,0xfff7df,.003);
    const core=new THREE.Shape();core.moveTo(.01,-.07);core.quadraticCurveTo(-.06,.01,.025,.12);core.quadraticCurveTo(.035,.04,.10,.015);core.quadraticCurveTo(.13,-.04,.085,-.07);core.closePath();add(core,0xc92d25,.004);
    rect(-.17,-.13,.34,.022,0xfff7df,.004);
    for(const y of [-.33,-.265,-.20])rect(-.045,y,.095,.020,0xfff7df,.004);
    rect(.035,-.32,.020,.13,0xfff7df,.004);
  }else if(kind==='number'){
    rect(-.5,-.26,1,.52,0x202729,0);rect(-.47,-.23,.94,.46,0xf3a333,.001);rect(-.47,-.005,.94,.016,0x202729,.002);
    const digits={0:'abcdef',1:'bc',2:'abged',3:'abgcd'};
    const segments={a:[.02,.145,.08,.016],b:[.09,.08,.016,.075],c:[.09,.005,.016,.075],d:[.02,0,.08,.016],e:[.005,.005,.016,.075],f:[.005,.08,.016,.075],g:[.02,.073,.08,.016]};
    for(const [text,y]of [['33',.043],['1203',-.208]])for(const [i,digit]of Array.from(text).entries())for(const segment of digits[digit]){
      const [x,dy,w,h]=segments[segment];rect((i-text.length/2)*.145+x,y+dy,w,h,0x202729,.003);
    }
  }else{
    add(polygon([[0,.5],[.5,-.4],[-.5,-.4]]),0x202729,0);add(polygon([[0,.39],[.40,-.34],[-.40,-.34]]),0xf5cc40,.001);
    rect(-.035,-.12,.07,.30,0x202729,.002);rect(-.035,-.25,.07,.065,0x202729,.002);
  }
  const result=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();return result;
}
export function tankerGeometries(){
  const result={};
  const profile=[[0,-.5],[.20,-.495],[.35,-.477],[.455,-.44],[.495,-.395],[.5,-.34],[.5,.34],[.495,.395],[.455,.44],[.35,.477],[.20,.495],[0,.5]].map(point=>new THREE.Vector2(...point));
  result.tankerBody=new THREE.LatheGeometry(profile,TANKER_APPEARANCE.tankSegments).rotateX(Math.PI/2);
  result['low-tankerBody']=new THREE.LatheGeometry(profile,TANKER_APPEARANCE.lowTankSegments).rotateX(Math.PI/2);
  result.tankerBand=new THREE.TorusGeometry(.5,.012,6,TANKER_APPEARANCE.tankSegments);
  result['low-tankerBand']=new THREE.TorusGeometry(.5,.012,4,TANKER_APPEARANCE.lowTankSegments);
  result.tankerHatch=new THREE.CylinderGeometry(.5,.5,1,24);
  result['low-tankerHatch']=new THREE.CylinderGeometry(.5,.5,1,12);
  result.tankerValve=new THREE.TorusGeometry(.5,.075,6,16).rotateY(Math.PI/2);
  result.tankerCab=roundedBoxGeometry(.06);
  const vertices=result.tankerCab.attributes.position;
  for(let i=0;i<vertices.count;i++){const blend=vertices.getY(i)+.5;vertices.setXYZ(i,vertices.getX(i)*(1-.06*blend),vertices.getY(i),vertices.getZ(i)+(vertices.getZ(i)<0?.10*blend:0));}
  result.tankerCab.computeVertexNormals();
  const windows={tankerFront:[[-.43,.045,-.448],[.43,.045,-.448],[.41,.36,-.417],[-.41,.36,-.417]]};
  for(const side of [-1,1])windows[side<0?'tankerLeft':'tankerRight']=[[side*.489,-.04,-.38],[side*.489,-.04,.28],[side*.477,.35,.28],[side*.477,.35,-.35]];
  for(const [name,points] of Object.entries(windows)){
    const pane=new THREE.BufferGeometry();pane.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));pane.setIndex(name==='tankerLeft'?[0,1,2,0,2,3]:[0,2,1,0,3,2]);pane.computeVertexNormals();result[name]=pane;
  }
  const fire=placard('fire'),number=placard('number');
  result.hazardRear=fire;result.hazardTop=fire.clone().rotateX(-Math.PI/2);
  result.hazardLeft=fire.clone().rotateY(-Math.PI/2);result.hazardRight=fire.clone().rotateY(Math.PI/2);
  result.hazardNumberRear=number;result.hazardNumberLeft=number.clone().rotateY(-Math.PI/2);result.hazardNumberRight=number.clone().rotateY(Math.PI/2);
  result.hazardWarningTop=placard('warning').rotateX(-Math.PI/2);
  return result;
}
export function tankerCabParts(g,c,w,l,part){
  const size=[w*.90,.70,l*.26],position=[0,.84,-l*.36];
  part(g,c,size,position,'tankerCab');
  for(const shape of ['tankerFront','tankerLeft','tankerRight'])part(g,0x244853,size,position,shape);
  part(g,0x263238,[w*.77,.17,.020],[0,.65,-l*.492],'rounded');
  for(let bar=0;bar<4;bar++)part(g,0xc4d1d4,[w*.64,.018,.014],[0,.595+bar*.038,-l*.497]);
  part(g,0x333b3e,[w*.90,.10,.055],[0,.43,-l*.487],'rounded');
  for(const side of [-1,1]){
    part(g,0xf5fbff,[w*.18,.055,.016],[side*w*.33,.51,-l*.494],'rounded');
    part(g,0xffa538,[w*.045,.06,.018],[side*w*.435,.51,-l*.490]);
    part(g,0x263238,[.022,.26,.025],[side*w*.45,.91,-l*.405]);
    part(g,c,[w*.05,.16,.06],[side*w*.474,.91,-l*.405],'rounded');
    part(g,0xe0eef0,[w*.052,.12,.014],[side*w*.474,.91,-l*.390]);
    part(g,0x263238,[.015,.44,.014],[side*w*.449,.72,-l*.29]);
    part(g,0xc4d1d4,[.025,.022,.075],[side*w*.45,.77,-l*.31]);
    for(const y of [.36,.44])part(g,0xc4d1d4,[w*.18,.035,.16],[side*w*.36,y,-l*.24]);
    part(g,0x263238,[.15,.035,.14],[side*w*.29,1.20,-l*.36],'rounded');
    part(g,0xffa538,[.115,.11,.115],[side*w*.29,1.25,-l*.36],'lens');
    const wiper=part(g,0x18262c,[w*.32,.012,.014],[side*w*.18,.91,-l*.476]);wiper.rotation.y=side*.10;
  }
  part(g,0xffffff,[.64/VEHICLE_WIDTH_SCALE,1,.64/VEHICLE_LENGTH_SCALE],[0,1.20,-l*.36],'hazardWarningTop').name='dangerWarning';
}
export function tankerParts(g,c,w,l,lowDetail,part){
  part(g,TANKER_APPEARANCE.tankColor,[w*.94,.88,l*.65],[0,1.00,l*.14],'tankerBody');
  for(const z of [-.06,.13,.34])part(g,0xc4d1d4,[w*.946,.886,1],[0,1.00,l*z],'tankerBand');
  for(const side of [-1,1]){
    part(g,0x333d40,[.09,.10,l*.65],[side*w*.29,.46,l*.14]);
    part(g,0xc4d1d4,[.11,.11,l*.48],[side*w*.40,.57,l*.17],'barrel');
    part(g,0x263238,[w*.20,.26,.027],[side*w*.40,.23,l*.43]);
    part(g,0xc4d1d4,[.025,.027,l*.34],[side*w*.30,1.49,l*.15]);
    for(const z of [-.02,.32])part(g,0xc4d1d4,[.022,.095,.022],[side*w*.30,1.445,l*z]);
    const sign=part(g,0xffffff,[1,TANKER_APPEARANCE.signSize/1.6,TANKER_APPEARANCE.signSize/VEHICLE_LENGTH_SCALE],[side*w*.477,1.00,l*.08],side<0?'hazardLeft':'hazardRight');sign.name='dangerSide';
    part(g,0xffffff,[1,.60/1.6,.85/VEHICLE_LENGTH_SCALE],[side*w*.465,.79,l*.30],side<0?'hazardNumberLeft':'hazardNumberRight');
    for(let stripe=0;stripe<7;stripe++)part(g,stripe%2?0xf4ead5:c,[.014,.035,l*.065],[side*w*.461,.48,l*(-.06+stripe*.070)]);
  }
  for(const z of [-.06,.30])part(g,0x697372,[w*.82,.20,.15],[0,.62,l*z],'rounded');
  part(g,0x586160,[w*.36,.045,l*.46],[0,1.46,l*.15]);
  for(const z of [-.035,.33]){
    part(g,0x5d696a,[.25,.045,.25*1.6/VEHICLE_LENGTH_SCALE],[0,1.47,l*z],'tankerHatch');
    part(g,0xc4d1d4,[.22,.035,.22],[0,1.50,l*z],'rounded');
    part(g,0x263238,[.10,.025,.025],[0,1.53,l*z]);
  }
  part(g,0xffffff,[TANKER_APPEARANCE.topSignSize/VEHICLE_WIDTH_SCALE,1,TANKER_APPEARANCE.topSignSize/VEHICLE_LENGTH_SCALE],[0,1.495,l*.145],'hazardTop').name='dangerTop';
  part(g,0xffffff,[TANKER_APPEARANCE.signSize/VEHICLE_WIDTH_SCALE,TANKER_APPEARANCE.signSize/1.6,1],[0,1.00,l*.478],'hazardRear').name='dangerRear';
  part(g,0xffffff,[.88/VEHICLE_WIDTH_SCALE,.88/1.6,1],[0,.55,l*.483],'hazardNumberRear');
  for(const x of [.27,.43])part(g,0xc4d1d4,[.025,.98,.025],[w*x,.96,l*.472]);
  for(let rung=0;rung<7;rung++)part(g,0xc4d1d4,[w*.18,.020,.030],[w*.35,.54+rung*.14,l*.475]);
  part(g,0x263238,[w*.91,.12,.045],[0,.34,l*.484],'rounded');
  for(const side of [-1,1]){
    part(g,0xf5704d,[w*.16,.075,.020],[side*w*.32,.39,l*.492],'rounded');
    part(g,0xffa538,[w*.05,.075,.020],[side*w*.43,.39,l*.492]);
  }
  if(!lowDetail){
    for(const side of [-1,1]){
      part(g,0x333d40,[.065,.075,l*.43],[side*w*.38,.53,l*.15],'barrel');
      part(g,0xc4d1d4,[.055,.14,.06],[side*w*.435,.62,l*.24]);
      part(g,c,[.035,.12,.12*1.6/VEHICLE_LENGTH_SCALE],[side*w*.46,.65,l*.24],'tankerValve');
      for(const z of [-.04,.10,.27])part(g,0x4c5858,[.15,.025,.045],[side*w*.38,.54,l*z]);
    }
    for(let step=0;step<12;step++)part(g,0x889290,[w*.32,.013,.014],[0,1.489,l*(-.06+step*.037)]);
  }
}
