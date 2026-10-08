import { DINOSAURS, laneD, random, lerp } from './config.js';
import { sweep } from './collision.js';

// 横穿恐龙与追行脚掌分别调度，落脚位置和危险时窗在预兆生成后固定。
export class DinosaurEvents {
  constructor(road,now){
    this.road=road;this.rng=random(road.seed^0x63d1a5);this.cows=[];this.feet=[];this.chaser=null;this.nextId=1;this.startedAt=now;
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
        chaser.previousS=chaser.s;
        const travel=player.speed/3.6*chaser.ratio*dt;
        chaser.s+=travel/this.road.pathScale(chaser.s,chaser.route);chaser.walked+=travel;
        if(chaser.route&&chaser.s>=this.road.route(chaser.route).end)chaser.route=null;
        if(travel>0&&chaser.walked>=chaser.stepDistance){
          chaser.walked=0;chaser.stepDistance=lerp(cfg.stepDistanceMin,cfg.stepDistanceMax,this.rng());
          const s=chaser.s+player.speed/3.6*cfg.footWarning/this.road.pathScale(chaser.s,chaser.route);
          if(chaser.lane>=this.road.available(s,chaser.route)||(!chaser.route&&!this.road.laneOpen(s,chaser.lane,chaser.direction,10,cfg.footLength))){this.chaser=null;this.nextChaseAt=now+cfg.chaseIntervalMin;}
          else if(this.feet.length<cfg.footCapacity){
            chaser.side*=-1;
            const d=this.road.branchCenter(s,chaser.route)+laneD(chaser.lane,chaser.direction)+chaser.side*.35;
            this.feet.push({id:this.nextId++,s,d,route:chaser.route,createdAt:now,from:now+cfg.footWarning,until:now+cfg.footWarning+cfg.footDanger,sounded:false,hits:new Set(),dimensions:{width:cfg.footWidth,length:cfg.footLength}});
          }
        }
      }
    }else if(age>=cfg.chaseAfterSeconds&&now>=this.nextChaseAt){
      this.nextChaseAt=now+lerp(cfg.chaseIntervalMin,cfg.chaseIntervalMax,this.rng());
      if(this.rng()<cfg.chaseChance){
        const route=player.route??null,s=player.s-lerp(cfg.chaseBehindMin,cfg.chaseBehindMax,this.rng()),lanes=this.road.available(s,route),options=[];
        for(const direction of [-1,1])for(let lane=0;lane<lanes;lane++)if(route||this.road.laneOpen(s,lane,direction,80,cfg.footLength))options.push({lane,direction});
        if(options.length>1){const choice=options[Math.floor(this.rng()*options.length)];this.chaser={...choice,route,s,walked:cfg.stepDistanceMin,stepDistance:cfg.stepDistanceMin,side:1,ratio:lerp(cfg.speedRatioMin,cfg.speedRatioMax,this.rng()),until:now+lerp(cfg.durationMin,cfg.durationMax,this.rng())};}
      }
    }
    for(const foot of this.feet)if(now+dt>=foot.from&&!foot.sounded){foot.sounded=true;game.audio?.dinosaurStep(foot,game);}
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
    const a={...start,s:lerp(start.s,finish.s,first),d:lerp(start.d,finish.d,first)},b={...finish,s:lerp(start.s,finish.s,last),d:lerp(start.d,finish.d,last)};
    const event=sweep(a,b,foot,foot,this.road);
    return event?{time:lerp(first,last,event.time),foot}:null;
  }
  resolveTraffic(now,dt,game){
    for(const foot of this.feet)for(const car of game.traffic.cars){
      if(car.remove)continue;
      const key='car:'+car.id;
      if(this.contact(car.previous??car,car,foot,now,dt,key)){foot.hits.add(key);car.remove=true;game.renderer?.effect(car.s,car.d,'wreck',car);}
    }
  }
}
