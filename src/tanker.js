import { TANKER, VEHICLES, LEVELS, laneD, random, lerp } from './config.js';
import { sweep } from './collision.js';

// 使用世界坐标圆与车辆有向矩形求交，坡道和相邻路线不按车道身份隔离爆炸。
export function blastOverlaps(road,center,target,radius){
  const point=road.at(target.s,target.d,target.route??null),size=target.dimensions??VEHICLES[target.rank];
  const dx=center.x-point.x,dz=center.z-point.z,heading=point.heading+(target.yaw??0),cos=Math.cos(heading),sin=Math.sin(heading);
  const across=Math.max(0,Math.abs(dx*cos+dz*sin)-(size?.width??0)/2),along=Math.max(0,Math.abs(dx*sin-dz*cos)-(size?.length??0)*Math.cos(point.pitch??0)/2);
  return across*across+along*along<=radius*radius+1e-8;
}

// 每个 Traffic 生命周期只安排一次油罐车；排程和车道抽签不消耗普通车流随机序列。
export class TankerEvent {
  constructor(seed){this.rng=random(seed^0x4f73a219);this.nextAt=null;this.spawned=false;}
  step(player,traffic,now,game){
    if(this.spawned)return;
    this.nextAt??=(game?.levelDuration??(traffic.level===2?LEVELS.secondSeconds:traffic.level===3?LEVELS.thirdSeconds:LEVELS.firstSeconds))*lerp(TANKER.firstFraction,TANKER.lastFraction,this.rng());
    if(now<this.nextAt)return;
    this.nextAt=now+TANKER.retrySeconds;
    const road=traffic.road,rng=this.rng;
    for(let attempt=0;attempt<6;attempt++){
      let s=player.s,route=player.route??null,distance=lerp(TANKER.aheadMin,TANKER.aheadMax,rng());
      while(distance>0){const step=Math.min(2,distance);s+=step/road.pathScale(s,route);distance-=step;if(route&&s>=road.route(route).end)route=null;}
      const lanes=road.available(s,route),first=Math.floor(rng()*lanes);
      for(let offset=0;offset<lanes;offset++){
        const lane=(first+offset)%lanes,d=road.branchCenter(s,route)+laneD(lane);
        if(!route&&!road.laneOpen(s,lane,1,120,VEHICLES[4].length))continue;
        if(!route&&road.roadworks(s-VEHICLES[4].length,s+VEHICLES[4].length).some(site=>Math.abs(site.d-d)<(site.dimensions.width+VEHICLES[4].width)/2))continue;
        const speed=TANKER.speed/3.6,car={id:traffic.nextId,s,d,route,rank:4,lane,direction:1,speed,desired:speed,color:TANKER.color,truckStyle:'tanker',tanker:true,merge:null,convoy:null,sidePush:0,sidePushTime:0,laneChangeChance:0,laneChangeTimer:Infinity,dangerous:false,dangerousRoll:1,previous:{s,d,route}};
        if(traffic.cars.some(other=>!other.remove&&sweep(car,car,other,other,road)))continue;
        traffic.nextId++;traffic.cars.push(car);this.spawned=true;return;
      }
    }
  }
  explode(game,car){
    if(car.detonated)return;
    car.detonated=true;car.remove=true;
    const road=game.road,center=road.at(car.s,car.d,car.route??null),inside=target=>blastOverlaps(road,center,target,TANKER.blastRadius);
    for(const target of game.traffic.cars)if(!target.remove&&inside(target)){
      target.remove=true;game.renderer?.effect(target.s,target.d,'wreck',target);
    }
    game.crossings.cows=game.crossings.cows.filter(cow=>!inside(cow));
    game.weather.hazards=game.weather.hazards.filter(hazard=>!inside(hazard));
    if(game.disasters)game.disasters.hazards=game.disasters.hazards.filter(hazard=>!['iceberg','cover'].includes(hazard.kind)||!inside(hazard));
    const reach=TANKER.blastRadius/road.minimumPathScale;
    for(const site of road.roadworks(car.s-reach,car.s+reach))if(site.blockade&&inside(site))game.whiteHorse.breakObstacle('work:'+site.id,site.end);
    for(const hazard of game.hazards.range(car.s-reach,car.s+reach,[]))if(inside(hazard))game.hazards.hits.set(hazard.id,hazard.s);
    if(game.police.police&&inside(game.police.police))game.police.dismiss(game.activeSeconds);
    else game.police.nets=game.police.nets.filter(net=>!inside(net));
    game.renderer?.tankerExplosion?.start(car);
    game.renderer?.invalidate();game.audio?.shellBoom();
  }
}
