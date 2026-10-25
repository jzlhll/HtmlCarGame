import { ROAD_INFRASTRUCTURE, DINOSAURS } from './config.js';

// 火车只在高架桥下行驶，按稳定标识安排事件，暂停时冻结。
export class RoadInfrastructure {
  constructor(road){this.road=road;this.events=new Map();this.dipHits=new Set();this.trains=[];this.nearby=[];this.hitSites=[];}
  advance(dt,game){
    const p=game.player,now=game.activeSeconds+dt;
    // 主路里程包含坡道弧长；按当前车速将提前量换成到桥面中央铁路交叉点的路面距离。
    const lead=game.level===2?DINOSAURS.bridgeLeadSeconds:ROAD_INFRASTRUCTURE.trainLeadSeconds,speed=game.level===2?DINOSAURS.bridgeSpeed:ROAD_INFRASTRUCTURE.trainSpeed;
    const ahead=p.speed/3.6*lead;
    for(const site of this.road.infrastructure(p.s-420,p.s+480,this.nearby)){
      if(site.kind!=='viaduct'||site.feature!=='rail'||this.events.has(site.id)||p.speed<=0||site.center>p.s+ahead||site.center<p.s)continue;
      this.events.set(site.id,{site,start:game.activeSeconds});
    }
    this.trains.length=0;
    for(const [id,event]of this.events){
      if(event.site.end<p.s-420){this.events.delete(id);continue;}
      // 火车中心在提前量结束时到达公路中心，玩家保持当前速度时两者在桥顶交汇。
      const {site,start}=event,age=now-start,d=(age-lead)*speed;
      if(d<120){
        this.trains.push({id,age,s:site.center,d,previous:{s:site.center,d:d-speed*dt},site,dimensions:{length:3.2,width:ROAD_INFRASTRUCTURE.trainLength}});
      }
    }
    if(this.dipHits.size){
      const sites=this.road.infrastructure(p.s-30,p.s+30,this.hitSites);
      for(const id of this.dipHits)if(!sites.some(site=>site.id===id))this.dipHits.delete(id);
    }
  }
}
