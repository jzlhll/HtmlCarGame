import { VEHICLES, XP, UPGRADE_POINTS, SEASONS, AUTO_ACCELERATION, laneD, clamp, lerp, approach } from './config.js';
import { Road } from './road.js';
import { Traffic } from './traffic.js';
import { RoadHazards, MUD_SECONDS, BUMP_SECONDS, surfaceContact } from './hazards.js';
import { sweep, classify } from './collision.js';
export const CAUSES={frontFatal:'追尾或正面撞击同级或更高级车辆',sideFatal:'侧碰更高级车辆',wall:'撞上截止车道的墙'};

export class Game {
  constructor(store,input,notify){
    this.store=store;this.input=input;this.notify=notify;this.state='READY';this.deathTime=0;this.renderer=null;this.onChange=()=>{};this.preview();
  }
  preview(){this.renderer?.resetRun();this.seed=6183;this.road=new Road(this.seed);this.hazards=new RoadHazards(this.road);this.player={s:0,d:laneD(1),rank:1,speed:42.5,xp:0,push:0,slow:0,mud:0,bump:0};this.traffic=new Traffic(this.road,this.seed);this.activeSeconds=0;this.startSeason=0;this.eaten=[0,0,0,0,0,0];this.highestRank=1;this.scraping=false;}
  async start(){
    if(this.state!=='READY'&&this.state!=='RESULT')return;
    this.state='PREPARING';this.onChange();
    // 让准备提示先显示，再创建本局的有限道路与车辆计划。
    await new Promise(resolve=>requestAnimationFrame(resolve));
    try{
      this.seed=crypto.getRandomValues(new Uint32Array(1))[0];this.runId=crypto.randomUUID();
      this.road=new Road(this.seed);this.hazards=new RoadHazards(this.road);this.player={s:0,d:laneD(1),rank:1,speed:42.5,xp:0,push:0,slow:0,mud:0,bump:0};
      this.traffic=new Traffic(this.road,this.seed);this.traffic.populate(this.player);
      this.startSeason=this.seed%4;this.activeSeconds=0;this.eaten=[0,0,0,0,0,0];this.highestRank=1;
      this.deathTime=0;this.scraping=false;this.saved=false;this.cause=null;this.result=null;this.input.clear();
      this.renderer?.resetRun();
      this.state=document.hasFocus()?'RUNNING':'PAUSED';this.onChange();
    }catch(error){console.error('Game preparation failed',error);this.state='READY';this.notify('本局准备失败，请重新按空格。');this.onChange();}
  }
  space(){if(this.state==='READY'||this.state==='RESULT')this.start();else if(this.state==='RUNNING')this.pause();else if(this.state==='PAUSED'){this.input.clear();this.state='RUNNING';this.onChange();}}
  pause(){if(this.state!=='RUNNING')return;this.state='PAUSED';this.input.clear();this.onChange();}
  ready(){if(this.state!=='RESULT')return;this.state='READY';this.preview();this.input.clear();this.onChange();}
  season(){const period=this.activeSeconds%120;return {index:(this.startSeason+Math.floor(this.activeSeconds/120))%4,blend:clamp((period-110)/10,0,1),remaining:Math.ceil(120-period)};}
  cap(){const factor=this.player.slow>1.5?.5:this.player.slow>0?1-this.player.slow/3:1;return VEHICLES[this.player.rank].playerMax*Math.min(factor,this.player.mud>0?.5:1);}
  hitHazard(hazard){
    const p=this.player;
    this.hazards.hits.set(hazard.id,hazard.s);p.speed*=.5;
    if(hazard.kind==='mud'){
      p.mud=MUD_SECONDS;p.speed=Math.min(p.speed,this.cap());this.notify('沾上泥巴 · 限速 8 秒');
    }else{
      p.bump=BUMP_SECONDS;
      const lanes=[];
      for(let lane=this.road.available(p.s)-1;lane>=0;lane--)lanes.push(laneD(lane,-1));
      for(let lane=0;lane<this.road.available(p.s);lane++)lanes.push(laneD(lane));
      let index=0;
      for(let i=1;i<lanes.length;i++)if(Math.abs(lanes[i]-p.d)<Math.abs(lanes[index]-p.d))index=i;
      const direction=index===0?1:index===lanes.length-1?-1:hazard.drift;
      const distance=Math.abs(lanes[index+direction]-p.d);
      // 递减横向冲量将车辆推向邻道，保留玩家反向纠偏与连续碰撞。
      p.push=direction*Math.sqrt(2*4.4*distance);this.notify('坑洞 · 减速 50%');
    }
  }
  hurtSlow(){
    const p=this.player;
    if(p.slow<=0)p.speed*=.5;
    p.slow=3.5;p.speed=Math.min(p.speed,this.cap());this.notify('减速 50% · 随后逐渐恢复速度');
  }
  eat(car){this.eaten[car.rank-1]++;this.player.xp+=this.player.rank<6?XP[car.rank]:0;car.remove=true;this.renderer?.effect(car.s,car.d,'eat',car);}
  grow(){
    const p=this.player;
    while(p.rank<6&&p.xp>=UPGRADE_POINTS[p.rank]){p.xp-=UPGRADE_POINTS[p.rank];p.rank++;this.highestRank=Math.max(this.highestRank,p.rank);p.speed=Math.min(p.speed,this.cap());this.notify('升级 · '+VEHICLES[p.rank].name);}
    if(p.rank===6)p.xp=0;
  }
  die(cause){this.cause=cause;this.state='DYING';this.deathTime=0;this.input.clear();this.onChange();}
  finish(reason){
    if(this.saved)return;
    this.saved=true;
    this.renderer?.resetEffects();
    this.result={runId:this.runId,runSeed:this.seed,startSeason:SEASONS[this.startSeason],rulesVersion:1,endedAt:new Date().toISOString(),endReason:reason,deathCause:reason==='death'?this.cause:null,distanceMeters:this.player.s,score:Math.floor(this.player.s),activeSeconds:this.activeSeconds,highestRank:this.highestRank,eatenByType:[...this.eaten]};
    this.store.record(this.result);this.state='RESULT';this.input.clear();this.onChange();
  }
  collisionStep(start,finish,dt){
    let cursor=0,iterations=0;
    while(cursor<1-1e-8&&iterations++<16){
      const candidates=[];
      for(const car of this.traffic.cars){
        if(car.remove)continue;
        const old=car.previous||car;
        const begin={...car,s:lerp(old.s,car.s,cursor),d:lerp(old.d,car.d,cursor)};
        const playerSize=VEHICLES[start.rank],targetSize=VEHICLES[car.rank];
        const reach=(Math.hypot(playerSize.length,playerSize.width)+Math.hypot(targetSize.length,targetSize.width))/2+1;
        if(Math.abs(begin.s-start.s)>reach+Math.abs(finish.s-start.s)+Math.abs(car.s-begin.s))continue;
        const event=sweep(start,finish,begin,car,this.road);
        if(event)candidates.push({...event,car});
      }
      for(const wall of this.road.walls(start.s-5,20))for(const sign of [-1,1]){
        const target={s:wall.end,d:sign*9.4,rank:4,direction:1,dimensions:{width:3.6,length:.7}};
        const event=sweep(start,finish,target,target,this.road);
        if(event)candidates.push({...event,wall:true});
      }
      const size=VEHICLES[start.rank];
      for(const hazard of this.hazards.range(start.s-size.length-4,finish.s+size.length+4)){
        if(this.hazards.hits.has(hazard.id))continue;
        const event=surfaceContact(start,finish,hazard);
        if(event)candidates.push({...event,hazard});
      }
      if(!candidates.length){this.player.s=finish.s;this.player.d=finish.d;this.activeSeconds+=dt*(1-cursor);return;}
      candidates.sort((a,b)=>a.time-b.time);
      const t=candidates[0].time,global=cursor+(1-cursor)*t,group=candidates.filter(e=>Math.abs(e.time-t)<1e-6);
      this.player.s=lerp(start.s,finish.s,t);this.player.d=lerp(start.d,finish.d,t);this.activeSeconds+=dt*(global-cursor);
      const rank=this.player.rank;
      for(const e of group)e.action=e.wall?'wall':e.hazard?'hazard':classify(rank,e.car,e);
      const fatal=group.find(e=>CAUSES[e.action]);
      if(fatal){
        for(const car of this.traffic.cars){const old=car.previous||car;car.s=lerp(old.s,car.s,global);car.d=lerp(old.d,car.d,global);}
        this.die(fatal.action);return;
      }
      const downgrade=group.some(e=>e.action==='downgrade');
      for(const e of group){
        if(e.action==='eat'){if(downgrade)e.car.remove=true;else this.eat(e.car);}
        if(e.action==='slow'||e.action==='downgrade'){e.car.remove=true;this.renderer?.effect(e.car.s,e.car.d,'wreck',e.car);}
      }
      if(downgrade){this.player.rank--;this.player.xp=0;this.player.speed=Math.min(this.player.speed,this.cap());this.notify('降级 · 成长进度清空');}
      else{if(group.some(e=>e.action==='slow'))this.hurtSlow();this.grow();}
      for(const e of group)if(e.hazard)this.hitHazard(e.hazard);
      // 首次接触后用更新后的等级和尺寸重新检查余下运动。
      const remaining=dt*(1-global);finish.s=this.player.s+this.player.speed/3.6*remaining;
      finish.d=this.player.d+(this.input.lateral*VEHICLES[this.player.rank].lateral+this.player.push)*remaining;
      start={...this.player};cursor=global;
    }
    this.player.s=finish.s;this.player.d=finish.d;this.activeSeconds+=dt*(1-cursor);
  }
  step(dt){
    if(this.state!=='RUNNING')return;
    const p=this.player,start={...p};
    p.slow=Math.max(0,p.slow-dt);
    p.mud=Math.max(0,p.mud-dt);p.bump=Math.max(0,p.bump-dt);
    if(this.input.down)p.speed-=35*dt;else if(!this.scraping)p.speed+=AUTO_ACCELERATION*dt;
    p.speed=clamp(p.speed,0,this.cap());
    if(this.scraping)p.speed=Math.max(0,p.speed-15*dt);
    const next={...p,s:p.s+p.speed/3.6*dt,d:p.d+(this.input.lateral*VEHICLES[p.rank].lateral+p.push)*dt};
    p.push=approach(p.push,0,4.4*dt);
    this.traffic.step(dt,p);
    this.collisionStep(start,next,dt);
    if(this.state!=='RUNNING')return;
    this.traffic.cars=this.traffic.cars.filter(c=>!c.remove);
    const limit=this.road.edge(p.s)-VEHICLES[p.rank].width/2;
    const scrape=Math.abs(p.d)>=limit-.012;
    if(scrape){
      p.d=clamp(p.d,-limit,limit);
      if(this.road.segment(p.s).kind==='taper')p.d=approach(p.d,0,dt);
      if(!this.scraping)this.notify('路边刮擦 · 减速并向内纠偏');
    }
    this.scraping=scrape;
    for(const [id,s]of this.hazards.hits)if(s<p.s-20)this.hazards.hits.delete(id);
  }
  animate(dt){if(this.state==='DYING'){this.deathTime+=dt;if(this.deathTime>=1.2)this.finish('death');}}
}
