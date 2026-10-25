import { buildingParts } from './building-layout.js';

// 建筑细节贴合既有主体包络，屋顶与入口由同一楼型和稳定坐标决定。
export function buildingDetails(site,parts){
  const details=[],hash=(site.layoutSeed??(Math.imul(Math.round(site.x),73856093)^Math.imul(Math.round(site.z),19349663)))>>>0;
  const frame=[0xc1beb0,0x9baeb1,0xc9bda6,0x738d99][hash%4],glass=[0x355561,0x3a505a,0x52605b,0x405b66][hash%4];
  const add=(p,x,y,z,w,h,d,color,role='frame')=>details.push({x,y,z,w,h,d,color,role,shift:p.shift,collision:y-h/2>=p.y+p.height/2});
  for(const p of parts){
    if(p.role==='equipment')continue;
    const base=p.y-p.height/2,top=p.y+p.height/2;
    if(p.role!=='podium'&&p.height>80){
      const count=Math.max(3,Math.min(8,Math.floor(Math.min(p.width,p.depth)/65)));
      for(const side of [-1,1])for(let i=0;i<=count;i++){
        const t=i/count-.5;
        add(p,p.x+t*p.width*.94,p.y,p.z+side*(p.depth*.5+.22),Math.max(1.5,p.width*.008),p.height,1.0,frame);
        add(p,p.x+side*(p.width*.5+.22),p.y,p.z+t*p.depth*.94,1.0,p.height,Math.max(1.5,p.depth*.008),frame);
      }
    }
    if(p.role==='podium'||site.height<45){
      const entranceWidth=Math.min(p.width*.34,60),entranceHeight=Math.min(p.height*.65,24);
      for(const side of [-1,1]){
        add(p,p.x,base+entranceHeight*.5,p.z+side*(p.depth*.5+.3),entranceWidth,entranceHeight,.5,glass,'glass');
        add(p,p.x,base+entranceHeight+1.2,p.z+side*(p.depth*.5+.2),entranceWidth*1.18,2.2,1.2,frame);
        for(const dx of [-.52,0,.52])add(p,p.x+dx*entranceWidth,base+entranceHeight*.5,p.z+side*(p.depth*.5+.7),1.2,entranceHeight,.5,frame);
        for(const dx of [-.36,-.24,.24,.36])add(p,p.x+dx*p.width,base+p.height*.45,p.z+side*(p.depth*.5+.1),p.width*.075,p.height*.6,.4,glass,'glass');
      }
    }
    const unit=Math.min(p.width,p.depth)*.17;
    for(let i=0;i<2+(hash%3);i++){
      const dx=((i%2)-.5)*p.width*.48,dz=(Math.floor(i/2)-.5)*p.depth*.45;
      add(p,p.x+dx,top+2.2,p.z+dz,unit,4.4,unit*.75,0x85928d);
      add(p,p.x+dx,top+4.6,p.z+dz,unit*.8,.5,unit*.55,0x354a50,'glass');
      for(const side of [-1,1])add(p,p.x+dx+side*unit*.3,top+5,p.z+dz,unit*.035,.7,unit*.55,frame);
    }
    // 退台放置花池和设备围屏，不在高空重复堆实体楼层横条。
    if(p.style>=2&&p.role!=='podium')for(const side of [-1,1]){
      add(p,p.x+side*p.width*.37,top+1.4,p.z+p.depth*.32,p.width*.13,2.8,p.depth*.1,0x7a8566);
      add(p,p.x+side*p.width*.37,top+2.9,p.z+p.depth*.32,p.width*.11,.6,p.depth*.08,0x536b4c);
    }
  }
  return details;
}

// 屋顶设备与花池沿用渲染尺寸，细薄贴面由原主体碰撞覆盖。
export function buildingCollisionParts(site){
  const parts=buildingParts(site);
  return [...parts,...buildingDetails(site,parts).filter(p=>p.collision).map(p=>({x:p.x,y:p.y,z:p.z,width:p.w,height:p.h,depth:p.d,shift:p.shift}))];
}
