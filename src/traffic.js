import { VEHICLES, MAX_RANK, TRAFFIC_COLORS, ONCOMING_SPEED_SCALE, TRAFFIC_WEIGHTS, TRAFFIC_SPAWN_AHEAD, TRAFFIC_SPAWN_BEHIND, UPGRADE_TRAFFIC, TRAFFIC_DENSITY, TRAFFIC_LANE_CHANGE, TRAFFIC_DRIVING, ROAD_DIFFICULTY, SLOW_TRAFFIC, REAR_WARNING, LANE_WIDTH, ROAD_INFRASTRUCTURE, laneD, random, clamp, approach, lerp, smooth } from './config.js';
import { sweep, roadworkContact, separation, startBounce, advanceBounce } from './collision.js';
import { surfaceContact, MUD_SECONDS } from './hazards.js';
const maxVehicleLength=Math.max(...VEHICLES.slice(1).map(vehicle=>vehicle.length));
const byPreviousStation=(a,b)=>(a.previous?.s??a.s)-(b.previous?.s??b.s);

function snapshot(car,out){
  const old=car.previous||car;
  out.s=old.s;out.d=old.d;out.route=old.route===undefined?(car.route??null):old.route;out.rank=car.rank;out.dimensions=car.dimensions;out.yaw=car.yaw;
}

export class Traffic {
  constructor(road,seed){this.road=road;this.rng=random(seed^0x31f024b5);this.maneuverRng=random(seed^0x72a391c5);this.queueRng=random(seed^0x54a31c92);this.cars=[];this.branchRng=random(seed^0x195e839a);this.branchPlans=new Map();this.nextId=1;this.nextQueueId=1;this.timer=0;this.rearTimer=0;this.elapsedSeconds=0;this.capacity=TRAFFIC_DENSITY.capacity;this.gapScale=1;this.queueTimer=SLOW_TRAFFIC.firstSeconds+this.queueRng()*6;this.dangerousRng=random(seed^0x73af2c19);this.contacts=new Set();this.obstacles=[];this.staticObstacles=[];this.cowObstacles=new Map();this.obstacleStation=null;this.obstacleRoadRevision=-1;this.activeCars=[];this.orderedCars=[];this.contactEvents=[];this.nextContacts=new Set();this.branchForks=[];this.fourLane=false;}
  rank(playerRank,direction,distance,ahead=true){
    const weights=TRAFFIC_WEIGHTS;
    if(ahead){
      const settings=weights.ahead;
      const higher=playerRank<MAX_RANK?Math.min(settings.higherMax,settings.higher+Math.floor(distance/weights.stepDistance)*weights.higherStep):0;
      // 三轮车没有更低两级的车型，坦克没有高级车型，空组优先转给低一级。
      const oneLower=playerRank>1?settings.oneLower+(playerRank===2?settings.otherLower:0)+(playerRank===MAX_RANK?settings.higher:0):0;
      const otherLower=playerRank>2?settings.otherLower:0,r=this.rng();
      if(r<oneLower)return playerRank-1;
      if(r<oneLower+otherLower)return 1+Math.floor(this.rng()*(playerRank-2));
      if(r<oneLower+otherLower+higher)return playerRank+1+Math.floor(this.rng()*(MAX_RANK-playerRank));
      return playerRank;
    }
    const higher=playerRank<MAX_RANK ? Math.min(weights.higherMax,weights.higher+Math.floor(distance/weights.stepDistance)*weights.higherStep) : 0;
    const lower=playerRank>1 ? weights.lower-Math.max(0,higher-weights.higher) : 0;
    const r=this.rng();
    if(r<higher)return playerRank+1+Math.floor(this.rng()*(MAX_RANK-playerRank));
    if(r<higher+lower)return 1+Math.floor(this.rng()*(playerRank-1));
    return playerRank;
  }
  gap(a,b){return Math.abs(a.s-b.s)*this.road.pathScale((a.s+b.s)/2,a.route)-(VEHICLES[a.rank].length+VEHICLES[b.rank].length)/2;}
  clearance(direction,speed,otherSpeed=speed){return Math.max(direction<0?45:35,speed*2,otherSpeed*2)*this.gapScale;}
  spawnParameters(player,direction,ahead,convoy=null){
    const rank=convoy?.rank??this.rank(player.rank,direction,player.s,ahead),v=VEHICLES[rank];
    let speed=convoy?.desired;
    if(speed==null){
      const cruise=v.min+this.rng()*(v.max-v.min);
      speed=(direction<0?Math.round(cruise*ONCOMING_SPEED_SCALE):cruise)/3.6;
    }
    const safeDistance=Math.max(ahead?120:TRAFFIC_SPAWN_BEHIND.min,Math.abs(speed*direction-player.speed/3.6)*TRAFFIC_SPAWN_AHEAD.safetySeconds+v.length+VEHICLES[player.rank].length);
    return {rank,speed,safeDistance};
  }
  spawn(player,s,lane,direction,initial=false,convoy=null,candidate=null){
    if(this.cars.length>=this.capacity||!this.road.laneOpen(s,lane,direction,300,10))return false;
    const {rank,speed,safeDistance}=candidate??this.spawnParameters(player,direction,s>player.s,convoy);
    const d=laneD(lane,direction);
    const car={id:this.nextId++,s,d,rank,lane,direction,speed,desired:speed,merge:null,sidePush:0,sidePushTime:0,convoy};
    if(Math.abs(s-player.s)<safeDistance)return false;
    const ahead=this.road.available(s+direction*240);
    if(lane===2&&ahead<3)return false;
    // 开局跨车道也留出纵向层次，避免三条车道的车辆排成横线。
    if(initial&&this.cars.some(other=>Math.abs(other.s-s)<18/TRAFFIC_DENSITY.scale))return false;
    if(this.cars.some(other=>{
      if(other.route||other.direction!==direction||Math.abs(other.d-d)>=2.4)return false;
      const sameQueue=convoy&&other.convoy?.id===convoy.id;
      const clearance=sameQueue?convoy.gap-.01:this.clearance(direction,speed,other.speed)+Math.max(0,(s-other.s)*direction>0?other.speed-speed:speed-other.speed)*4*this.gapScale;
      return this.gap(car,other)<clearance;
    }))return false;
    const colors=TRAFFIC_COLORS[rank];car.color=colors[Math.floor(this.rng()*colors.length)];
    this.configureDriving(car);
    this.cars.push(car);return true;
  }
  spawnUpgrade(player){
    const settings=UPGRADE_TRAFFIC,count=settings.countPerRank*2,batch=[];
    let s=player.s,distance=0,route=player.route??null;
    for(let index=0;index<count;index++){
      const ahead=lerp(settings.minAhead,settings.maxAhead,(index+.5)/count);
      // 按当前路线实际弧长推进，副路出口后继续沿主路安排剩余车辆。
      while(distance<ahead){
        const step=Math.min(1,ahead-distance);
        s+=step/this.road.pathScale(s,route);distance+=step;
        if(route&&s>=this.road.route(route).end)route=null;
      }
      const rank=index%2===0?player.rank:player.rank-1,v=VEHICLES[rank],colors=TRAFFIC_COLORS[rank];
      const lanes=[];
      for(let lane=0;lane<this.road.available(s,route);lane++)if(route||this.road.laneOpen(s,lane,1,0,v.length/2))lanes.push(lane);
      const lane=lanes[index%lanes.length],d=this.road.branchCenter(s,route)+laneD(lane);
      const speed=lerp(v.min,v.max,this.rng())/3.6;
      const car={id:this.nextId++,s,d,route,rank,lane,direction:1,speed,desired:speed,color:colors[Math.floor(this.rng()*colors.length)],merge:null,convoy:null,sidePush:0,sidePushTime:0};
      this.configureDriving(car);batch.push(car);
    }
    // 此批次保证足量投放：只替换与新车重叠的普通车，满额时先回收最远车。
    this.cars=this.cars.filter(car=>!car.remove&&!batch.some(target=>sweep(car,car,target,target,this.road)));
    while(this.cars.length+batch.length>this.capacity){
      let farthest=0;
      for(let index=1;index<this.cars.length;index++)if(Math.abs(this.cars[index].s-player.s)>Math.abs(this.cars[farthest].s-player.s))farthest=index;
      this.cars.splice(farthest,1);
    }
    this.cars.push(...batch);
  }
  replenish(player,direction,from,to){
    if(this.cars.length>=this.capacity)return false;
    // 每次补车最多尝试两次，失败后重选距离、开放车道及车型；成功只投放一辆。
    for(let attempt=0;attempt<2;attempt++){
      let candidate=null,min=from,max=to;
      if(direction<0&&from>0){
        // 先确定实际车型与速度，再推远投放窗口，避免高速对向车被固定近距窗口全部排除。
        candidate=this.spawnParameters(player,direction,true);
        min=Math.max(from,candidate.safeDistance);
        max=Math.min(min+to-from,TRAFFIC_SPAWN_AHEAD.retainDistance);
        if(min>=max)continue;
      }
      const s=player.s+lerp(min,max,this.rng()),lanes=[];
      for(let lane=0;lane<this.road.available(s);lane++)if(this.road.laneOpen(s,lane,direction,300,10))lanes.push(lane);
      if(!lanes.length)continue;
      const lane=lanes[Math.floor(this.rng()*lanes.length)];
      if(this.spawn(player,s,lane,direction,false,null,candidate))return true;
    }
    return false;
  }
  spawnCongestion(player){
    if(this.cars.some(car=>car.convoy&&!car.remove))return false;
    const rng=this.queueRng,settings=SLOW_TRAFFIC,event=this.nextQueueId++;
    // 两车道道路只安排一队，三车道最多两队，始终留出同向通路。
    for(let attempt=0;attempt<5;attempt++){
      const head=player.s+350+attempt*20,lanes=this.road.available(head),choices=Array.from({length:lanes},(_,lane)=>lane);
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      const laneCount=lanes===3&&rng()<.5?2:1,batch=[];
      for(const lane of choices.slice(0,laneCount)){
        const count=settings.minCount+Math.floor(rng()*(settings.maxCount-settings.minCount+1));
        const desired=lerp(settings.minSpeed,settings.maxSpeed,rng())/3.6,gap=lerp(settings.minGap,settings.maxGap,rng());
        let s=head-rng()*12,previousRank;
        for(let index=0;index<count;index++){
          const rank=this.rank(player.rank,1,player.s);
          if(index)s-=(VEHICLES[previousRank].length+VEHICLES[rank].length)/2+gap;
          batch.push({s,lane,convoy:{id:event+':'+lane,desired,gap,rank}});previousRank=rank;
        }
      }
      const tail=Math.min(...batch.map(car=>car.s)),front=Math.max(...batch.map(car=>car.s));
      if(tail<player.s+240||this.cars.length+batch.length>this.capacity)continue;
      if(!this.road.stable(tail-120,front+300)||this.road.roadworks(tail-180,front+300).length)continue;
      // 整个事件一次投放，任何一辆不满足空间约束就撤销本次候选。
      const firstId=this.nextId;
      if(batch.every(car=>this.spawn(player,car.s,car.lane,1,false,car.convoy)))return true;
      this.cars=this.cars.filter(car=>car.id<firstId);
    }
    return false;
  }
  populate(player){
    const slots=[{lane:0,direction:1},{lane:1,direction:1},{lane:2,direction:1},{lane:0,direction:-1},{lane:1,direction:-1},{lane:2,direction:-1}];
    for(let distance=120+this.rng()*15;distance<=440;distance+=(18+this.rng()*15)/TRAFFIC_DENSITY.scale){
      const choices=[...slots];
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      for(const slot of choices)if(this.spawn(player,player.s+distance,slot.lane,slot.direction,true))break;
    }
    // 起步时也布置一段后方同向车流，所有车道均参与，前后错开并保留系统车净距。
    for(let distance=TRAFFIC_SPAWN_BEHIND.min+this.rng()*15;distance<TRAFFIC_SPAWN_BEHIND.retainDistance-20;distance+=(18+this.rng()*15)/TRAFFIC_DENSITY.scale){
      const choices=[0,1,2];
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      for(const lane of choices)if(this.spawn(player,player.s-distance,lane,1,true))break;
    }
  }
  approachingRear(player){
    let car,gap,seconds,sameLane=false;
    for(const other of this.cars){
      if(other.remove||(other.route??null)!==(player.route??null)||other.direction!==1||other.s>=player.s)continue;
      const closing=other.speed-player.speed/3.6;
      if(closing<=REAR_WARNING.minClosingSpeed)continue;
      const distance=Math.max(0,(player.s-other.s)*this.road.pathScale((player.s+other.s)/2,player.route)-(VEHICLES[player.rank].length+VEHICLES[other.rank].length)/2);
      if(distance>Math.max(REAR_WARNING.minDistance,closing*REAR_WARNING.seconds))continue;
      const aligned=Math.abs(other.d-player.d)<(VEHICLES[player.rank].width+VEHICLES[other.rank].width)/2+.3;
      const eta=distance/closing;
      // 本车道威胁优先，同类威胁选最快追上的后车，不依赖数组生成顺序。
      if(!car||(aligned&&!sameLane)||(aligned===sameLane&&eta<seconds)){car=other;gap=distance;seconds=eta;sameLane=aligned;}
    }
    return car?{car,gap,seconds,sameLane}:null;
  }
  configureDriving(car){
    const change=TRAFFIC_LANE_CHANGE;
    car.laneChangeChance=this.maneuverRng()<change.enabledChance?1:0;
    const difficulty=ROAD_DIFFICULTY.fourLane;
    car.laneChangeTimer=lerp(this.fourLane?difficulty.laneChangeIntervalMin:change.intervalMin,this.fourLane?difficulty.laneChangeIntervalMax:change.intervalMax,this.maneuverRng());
    car.dangerousRoll=this.dangerousRng();
    car.dangerous=car.dangerousRoll<(this.fourLane?difficulty.dangerousChance:TRAFFIC_DRIVING.dangerousChance);
  }
  samePath(a,b){
    if((a.route??null)===(b.route??null))return true;
    const fork=this.road.fork(a.s);
    return Boolean(fork&&this.road.junction(a.s,fork.side));
  }
  prepareAvoidance(){
    const cars=this.avoidCars??=[];cars.length=0;this.avoidMaxSpeed=0;
    for(const car of this.cars)if(!car.remove){cars.push(car);this.avoidMaxSpeed=Math.max(this.avoidMaxSpeed,car.speed,car.desired??car.speed);}
    cars.sort(byPreviousStation);this.avoidIndexActive=true;
  }
  avoidanceIndex(s){
    let low=0,high=this.avoidCars.length;
    while(low<high){const middle=(low+high)>>>1;if((this.avoidCars[middle].previous?.s??this.avoidCars[middle].s)<s)low=middle+1;else high=middle;}
    return low;
  }
  safe(car,lane){
    const route=car.route??null,look=Math.max(TRAFFIC_DRIVING.minAvoidDistance,car.speed*TRAFFIC_DRIVING.avoidSeconds);
    if(lane<0||lane>=this.road.available(car.s,route))return false;
    if(car.dangerous)return true;
    if(!route&&!this.road.laneOpen(car.s,lane,car.direction,look,VEHICLES[car.rank].length/2))return false;
    const d=this.road.branchCenter(car.s,route)+laneD(lane,car.direction),v=VEHICLES[car.rank];
    const indexed=this.avoidIndexActive,cars=indexed?this.avoidCars:this.cars;
    const reach=indexed?Math.max(TRAFFIC_DRIVING.minAvoidDistance,(car.speed+this.avoidMaxSpeed)*TRAFFIC_DRIVING.avoidSeconds)+(v.length+maxVehicleLength)/2:Infinity;
    for(let i=indexed?this.avoidanceIndex(car.s-reach):0;i<cars.length;i++){
      const other=cars[i],position=other.previous||other;
      if(position.s-car.s>reach)break;
      if(other===car||other.remove||!this.samePath(car,other))continue;
      const center=this.road.branchCenter(position.s,position.route??other.route);
      const targetD=this.road.branchCenter(position.s,route)+laneD(lane,car.direction),width=(v.width+VEHICLES[other.rank].width)/2+.2;
      const claims=Math.abs(position.d-targetD)<width||other.merge&&Math.abs(center+laneD(other.merge.lane,other.direction)-targetD)<width;
      if(!claims)continue;
      const distance=(position.s-car.s)*car.direction;
      const closing=distance>=0?car.speed-other.speed*other.direction*car.direction:other.speed*other.direction*car.direction-car.speed;
      if(Math.abs(distance)-(v.length+VEHICLES[other.rank].length)/2<Math.max(TRAFFIC_DRIVING.minAvoidDistance,Math.max(0,closing)*TRAFFIC_DRIVING.avoidSeconds))return false;
    }
    return !this.obstacles.some(obstacle=>{
      if((obstacle.route??null)!==route)return false;
      const distance=(obstacle.s-car.s)*car.direction;
      const center=this.road.branchCenter(obstacle.s,route),targetD=center+d-this.road.branchCenter(car.s,route);
      return distance>=-obstacle.dimensions.length/2&&distance<=look+obstacle.dimensions.length/2&&Math.abs(obstacle.d-targetD)<(obstacle.dimensions.width+v.width)/2+.2;
    });
  }
  prepareObstacles(player,game,infrastructure){
    const station=Math.floor(player.s/10)*10,obstacles=this.obstacles;
    // 静态候选窗口留出十米余量，缓存不会漏掉下一次重建之前的接触。
    if(this.obstacleStation!==station||this.obstacleRoadRevision!==this.road.revision){
      this.obstacleStation=station;this.obstacleRoadRevision=this.road.revision;
      const from=station-420,to=station+790,list=this.staticObstacles;list.length=0;
      for(const wall of this.road.walls(from,to-from))for(const sign of [-1,1])list.push({id:'wall:'+wall.end+':'+sign,kind:'wall',s:wall.end,d:sign*9.4,dimensions:{width:3.6,length:.7}});
      for(const site of this.road.roadworks(from,to))list.push({...site,id:'work:'+site.id,kind:'roadwork'});
      for(const hazard of game?.hazards?.range(from,to)||[])list.push({...hazard,id:'hazard:'+hazard.id});
      for(const site of this.road.infrastructure(from,to))if(site.kind==='dip'&&site.feature==='river')list.push({id:'river:'+site.id,kind:'river',s:site.center,d:0,dimensions:{width:this.road.edge(site.center)*2,length:site.flat},site});
    }
    obstacles.length=0;
    for(const obstacle of this.staticObstacles)obstacles.push(obstacle);
    const cows=game?.crossings?.cows||[];
    for(const cow of cows){
      if(cow.hit)continue;
      let record=this.cowObstacles.get(cow.id);
      if(!record){record={};this.cowObstacles.set(cow.id,record);}
      Object.assign(record,cow);record.id='cow:'+cow.id;record.kind='cow';obstacles.push(record);
    }
    for(const id of this.cowObstacles.keys())if(!cows.some(cow=>cow.id===id&&!cow.hit))this.cowObstacles.delete(id);
  }
  threatens(car,target,dimensions,closing){
    if(closing<=0)return false;
    const v=VEHICLES[car.rank],position=target.previous||target,distance=(position.s-car.s)*car.direction-(v.length+dimensions.length)/2;
    return distance>=-(v.length+dimensions.length)&&distance<=Math.max(TRAFFIC_DRIVING.minAvoidDistance,closing*TRAFFIC_DRIVING.avoidSeconds)&&Math.abs(position.d-car.d)<(v.width+dimensions.width)/2+.15;
  }
  imminent(car){
    const indexed=this.avoidIndexActive,cars=indexed?this.avoidCars:this.cars,direction=indexed?car.direction:1;
    const reach=indexed?Math.max(TRAFFIC_DRIVING.minAvoidDistance,(car.speed+this.avoidMaxSpeed)*TRAFFIC_DRIVING.avoidSeconds)+(VEHICLES[car.rank].length+maxVehicleLength)/2:Infinity;
    const first=indexed?this.avoidanceIndex(car.s)+(direction<0?-1:0):0;
    for(let i=first;i>=0&&i<cars.length;i+=direction){
      const other=cars[i],position=other.previous||other,distance=(position.s-car.s)*car.direction;
      if(distance>reach)break;
      if(distance<=0||other===car||other.remove||!this.samePath(car,other))continue;
      if(this.threatens(car,other,VEHICLES[other.rank],car.speed-other.speed*other.direction*car.direction))return true;
    }
    for(const obstacle of this.obstacles)if((obstacle.route??null)===(car.route??null)&&this.threatens(car,obstacle,obstacle.dimensions,car.speed))return true;
    return false;
  }
  step(dt,player,activeSeconds=this.elapsedSeconds+dt,weather=null,infrastructure=null,game=null){
    this.stepMain(dt,player,activeSeconds,weather,infrastructure,game);
  }
  stepBranch(dt,player,activeSeconds,weather){
    const rng=this.branchRng;
    for(const [id]of this.branchPlans)if(this.road.route(id).end<player.s-240)this.branchPlans.delete(id);
    for(const fork of this.road.forksRange(player.s-160,player.s+460,this.branchForks)){
      let plan=this.branchPlans.get(fork.id);
      if(!plan){
        plan={nextAt:activeSeconds+4+rng()*4,pending:[]};this.branchPlans.set(fork.id,plan);
        for(let s=fork.start+60;s<fork.end-40;s+=55+rng()*40)plan.pending.push(s);
      }
      let pending=0;
      for(const s of plan.pending){if(s>player.s+460)plan.pending[pending++]=s;else this.spawnBranch(player,fork,s);}
      plan.pending.length=pending;
      if(activeSeconds>=plan.nextAt){plan.nextAt=activeSeconds+5+rng()*6;this.spawnBranch(player,fork,rng()<.65?fork.start+20:fork.end-20);}
    }
  }
  spawnBranch(player,fork,s){
    if(s<player.s-160||s>player.s+460||this.cars.length>=this.capacity)return;
    const rng=this.branchRng,direction=s>fork.end-30?-1:rng()<.7?1:-1,route=fork.id,lane=Math.floor(rng()*this.road.available(s,route));
    const d=this.road.branchCenter(s,route)+laneD(lane,direction),rank=this.rank(player.rank,direction,player.s,s>player.s),v=VEHICLES[rank];
    const cruise=v.min+rng()*(v.max-v.min),colors=TRAFFIC_COLORS[rank];
    const speed=(direction<0?Math.round(cruise*ONCOMING_SPEED_SCALE):cruise)/3.6;
    const safeDistance=Math.max(120,Math.abs(speed*direction-player.speed/3.6)*TRAFFIC_SPAWN_AHEAD.safetySeconds+v.length+VEHICLES[player.rank].length);
    if(Math.abs(player.s-s)<safeDistance)return;
    if(this.cars.some(car=>Math.abs(car.s-s)<40&&((car.route??null)===route?Math.abs(car.d-d)<2.4:this.road.junction(s,fork.side))))return;
    const car={id:this.nextId++,s,d,route,rank,lane,direction,speed,desired:speed,color:colors[Math.floor(rng()*colors.length)],merge:null,convoy:null,sidePush:0,sidePushTime:0};this.configureDriving(car);this.cars.push(car);
  }
  stepMain(dt,player,activeSeconds=this.elapsedSeconds+dt,weather=null,infrastructure=null,game=null){
    this.elapsedSeconds=activeSeconds;
    const change=TRAFFIC_LANE_CHANGE,difficulty=ROAD_DIFFICULTY.fourLane;
    const fourLane=this.road.isFourLanePhase(player.s),intervalMin=fourLane?difficulty.laneChangeIntervalMin:change.intervalMin,intervalMax=fourLane?difficulty.laneChangeIntervalMax:change.intervalMax;
    if(fourLane!==this.fourLane){
      this.fourLane=fourLane;
      // 使用生成时固定的抽签值调整已有车，不逐帧重新抽签；保留进行中的变道时序。
      for(const car of this.cars){
        if(car.dangerousRoll!==undefined)car.dangerous=car.dangerousRoll<(fourLane?difficulty.dangerousChance:TRAFFIC_DRIVING.dangerousChance);
        if(fourLane)car.laneChangeTimer=Math.min(car.laneChangeTimer??intervalMax,intervalMax+(car.merge?TRAFFIC_DRIVING.signalSeconds+TRAFFIC_DRIVING.changeSeconds:0));
      }
    }
    const density=TRAFFIC_DENSITY,stage=Math.floor(Math.max(0,activeSeconds)/density.growthSeconds);
    this.capacity=Math.min(density.maxCapacity,density.capacity+stage*density.capacityPerStep);
    this.gapScale=Math.max(density.minGapScale,1-stage*density.gapReductionPerStep);
    this.queueTimer-=dt;
    if(this.queueTimer<=0){
      this.queueTimer=lerp(SLOW_TRAFFIC.intervalMin,SLOW_TRAFFIC.intervalMax,this.queueRng());
      if(this.queueRng()<SLOW_TRAFFIC.chance)this.spawnCongestion(player);
    }
    this.timer+=dt;
    if(this.timer>Math.max(.5,.8-Math.floor(player.s/2000)*.035)/TRAFFIC_DENSITY.scale){
      this.timer=0;
      const direction=this.rng()<.73 ? 1:-1;
      this.replenish(player,direction,TRAFFIC_SPAWN_AHEAD.min,TRAFFIC_SPAWN_AHEAD.max);
    }
    // 后方补车独立计时，不依赖前方生成的方向和车道；巡航速度只在 spawn 时选定。
    this.rearTimer+=dt;
    if(this.rearTimer>=TRAFFIC_SPAWN_BEHIND.intervalSeconds){
      this.rearTimer=0;
      this.replenish(player,1,-TRAFFIC_SPAWN_BEHIND.max,-TRAFFIC_SPAWN_BEHIND.min);
    }
    this.stepBranch(dt,player,activeSeconds,weather);
    this.prepareObstacles(player,game,infrastructure);
    const settings=TRAFFIC_DRIVING;
    for(const car of this.cars){
      if(!car.previous)car.previous={s:car.s,d:car.d,route:car.route??null};
      else{car.previous.s=car.s;car.previous.d=car.d;car.previous.route=car.route??null;}
    }
    // 查询只使用步初位置；巡航目标也计入速度上界，覆盖本步恢复提速及对向来车。
    this.prepareAvoidance();
    for(const car of this.cars){
      if(car.remove)continue;
      const route=car.route??null,center=this.road.branchCenter(car.s,route),bouncing=Boolean(car.sidePush);
      const threat=car.dangerous?null:this.imminent(car);
      const look=Math.max(settings.minAvoidDistance,car.speed*settings.avoidSeconds);
      const closing=car.lane>=Math.min(this.road.available(car.s,route),this.road.available(car.s+car.direction*look,route));
      car.warning=Boolean(threat||closing)&&!car.dangerous;
      car.laneChangeTimer=(car.laneChangeTimer??intervalMin)-dt;
      let voluntary=false;
      if(car.laneChangeTimer<=0){
        car.laneChangeTimer=lerp(intervalMin,intervalMax,this.maneuverRng());
        if(!bouncing&&!car.merge&&(!car.convoy||car.dangerous)&&car.speed>.5&&(car.laneChangeChance===1||car.dangerous)){
          voluntary=car.dangerous||this.maneuverRng()<Math.min(1,lerp(change.chanceMin,change.chanceMax,this.maneuverRng())+(fourLane?difficulty.laneChangeChanceIncrease:0));
        }
      }
      if(!bouncing&&!car.merge&&((!car.dangerous&&(threat||closing))||voluntary)){
        const lanes=this.road.available(car.s,route),options=[car.lane-1,car.lane+1].filter(lane=>lane>=0&&lane<lanes);
        if(this.maneuverRng()<.5)options.reverse();
        const lane=options.find(candidate=>this.safe(car,candidate));
        if(lane!==undefined){
          car.merge={lane,from:car.d-center,time:0};car.convoy=null;
          car.laneChangeTimer=settings.signalSeconds+settings.changeSeconds+lerp(intervalMin,intervalMax,this.maneuverRng());
        }
      }
      let relative=car.d-center;
      if(car.merge){
        const m=car.merge;
        if(!car.dangerous&&m.time<settings.signalSeconds&&!this.safe(car,m.lane))car.merge=null;
        else{
          m.time+=dt;
          if(m.time>=settings.signalSeconds)relative=lerp(m.from,laneD(m.lane,car.direction),smooth(clamp((m.time-settings.signalSeconds)/settings.changeSeconds,0,1)));
          if(m.time>=settings.signalSeconds+settings.changeSeconds){car.lane=m.lane;car.merge=null;}
        }
      }
      const dipLimit=!route&&this.road.dip(car.s)?.feature==='river'?car.desired*ROAD_INFRASTRUCTURE.slowMultiplier:Infinity;
      const mudLimit=car.mudUntil>activeSeconds?car.desired*.5:Infinity;
      const target=Math.min(car.desired,dipLimit,mudLimit);
      car.speed=Math.min(approach(car.speed,target,(target<car.speed?5:1.2)*dt),weather?.speedLimit(car,activeSeconds)??Infinity,dipLimit,mudLimit);
      const travel=car.speed*dt;
      car.s+=travel*car.direction/this.road.pathScale(car.s,route);
      relative+=advanceBounce(car,dt);
      const wind=weather?.wind(route);
      if(wind){const shift=weather.lateral(0,0,route)*dt;relative+=shift;if(car.merge)car.merge.from+=shift;}
      else if(!bouncing&&!car.merge)relative=approach(relative,laneD(car.lane,car.direction),1.2*dt);
      car.d=this.road.branchCenter(car.s,route)+relative;
      weather?.trafficContact(car,activeSeconds-dt,dt);
      if(route){const fork=this.road.route(route);if(car.s>=fork.end||car.s<=fork.start){car.route=null;car.d=relative;car.merge=null;}}
      // 截止墙与路障接触在边界修正之前检查；保留完整运动轨迹供玩家及系统碰撞使用。
    }
    this.avoidIndexActive=false;
  }
  resolveContacts(dt,game){
    if(dt<=0)return;
    const cars=this.activeCars,events=this.contactEvents,nextContacts=this.nextContacts,ordered=this.orderedCars;
    cars.length=0;events.length=0;ordered.length=0;nextContacts.clear();
    for(const car of this.cars)if(!car.remove){
      cars.push(car);ordered.push(car);
      const start=car.contactStart??={};snapshot(car,start);
    }
    ordered.sort((a,b)=>Math.min(a.s,a.previous?.s??a.s)-Math.min(b.s,b.previous?.s??b.s));
    for(let i=0;i<ordered.length;i++){
      const a=ordered[i],from=a.contactStart,fork=this.road.fork(a.s);
      const reach=maxVehicleLength+(fork?.separation??0)+a.speed*dt;
      for(let j=i+1;j<ordered.length;j++){
        const b=ordered[j];
        if(Math.min(b.s,b.previous?.s??b.s)-Math.max(a.s,from.s)>reach+b.speed*dt)break;
        const event=sweep(from,a,b.contactStart,b,this.road);
        if(!event)continue;
        const key=Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);nextContacts.add(key);
        if(!this.contacts.has(key)){event.a=a;event.b=b;events.push(event);}
      }
    }
    this.nextContacts=this.contacts;this.contacts=nextContacts;
    for(const car of cars){
      const start=car.contactStart;
      car.obstacleHits??=new Map();
      for(const [id,s]of car.obstacleHits)if(Math.abs(car.s-s)>60)car.obstacleHits.delete(id);
      for(const obstacle of this.obstacles){
        if(car.obstacleHits.has(obstacle.id)||(obstacle.route??null)!==(start.route??null))continue;
        if(Math.abs(obstacle.s-start.s)>VEHICLES[car.rank].length+obstacle.dimensions.length/2+Math.abs(car.s-start.s)+3)continue;
        let event;
        if(obstacle.kind==='pothole'||obstacle.kind==='mud')event=surfaceContact(start,car,obstacle,this.road);
        else if(obstacle.kind==='roadwork')event=roadworkContact(start,car,obstacle);
        else if(obstacle.kind==='river'){
          const boundary=car.direction>0?obstacle.site.flatStart:obstacle.site.flatEnd;
          if((boundary-start.s)*car.direction>=0&&(car.s-boundary)*car.direction>=0&&car.s!==start.s)event={time:(boundary-start.s)/(car.s-start.s)};
        }else{const old=obstacle.contactStart??={};snapshot(obstacle,old);event=sweep(start,car,old,obstacle,this.road);}
        if(event){event.a=car;event.obstacle=obstacle;events.push(event);}
      }
    }
    events.sort((a,b)=>a.time-b.time||a.a.id-b.a.id);
    const wreck=(car,time)=>{
      car.s=lerp(car.previous?.s??car.s,car.s,time);car.d=lerp(car.previous?.d??car.d,car.d,time);car.remove=true;
      game.renderer?.effect(car.s,car.d,'wreck',car);
    };
    for(const event of events){
      const {a,b,obstacle}=event;if(a.remove||b?.remove)continue;
      if(b){
        if(a.rank!==b.rank){wreck(a.rank<b.rank?a:b,event.time);continue;}
        const shift=separation(a,b,this.road,event.direction)/2;a.d+=shift;b.d-=shift;
        startBounce(a,-event.direction);startBounce(b,event.direction);a.merge=null;b.merge=null;a.convoy=null;b.convoy=null;
      }else{
        a.obstacleHits.set(obstacle.id,obstacle.s);
        if(['wall','roadwork'].includes(obstacle.kind)||obstacle.kind==='cow'&&a.rank<=2){wreck(a,event.time);continue;}
        if(obstacle.kind==='cow'){startBounce(a,-(event.direction||1));a.merge=null;}
        else{
          a.speed*=.5;
          if(obstacle.kind==='mud')a.mudUntil=game.activeSeconds+MUD_SECONDS;
          if(obstacle.kind==='pothole'){startBounce(a,obstacle.drift);a.merge=null;}
        }
      }
    }
    for(const car of cars){
      if(car.remove)continue;
      const center=this.road.branchCenter(car.s,car.route),v=VEHICLES[car.rank],limit=this.road.edge(car.s,car.route)-v.width/2;
      car.d=center+clamp(car.d-center,-limit,limit);
      if(!car.merge&&!car.sidePush)car.lane=clamp(Math.round(((car.d-center)*car.direction-.4)/LANE_WIDTH-.5),0,this.road.available(car.s,car.route)-1);
    }
    let retained=0;
    for(const car of this.cars)if(!car.remove&&car.s>game.player.s-TRAFFIC_SPAWN_BEHIND.retainDistance&&car.s<game.player.s+TRAFFIC_SPAWN_AHEAD.retainDistance)this.cars[retained++]=car;
    this.cars.length=retained;
  }
}
