import { COINS, ROCKETS, VEHICLES, LANE_WIDTH, laneD, random, lerp, clamp } from './config.js';
import { sweep } from './collision.js';

// 左侧车道从 -1 向外递减，右侧从 1 向外递增；按实际横向位置归属车道。
function laneAt(road,s,d,route){
  const relative=d-road.branchCenter(s,route),direction=relative<0?-1:1;
  const lane=clamp(Math.floor((Math.abs(relative)-.4)/LANE_WIDTH),0,road.available(s,route)-1);
  return direction*(lane+1);
}

// 金币与武器仅属于本局第二关，不进入成长积分或本机存档。
export class Arsenal {
  constructor(road){
    this.road=road;this.rng=random(road.seed^0x2357fa);this.coins=[];this.balance=0;this.shots=[];this.nextId=1;this.nextAt=COINS.firstSeconds;
  }
  step(start,player,game){
    const now=game.activeSeconds;
    let kept=0;
    for(const shot of this.shots)if(now-shot.born<ROCKETS.flightSeconds)this.shots[kept++]=shot;
    this.shots.length=kept;
    let collected=0;kept=0;
    const reach=Math.abs(player.s-start.s)+VEHICLES[start.rank].length/2;
    for(const coin of this.coins){
      if(coin.collected)continue;
      if((coin.route??null)===(start.route??null)&&Math.abs(coin.s-start.s)<=reach+coin.dimensions.length/2&&sweep(start,player,coin,coin,this.road)){
        coin.collected=true;collected+=coin.value;
      }else if(coin.s>=player.s-COINS.recycleBehind)this.coins[kept++]=coin;
    }
    this.coins.length=kept;
    if(collected){this.balance+=collected;game.audio?.coinPickup();}
    if(now>=this.nextAt){
      this.nextAt=now+lerp(COINS.intervalMin,COINS.intervalMax,this.rng());
      if(this.rng()<COINS.chance)this.spawn(player);
    }
  }
  spawn(player){
    if(this.coins.length>=COINS.capacity)return;
    const options=[],count=COINS.batchMin+Math.floor(this.rng()*(COINS.batchMax-COINS.batchMin+1));
    for(let i=0;i<count&&this.coins.length<COINS.capacity;i++){
      // 每枚独立选择前方位置、开放车道及车道内偏移，不排列成串。
      const ahead=lerp(COINS.aheadMin,COINS.aheadMax,this.rng()),s=player.s+ahead/this.road.pathScale(player.s,player.route);
      const route=player.route&&s<this.road.route(player.route).end?player.route:null;
      if(this.road.roadworks(s-COINS.largeSize/2,s+COINS.largeSize/2).length)continue;
      options.length=0;
      for(const direction of [-1,1])for(let lane=0;lane<this.road.available(s,route);lane++)if(route||this.road.laneOpen(s,lane,direction,0,COINS.largeSize))options.push({lane,direction});
      if(!options.length)continue;
      const choice=options[Math.floor(this.rng()*options.length)],large=this.rng()<COINS.largeChance,size=large?COINS.largeSize:COINS.smallSize,margin=Math.max(0,(LANE_WIDTH-size)/2);
      const d=this.road.branchCenter(s,route)+laneD(choice.lane,choice.direction)+lerp(-margin,margin,this.rng());
      this.coins.push({id:this.nextId++,s,d,route,value:large?COINS.largeValue:COINS.smallValue,large,dimensions:{width:size,length:size}});
    }
  }
  fire(game,type='normal'){
    if(!['normal','advanced'].includes(type)||this.shots.length>=ROCKETS.capacity)return false;
    const cost=type==='advanced'?ROCKETS.advancedCost:ROCKETS.normalCost;
    if(this.balance<cost)return false;
    this.balance-=cost;
    const p=game.player,route=p.route??null,available=this.road.available(p.s,route),ordered=[];
    for(let lane=available;lane>=1;lane--)ordered.push(-lane);
    for(let lane=1;lane<=available;lane++)ordered.push(lane);
    const lane=laneAt(this.road,p.s,p.d,route),index=ordered.indexOf(lane);
    const lanes=type==='advanced'?null:ordered.slice(Math.max(0,index-ROCKETS.normalSideLanes),index+ROCKETS.normalSideLanes+1);
    const path=[{s:p.s,route,distance:0}];let s=p.s,currentRoute=route,distance=0;
    // 沿当前路线累计实际前方距离，副路结束后接主路，弯道和坡道不会缩短清理范围。
    while(distance<ROCKETS.range){
      const step=Math.min(1,ROCKETS.range-distance);s+=step/this.road.pathScale(s,currentRoute);distance+=step;
      if(currentRoute&&s>=this.road.route(currentRoute).end)currentRoute=null;
      path.push({s,route:currentRoute,distance});
    }
    const shot={id:this.nextId++,type,s:p.s,route,lanes,lateral:p.d-this.road.branchCenter(p.s,route),path,endS:s,range:ROCKETS.range,born:game.activeSeconds};this.shots.push(shot);
    // 起点、路线和普通炮的三条车道在发射时固定，按车辆中心所在车道立即清理。
    for(const car of game.traffic.cars)if(!car.remove&&this.hit(shot,car)){
      car.remove=true;game.renderer?.effect(car.s,car.d,'wreck',car);
    }
    const police=game.police.police;
    if(police&&this.hit(shot,police)){
      game.renderer?.effect(police.s,police.d,'wreck');game.police.dismiss(game.activeSeconds);
    }
    const chaser=game.dinosaurs?.chaser;
    // 高级炮三枚动画合计一次伤害，沿用本次发射的路线、车道与射程判定。
    if(chaser&&!chaser.defeated&&this.hit(shot,chaser))game.dinosaurs.hurt(type==='advanced'?ROCKETS.advancedDinosaurDamage:ROCKETS.normalDinosaurDamage,game);
    game.audio?.rocketLaunch();return true;
  }
  hit(shot,car){
    if(car.s<shot.s||car.s>shot.endS)return false;
    const route=shot.route&&car.s<this.road.route(shot.route).end?shot.route:null;
    if((car.route??null)!==route)return false;
    return shot.type==='advanced'||shot.lanes.includes(laneAt(this.road,car.s,car.d,route));
  }
}
