import { SHELL, VEHICLE_DEFENSE, random, lerp } from './config.js';

// 天降炮弹:开局 startSeconds 后按随机间隔从天空投下炮弹,落点取在玩家前方并带横向抖动;
// 爆炸区域边长从 areaSize 起,炮击开始后每满 sizeGrowthSeconds 秒增大 sizeGrowthFactor 倍,弹体携带生成时的尺寸;
// 下落期间地面显示预警圈,落地炸毁弹体尺寸区域内的车流、奶牛、天气落点与路面障碍。
// 玩家被直接命中即死亡;坦克只损失 1/3 满防御、卡车损失 1/2 满防御(按整数防御刻度取整)。
export class Shelling {
  constructor(seed){this.rng=random(seed^0x1c9e4b25);this.shells=[];this.craters=[];this.nextId=1;this.nextAt=SHELL.startSeconds;this.hitPoint={};}
  advance(dt,game){
    const now=game.activeSeconds;
    if(now>=this.nextAt){
      this.spawn(game);
      this.nextAt=now+lerp(SHELL.intervalMin,SHELL.intervalMax,this.rng());
    }
    let kept=0,index=0;
    for(;index<this.shells.length;index++){
      const shell=this.shells[index];
      shell.fall-=dt;
      if(shell.fall<=0)this.impact(shell,game);
      else this.shells[kept++]=shell;
      if(game.state!=='RUNNING')break; // 命中致死即冻结本步,余下炮弹保留到下一步处理。
    }
    // 只压缩已处理前缀:已结算炮弹出列,未处理的余项原样保留,避免残留炮弹被重复结算。
    if(index<this.shells.length){
      const pending=this.shells.slice(index+1);
      this.shells.length=kept;
      this.shells.push(...pending);
    }else this.shells.length=kept;
  }
  spawn(game){
    const p=game.player,now=game.activeSeconds;
    // 爆炸尺寸随炮击持续时长成长:每满 growthSeconds 秒按 growthFactor 复利增大。
    const age=Math.max(0,now-SHELL.startSeconds);
    const size=SHELL.areaSize*Math.pow(SHELL.sizeGrowthFactor,Math.floor(age/SHELL.sizeGrowthSeconds));
    const shell={id:this.nextId++,size,s:p.s+lerp(SHELL.targetAheadMin,SHELL.targetAheadMax,this.rng()),
      d:p.d+(this.rng()*2-1)*SHELL.targetJitter,route:p.route??null,total:SHELL.fallSeconds,fall:SHELL.fallSeconds};
    this.shells.push(shell);
    game.audio?.shellWhistle(SHELL.fallSeconds);
  }
  // 各路线先转换为世界坐标，再按落点道路朝向检查方形区域；汇流处不按路线身份隔离。
  inArea(point,center,half,road){
    const p=road.at(point.s,point.d,point.route??null,this.hitPoint),dx=p.x-center.x,dz=p.z-center.z;
    const sin=Math.sin(center.heading),cos=Math.cos(center.heading);
    return Math.abs(dx*cos+dz*sin)<=half&&Math.abs(dx*sin-dz*cos)<=half*Math.cos(center.pitch);
  }
  impact(shell,game){
    const center=game.road.at(shell.s,shell.d,shell.route??null),half=shell.size/2;
    this.craters.push({id:shell.id,s:shell.s,d:shell.d,route:shell.route,size:shell.size});
    if(this.craters.length>40)this.craters.shift();
    game.audio?.shellBoom();
    game.renderer?.effect(shell.s,shell.d,'hit',{route:shell.route??null});
    // 炸毁区域内的一切:系统车、奶牛、天气落点与路面障碍(泥巴、坑洞)。
    for(const car of game.traffic.cars)if(!car.remove&&this.inArea(car,center,half,game.road)){car.remove=true;game.renderer?.effect(car.s,car.d,'wreck',car);}
    for(const cow of game.crossings.cows)if(!cow.hit&&this.inArea(cow,center,half,game.road)){cow.hit=true;game.renderer?.effect(cow.s,cow.d,'hit',{route:cow.route??null});}
    game.weather.hazards=game.weather.hazards.filter(hazard=>!this.inArea(hazard,center,half,game.road));
    const reach=shell.size/game.road.minimumPathScale;
    for(const hazard of game.hazards.range(shell.s-reach,shell.s+reach,[]))
      if(this.inArea(hazard,center,half,game.road))game.hazards.hits.set(hazard.id,hazard.s);
    // 玩家判定:白马无敌与复活保护免伤;坦克损失 1/3 满防御、卡车 1/2,其余车型直接死亡。
    const p=game.player;
    const horseProtected=game.whiteHorse.shielded(game.activeSeconds);
    const protectedNow=game.activeSeconds<p.invincibleUntil;
    const debugProtected=game.activeSeconds<game.debugInvincibleUntil;
    if(horseProtected||protectedNow||debugProtected||!this.inArea(p,center,half,game.road))return;
    if(p.rank===5)game.hurt(Math.max(1,Math.round(VEHICLE_DEFENSE[5].max*SHELL.tankDamageFraction)),'shell');
    else if(p.rank===4)game.hurt(Math.max(1,Math.round(VEHICLE_DEFENSE[4].max*SHELL.truckDamageFraction)),'shell');
    else game.die('shell');
  }
}
