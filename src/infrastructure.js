import { ROAD_INFRASTRUCTURE } from './config.js';

// 火车只在高架桥下行驶，按稳定标识安排事件，暂停时冻结。
export class RoadInfrastructure {
  constructor(road){this.road=road;this.events=new Map();this.dipHits=new Set();this.trains=[];this.nearby=[];this.hitSites=[];}
  advance(dt,game){
    const p=game.player,now=game.activeSeconds+dt;
    for(const site of this.road.infrastructure(p.s-420,p.s+480,this.nearby)){
      if(site.kind!=='viaduct'||site.feature!=='rail'||this.events.has(site.id)||site.center>p.s+180||site.center<p.s-200)continue;
      const start=now+Math.max(2,(site.center-p.s)/Math.max(8,p.speed/3.6)-5);
      this.events.set(site.id,{site,start});
    }
    this.trains.length=0;
    for(const [id,event]of this.events){
      if(event.site.end<p.s-420){this.events.delete(id);continue;}
      const {site,start}=event,age=now-start,d=-120+age*ROAD_INFRASTRUCTURE.trainSpeed;
      if(site.hasTrain&&age>=0&&d<120)this.trains.push({id,s:site.center,d,previous:{s:site.center,d:d-ROAD_INFRASTRUCTURE.trainSpeed*dt},site,dimensions:{length:3.2,width:ROAD_INFRASTRUCTURE.trainLength}});
    }
    if(this.dipHits.size){
      const sites=this.road.infrastructure(p.s-30,p.s+30,this.hitSites);
      for(const id of this.dipHits)if(!sites.some(site=>site.id===id))this.dipHits.delete(id);
    }
  }
}
