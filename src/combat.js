import { VEHICLES, MAX_RANK, FORTIFICATIONS, PROJECTILES, COMBAT, ROAD_DIFFICULTY, random } from './config.js';

// 射弹与移动车身连续相交，双方使用道路弧长及横向位置；系统车不参与射弹碰撞。
export function projectileContact(from,to,target,targetNext,radius,road=null){
  if(road){
    const p=road.at(target.s,target.d,target.route),next=road.at(targetNext.s,targetNext.d,targetNext.route),a=road.at(from.s,from.d,from.route),b=road.at(to.s,to.d,to.route);
    const heading=p.heading+(target.yaw||0),sin=Math.sin(heading),cos=Math.cos(heading);
    const coordinates=point=>({s:(point.x-p.x)*sin-(point.z-p.z)*cos,d:(point.x-p.x)*cos+(point.z-p.z)*sin});
    from=coordinates(a);to=coordinates(b);target={...target,s:0,d:0,yaw:0};targetNext={...targetNext,...coordinates(next),yaw:0};
  }
  const size=target.dimensions||VEHICLES[target.rank];
  const yaw=target.yaw||0,sin=Math.sin(yaw),cos=Math.cos(yaw);
  const ds=from.s-target.s,dd=from.d-target.d,ms=to.s-from.s-(targetNext.s-target.s),md=to.d-from.d-(targetNext.d-target.d);
  let enter=0,exit=1;
  for(let i=0;i<2;i++){
    const half=(i===0?size.length:size.width)/2;
    const position=i===0?ds*cos+dd*sin:dd*cos-ds*sin,motion=i===0?ms*cos+md*sin:md*cos-ms*sin,reach=half+radius;
    if(Math.abs(motion)<1e-10){if(Math.abs(position)>reach)return null;continue;}
    const a=(-reach-position)/motion,b=(reach-position)/motion;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    if(enter>exit+1e-8)return null;
  }
  return enter<=1&&exit>=0?{time:Math.max(0,enter)}:null;
}

export class Combat {
  constructor(seed){this.rng=random(seed^0x573d96a1);this.enabled=false;this.projectiles=[];this.timers=new Map();this.nextId=1;this.buildings=[];this.nextSlot=null;}
  clearProjectiles(){this.projectiles.length=0;}
  advance(dt,game){
    if(!this.projectiles.length)return;
    const walls=game.road.walls(game.player.s-160,780);
    for(const shot of this.projectiles){
      const previous=shot.previous??={};previous.s=shot.s;previous.d=shot.d;shot.until=Math.min(1,(COMBAT.lifetime-shot.age)/dt);shot.blocked=false;
      shot.s+=shot.vs*dt;shot.d+=shot.vd*dt;shot.age+=dt;
      const radius=PROJECTILES[shot.kind].radius,first=Math.min(shot.previous.s,shot.s)-radius-.35,last=Math.max(shot.previous.s,shot.s)+radius+.35;
      for(const wall of walls){
        if(wall.end<first||wall.end>last)continue;
        for(const sign of [-1,1]){
          if(game.whiteHorse.smashed.has('wall:'+wall.end+':'+sign))continue;
          const target={s:wall.end,d:sign*9.4,dimensions:{length:.7,width:3.6}};
          const contact=projectileContact(shot.previous,shot,target,target,radius);
          if(contact){shot.until=Math.min(shot.until,contact.time);shot.blocked=true;}
        }
      }
    }
  }
  finishStep(dt,game){
    let retained=0;
    for(const shot of this.projectiles)if(!shot.remove&&!shot.blocked&&shot.age<COMBAT.lifetime&&shot.s>game.player.s-150&&shot.s<game.player.s+600&&Math.abs(shot.d)<35)this.projectiles[retained++]=shot;
    this.projectiles.length=retained;
    this.enabled ||= game.highestRank===MAX_RANK||game.activeSeconds>COMBAT.unlockSeconds;
    if(!this.enabled)return;
    // 解锁后只在前方投放新建筑；按固定距离区块生成，不受车流数量影响。
    if(this.nextSlot===null)this.nextSlot=Math.ceil((game.player.s+100)/FORTIFICATIONS.spacing);
    while(this.nextSlot*FORTIFICATIONS.spacing<game.player.s+450){
      const slot=this.nextSlot++,s=slot*FORTIFICATIONS.spacing;
      for(const side of [-1,1]){
        const kind=this.rng()<.5?'bunker':'tower',weapon=FORTIFICATIONS[kind];
        if(game.road.fork(s))continue;
        this.buildings.push({id:slot+':'+side,s,d:side*(game.road.edge(s)+FORTIFICATIONS.offset),kind,height:weapon.height});
      }
    }
    retained=0;
    for(const building of this.buildings){if(building.s>game.player.s-80)this.buildings[retained++]=building;else this.timers.delete(building.id);}
    this.buildings.length=retained;
    const chance=(COMBAT.tankChance-(MAX_RANK-game.player.rank)*COMBAT.chanceStep)*COMBAT.chanceMultiplier;
    const fourLane=game.road.isFourLanePhase(game.player.s),difficulty=ROAD_DIFFICULTY.fourLane;
    for(const building of this.buildings){
      if(building.s<=game.player.s||building.s>game.player.s+FORTIFICATIONS.range){this.timers.delete(building.id);continue;}
      const weapon=FORTIFICATIONS[building.kind];
      let remaining=this.timers.get(building.id)??weapon.interval*(.4+this.rng()*.6);
      remaining-=dt;
      let increase=weapon.kind==='bullet'&&game.activeSeconds>=ROAD_DIFFICULTY.afterSeconds?ROAD_DIFFICULTY.bulletChanceIncrease:0;
      if(fourLane)increase=weapon.kind==='bullet'?difficulty.bulletChanceIncrease:difficulty.rocketChanceIncrease;
      const firingChance=Math.min(1,chance+increase);
      if(remaining<=0){remaining+=weapon.interval;if(this.rng()<firingChance)this.fire(building,game.player);}
      this.timers.set(building.id,remaining);
    }
  }
  fire(building,player){
    if(building.s<=player.s||this.projectiles.length>=COMBAT.capacity)return;
    const ds=player.s-building.s,dd=player.d-building.d,length=Math.hypot(ds,dd);
    if(length<.001)return;
    const weapon=FORTIFICATIONS[building.kind],profile=PROJECTILES[weapon.kind],vs=ds/length,vd=dd/length,muzzle=2.8;
    // 方向锁定为开火瞬间的玩家位置，发射后不再跟踪，允许玩家横移躲避。
    this.projectiles.push({id:this.nextId++,s:building.s+vs*muzzle,d:building.d+vd*muzzle,vs:vs*profile.speed,vd:vd*profile.speed,kind:weapon.kind,size:weapon.size,height:weapon.height,targetTime:(length-muzzle)/profile.speed,age:0,until:1});
  }
}
