import { ROAD_INFRASTRUCTURE } from './config.js';

// 火车只在高架桥下行驶，按稳定标识安排事件，暂停时冻结。
export class RoadInfrastructure {
  constructor(road){this.road=road;this.events=new Map();this.dipHits=new Set();this.trains=[];this.nearby=[];this.hitSites=[];}
  advance(dt,game){
    const p=game.player,now=game.activeSeconds+dt;
    // 主路里程包含坡道弧长；按当前车速将提前量换成到桥面中央铁路交叉点的路面距离。
    const ahead=p.speed/3.6*ROAD_INFRASTRUCTURE.trainLeadSeconds;
    for(const site of this.road.infrastructure(p.s-420,p.s+480,this.nearby)){
      if(site.kind!=='viaduct'||site.feature!=='rail'||this.events.has(site.id)||p.speed<=0||site.center>p.s+ahead||site.center<p.s)continue;
      this.events.set(site.id,{site,start:game.activeSeconds});
    }
    this.trains.length=0;
    for(const [id,event]of this.events){
      if(event.site.end<p.s-420){this.events.delete(id);continue;}
      // 火车中心在提前量结束时到达公路中心，玩家保持当前速度时两者在桥顶交汇。
      const {site,start}=event,age=now-start,d=(age-ROAD_INFRASTRUCTURE.trainLeadSeconds)*ROAD_INFRASTRUCTURE.trainSpeed;
      if(d<120){
        // 按当前车速提前起音，留出汽笛包络和距离增益的渐入时间，氮气下也在桥顶前听到。
        const hornAhead=p.speed/3.6*ROAD_INFRASTRUCTURE.trainHornLeadSeconds;
        if(event.hornAt===undefined&&site.center-p.s<=hornAhead)event.hornAt=game.activeSeconds;
        this.trains.push({id,age,hornAt:event.hornAt,s:site.center,d,previous:{s:site.center,d:d-ROAD_INFRASTRUCTURE.trainSpeed*dt},site,dimensions:{length:3.2,width:ROAD_INFRASTRUCTURE.trainLength}});
      }
    }
    if(this.dipHits.size){
      const sites=this.road.infrastructure(p.s-30,p.s+30,this.hitSites);
      for(const id of this.dipHits)if(!sites.some(site=>site.id===id))this.dipHits.delete(id);
    }
  }
}
