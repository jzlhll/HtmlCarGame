import { VEHICLES, MAX_RANK, LEVELS, RULES_VERSION, XP, POINT_LOSS, HUNGER, VEHICLE_DEFENSE, SEASONS, SEASON_CYCLE, PLAYER_START_SPEED, AUTO_ACCELERATION, MANUAL_ACCELERATION, NITRO, REAR_END_INVINCIBLE_SECONDS, DEBUG_REVIVE_SECONDS, RESCUE_LIMIT, REVIVE_CLEAR_AHEAD, ROAD_INFRASTRUCTURE, ROAD_DIFFICULTY, ROADBLOCKS, POLICE, laneD, clamp, lerp, approach, random } from './config.js';
import { Road } from './road.js';
import { Traffic } from './traffic.js';
import { RoadHazards, MUD_SECONDS, BUMP_SECONDS, surfaceContact } from './hazards.js';
import { sweep, roadworkContact, classify, separation, bounceTravel, advanceBounce, startBounce } from './collision.js';
import { CrossingCows } from './crossings.js';
import { Shelling } from './shell.js';
import { Nitro } from './driving.js';
import { WhiteHorseEvent } from './white-horse.js';
import { PoliceEvent } from './police.js';
import { makeQuestion, answeredQuestion } from './quiz.js';
import { SeasonalWeather } from './weather.js';
import { RoadInfrastructure } from './infrastructure.js';
import { DinosaurEvents } from './dinosaurs.js';
import { Arsenal } from './arsenal.js';
export const CAUSES={frontFatal:'撞击更高级车辆或追尾后积分耗尽',bicycleRearFatal:'自行车追尾自行车',sideFatal:'侧碰更高级车辆',wall:'撞上截止车道的墙',roadwork:'撞上施工封闭路段',roadblock:'撞上 X 路障',lightning:'被闪电击毁',shell:'被天降炮弹炸毁',cowFatal:'撞上横穿马路的奶牛',dinosaurFatal:'撞上横穿的小恐龙',stomp:'被大型恐龙踩中',hunger:'饥饿死亡',quizWrong:'答题错误',quizTimeout:'答题超时'}; // 火车仅在桥下装饰性经过,不参与碰撞判定;警车普通接触只触发答题，第二关可用火箭击毁。

const maxVehicleLength=Math.max(...VEHICLES.slice(1).map(vehicle=>vehicle.length));
const maxPlayerSpeed=Math.max(...VEHICLES.slice(1).map(vehicle=>vehicle.playerMax))*2;

function motionSnapshot(target,old,time,out){
  out.s=lerp(old.s,target.s,time);out.d=lerp(old.d,target.d,time);out.rank=target.rank;out.dimensions=target.dimensions;out.route=target.route;out.yaw=target.yaw;
  return out;
}

export class Game {
  constructor(store,input,notify){
    this.store=store;this.input=input;this.notify=notify;this.state='READY';this.carColor=store.getColor();this.deathTime=0;this.debugMode=false;this.debugSecondLevel=false;this.debugRun=false;this.debugInvincibleUntil=0;this.renderer=null;this.onChange=()=>{};this.collisionCandidates=[];this.collisionGroup=[];this.separatedCars=new Set();this.collisionBegin={};this.collisionSites=[];this.collisionWalls=[];this.collisionWorks=[];this.collisionHazards=[];this.preview();
  }
  preview(){this.renderer?.resetRun();this.seed=6183;this.whiteHorse=new WhiteHorseEvent(this.seed);this.police=new PoliceEvent(this.seed);this.quiz=null;this.failedQuiz=null;this.caught=null;this.rescueUsed=0;this.weather=new SeasonalWeather(this.seed);this.road=new Road(this.seed);this.infrastructure=new RoadInfrastructure(this.road);this.hazards=new RoadHazards(this.road);this.crossings=new CrossingCows(this.road);this.shell=new Shelling(this.seed);this.nitro=new Nitro();this.player={s:0,route:null,distance:0,d:laneD(1),rank:1,speed:PLAYER_START_SPEED,xp:XP[1],defense:VEHICLE_DEFENSE[1].max,push:0,sidePush:0,sidePushTime:0,mud:0,bump:0,yaw:0,invincibleUntil:0};this.traffic=new Traffic(this.road,this.seed);this.level=1;this.levelStartedAt=0;this.levelExit=null;this.renderPreviousPlayer=null;this.dinosaurs=null;this.arsenal=null;this.activeSeconds=0;this.nextHungerAt=HUNGER.intervalSeconds;this.startSeason=0;this.eaten=Array(MAX_RANK).fill(0);this.highestRank=1;this.scraping=false;this.debugRun=false;this.debugInvincibleUntil=0;}
  async start(level=this.debugSecondLevel?2:1){
    if(!['READY','RESULT'].includes(this.state)&&!(this.state==='LEVEL_CLEAR'&&level===2))return;
    this.audio?.ensure();
    this.debugRun=this.debugMode||this.debugSecondLevel;this.debugInvincibleUntil=0;
    this.state='PREPARING';this.onChange();
    // 让准备提示先显示，再创建本局的有限道路与车辆计划。
    await new Promise(resolve=>requestAnimationFrame(resolve));
    try{
      this.seed=crypto.getRandomValues(new Uint32Array(1))[0];this.runId=crypto.randomUUID();
      this.whiteHorse=new WhiteHorseEvent(this.seed);this.police=new PoliceEvent(this.seed);this.quiz=null;this.failedQuiz=null;this.caught=null;this.rescueUsed=0;this.weather=new SeasonalWeather(this.seed);
      this.road=new Road(this.seed);this.infrastructure=new RoadInfrastructure(this.road);this.hazards=new RoadHazards(this.road);this.crossings=new CrossingCows(this.road);this.shell=new Shelling(this.seed);this.nitro=new Nitro();this.player={s:0,route:null,distance:0,d:laneD(1),rank:1,speed:PLAYER_START_SPEED,xp:XP[1],defense:VEHICLE_DEFENSE[1].max,push:0,sidePush:0,sidePushTime:0,mud:0,bump:0,yaw:0,invincibleUntil:0};
      this.level=level;this.levelStartedAt=0;this.levelExit=null;this.renderPreviousPlayer=null;this.activeSeconds=0;
      this.dinosaurs=level===2?new DinosaurEvents(this.road,0):null;
      this.arsenal=level===2?new Arsenal(this.road):null;
      if(this.dinosaurs){this.crossings=this.dinosaurs;this.shell.nextAt=Infinity;}
      this.traffic=new Traffic(this.road,this.seed);this.traffic.level=level;this.traffic.populate(this.player);
      this.startSeason=this.seed%4;this.eaten=Array(MAX_RANK).fill(0);this.highestRank=1;
      this.nextHungerAt=HUNGER.intervalSeconds;
      this.deathTime=0;this.scraping=false;this.saved=false;this.cause=null;this.result=null;this.input.clear();
      this.renderer?.resetRun();
      await this.renderer?.prepare(this);
      this.state=document.hasFocus()&&!document.hidden?'RUNNING':'PAUSED';this.onChange();
      this.audio?.start();
    }catch(error){console.error('Game preparation failed',error);this.state='READY';this.notify('本局准备失败，请重新开始。');this.onChange();}
  }
  // 颜色在开场说明页直接切换：选择立即生效并写入本机，下次开局使用。
  setColor(id){
    if(!['READY','RESULT'].includes(this.state)||id===this.carColor||!this.store.setColor(id))return;
    this.carColor=id;this.renderer?.setCarColor(id);this.onChange();
  }
  space(){if(this.state==='READY'||this.state==='RESULT')this.start();else if(this.state==='LEVEL_CLEAR')this.enterSecondLevel();else if(this.state==='RUNNING')this.pause();else if(this.state==='PAUSED'){this.audio?.ensure();this.input.clear();this.state='RUNNING';this.onChange();}}
  get levelSeconds(){return this.activeSeconds-this.levelStartedAt;}
  get levelCountdown(){
    const remaining=LEVELS.firstSeconds-this.activeSeconds;
    return this.level===1&&remaining>0&&remaining<=LEVELS.countdownSeconds+1e-8?Math.ceil(remaining-1e-8):0;
  }
  enterSecondLevel(){return this.start(2);}
  weaponAction(key){
    if(this.state!=='RUNNING'||!this.arsenal)return;
    if(key!==1&&key!==2)return;
    this.arsenal.fire(this,key===2?'advanced':'normal');
    this.renderer?.invalidate();
  }
  beginLevelExit(){
    // 只推进驶离模型；逻辑位置、成绩和场景原点停在通关时刻。
    this.levelExit={time:0,s:this.player.s,d:this.player.d,route:this.player.route,speed:Math.max(this.player.speed,LEVELS.exitSpeed)};
    this.traffic.cars=[];this.police.police=null;this.police.nets=[];this.crossings.cows=[];
    this.whiteHorse.horse=null;this.whiteHorse.buff=null;this.infrastructure.trains=[];
    this.weather.event=null;this.weather.hazards=[];this.weather.starts=[];this.shell.shells=[];this.shell.craters=[];
    this.input.clear();this.nitro.stop();this.scraping=false;this.renderer?.resetEffects();
    this.state='LEVEL_EXIT';this.onChange();
  }
  restart(){
    if(this.state==='PREPARING')return;
    this.input.clear();this.nitro.stop();this.state='READY';this.start();
  }
  policeContact(rescue=false){
    // 警车拦查或致命救援共用题目流程；驾驶时间与音效暂停，答题按真实时间倒计时。
    // 题目随机走独立种子流(本局种子+接触时刻),不消耗各事件系统的随机序列,自动化验证可复现。
    this.caught=null;
    this.nitro.stop();this.input.clear();this.scraping=false;
    if(this.debugRun){this.passQuiz(rescue);return;}
    this.quiz=makeQuestion(random(this.seed^0x7ab91e^Math.floor(this.activeSeconds*1024)));
    this.quiz.rescue=rescue;
    this.quiz.deadline=performance.now()+1000*(this.quiz.subject==='math'?POLICE.quizMathSeconds:this.quiz.subject==='english'?POLICE.quizEnglishSeconds:POLICE.quizChineseSeconds);
    this.state='QUIZ';this.onChange();
  }
  caughtBy(net){
    // 被渔网罩住:冻结局面,播放缩小并被拉向警车的动画(catchSeconds),随后弹出答题。
    if(this.debugRun){this.policeContact();return;}
    this.nitro.stop();this.input.clear();this.scraping=false;
    const police=this.police.police;
    this.caught={t:0,police:{s:police.s,d:police.d,route:police.route??null}};
    this.audio?.netCatch();
    this.state='CAUGHT';this.onChange();
  }
  quizRemaining(){return this.quiz?Math.max(0,(this.quiz.deadline-performance.now())/1000):0;}
  answerQuiz(choice){
    if(this.state!=='QUIZ'||!this.quiz)return;
    const expired=this.quizRemaining()<=0,correct=!expired&&choice===this.quiz.answer,rescue=this.quiz.rescue;
    if(correct)this.passQuiz(rescue);
    else this.die(expired?'quizTimeout':'quizWrong');
  }
  passQuiz(rescue){
    this.quiz=null;
    this.police.dismiss(this.activeSeconds);
    if(rescue){this.revive(true);return;}
    this.state=document.hasFocus()&&!document.hidden?'RUNNING':'PAUSED';
    this.input.clear();this.onChange();
    this.notify(this.debugRun?'调试通过 · 警车撤离':'回答正确 · 警车撤离');
  }
  pause(){if(this.state!=='RUNNING')return;this.state='PAUSED';this.input.clear();this.onChange();}
  ready(){if(this.state!=='RESULT')return;this.state='READY';this.preview();this.input.clear();this.onChange();}
  season(){const {seconds,transitionSeconds}=SEASON_CYCLE,period=this.activeSeconds%seconds;return {index:(this.startSeason+Math.floor(this.activeSeconds/seconds))%SEASONS.length,blend:clamp((period-(seconds-transitionSeconds))/transitionSeconds,0,1),remaining:Math.ceil(seconds-period)};}
  normalCap(){
    // 车型正常最高速,已计入泥巴、河道谷底与天气限速,不含氮气加成。
    const p=this.player,penalty=(p.mud>0||this.road.dip(p.s)?.feature==='river')?ROAD_INFRASTRUCTURE.slowMultiplier:1;
    return Math.min(VEHICLES[p.rank].playerMax*penalty,this.weather.speedLimit(p,this.activeSeconds));
  }
  cap(){
    const p=this.player,normal=VEHICLES[p.rank].playerMax;
    const horseSpeed=this.horseSpeed(p,this.activeSeconds);
    if(horseSpeed!==null)return horseSpeed;
    // 氮气允许突破车型正常上限,但不突破泥巴、河道谷底与天气限速。
    const base=this.normalCap();
    if(base<normal)return base;
    return Math.min(this.nitro.limit(normal),this.weather.speedLimit(p,this.activeSeconds));
  }
  horseSpeed(player,now){
    const speed=this.whiteHorse.speed(player,now);
    if(speed===null)return null;
    return speed*(this.road.dip(player.s)?.feature==='river'?ROAD_INFRASTRUCTURE.slowMultiplier:1);
  }
  travel(player,now,dt){
    const active=this.whiteHorse.speed(player,now)!==null;
    const factor=active&&this.road.dip(player.s)?.feature==='river'?ROAD_INFRASTRUCTURE.slowMultiplier:1;
    let distance=this.whiteHorse.travel(player,now,dt);
    // 无敌不免除行车约束：强化与回落期间擦边刮擦仍按固定速率扣减前进距离。
    if(active&&this.scraping)distance=Math.max(0,distance-15/3.6*dt);
    return distance*factor/this.road.pathScale(player.s,player.route);
  }
  releaseNitro(dt){
    const p=this.player;
    if(this.whiteHorse.speed(p,this.activeSeconds)!==null||p.frozenUntil>this.activeSeconds){this.nitro.stop();return;}
    const held=this.input.nitro&&!this.input.down&&!this.scraping;
    // 持续按住上键时，普通加速达到车型最高速后接续喷气；达到喷气上限仍持续耗气。
    const accelerating=held&&p.speed<this.normalCap();
    const used=this.nitro.advance(dt,p.speed,held&&!accelerating);
    if(accelerating)p.speed=Math.min(this.normalCap(),p.speed+MANUAL_ACCELERATION.acceleration*dt);
    // 按实际消耗的喷气时长提速，避免反复点按叠加瞬时倍率。
    p.speed+=NITRO.boostAcceleration*used;
  }
  hitHazard(hazard){
    const p=this.player;
    this.hazards.hits.set(hazard.id,hazard.s);p.speed*=.5;
    if(hazard.kind==='mud'){this.audio?.mud();p.mud=MUD_SECONDS;p.speed=Math.min(p.speed,this.cap());}
    else{
      this.audio?.bump();p.bump=BUMP_SECONDS;
      const lanes=[];
      for(let lane=this.road.available(p.s,p.route)-1;lane>=0;lane--)lanes.push(this.road.branchCenter(p.s,p.route)+laneD(lane,-1));
      for(let lane=0;lane<this.road.available(p.s,p.route);lane++)lanes.push(this.road.branchCenter(p.s,p.route)+laneD(lane));
      let index=0;
      for(let i=1;i<lanes.length;i++)if(Math.abs(lanes[i]-p.d)<Math.abs(lanes[index]-p.d))index=i;
      const direction=index===0?1:index===lanes.length-1?-1:hazard.drift;
      const distance=Math.abs(lanes[index+direction]-p.d);
      // 递减横向冲量将车辆推向邻道，保留玩家反向纠偏与连续碰撞。
      p.push=direction*Math.sqrt(2*4.4*distance);
    }
  }
  hurtSlow(){
    const p=this.player;
    p.speed*=.5;
    p.speed=Math.min(p.speed,this.cap());
  }
  hurt(damage,cause){
    const p=this.player;
    p.defense=Math.max(0,p.defense-damage);
    this.renderer?.effect(this.player.s,this.player.d,'hit');
    if(p.defense>0){this.audio?.impact();return;}
    // 防御耗尽仅降一级，积分固定到下一级门槛；溢出伤害不传递到新车型。
    if(p.rank===1){this.die(cause);return;}
    p.xp=XP[p.rank-1];
    this.grow(cause);
  }
  eat(car){
    this.eaten[car.rank-1]++;
    // 吞吃只增加成长积分，同车型吞吃不恢复防御。
    this.player.xp=Math.min(XP[MAX_RANK],this.player.xp+XP[car.rank]);
    this.nextHungerAt=this.activeSeconds+HUNGER.intervalSeconds;
    // 吞吃即按车型回气(等级越高越多);同方向持续侧移超过阈值时奖励翻倍。
    const sideEat=this.input.lateral!==0&&this.input.lateralSeconds>NITRO.eatSideSeconds;
    this.nitro.charge((sideEat?2:1)*NITRO.eatCharge*car.rank);
    car.remove=true;this.renderer?.effect(car.s,car.d,'eat',car);
  }
  grow(cause='hunger'){
    const p=this.player,previousRank=p.rank;
    p.xp=Math.min(p.xp,XP[MAX_RANK]);
    if(p.xp<-HUNGER.bicycleDebtLimit){this.die(cause);return;}
    let rank=MAX_RANK;
    while(rank>1&&p.xp<XP[rank])rank--;
    p.rank=rank;
    if(rank!==previousRank)p.defense=VEHICLE_DEFENSE[rank].max;
    if(rank>previousRank)this.audio?.upgrade();else if(rank<previousRank)this.audio?.downgrade();
    if(rank>previousRank&&(rank===2||rank===3))this.traffic.spawnUpgrade(p);
    this.highestRank=Math.max(this.highestRank,rank);
    p.speed=Math.min(p.speed,this.cap());
    if(rank<previousRank)p.invincibleUntil=this.activeSeconds+REAR_END_INVINCIBLE_SECONDS;
  }
  deflect(group){
    for(const event of group){
      if(event.car){
        event.car.remove=true;
        this.renderer?.effect(event.car.s,event.car.d,'knockaway',event.car,event.direction);
      }
      if(event.cow){event.cow.hit=true;event.cow.hitTime=0;event.cow.launched=true;event.cow.launchSide=event.direction||1;}
      if(event.shot)event.shot.remove=true;
      if(event.weatherHazard)event.weatherHazard.hits.add('player');
      if(event.hazard)this.hazards.hits.set(event.hazard.id,event.hazard.s);
      if(event.obstacleKey){this.whiteHorse.breakObstacle(event.obstacleKey,event.obstacleS);this.renderer?.invalidate();}
      if(event.car||event.cow||event.shot||event.hazard||event.obstacleKey||event.weatherHazard){
        const target=event.car||event.cow||event.shot||event.hazard;
        this.renderer?.whiteHorseView?.hit(target?.s??this.player.s,target?.d??event.obstacleD??this.player.d,event.wall?'wall':event.roadwork||event.roadblock?'roadwork':'hit',this.activeSeconds,event.direction||1,target?(target.route??null):this.player.route);
      }
    }
  }
  hungerTick(cause='hunger'){
    this.nextHungerAt=this.activeSeconds+HUNGER.intervalSeconds;
    // 到期才读取实际车型，不在安排计时或检测候选事件时预存扣分值。
    this.player.xp-=POINT_LOSS[this.player.rank];
    this.grow(cause);
  }
  freezeTraffic(time){
    for(const car of this.traffic.cars){const old=car.previous||car;car.s=lerp(old.s,car.s,time);car.d=lerp(old.d,car.d,time);}
    for(const cow of this.crossings.cows){cow.s=lerp(cow.previous.s,cow.s,time);cow.d=lerp(cow.previous.d,cow.d,time);}
    const chaser=this.dinosaurs?.chaser;if(chaser&&chaser.previousS!==undefined){chaser.s=lerp(chaser.previousS,chaser.s,time);chaser.d=lerp(chaser.previousD,chaser.d,time);}
    const horse=this.whiteHorse.horse;if(horse)horse.s=lerp(horse.previous.s,horse.s,time);
  }
  die(cause){
    // 每局按次数提供答题救援，出题即消耗一次，答题失败不能再触发救援。
    if(cause!=='quizWrong'&&cause!=='quizTimeout'&&this.rescueUsed<RESCUE_LIMIT){
      this.rescueUsed++;this.policeContact(true);return;
    }
    if((cause==='quizWrong'||cause==='quizTimeout')&&this.quiz)this.failedQuiz=answeredQuestion(this.quiz);
    this.quiz=null;this.caught=null;this.cause=cause;this.state='DYING';this.deathTime=0;
    this.nitro.stop();this.input.clear();this.audio?.explosion();this.onChange();
  }
  revive(rescued=false){
    const p=this.player;
    // 保留死亡位置与车型，将总积分恢复到当前车型门槛，保留更高的有效积分。
    p.xp=Math.min(XP[MAX_RANK],Math.max(XP[p.rank],p.xp));p.defense=VEHICLE_DEFENSE[p.rank].max;p.push=0;p.sidePush=0;p.sidePushTime=0;p.bump=0;p.yaw=0;
    p.frozenUntil=0;
    p.speed=Math.min(Math.max(p.speed,PLAYER_START_SPEED),this.cap());
    p.invincibleUntil=this.activeSeconds+DEBUG_REVIVE_SECONDS;this.debugInvincibleUntil=p.invincibleUntil;
    this.nextHungerAt=this.activeSeconds+HUNGER.intervalSeconds;
    // 按当前路线实际行驶距离清场，副路出口后衔接主路，不清理分离的另一条路线。
    const route=p.route??null,exit=route?this.road.route(route).end:Infinity;
    let ahead=p.s,distance=REVIVE_CLEAR_AHEAD;
    while(distance>0){
      const step=Math.min(1,distance);
      ahead+=step/this.road.pathScale(ahead,ahead<exit?route:null);distance-=step;
    }
    for(const car of this.traffic.cars)
      if(car.s>=p.s&&car.s<=ahead&&(car.route??null)===(car.s<exit?route:null))car.remove=true;
    this.deathTime=0;this.cause=null;this.scraping=false;this.input.clear();this.renderer?.resetEffects();
    this.state=document.hasFocus()&&!document.hidden?'RUNNING':'PAUSED';this.onChange();
    this.notify((rescued?'回答正确 · 复活保护 ':'调试复活 · 保护 ')+DEBUG_REVIVE_SECONDS+' 秒');
  }
  finish(reason){
    if(this.saved)return;
    this.saved=true;
    this.nitro.stop();
    this.renderer?.resetEffects();
    this.result={runId:this.runId,runSeed:this.seed,startSeason:SEASONS[this.startSeason],rulesVersion:RULES_VERSION,endedAt:new Date().toISOString(),endReason:reason,deathCause:reason==='death'?this.cause:null,failedQuiz:reason==='death'?this.failedQuiz:null,distanceMeters:this.player.distance,score:Math.floor(this.player.distance),activeSeconds:this.activeSeconds,highestRank:this.highestRank,eatenByType:[...this.eaten]};
    if(!this.debugRun)this.store.record(this.result);
    this.audio?.result();
    this.state='RESULT';this.input.clear();this.onChange();
  }
  collisionStep(start,finish,dt){
    let cursor=0,iterations=0;
    const separated=this.separatedCars,candidates=this.collisionCandidates,group=this.collisionGroup;
    separated.clear();
    // 余下事件可能升级、拾取白马或提速，窗口按最高冲刺速度与路线最小比例覆盖整步。
    const padding=maxVehicleLength+4,maxTravel=Math.max(Math.abs(finish.s-start.s),maxPlayerSpeed/3.6*dt/this.road.minimumPathScale);
    const from=Math.min(start.s,finish.s)-padding,to=Math.max(start.s,finish.s)+padding+maxTravel;
    const sites=this.road.infrastructure(from,to,this.collisionSites),walls=this.road.walls(from,to-from,this.collisionWalls);
    const works=this.road.roadworks(from,to,this.collisionWorks),hazards=this.hazards.range(from,to,this.collisionHazards);
    while(cursor<1-1e-8&&iterations++<16+this.traffic.cars.length){
      candidates.length=0;
      const playerSize=VEHICLES[start.rank],fork=this.road.fork(start.s);
      const horseProtected=this.whiteHorse.shielded(this.activeSeconds);
      const protectedNow=this.activeSeconds<this.player.invincibleUntil;
      const debugProtected=this.activeSeconds<this.debugInvincibleUntil;
      for(const car of this.traffic.cars){
        if(car.remove||(protectedNow&&!horseProtected))continue;
        const old=car.previous||car;
        const beginS=lerp(old.s,car.s,cursor),targetSize=VEHICLES[car.rank];
        const reach=(Math.hypot(playerSize.length,playerSize.width)+Math.hypot(targetSize.length,targetSize.width))/2+1+(fork?.separation??0);
        if(Math.abs(beginS-start.s)>reach+Math.abs(finish.s-start.s)+Math.abs(car.s-beginS))continue;
        const begin=motionSnapshot(car,old,cursor,this.collisionBegin);
        const event=sweep(start,finish,begin,car,this.road);
        if(event&&!(separated.has(car.id)&&(event.kind==='graze'||event.kind==='overlap'))){event.car=car;candidates.push(event);}
      }
      for(const site of sites){
        if(site.kind!=='dip'||site.feature!=='river'||this.infrastructure.dipHits.has(site.id)||start.s>site.flatStart||finish.s<site.flatStart||finish.s===start.s)continue;
        candidates.push({time:(site.flatStart-start.s)/(finish.s-start.s),dip:site});
      }
      for(const weatherHazard of this.weather.hazards){
        if(horseProtected||(weatherHazard.kind==='lightning'?protectedNow:debugProtected))continue;
        const event=this.weather.contact(start,finish,weatherHazard,this.activeSeconds,dt*(1-cursor));
        if(event){event.weatherHazard=weatherHazard;candidates.push(event);}
      }
      for(const cow of this.crossings.cows){
        if(cow.hit||(protectedNow&&!horseProtected)||Math.abs(cow.s-start.s)>(VEHICLES[start.rank].length+cow.dimensions.length)/2+Math.abs(finish.s-start.s)+1)continue;
        const begin=motionSnapshot(cow,cow.previous,cursor,this.collisionBegin);
        const event=sweep(start,finish,begin,cow,this.road);
        if(event){event.cow=cow;candidates.push(event);}
      }
      if(this.dinosaurs&&!horseProtected&&!protectedNow&&!debugProtected)for(const foot of this.dinosaurs.feet){
        const event=this.dinosaurs.contact(start,finish,foot,this.activeSeconds,dt*(1-cursor));
        if(event)candidates.push(event);
      }
      const horseContact=this.whiteHorse.contact(start,finish,this.activeSeconds,dt*(1-cursor),cursor,this.road);
      if(horseContact)candidates.push(horseContact);
      // 调试无敌期间不检测警车与渔网,避免复活保护被弹题打断。
      if(!debugProtected){const policeContact=this.police.contact(start,finish,cursor,this.road);
      if(policeContact)candidates.push(policeContact);
      const netEvent=this.police.netContact(start,finish,this.activeSeconds,this.road);if(netEvent)candidates.push(netEvent);}
      if(!debugProtected)for(const wall of walls)for(const sign of [-1,1]){
        const obstacleKey='wall:'+wall.end+':'+sign;
        if(this.whiteHorse.smashed.has(obstacleKey))continue;
        const target={s:wall.end,d:sign*9.4,rank:4,direction:1,dimensions:{width:3.6,length:.7}};
        const event=sweep(start,finish,target,target,this.road);
        if(event){event.wall=true;event.obstacleKey=obstacleKey;event.obstacleS=wall.end;event.obstacleD=target.d;candidates.push(event);}
      }
      // 整段施工区域都不可穿越，车身侧面进入或从对向驶入同样检测。
      if(!debugProtected)for(const site of works){
        const obstacleKey='work:'+site.id;if(this.whiteHorse.smashed.has(obstacleKey))continue;
        const event=roadworkContact(start,finish,site);
        if(event){event.roadwork=!site.blockade;event.roadblock=!!site.blockade;event.obstacleKey=obstacleKey;event.obstacleS=site.end;event.obstacleD=site.d;candidates.push(event);}
      }
      if(!debugProtected)for(const hazard of hazards){
        if(this.hazards.hits.has(hazard.id))continue;
        const event=surfaceContact(start,finish,hazard,this.road);
        if(event){event.hazard=hazard;candidates.push(event);}
      }
      // 饥饿与接触共用最早事件时序，同一时刻吞吃可以取消到期扣分。
      const remainingTime=dt*(1-cursor),untilHunger=this.nextHungerAt-this.activeSeconds;
      if(!debugProtected&&!horseProtected&&untilHunger<=remainingTime+1e-10)candidates.push({time:clamp(untilHunger/remainingTime,0,1),hunger:true});
      const horseBoundary=this.whiteHorse.boundary(this.activeSeconds);
      if(horseBoundary!==undefined&&horseBoundary-this.activeSeconds<=remainingTime+1e-10)candidates.push({time:clamp((horseBoundary-this.activeSeconds)/remainingTime,0,1),horseBoundary});
      // 保护到期也切分连续运动，避免整步多保护或漏掉到期后的首次碰撞。
      if(protectedNow&&this.player.invincibleUntil-this.activeSeconds<=remainingTime)candidates.push({time:(this.player.invincibleUntil-this.activeSeconds)/remainingTime,immunityEnd:true});
      if(!candidates.length){this.player.s=finish.s;this.player.d=finish.d;advanceBounce(this.player,dt*(1-cursor));this.activeSeconds+=dt*(1-cursor);this.player.speed=this.horseSpeed(this.player,this.activeSeconds)??this.player.speed;return;}
      candidates.sort((a,b)=>a.time-b.time);
      const t=candidates[0].time,global=cursor+(1-cursor)*t;
      group.length=0;for(const event of candidates){if(Math.abs(event.time-t)>=1e-6)break;group.push(event);}
      this.player.s=lerp(start.s,finish.s,t);this.player.d=lerp(start.d,finish.d,t);this.activeSeconds+=dt*(global-cursor);
      advanceBounce(this.player,dt*(global-cursor));
      // 捕捞网接触:进入被抓动画;警车车身接触(兜底)直接弹题,均优先于同刻其他事件。
      // 渔网的命中标记在事件真正入选结算时才落笔,查询阶段的候选不会提前消费渔网。
      const netHit=group.find(e=>e.netCatch);
      if(netHit){netHit.net.hit=true;this.freezeTraffic(global);this.caughtBy(netHit.net);return;}
      const policeHit=group.some(e=>e.police);
      if(policeHit){this.freezeTraffic(global);this.policeContact();return;}
      if(group.some(e=>e.immunityEnd))this.activeSeconds=this.player.invincibleUntil;
      const boundary=group.find(e=>e.horseBoundary);if(boundary)this.activeSeconds=boundary.horseBoundary;
      for(const event of group)if(event.dip){this.infrastructure.dipHits.add(event.dip.id);this.player.speed*=ROAD_INFRASTRUCTURE.slowMultiplier;this.audio?.splash();}
      if(group.some(e=>e.horse)){this.whiteHorse.collect(this);this.audio?.horse();}
      const horseSpeed=this.horseSpeed(this.player,this.activeSeconds);if(horseSpeed!==null)this.player.speed=horseSpeed;
      if(this.whiteHorse.shielded(this.activeSeconds)){
        // 无敌只免伤不免则：断头路截止墙仍然致命，不撞破。
        if(group.some(e=>e.wall)){this.freezeTraffic(global);this.die('wall');return;}
        this.deflect(group);
        const remaining=dt*(1-global);
        finish.s=this.player.s+this.travel(this.player,this.activeSeconds,remaining);
        finish.d=this.player.d+this.road.branchCenter(finish.s,this.player.route)-this.road.branchCenter(this.player.s,this.player.route)+(this.weather.lateral(this.player.sidePush?0:this.input.lateral,VEHICLES[this.player.rank].lateral)+this.player.push)*remaining+bounceTravel(this.player,remaining);
        start={...this.player};cursor=global;continue;
      }
      const rank=this.player.rank;
      for(const e of group){
        if(e.dip)e.action='dip';
        else if(e.horseBoundary)e.action='horseBoundary';
        else if(e.horse)e.action='horse';
        else if(e.immunityEnd)e.action='immunityEnd';
        else if(e.hunger)e.action='hungerTick';
        else if(e.wall)e.action='wall';
        else if(e.roadwork)e.action='roadwork';
        else if(e.roadblock)e.action='roadblock';
        else if(e.hazard)e.action='hazard';
        else if(e.weatherHazard)e.action='weather';
        else if(e.foot)e.action='stomp';
        else if(e.cow)e.action=rank<=2?(e.cow.kind==='dinosaur'?'dinosaurFatal':'cowFatal'):'cowDowngrade';
        else e.action=classify(rank,e.car,e,this.nitro.boost>0);
      }
      for(const e of group)if(e.cow){e.cow.hit=true;this.renderer?.effect(e.cow.s,e.cow.d,'hit');}
      for(const e of group)if(e.foot)e.foot.hits.add('player');
      const fatal=group.find(e=>CAUSES[e.action]);
      // 闪电伤害按车型防御刻度扣减;其余同刻事件不再有远程伤害源。
      const incoming=group.reduce((sum,e)=>sum+(e.weatherHazard?.kind==='lightning'?VEHICLE_DEFENSE[rank].lightning:0),0);
      if(fatal){this.freezeTraffic(global);this.die(fatal.action);return;}
      const armorHit=group.some(e=>e.action==='armorDowngrade'),rearEnd=group.some(e=>e.action==='downgrade'),cowHit=group.some(e=>e.action==='cowDowngrade');
      const ate=group.some(e=>e.action==='eat'),fuel=this.nitro.tanks;
      for(const e of group){
        if(e.weatherHazard){
          e.weatherHazard.hits.add('player');
          if(e.weatherHazard.kind==='ice'){this.weather.freeze(this.player,this.activeSeconds);this.audio?.freeze();}
          else if(e.weatherHazard.kind==='lightning')this.audio?.thunder();
          this.renderer?.weatherView?.hit(this.player.s,this.player.d,e.weatherHazard.kind,this.activeSeconds,this.player.route);
        }
        if(e.action==='eat')this.eat(e.car);
        if(e.action==='bounce'){
          startBounce(this.player,-e.direction);startBounce(e.car,e.direction);
          // 系统车从下一逻辑步开始横移，避免改写本步已经参与连续检测的轨迹。
          e.car.merge=null;e.car.convoy=null;
        }
        if(e.action==='knockaway'||e.action==='downgrade'){
          e.car.remove=true;
          this.renderer?.effect(e.car.s,e.car.d,e.action==='knockaway'?'knockaway':'wreck',e.car,e.direction);
        }
      }
      this.audio?.collision(group);
      let contacts=0;for(const e of group)if(e.action==='downgrade'||e.action==='cowDowngrade')contacts++;
      this.player.xp-=(contacts+(armorHit?1:0))*POINT_LOSS[rank];
      if(armorHit)this.player.xp=Math.min(this.player.xp,XP[rank]-1);
      if(rearEnd){
        // 同级追尾至少降一级，不能用门槛以上的积分抵消；保留原有扣分结果。
        this.player.xp=Math.min(this.player.xp,XP[rank]-1);
        this.hurtSlow();
      }
      // 先处理本组闪电伤害；防御耗尽时固定下一级积分，吞吃不能抵消防御致命伤害。
      if(incoming)this.hurt(incoming,'lightning');
      if(this.state!=='RUNNING'){this.nitro.tanks=fuel;this.freezeTraffic(global);return;}
      const cause=cowHit?'cowFatal':rearEnd?'frontFatal':'hunger';
      this.grow(cause);
      // 先完成接触带来的换级，再按扣分发生时的实际车型处理饥饿。
      if(this.state==='RUNNING'&&group.some(e=>e.hunger)&&!ate)this.hungerTick();
      // 同刻伤害造成降级或死亡时不获得吞吃回气，积分仍按统一规则汇总。
      if(this.state!=='RUNNING'||this.player.rank<rank)this.nitro.tanks=fuel;
      if(this.state!=='RUNNING'){this.freezeTraffic(global);return;}
      for(const e of group)if(e.action==='graze'){
        const target=motionSnapshot(e.car,e.car.previous||e.car,global,this.collisionBegin);
        this.player.d+=separation(this.player,target,this.road,e.direction);
        // 当前步不重复擦角分离，但分离后的明确侧碰或中央撞击仍检测，不提供整步无敌。
        separated.add(e.car.id);
      }
      for(const e of group)if(e.hazard)this.hitHazard(e.hazard);
      if(this.state!=='RUNNING'){this.freezeTraffic(global);return;}
      // 首次接触后用更新后的等级和尺寸重新检查余下运动。
      const remaining=dt*(1-global);finish.s=this.player.s+this.travel(this.player,this.activeSeconds,remaining);
      finish.d=this.player.d+this.road.branchCenter(finish.s,this.player.route)-this.road.branchCenter(this.player.s,this.player.route)+(this.weather.lateral(this.player.sidePush?0:this.input.lateral,VEHICLES[this.player.rank].lateral)+this.player.push)*remaining+bounceTravel(this.player,remaining);
      start={...this.player};cursor=global;
    }
    this.player.s=finish.s;this.player.d=finish.d;advanceBounce(this.player,dt*(1-cursor));this.activeSeconds+=dt*(1-cursor);this.player.speed=this.horseSpeed(this.player,this.activeSeconds)??this.player.speed;
  }
  step(dt){
    if(this.state!=='RUNNING')return;
    if(this.level===1){
      const remaining=LEVELS.firstSeconds-this.activeSeconds;
      if(remaining<=1e-8){this.beginLevelExit();return;}
      dt=Math.min(dt,remaining);
    }
    this.input.advance(dt);
    if(this.level===2&&this.levelSeconds+dt>=ROAD_DIFFICULTY.afterSeconds)this.road.narrowAfter(this.player.s);
    if(this.activeSeconds+dt>=ROADBLOCKS.afterSeconds)this.road.blockadesAfter(this.player.s);
    this.infrastructure.advance(dt,this);
    this.weather.advance(this);this.whiteHorse.advance(dt,this);this.police.advance(dt,this);
    const p=this.player,start={...p};
    this.renderPreviousPlayer=start;
    p.mud=Math.max(0,p.mud-dt);p.bump=Math.max(0,p.bump-dt);
    this.releaseNitro(dt);
    const bouncing=Boolean(p.sidePush),lateral=bouncing?0:this.input.lateral;
    if(this.input.down)p.speed-=35*dt;
    else if(!this.scraping&&!(p.frozenUntil>this.activeSeconds))p.speed+=AUTO_ACCELERATION*dt;
    const horseSpeed=this.horseSpeed(p,this.activeSeconds+dt);
    p.speed=horseSpeed??clamp(p.speed,0,Math.min(this.cap(),this.weather.speedLimit(p,this.activeSeconds+dt)));
    if(this.scraping&&horseSpeed===null)p.speed=Math.max(0,p.speed-15*dt);
    const next={...p,s:p.s+this.travel(p,this.activeSeconds,dt),d:p.d+(this.weather.lateral(lateral,VEHICLES[p.rank].lateral)+p.push)*dt+bounceTravel(p,dt)};
    p.push=approach(p.push,0,4.4*dt);
    next.d+=this.road.branchCenter(next.s,p.route)-this.road.branchCenter(p.s,p.route);
    this.crossings.step(dt,p,this);
    this.traffic.step(dt,p,this.activeSeconds+dt,this.weather,this.infrastructure,this);
    const startedAt=this.activeSeconds;
    this.collisionStep(start,next,dt);
    this.traffic.resolveContacts(this.activeSeconds-startedAt,this);
    this.dinosaurs?.resolveTraffic(startedAt,this.activeSeconds-startedAt,this);
    p.distance+=Math.max(0,p.s-start.s)*this.road.pathScale((start.s+p.s)/2,start.route);
    const route=this.road.chooseRoute(p.s,p.d,p.route);
    if(route&&!p.route)this.road.enterRoute(p,route);else p.route=route;
    if(this.state!=='RUNNING')return;
    const size=VEHICLES[p.rank],footprint=(size.width*Math.abs(Math.cos(p.yaw))+size.length*Math.abs(Math.sin(p.yaw)))/2;
    const bounds=this.road.drivableBounds(p.s,p.route);
    const min=bounds.min+footprint,max=bounds.max-footprint;
    const scrape=p.d<=min+.012||p.d>=max-.012;
    if(scrape){
      p.d=clamp(p.d,min,max);
      if(this.road.segment(p.s).kind==='taper')p.d=approach(p.d,0,dt);
    }
    // 无敌期间擦边判定与普通行驶一致：夹回路面、标记刮擦减速。
    this.scraping=scrape;
    this.arsenal?.step(start,p,this);
    this.shell.advance(dt,this);
    if(this.state!=='RUNNING')return;
    if(this.level===1&&this.activeSeconds>=LEVELS.firstSeconds-1e-8){this.beginLevelExit();return;}
    for(const [id,s]of this.hazards.hits)if(s<p.s-20)this.hazards.hits.delete(id);
  }
  animate(dt){
    if(this.state==='LEVEL_EXIT'){
      if(document.hidden||!document.hasFocus())return;
      const exit=this.levelExit,used=Math.min(dt,LEVELS.exitSeconds-exit.time),previous=exit.s;
      exit.time+=used;exit.s+=exit.speed/3.6*used/this.road.pathScale(exit.s,exit.route);
      exit.d+=this.road.branchCenter(exit.s,exit.route)-this.road.branchCenter(previous,exit.route);
      if(exit.route&&exit.s>=this.road.route(exit.route).end)exit.route=null;
      if(exit.time>=LEVELS.exitSeconds){this.state='LEVEL_CLEAR';this.onChange();}
      return;
    }
    if(this.state==='QUIZ'){
      if(this.quizRemaining()<=0)this.die('quizTimeout');
      return;
    }
    if(this.state==='CAUGHT'){
      // 被抓动画计时;动画结束转入答题流程。
      this.caught.t+=dt;
      if(this.caught.t>=POLICE.catchSeconds)this.policeContact();
      return;
    }
    if(this.state!=='DYING')return;
    this.deathTime+=dt;
    if(this.deathTime>=1.2){if(this.debugRun&&this.cause!=='quizWrong'&&this.cause!=='quizTimeout')this.revive();else this.finish('death');}
  }
}
