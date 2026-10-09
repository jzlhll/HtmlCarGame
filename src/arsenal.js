import { COINS, ROCKETS, VEHICLES, LANE_WIDTH, laneD, random, lerp } from './config.js';
import { sweep } from './collision.js';

// 金币与武器仅属于本局第二关，不进入成长积分或本机存档。
export class Arsenal {
  constructor(road){
    this.road=road;this.rng=random(road.seed^0x2357fa);this.coins=[];this.balance=0;this.normal=0;this.advanced=0;this.shots=[];this.nextId=1;this.nextAt=COINS.firstSeconds;
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
  buy(type='normal'){
    const cost=type==='advanced'?ROCKETS.advancedCost:ROCKETS.normalCost;
    if(this.balance<cost)return false;
    this.balance-=cost;this[type]++;return true;
  }
  fire(game){
    const type=this.advanced>0?'advanced':this.normal>0?'normal':null;
    if(!type||this.shots.length>=ROCKETS.capacity)return false;
    this[type]--;
    const p=game.player,origin={...this.road.at(p.s,p.d,p.route)},heading=origin.heading+(p.yaw||0),width=type==='advanced'?ROCKETS.advancedWidth:ROCKETS.normalWidth;
    const shot={id:this.nextId++,type,origin,heading,width,range:ROCKETS.range,born:game.activeSeconds};this.shots.push(shot);
    // 发射时固定正前方矩形，按真实车身盒体判定，不随弯道或玩家横移拐弯。
    for(const car of game.traffic.cars)if(!car.remove&&this.hit(shot,car)){
      car.remove=true;game.renderer?.effect(car.s,car.d,'wreck',car);
    }
    const police=game.police.police;
    if(police&&this.hit(shot,police)){
      game.renderer?.effect(police.s,police.d,'wreck');game.police.dismiss(game.activeSeconds);
    }
    game.audio?.rocketLaunch();return true;
  }
  hit(shot,car){
    const point=this.road.at(car.s,car.d,car.route),size=car.dimensions??VEHICLES[car.rank],heading=point.heading+(car.yaw||0);
    const fx=Math.sin(shot.heading),fz=-Math.cos(shot.heading),sx=Math.cos(shot.heading),sz=Math.sin(shot.heading);
    const dx=point.x-shot.origin.x-fx*shot.range/2,dz=point.z-shot.origin.z-fz*shot.range/2;
    const cx=Math.cos(heading),cz=Math.sin(heading),vx=Math.sin(heading),vz=-Math.cos(heading),halfWidth=size.width/2,halfLength=size.length*Math.cos(point.pitch||0)/2;
    for(const [x,z]of [[sx,sz],[fx,fz],[cx,cz],[vx,vz]]){
      const beam=Math.abs(sx*x+sz*z)*shot.width/2+Math.abs(fx*x+fz*z)*shot.range/2;
      const vehicle=Math.abs(cx*x+cz*z)*halfWidth+Math.abs(vx*x+vz*z)*halfLength;
      if(Math.abs(dx*x+dz*z)>beam+vehicle)return false;
    }
    // 前端必须进入发射点前方，后方车身不会被擦边击中。
    return (point.x-shot.origin.x)*fx+(point.z-shot.origin.z)*fz+halfLength>0;
  }
}
