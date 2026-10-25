import { MODEL_APPEARANCE, DISASTERS, XP, VEHICLES, VEHICLE_DEFENSE, laneD, clamp, lerp, random } from './config.js';
import { sweep, startDisasterSpin } from './collision.js';

// 圆形岩浆与车身矩形的扫掠：圆角扩张包含中间条带与四角圆，避免方框角落误伤。
function circleContact(start,finish,hazard,road){
  const a=road.at(start.s,start.d,start.route),b=road.at(finish.s,finish.d,finish.route),p=road.at(hazard.s,hazard.d,hazard.route);
  const angle=a.heading+(start.yaw||0),cos=Math.cos(angle),sin=Math.sin(angle);
  const dx=p.x-a.x,dz=p.z-a.z,mx=a.x-b.x,mz=a.z-b.z;
  const x=dx*cos+dz*sin,z=dx*sin-dz*cos,vx=mx*cos+mz*sin,vz=mx*sin-mz*cos;
  const dimensions=start.dimensions||VEHICLES[start.rank],hx=dimensions.width/2,hz=dimensions.length/2,r=hazard.dimensions.width/2;
  let first=Infinity;
  for(const [rx,rz]of [[hx+r,hz],[hx,hz+r]]){
    let enter=0,exit=1;
    for(const [position,motion,reach]of [[x,vx,rx],[z,vz,rz]]){
      if(Math.abs(motion)<1e-12){if(Math.abs(position)>reach){exit=-1;break;}continue;}
      const t1=(-reach-position)/motion,t2=(reach-position)/motion;
      enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
    }
    if(enter<=exit&&enter<=1&&exit>=0)first=Math.min(first,enter);
  }
  const motionSquared=vx*vx+vz*vz;
  for(const side of [-1,1])for(const end of [-1,1]){
    const cx=x-side*hx,cz=z-end*hz,c=cx*cx+cz*cz-r*r;
    if(c<=0){first=0;continue;}
    if(motionSquared<1e-12)continue;
    const b=2*(cx*vx+cz*vz),discriminant=b*b-4*motionSquared*c;
    if(discriminant<0)continue;
    const time=(-b-Math.sqrt(discriminant))/(2*motionSquared);
    if(time>=0&&time<=1)first=Math.min(first,time);
  }
  return Number.isFinite(first)?{time:first,exit:1}:null;
}

// 第三关环境、固定排程、连续接触和覆盖区横移计时，全部使用有效运行时间。
export class DisasterEvents {
  constructor(seed){
    this.rng=random(seed^0x7d632a19);this.period=-1;this.environment=0;this.hazards=[];this.sides=[];this.nextId=1;this.slideTime=0;
  }
  resetSlide(){this.slideTime=0;}
  boundary(now){
    return Math.min((Math.floor(now/DISASTERS.environmentSeconds)+1)*DISASTERS.environmentSeconds,this.nextMain??Infinity,this.nextObstacle??Infinity,...this.sides.map(side=>side.nextAt));
  }
  ahead(game,meters){
    const p=game.player,exit=p.route?game.road.route(p.route).end:Infinity;
    let s=p.s;
    for(let left=meters;left>0;){const used=Math.min(1,left);s+=used/game.road.pathScale(s,s<exit?p.route:null);left-=used;}
    return {s,route:s<exit?p.route:null};
  }
  lane(game,point){
    const count=game.road.available(point.s,point.route),options=[];
    for(const sign of [-1,1])for(let lane=0;lane<count;lane++)if(game.road.laneOpen(point.s,lane,sign))options.push(game.road.branchCenter(point.s,point.route)+laneD(lane,sign));
    return options.length?options[Math.floor(this.rng()*options.length)]:game.road.branchCenter(point.s,point.route)+laneD(0);
  }
  add(kind,point,now,dimensions,keep,delay=0,extra={}){
    if(this.hazards.length>=DISASTERS.capacity)return;
    this.hazards.push({id:this.nextId++,kind,...point,createdAt:now,from:now+delay,until:now+delay+keep,dimensions,hits:new Set(),...extra});
  }
  advance(game){
    const now=game.levelSeconds,period=Math.floor((now+1e-9)/DISASTERS.environmentSeconds);
    if(period!==this.period){
      this.period=period;this.environment=period%3;this.hazards=[];this.sides=[];this.slideTime=0;
      const start=period*DISASTERS.environmentSeconds;
      this.nextMain=start+(this.environment===0?DISASTERS.volcanoInterval:this.environment===1?DISASTERS.waveInterval:DISASTERS.iceInterval);
      this.nextObstacle=this.environment===2?start+DISASTERS.icebergInterval:Infinity;
    }
    let count=0;
    for(const item of this.hazards)if(item.until>now&&item.s>game.player.s-80)this.hazards[count++]=item;
    this.hazards.length=count;count=0;
    for(const item of this.sides)if(item.until>now&&item.s>game.player.s-100)this.sides[count++]=item;
    this.sides.length=count;
    if(now+1e-9>=this.nextMain){
      if(this.environment===1){
        const point=this.ahead(game,DISASTERS.waveAhead),direction=this.rng()<.5?1:-1,edge=game.road.edge(point.s,point.route)+DISASTERS.waveWidth/2;
        point.d=game.road.branchCenter(point.s,point.route)-direction*edge;
        this.add('wave',point,now,{width:DISASTERS.waveWidth,length:DISASTERS.waveLength},2*edge/DISASTERS.waveSpeed,0,{direction});
        game.audio?.disaster('wave');
      }else if(this.sides.length<DISASTERS.sideCapacity){
        const point=this.ahead(game,lerp(this.environment===2?DISASTERS.iceSideAheadMin:DISASTERS.roadsideAheadMin,this.environment===2?DISASTERS.iceSideAheadMax:DISASTERS.roadsideAheadMax,this.rng())),side=this.rng()<.5?-1:1;
        let d=game.road.branchCenter(point.s,point.route)+side*(game.road.edge(point.s,point.route)+(this.environment===0?MODEL_APPEARANCE.volcanoRoadOffset:10));
        if(this.environment===0)for(let shift=0;shift<12&&game.road.onPavement(point.s,d,MODEL_APPEARANCE.volcanoRadius*1.3);shift++)d+=side*8;
        this.sides.push({id:this.nextId++,...point,d,side,kind:this.environment===0?'volcano':'ice',createdAt:now,until:now+DISASTERS.roadsideKeepSeconds,nextAt:this.environment===0?now:now+DISASTERS.collapseInterval,shots:0});
      }
      this.nextMain+=this.environment===0?DISASTERS.volcanoInterval:this.environment===1?DISASTERS.waveInterval:DISASTERS.iceInterval;
    }
    for(const side of this.sides){
      if(now+1e-9<side.nextAt)continue;
      if(side.kind==='volcano'){
        const point=this.ahead(game,lerp(DISASTERS.lavaAheadMin,DISASTERS.lavaAheadMax,this.rng()));point.d=this.lane(game,point);
        this.add('lava',point,now,{width:DISASTERS.lavaSize,length:DISASTERS.lavaSize},DISASTERS.lavaKeepSeconds,DISASTERS.lavaFallSeconds,{source:side});
        side.shots++;side.nextAt=side.shots<DISASTERS.burstCount?side.nextAt+DISASTERS.burstInterval:side.nextAt+DISASTERS.volcanoInterval-(DISASTERS.burstCount-1)*DISASTERS.burstInterval;
        if(side.shots>=DISASTERS.burstCount){side.shots=0;side.nextAt=Math.max(side.nextAt,now+DISASTERS.burstInterval);}
        side.eruptedAt=now;game.audio?.disaster('volcano');
      }else{
        const point={s:side.s,route:side.route,d:game.road.branchCenter(side.s,side.route)};
        this.add('cover',point,now,{width:game.road.edge(side.s,side.route)*2,length:DISASTERS.coverLength},DISASTERS.coverKeepSeconds);
        side.nextAt+=DISASTERS.collapseInterval;side.eruptedAt=now;game.audio?.disaster('ice');
      }
    }
    if(now+1e-9>=this.nextObstacle){
      const point=this.ahead(game,lerp(DISASTERS.icebergAheadMin,DISASTERS.icebergAheadMax,this.rng()));point.d=this.lane(game,point);
      this.add('iceberg',point,now,{width:DISASTERS.icebergWidth,length:DISASTERS.icebergLength},DISASTERS.icebergKeepSeconds);
      this.nextObstacle+=DISASTERS.icebergInterval;
    }
  }
  window(start,finish,hazard,now,dt,road){
    if(dt<=0||(start.route??null)!==(hazard.route??null)||hazard.until<=now||hazard.from>now+dt)return null;
    const first=clamp((hazard.from-now)/dt,0,1),last=clamp((hazard.until-now)/dt,0,1);
    if(last<first)return null;
    const a={...start,s:lerp(start.s,finish.s,first),d:lerp(start.d,finish.d,first)},b={...finish,s:lerp(start.s,finish.s,last),d:lerp(start.d,finish.d,last)};
    const moving=time=>({...hazard,d:hazard.d+(hazard.kind==='wave'?(time-hazard.from)*DISASTERS.waveSpeed*hazard.direction:0)});
    const event=hazard.kind==='lava'?circleContact(a,b,hazard,road):sweep(a,b,moving(now+dt*first),moving(now+dt*last),road,true);
    return event?{time:lerp(first,last,event.time),exit:lerp(first,last,event.exit)}:null;
  }
  covers(start,finish,now,dt,road){
    const windows=[];
    for(const hazard of this.hazards)if(hazard.kind==='cover'){
      const interval=this.window(start,finish,hazard,now,dt,road);if(interval)windows.push(interval);
    }
    windows.sort((a,b)=>a.time-b.time);
    const merged=[];
    for(const interval of windows){const previous=merged[merged.length-1];if(previous&&interval.time<=previous.exit+1e-9)previous.exit=Math.max(previous.exit,interval.exit);else merged.push({...interval});}
    return merged;
  }
  slide(start,finish,now,dt,game,commit=false){
    if(!game.input.lateral||game.player.spin||game.whiteHorse?.shielded(now)||now<(game.player.invincibleUntil??0)||now<(game.debugInvincibleUntil??0)){if(commit)this.slideTime=0;return null;}
    let elapsed=this.slideTime,end=0,event=null;
    for(const interval of this.covers(start,finish,now,dt,game.road)){
      if(interval.time>end+1e-8)elapsed=0;
      const length=(interval.exit-interval.time)*dt;
      if(!event&&elapsed+length>DISASTERS.slideSeconds+1e-9)event={time:Math.max(interval.time,interval.time+(DISASTERS.slideSeconds+1e-8-elapsed)/dt),disasterSlide:true};
      elapsed+=length;end=interval.exit;
    }
    if(commit)this.slideTime=end<1-1e-8?0:elapsed;
    return event;
  }
  candidates(start,finish,now,dt,game,out){
    for(const hazard of this.hazards){
      if(hazard.kind==='cover'||hazard.hits.has('player'))continue;
      const interval=this.window(start,finish,hazard,now,dt,game.road);
      if(interval)out.push({time:interval.time,disasterHazard:hazard});
    }
    const slip=this.slide(start,finish,now,dt,game);if(slip)out.push(slip);
  }
  hit(event,game){
    const hazard=event.disasterHazard,p=game.player;
    if(hazard)hazard.hits.add('player');
    if(hazard?.kind==='iceberg'){game.die('iceberg');return;}
    if(hazard?.kind==='lava'){
      if(p.rank===1){game.die('lava');return;}
      p.xp=XP[p.rank-1];game.grow('lava');game.audio?.impact();return;
    }
    if(hazard?.kind==='wave'){
      if(p.rank===1){game.die('tsunami');return;}
      game.hurt(VEHICLE_DEFENSE[p.rank].max*DISASTERS.defenseFraction,'tsunami');
      p.wetUntil=game.activeSeconds+DISASTERS.wetSeconds;game.audio?.splash();
    }
    if(event.disasterSlide||hazard?.kind==='wave'){
      startDisasterSpin(p,event.disasterSlide?DISASTERS.iceSpinSeconds:DISASTERS.waterSpinSeconds,hazard?.direction??(Math.sign(game.input.lateral)||1));
      this.slideTime=0;game.nitro.stop();game.input.clear();
      if(event.disasterSlide)game.audio?.freeze();
    }
  }
}
