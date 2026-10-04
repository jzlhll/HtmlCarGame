import { random, laneD, VEHICLES } from './config.js';

export const MUD_SECONDS=8;
export const BUMP_SECONDS=.65;

export function surfaceContact(start,finish,hazard){
  const vehicle=VEHICLES[start.rank],tireWidth=start.rank===6?vehicle.width*.1:.1;
  const rx=hazard.dimensions.width/2+tireWidth,rz=hazard.dimensions.length/2+.15;
  const dx=(finish.d-start.d)/rx,dz=(finish.s-start.s)/rz,a=dx*dx+dz*dz;
  let contacts;
  if(start.rank===1)contacts=[[0,-vehicle.length*.33],[0,vehicle.length*.33]];
  else if(start.rank===2)contacts=[[0,vehicle.length*.34],[-vehicle.width*.4,-vehicle.length*.34],[vehicle.width*.4,-vehicle.length*.34]];
  else{
    const ends=start.rank===6?[-vehicle.length*.34,0,vehicle.length*.34]:[-vehicle.length*.33,vehicle.length*.33];
    contacts=[-vehicle.width*.4,vehicle.width*.4].flatMap(side=>ends.map(end=>[side,end]));
  }
  let earliest=Infinity;
  // 车轮或履带沿本步轨迹扫过椭圆，避免只擦到车身边角也算踩洞。
  for(const [side,end]of contacts){
    const x=(start.d+side-hazard.d)/rx,z=(start.s+end-hazard.s)/rz,c=x*x+z*z-1;
    if(c<=0){earliest=0;continue;}
    if(a<1e-12)continue;
    const b=2*(x*dx+z*dz),discriminant=b*b-4*a*c;
    if(discriminant<0)continue;
    const t=(-b-Math.sqrt(discriminant))/(2*a);
    if(t>=0&&t<=1)earliest=Math.min(earliest,t);
  }
  return Number.isFinite(earliest)?{time:earliest,kind:'surface'}:null;
}

// 稀疏路面障碍随道路计划循环，接触记录只保留玩家附近的部分。
export class RoadHazards {
  constructor(road){
    this.road=road;this.plan=[];this.hits=new Map();
    const rng=random(road.seed^0x71b37e);
    for(let slot=260;slot<road.length-180;slot+=100){
      const chance=rng(),s=slot+rng()*35;
      if(chance>=.16||road.closures(s-160,320).length||road.segment(s).kind==='open')continue;
      const kind=chance<.10?'pothole':'mud',lanes=road.available(s);
      const lane=Math.floor(rng()*lanes),direction=rng()<.5?-1:1;
      this.plan.push({s,d:laneD(lane,direction),kind,drift:rng()<.5?-1:1,dimensions:{width:kind==='mud'?2.8:2.1,length:kind==='mud'?4:2.6}});
    }
  }
  range(from,to){
    const result=[],length=this.road.length;
    for(let lap=Math.floor(Math.max(0,from)/length);lap<=Math.floor(Math.max(0,to)/length);lap++)for(let i=0;i<this.plan.length;i++){
      const hazard=this.plan[i],s=lap*length+hazard.s;
      if(s>=from&&s<=to)result.push({...hazard,s,id:lap+':'+i});
    }
    return result;
  }
}
