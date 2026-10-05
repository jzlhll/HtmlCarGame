import { COW_CROSSING, random } from './config.js';

export { COW_CROSSING } from './config.js';

// 每次安排一队奶牛排队横穿，上一队离场后才生成下一队，暂停时不推进。
export class CrossingCows {
  constructor(road){this.road=road;this.rng=random(road.seed^0x6c842a19);this.cows=[];this.timer=12+this.rng()*8;this.nextId=1;}
  step(dt,player){
    for(const cow of this.cows){
      cow.previous.s=cow.s;cow.previous.d=cow.d;cow.d+=cow.direction*cow.speed*dt;cow.time+=dt;
      if(cow.hit)cow.hitTime+=dt;
    }
    this.cows=this.cows.filter(cow=>cow.direction*cow.d<this.road.edge(cow.s)+6&&cow.s>player.s-100&&(!cow.hit||cow.hitTime<.8));
    this.timer-=dt;
    if(this.timer>0)return;
    this.timer=COW_CROSSING.minInterval+this.rng()*COW_CROSSING.intervalRange;
    if(this.cows.length||this.rng()>=COW_CROSSING.chance)return;
    const s=player.s+COW_CROSSING.minAhead+this.rng()*COW_CROSSING.aheadRange;
    if(this.road.closures(s-120,240).length||this.road.roadworks(s-120,s+120).length||this.road.segment(s).kind==='open')return;
    // 整队及其身体范围都必须远离结构两端，避免队员错开后踏上坡道。
    const reach=COW_CROSSING.infrastructurePadding+COW_CROSSING.stationJitter/2+COW_CROSSING.dimensions.length/2;
    if(this.road.infrastructure(s-reach,s+reach).length)return;
    const direction=this.rng()<.5?-1:1,speed=1.6+this.rng()*.6;
    const count=COW_CROSSING.minCount+Math.floor(this.rng()*(COW_CROSSING.capacity-COW_CROSSING.minCount+1));
    for(let i=0;i<count;i++){
      const station=s+(this.rng()-.5)*COW_CROSSING.stationJitter,d=-direction*(this.road.edge(station)+3+i*COW_CROSSING.spacing);
      this.cows.push({id:this.nextId++,s:station,d,direction,speed,time:i*.3,hit:false,hitTime:0,previous:{s:station,d},dimensions:COW_CROSSING.dimensions});
    }
  }
}
