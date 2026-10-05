import { WHITE_HORSE, VEHICLES, LANE_WIDTH, random, laneD, lerp, clamp } from './config.js';
import { sweep } from './collision.js';

// 每分钟安排一匹白马，拾取和强化均使用有效游戏时间；暂停冻结，新局清空。
export class WhiteHorseEvent {
  constructor(seed){
    this.rng=random(seed^0x29c4a831);this.nextAt=WHITE_HORSE.intervalSeconds;this.nextId=1;
    this.horse=null;this.buff=null;this.smashed=new Map();this.revision=0;
  }
  advance(dt,game){
    const now=game.activeSeconds,p=game.player;
    for(const [key,s]of this.smashed)if(s<p.s-100){this.smashed.delete(key);this.revision++;}
    if(this.buff&&now>=this.buff.until)this.buff=null;
    if(this.horse&&now>=this.horse.until)this.horse=null;
    if(!this.horse&&now>=this.nextAt){
      const candidates=[],fallback=[];
      // 每分钟必定投放；优先选完整奔跑路段无施工、且不与系统车重叠的位置。
      for(let distance=WHITE_HORSE.minAhead;distance<=WHITE_HORSE.maxAhead;distance+=5){
        const s=p.s+distance,look=WHITE_HORSE.speed/3.6*(WHITE_HORSE.visibleSeconds+WHITE_HORSE.blinkSeconds);
        const route=p.route&&s<game.road.route(p.route).end?p.route:null;
        for(let lane=0;lane<game.road.available(s,route);lane++){
          if(!route&&!game.road.laneOpen(s,lane,1,0,WHITE_HORSE.length/2))continue;
          const d=game.road.branchCenter(s,route)+laneD(lane);fallback.push({s,d,lane,route});
          if(!route&&!game.road.laneOpen(s,lane,1,look,WHITE_HORSE.length/2))continue;
          if(game.traffic.cars.some(car=>!car.remove&&(car.route??null)===route&&Math.abs(car.d-d)<(VEHICLES[car.rank].width+WHITE_HORSE.width)/2+.2&&Math.abs(car.s-s)<(VEHICLES[car.rank].length+WHITE_HORSE.length)/2+3))continue;
          candidates.push({s,d,lane,route});
        }
      }
      const positions=candidates.length?candidates:fallback;
      if(positions.length){
        const position=positions[Math.floor(this.rng()*positions.length)];
        this.horse={...position,id:this.nextId++,direction:1,speed:WHITE_HORSE.speed/3.6,from:now,until:now+WHITE_HORSE.visibleSeconds+WHITE_HORSE.blinkSeconds,dimensions:{length:WHITE_HORSE.length,width:WHITE_HORSE.width}};
        this.nextAt=(Math.floor(now/WHITE_HORSE.intervalSeconds)+1)*WHITE_HORSE.intervalSeconds;
      }
    }
    if(this.horse){
      const horse=this.horse,route=horse.route,relative=horse.d-game.road.branchCenter(horse.s,route);
      horse.previous={s:horse.s,d:horse.d,route};horse.s+=horse.speed*dt/game.road.pathScale(horse.s,route);
      horse.d=game.road.branchCenter(horse.s,route)+relative;
      if(route&&horse.s>=game.road.route(route).end)horse.route=null;
    }
  }
  contact(start,finish,now,dt,cursor,road){
    const horse=this.horse;if(!horse||now>=horse.until)return null;
    const last=clamp((horse.until-now)/dt,0,1),previous=horse.previous||horse;
    const begin={...horse,s:lerp(previous.s,horse.s,cursor),d:lerp(previous.d,horse.d,cursor)},end={...horse,s:lerp(begin.s,horse.s,last),d:lerp(begin.d,horse.d,last)};
    const next={...finish,s:lerp(start.s,finish.s,last),d:lerp(start.d,finish.d,last)};
    const event=sweep(start,next,begin,end,road);
    return event?{...event,time:event.time*last,horse:true}:null;
  }
  collect(game){
    const p=game.player,now=game.activeSeconds;
    this.horse=null;
    this.buff={from:now,startSpeed:p.speed,peakSpeed:VEHICLES[p.rank].playerMax*WHITE_HORSE.speedMultiplier,shieldUntil:now+WHITE_HORSE.shieldSeconds,until:now+WHITE_HORSE.shieldSeconds+WHITE_HORSE.recoverySeconds};
    // 强化期间不吞吃，饥饿倒计时同步冻结，避免保护罩内因无法补分而死亡。
    game.nextHungerAt=Math.max(now,game.nextHungerAt)+WHITE_HORSE.shieldSeconds;
    p.mud=0;p.bump=0;p.frozenUntil=0;p.push=0;p.sidePush=0;p.sidePushTime=0;
    game.scraping=false;game.nitro.stop();
  }
  shielded(now){return Boolean(this.buff&&now<this.buff.shieldUntil);}
  speed(player,now){
    const buff=this.buff;if(!buff||now>buff.until)return null;
    if(now<buff.from+WHITE_HORSE.rampSeconds)return lerp(buff.startSpeed,buff.peakSpeed,clamp((now-buff.from)/WHITE_HORSE.rampSeconds,0,1));
    if(now<buff.shieldUntil)return buff.peakSpeed;
    return lerp(buff.peakSpeed,VEHICLES[player.rank].playerMax,clamp((now-buff.shieldUntil)/WHITE_HORSE.recoverySeconds,0,1));
  }
  travel(player,now,dt){
    if(this.speed(player,now)===null)return player.speed/3.6*dt;
    const stops=[now,now+dt];
    for(const time of [this.buff.from+WHITE_HORSE.rampSeconds,this.buff.shieldUntil,this.buff.until])if(time>now&&time<now+dt)stops.push(time);
    stops.sort((a,b)=>a-b);
    let distance=0;
    for(let i=1;i<stops.length;i++)distance+=((this.speed(player,stops[i-1])??player.speed)+(this.speed(player,stops[i])??VEHICLES[player.rank].playerMax))/2/3.6*(stops[i]-stops[i-1]);
    return distance;
  }
  boundary(now){return this.buff?[this.buff.from+WHITE_HORSE.rampSeconds,this.buff.shieldUntil,this.buff.until].find(time=>time>now+1e-10):undefined;}
  breakObstacle(key,s){if(!this.smashed.has(key)){this.smashed.set(key,s);this.revision++;}}
  edge(road,s,now){return this.shielded(now)?Math.max(road.edge(s),.4+3*LANE_WIDTH):road.edge(s);}
}
