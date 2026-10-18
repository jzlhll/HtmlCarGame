import { HARBOR } from './config.js';

// 港区实体与场景实例使用同一份尺寸，避免大型设施只有外观没有碰撞。
export function harborParts() {
  const parts=[],s=HARBOR;
  const box=(x,y,z,width,height,depth,role,color)=>parts.push({x:s.x+x,y,z:s.z+z,width,height,depth,role,color,name:role==='container'?'集装箱':role==='crane'?'港口起重机':role==='ship'?'货船':'港区设施'});
  box(0,1.4,0,1500,2.8,1460,'quay',0x89918c);
  box(900,1.2,350,400,2.4,64,'quay',0x89918c);
  box(430,30,360,460,54,240,'warehouse',0xa3aaa6);
  box(430,30,-360,460,54,240,'warehouse',0xb2ad9a);
  for(const z of [-360,360])for(let i=0;i<12;i++){box(230+i*36,58,z,8,2,205,'glass',0x839c9d);box(230+i*36,23,z+121,24,32,1,'door',0x64777a);}
  for(let row=0;row<8;row++)for(let col=0;col<11;col++){
    if(col===5)continue;
    const levels=1+(row+col)%3;
    for(let level=0;level<levels;level++)box(-490+col*60,8.8+level*12, -520+row*136,48,12,18,'container',s.containerColors[(row*3+col+level)%s.containerColors.length]);
  }
  for(const z of [-490,0,490]){
    for(const x of [-675,-510])box(x,60,z,10,116,12,'crane',0xd4ae52);
    box(-592,121,z,235,12,16,'crane',0xc3a04d);
    box(-760,130,z,210,9,11,'crane',0xd4ae52);
    box(-850,90,z,2,80,2,'crane',0x4b5252);
    box(-850,49,z,38,5,22,'crane',0x806b42);
  }
  box(-860,-1,40,76,12,470,'ship',0x394955);
  box(-860,7,40,70,5,440,'ship',0x8b8d80);
  box(-860,30,220,62,42,52,'warehouse',0xc1c5bc);
  for(let row=0;row<9;row++)for(let col=0;col<3;col++)box(-883+col*23,17, -135+row*37,18,14,32,'container',s.containerColors[(row+col)%s.containerColors.length]);
  return parts;
}

export function parkingParts(x,z,width=540,depth=680) {
  const parts=[{x,y:.18,z,width,height:.24,depth,role:'parking',color:0x5e6665,name:'停车场路面'}];
  const colors=[0xc3c8c8,0xe4e3d9,0x537a91,0x535b60,0x9c5347,0x9d9d91];
  for(let row=0;row<8;row++)for(let col=0;col<18;col++){
    if((row*17+col*7)%9<2)continue;
    const px=x+(col-8.5)*24,pz=z+(row-3.5)*70;
    parts.push({x:px,y:1.8,z:pz,width:9,height:3,depth:18,role:'car',color:colors[(row+col)%colors.length],name:'停车场车辆'});
    parts.push({x:px,y:3.9,z:pz-1,width:7.7,height:1.6,depth:9,role:'glass',color:0x374d56,name:'停车场车辆'});
  }
  return parts;
}
