import { random, laneD, VEHICLES, MAX_RANK, VEHICLE_WIDTH_SCALE, BICYCLE_WIDTH_SCALE, BICYCLE_TIRE_WIDTH, ROAD_CACHE, ROAD_FORKS } from './config.js';

export const MUD_SECONDS=8;
export const BUMP_SECONDS=.65;

// 轮胎相对坐标只取决于车型，接触查询直接使用标量而不复制运动对象。
const tireContacts=VEHICLES.map((vehicle,rank)=>{
  if(!vehicle)return [];
  if(rank===1)return [[0,-vehicle.length*.33],[0,vehicle.length*.33]];
  if(rank===2)return [[0,vehicle.length*.34],[-vehicle.width*.4,-vehicle.length*.34],[vehicle.width*.4,-vehicle.length*.34]];
  const ends=rank===MAX_RANK?[-vehicle.length*.34,0,vehicle.length*.34]:[-vehicle.length*.33,vehicle.length*.33];
  return [-vehicle.width*.4,vehicle.width*.4].flatMap(side=>ends.map(end=>[side,end]));
});

export function surfaceContact(start,finish,hazard,road){
  if((start.route??null)!==(hazard.route??null))return null;
  const scale=road.pathScale(hazard.s,hazard.route),startD=start.d-road.branchCenter(start.s,start.route),finishD=finish.d-road.branchCenter(finish.s,start.route);
  const hazardD=hazard.d-road.branchCenter(hazard.s,start.route),startS=start.s*scale,finishS=finish.s*scale,hazardS=hazard.s*scale;
  const vehicle=VEHICLES[start.rank],tireWidth=start.rank===1?BICYCLE_TIRE_WIDTH*VEHICLE_WIDTH_SCALE*BICYCLE_WIDTH_SCALE/2:start.rank===MAX_RANK?vehicle.width*.1:.1;
  const rx=hazard.dimensions.width/2+tireWidth,rz=hazard.dimensions.length/2+.15;
  const dx=(finishD-startD)/rx,dz=(finishS-startS)/rz,a=dx*dx+dz*dz;
  const contacts=tireContacts[start.rank];
  let earliest=Infinity;
  const sin=Math.sin(start.yaw||0),cos=Math.cos(start.yaw||0);
  // 车轮或履带沿本步轨迹扫过椭圆，避免只擦到车身边角也算踩洞。
  for(const [side,end]of contacts){
    const x=(startD+side*cos+end*sin-hazardD)/rx,z=(startS+end*cos-side*sin-hazardS)/rz,c=x*x+z*z-1;
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
    this.road=road;this.plan=[];this.hits=new Map();this.lapCache=new Map();
    const rng=random(road.seed^0x71b37e);
    for(let slot=260;slot<road.length-180;slot+=100){
      const chance=rng(),s=slot+rng()*35;
      if(chance>=.16||road.closures(s-160,320).length||road.roadworks(s-40,s+40).length||road.segment(s).kind==='open')continue;
      const kind=chance<.10?'pothole':'mud',lanes=road.available(s);
      const lane=Math.floor(rng()*lanes),direction=rng()<.5?-1:1;
      this.plan.push({s,d:laneD(lane,direction),kind,drift:rng()<.5?-1:1,dimensions:{width:kind==='mud'?2.8:2.1,length:kind==='mud'?4:2.6}});
    }
    for(const fork of road.forks)for(let s=fork.start+35;s<fork.end-25;s+=ROAD_FORKS.potholeSpacing){
      if(rng()>ROAD_FORKS.potholeChance)continue;
      const lane=Math.floor(rng()*fork.lanes),direction=rng()<.5?-1:1;
      this.plan.push({s,d:laneD(lane,direction),fork:fork.index,kind:'pothole',drift:rng()<.5?-1:1,dimensions:{width:2.1+rng()*.7,length:2.6+rng()*1.2}});
    }
  }
  range(from,to,result=[]){
    result.length=0;
    const length=this.road.length;
    for(let lap=Math.floor(Math.max(0,from)/length);lap<=Math.floor(Math.max(0,to)/length);lap++){
      let records=this.lapCache.get(lap);
      if(!records){
        if(this.lapCache.size>=ROAD_CACHE.maxLaps)this.lapCache.delete(this.lapCache.keys().next().value);
        records=[];this.lapCache.set(lap,records);
      }
      for(let i=0;i<this.plan.length;i++){
        const hazard=this.plan[i],s=lap*length+hazard.s;
        if(s<from||s>to)continue;
        let record=records[i];
        if(!record){
          const route=hazard.fork===undefined?null:lap+':'+hazard.fork;
          record={...hazard,s,route,d:hazard.d+this.road.branchCenter(s,route),id:lap+':'+i};records[i]=record;
        }
        if(Math.abs(hazard.d)>this.road.edge(s,record.route))continue;
        result.push(record);
      }
    }
    return result;
  }
}
