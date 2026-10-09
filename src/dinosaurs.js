import { DINOSAURS, laneD, random, lerp, clamp } from './config.js';
import { sweep } from './collision.js';

// 巨型恐龙在玩家前方同向奔跑，落脚位置和危险时窗在预兆生成后固定。
export class DinosaurEvents {
  constructor(road,now){
    this.road=road;this.rng=random(road.seed^0x63d1a5);this.cows=[];this.feet=[];this.chaser=null;this.nextId=1;this.startedAt=now;
    this.contactStart={};this.contactFinish={};this.trafficStart={};
    this.nextSmallAt=now+lerp(DINOSAURS.smallFirstMin,DINOSAURS.smallFirstMax,this.rng());
    this.nextChaseAt=now+DINOSAURS.chaseAfterSeconds+lerp(DINOSAURS.chaseFirstMin,DINOSAURS.chaseFirstMax,this.rng());
  }
  step(dt,player,game){
    const now=game.activeSeconds,age=now-this.startedAt,cfg=DINOSAURS;
    for(const animal of this.cows){animal.previous.s=animal.s;animal.previous.d=animal.d;animal.d+=animal.direction*animal.speed*dt;animal.time+=dt;if(animal.hit)animal.hitTime+=dt;}
    this.cows=this.cows.filter(animal=>animal.direction*(animal.d-this.road.branchCenter(animal.s,animal.route))<this.road.edge(animal.s,animal.route)+6&&animal.s>player.s-100&&(!animal.hit||animal.hitTime<.8));
    if(age<cfg.chaseAfterSeconds&&!this.cows.length&&now>=this.nextSmallAt){
      this.nextSmallAt=now+lerp(cfg.smallIntervalMin,cfg.smallIntervalMax,this.rng());
      if(this.rng()<cfg.smallChance)this.spawnSmall(player);
    }
    this.feet=this.feet.filter(foot=>now<foot.until+cfg.footFade);
    const chaser=this.chaser;
    if(chaser){
      if(now>=chaser.until){this.chaser=null;this.nextChaseAt=now+lerp(cfg.chaseIntervalMin,cfg.chaseIntervalMax,this.rng());}
      else{
        chaser.previousS=chaser.s;chaser.previousRoute=chaser.route;
        const sameRoute=(chaser.route??null)===(player.route??null),gap=(chaser.s-player.s)*this.road.pathScale((chaser.s+player.s)/2,chaser.route);
        // 越接近前方距离上限，超出玩家速度的部分越小，避免跑出视野。
        const extra=(chaser.ratio-1)*(sameRoute?clamp((cfg.followAheadMax-gap)/(cfg.followAheadMax-cfg.chaseAheadMin),0,1):1);
        const speed=player.speed/3.6,travel=speed*(1+extra)*dt;
        chaser.phase+=dt*Math.min(1/cfg.stepSecondsMin,speed/((cfg.stepDistanceMin+cfg.stepDistanceMax)/2))/2;
        chaser.s+=travel/this.road.pathScale(chaser.s,chaser.route);chaser.walked+=travel;
        if(chaser.route&&chaser.s>=this.road.route(chaser.route).end)chaser.route=null;
        if(travel>0&&chaser.walked>=chaser.stepDistance&&now>=chaser.nextStepAt&&now+cfg.footWarning+cfg.footDanger<chaser.until){
          chaser.walked=0;chaser.stepDistance=lerp(cfg.stepDistanceMin,cfg.stepDistanceMax,this.rng());
          chaser.nextStepAt=now+cfg.stepSecondsMin;
          const s=chaser.s+(speed*(1+extra)*cfg.footWarning-cfg.footBack)/this.road.pathScale(chaser.s,chaser.route),route=chaser.route&&s>=this.road.route(chaser.route).end?null:chaser.route;
          if(chaser.lane>=this.road.available(s,route)||(!route&&!this.road.laneOpen(s,chaser.lane,chaser.direction,10,cfg.footLength))){this.chaser=null;this.nextChaseAt=now+cfg.chaseIntervalMin;}
          else if(this.feet.length<cfg.footCapacity){
            chaser.side*=-1;
            const d=this.chaserD({...chaser,route},s)+chaser.side*cfg.footSpread;
            this.feet.push({id:this.nextId++,s,d,route,createdAt:now,from:now+cfg.footWarning,until:now+cfg.footWarning+cfg.footDanger,sounded:false,hits:new Set(),dimensions:{width:cfg.footWidth,length:cfg.footLength}});
          }
        }
      }
    }else if(age>=cfg.chaseAfterSeconds&&now>=this.nextChaseAt){
      this.nextChaseAt=now+lerp(cfg.chaseIntervalMin,cfg.chaseIntervalMax,this.rng());
      if(this.rng()<cfg.chaseChance){
        const playerRoute=player.route??null,s=player.s+lerp(cfg.chaseAheadMin,cfg.chaseAheadMax,this.rng())/this.road.pathScale(player.s,playerRoute),route=playerRoute&&s>=this.road.route(playerRoute).end?null:playerRoute,lanes=this.road.available(s,route),options=[];
        for(const direction of [-1,1])for(let lane=0;lane<lanes;lane++)if(route||this.road.laneOpen(s,lane,direction,80,cfg.footLength))options.push({lane,direction});
        if(options.length>1){const choice=options[Math.floor(this.rng()*options.length)];this.chaser={...choice,id:this.nextId++,route,s,previousS:s,previousRoute:route,phase:0,walked:cfg.stepDistanceMin,stepDistance:cfg.stepDistanceMin,nextStepAt:now,side:1,ratio:lerp(cfg.speedRatioMin,cfg.speedRatioMax,this.rng()),until:now+lerp(cfg.durationMin,cfg.durationMax,this.rng())};}
      }
    }
    for(const foot of this.feet)if(now+dt>=foot.from&&!foot.sounded){foot.sounded=true;game.audio?.dinosaurStep(foot,game);}
  }
  chaserD(chaser,s=chaser.s){
    const bounds=this.road.drivableBounds(s,chaser.route),half=DINOSAURS.chaserWidth/2+.2;
    return clamp(this.road.branchCenter(s,chaser.route)+laneD(chaser.lane,chaser.direction),bounds.min+half,bounds.max-half);
  }
  spawnSmall(player){
    const cfg=DINOSAURS,route=player.route??null,s=player.s+Math.max(cfg.smallAheadMin,player.speed/3.6*cfg.smallLeadSeconds);
    if(route&&s>this.road.route(route).end-20)return;
    if(this.road.infrastructure(s-20,s+20).length||this.road.roadworks(s-30,s+30).length||this.road.closures(s-40,80).length||this.road.junction(s,1)||this.road.junction(s,-1))return;
    const direction=this.rng()<.5?-1:1,speed=lerp(cfg.cowSpeedMin,cfg.cowSpeedMax,this.rng())*cfg.crossingSpeedMultiplier;
    const count=cfg.smallCountMin+Math.floor(this.rng()*(cfg.smallCountMax-cfg.smallCountMin+1));
    for(let i=0;i<count;i++){
      const d=this.road.branchCenter(s,route)-direction*(this.road.edge(s,route)+3+i*3);
      this.cows.push({id:this.nextId++,s,d,route,direction,speed,time:i*.3,kind:'dinosaur',hit:false,hitTime:0,previous:{s,d,route},dimensions:{width:cfg.smallLength,length:cfg.smallWidth}});
    }
  }
  contact(start,finish,foot,now,dt,key='player'){
    if(dt<=0||Math.abs(foot.s-start.s)>(start.dimensions?.length??9)/2+foot.dimensions.length/2+Math.abs(finish.s-start.s)+1||foot.hits.has(key)||now>=foot.until||now+dt<foot.from||(start.route??null)!==(foot.route??null))return null;
    const first=Math.max(0,(foot.from-now)/dt),last=Math.min(1,(foot.until-now)/dt);
    const a=this.contactStart,b=this.contactFinish;
    a.rank=b.rank=start.rank;a.dimensions=b.dimensions=start.dimensions;a.route=b.route=start.route;a.yaw=b.yaw=start.yaw;
    a.s=lerp(start.s,finish.s,first);a.d=lerp(start.d,finish.d,first);b.s=lerp(start.s,finish.s,last);b.d=lerp(start.d,finish.d,last);
    const event=sweep(a,b,foot,foot,this.road);
    return event?{time:lerp(first,last,event.time),foot}:null;
  }
  resolveTraffic(now,dt,game){
    if(dt<=0)return;
    for(const foot of this.feet){
      // 预兆和残留阶段没有伤害，不必反复遍历全部车流。
      if(now>=foot.until||now+dt<foot.from)continue;
      for(const car of game.traffic.cars){
        if(car.remove)continue;
        const key='car:'+car.id;
        // previous 只保存位置，碰撞尺寸、车型和朝向必须取当前车辆。
        const previous=car.previous??car,start=this.trafficStart;
        start.s=previous.s;start.d=previous.d;start.route=previous.route===undefined?car.route:previous.route;start.rank=car.rank;start.dimensions=car.dimensions;start.yaw=car.yaw;
        if(this.contact(start,car,foot,now,dt,key)){foot.hits.add(key);car.remove=true;game.renderer?.effect(car.s,car.d,'wreck',car);}
      }
    }
  }
}
