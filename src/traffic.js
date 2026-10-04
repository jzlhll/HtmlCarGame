import { VEHICLES, TRAFFIC_COLORS, ONCOMING_SPEED_SCALE, TRAFFIC_WEIGHTS, TRAFFIC_SPAWN_AHEAD, laneD, random, clamp, approach, lerp, smooth } from './config.js';
import { sweep } from './collision.js';

export class Traffic {
  constructor(road,seed){this.road=road;this.rng=random(seed^0x31f024b5);this.cars=[];this.nextId=1;this.timer=0;}
  rank(playerRank,direction,distance){
    const weights=TRAFFIC_WEIGHTS;
    const higher=playerRank<6 ? Math.min(weights.higherMax,weights.higher+Math.floor(distance/weights.stepDistance)*weights.higherStep) : 0;
    const lower=playerRank>1 ? weights.lower-Math.max(0,higher-weights.higher) : 0;
    const r=this.rng();
    if(r<higher)return playerRank+1+Math.floor(this.rng()*(6-playerRank));
    if(r<higher+lower)return 1+Math.floor(this.rng()*(playerRank-1));
    return playerRank;
  }
  gap(a,b){return Math.abs(a.s-b.s)-(VEHICLES[a.rank].length+VEHICLES[b.rank].length)/2;}
  spawn(player,s,lane,direction,initial=false){
    if(this.cars.length>=44||lane>=this.road.available(s))return false;
    const d=laneD(lane,direction),rank=this.rank(player.rank,direction,player.s),v=VEHICLES[rank];
    const speed=(v.min+this.rng()*(v.max-v.min))*(direction<0?ONCOMING_SPEED_SCALE:1)/3.6;
    const car={id:this.nextId++,s,d,rank,lane,direction,speed,desired:speed,merge:null};
    if(s<player.s && Math.abs(player.d-d)<1.8+VEHICLES[player.rank].width/2)return false;
    if(Math.abs(s-player.s)<Math.max(s<player.s ? 40:120,Math.abs(speed*direction-player.speed/3.6)*4+v.length+VEHICLES[player.rank].length))return false;
    const ahead=this.road.available(s+direction*240);
    if(lane===2&&ahead<3)return false;
    // 开局跨车道也留出纵向层次，避免三条车道的车辆排成横线。
    if(initial&&this.cars.some(other=>Math.abs(other.s-s)<18))return false;
    if(this.cars.some(other=>other.direction===direction&&Math.abs(other.d-d)<2.4&&this.gap(car,other)<Math.max(direction<0?45:35,speed*2,other.speed*2)+Math.max(0,(s-other.s)*direction>0?other.speed-speed:speed-other.speed)*4))return false;
    car.appearance=rank===3&&this.rng()<.5?'tractor':'default';
    const colors=TRAFFIC_COLORS[rank];car.color=colors[Math.floor(this.rng()*colors.length)];
    this.cars.push(car);return true;
  }
  populate(player){
    const slots=[{lane:0,direction:1},{lane:1,direction:1},{lane:2,direction:1},{lane:0,direction:-1},{lane:1,direction:-1},{lane:2,direction:-1}];
    for(let distance=120+this.rng()*15;distance<=440;distance+=18+this.rng()*15){
      const choices=[...slots];
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      for(const slot of choices)if(this.spawn(player,player.s+distance,slot.lane,slot.direction,true))break;
    }
    for(let lane=0;lane<3;lane++)this.spawn(player,player.s-50-lane*22-this.rng()*8,lane,1,true);
  }
  safe(car,lane){
    const d=laneD(lane,car.direction);
    return !this.cars.some(other=>{
      if(other===car||other.remove||other.direction!==car.direction)return false;
      const claims=other.merge?.lane===lane || other.lane===lane || Math.abs(other.d-d)<2.4;
      if(!claims)return false;
      const delta=(other.s-car.s)*car.direction;
      const gap=this.gap(car,other),closing=delta>0 ? car.speed-other.speed : other.speed-car.speed;
      return gap<Math.max(car.direction<0?45:35,Math.max(car.speed,other.speed)*2)+Math.max(0,closing)*3;
    });
  }
  step(dt,player){
    this.timer+=dt;
    if(this.timer>Math.max(.5,.8-Math.floor(player.s/2000)*.035)){
      this.timer=0;
      const direction=this.rng()<.73 ? 1:-1,lane=Math.floor(this.rng()*3);
      this.spawn(player,player.s+TRAFFIC_SPAWN_AHEAD.min+this.rng()*(TRAFFIC_SPAWN_AHEAD.max-TRAFFIC_SPAWN_AHEAD.min),lane,direction);
      if(direction===1&&this.rng()<.65)this.spawn(player,player.s-90-this.rng()*10,lane,1);
    }
    const ordered=[],ordinary=[],closingCars=new Set();
    // 覆盖附近车流及其前方预警区，一步只查询一次截止墙。
    const walls=this.road.walls(player.s-420,1200);
    for(const car of this.cars){
      if(this.road.available(car.s+car.direction*300)<=car.lane){closingCars.add(car);ordered.push(car);}
      else ordinary.push(car);
    }
    ordered.push(...ordinary);
    for(const car of ordered){
      car.previous={s:car.s,d:car.d};
      let front,nearest=Infinity;
      for(const other of this.cars){
        if(other===car||other.remove||other.direction!==car.direction||Math.abs(other.d-car.d)>=2.4)continue;
        const distance=(other.s-car.s)*car.direction;
        if(distance>0&&distance<nearest){front=other;nearest=distance;}
      }
      const closing=closingCars.has(car);
      let target=car.desired;
      const tight=front&&this.gap(car,front)<65+Math.max(0,car.speed-front.speed)*5;
      if(tight)target=Math.min(target,Math.max(0,front.speed+(this.gap(car,front)-Math.max(car.direction<0?45:35,car.speed*2))*.15));
      if(!car.merge&&(closing||(tight&&front.speed<car.desired-.5))){
        const options=[car.lane-1,car.lane+1].filter(lane=>lane>=0&&lane<this.road.available(car.s+car.direction*120));
        const lane=options.find(candidate=>this.safe(car,candidate));
        if(lane!==undefined)car.merge={lane,from:car.d,time:0};
        else if(closing)target=Math.min(target,car.desired*.65);
      }
      if(car.merge){
        const m=car.merge;
        if(m.time<1&&!this.safe(car,m.lane)){car.merge=null;}
        else {
          m.time+=dt;
          if(m.time>=1)car.d=lerp(m.from,laneD(m.lane,car.direction),smooth(clamp((m.time-1)/1.5,0,1)));
          if(m.time>=2.5){car.lane=m.lane;car.merge=null;}
        }
      }
      // 并道受阻或尚未横移到安全范围时，随剩余距离继续减速，留出制动和并道时间。
      const v=VEHICLES[car.rank];
      if(Math.abs(car.d)+v.width/2>7.6){
        let distance=Infinity;
        for(const wall of walls){const ahead=(wall.end-car.s)*car.direction;if(ahead>=0&&ahead<distance)distance=ahead;}
        if(distance<300){
          const clearance=Math.max(0,distance-v.length/2-.35-4),remaining=car.merge?Math.max(.5,3-car.merge.time):6;
          target=Math.min(target,Math.sqrt(2*5*clearance),clearance/remaining);
        }
      }
      car.speed=approach(car.speed,target,(target<car.speed?5:1.2)*dt);
      car.s+=car.speed*car.direction*dt;
      if(!car.merge&&(Math.abs(car.d-laneD(car.lane,car.direction))<.05||this.safe(car,car.lane)))car.d=approach(car.d,laneD(car.lane,car.direction),1.2*dt);
      // 用边界修正前的完整车身轨迹检查墙，不能先把外侧车强制挪到内侧而漏检。
      const start={...car,...car.previous},reach=v.length/2+.35;
      for(const wall of walls){
        if(wall.end<Math.min(start.s,car.s)-reach||wall.end>Math.max(start.s,car.s)+reach)continue;
        for(const sign of [-1,1]){
          const target={s:wall.end,d:sign*9.4,direction:1,dimensions:{width:3.6,length:.7}};
          if(sweep(start,car,target,target,this.road)){car.remove=true;break;}
        }
        if(car.remove)break;
      }
      if(car.remove)continue;
      const limit=this.road.edge(car.s)-v.width/2;
      if(Math.abs(car.d)>limit){car.d=clamp(car.d,-limit,limit);car.speed=Math.max(0,car.speed-4*dt);car.lane=Math.min(car.lane,this.road.available(car.s)-1);}
    }
    // 偏离车道后的系统车接触采用独立分离，不应用玩家的等级规则。
    for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++){
      const a=this.cars[i],b=this.cars[j],av=VEHICLES[a.rank],bv=VEHICLES[b.rank];
      if(a.remove||b.remove)continue;
      const dx=(av.width+bv.width)/2-Math.abs(a.d-b.d),ds=(av.length+bv.length)/2-Math.abs(a.s-b.s);
      if(dx<=0||ds<=0)continue;
      if(dx<ds){const sign=Math.sign(a.d-b.d)||1;a.d+=sign*(dx+.01)/2;b.d-=sign*(dx+.01)/2;}
      else{const sign=Math.sign(a.s-b.s)||1;a.s+=sign*(ds+.01)/2;b.s-=sign*(ds+.01)/2;}
      a.speed*=.8;b.speed*=.8;a.merge=null;b.merge=null;
    }
    this.cars=this.cars.filter(car=>!car.remove&&car.s>player.s-110&&car.s<player.s+480);
  }
}
