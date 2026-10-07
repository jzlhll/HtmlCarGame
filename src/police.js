import { POLICE, VEHICLES, laneD, clamp, lerp, approach, random } from './config.js';
import { sweep } from './collision.js';

// 无敌警车随机出现拦查:车速完全自由,始终与玩家保持前方距离窗口(屏幕内、相距不太远)——
// 太远减速等待、太近加速拉开,不拦截玩家也不会被玩家追尾;横向上以极快速度避让车流。
// 进入撒网范围后按固定间隔向玩家预判位置(保持当前车速将到达的地点)发射渔网,
// 网边长与落下时间随警车持续时长按增长常量逐渐增大;渔网落地后接触即被抓,
// 由游戏层播放缩小并拉向警车的动画,再弹出答题。渔网与警车均不可被吃,不受白马无敌影响。
export class PoliceEvent {
  constructor(seed){
    this.rng=random(seed^0x5f3c92);this.nextId=1;this.netSeq=1;
    this.police=null;this.nets=[];
    this.nextAt=this.nextWindow(0);
  }
  nextWindow(now){return now+POLICE.intervalMin+this.rng()*(POLICE.intervalMax-POLICE.intervalMin);}
  dismiss(now){
    this.police=null;this.nets=[];
    this.nextAt=this.nextWindow(now);
  }
  spawn(game){
    const p=game.player,road=game.road,now=game.activeSeconds;
    const s=p.s+POLICE.spawnAheadMin+this.rng()*(POLICE.spawnAheadMax-POLICE.spawnAheadMin);
    // 截止墙与封闭段附近不生成;暂无可用车道时稍后重试。
    if(road.closures(s-40,80).length){this.nextAt=now+5;return;}
    const lanes=road.available(s);
    if(!lanes){this.nextAt=now+5;return;}
    const lane=Math.floor(this.rng()*lanes),d=road.branchCenter(s)+laneD(lane);
    this.police={id:'police:'+this.nextId++,s,d,route:null,speed:p.speed*POLICE.closeRatio,previous:{s,d},chase:0,nextNet:0,
      dimensions:{length:VEHICLES[3].length,width:VEHICLES[3].width}};
  }
  advance(dt,game){
    const now=game.activeSeconds,p=game.player,road=game.road;
    // 渔网按寿命清理:落地后存活 netKeep 秒,期间能抓人。
    this.nets=this.nets.filter(net=>now-net.born<net.fall+POLICE.netKeep);
    if(!this.police){
      if(now>=this.nextAt)this.spawn(game);
      if(!this.police)return;
    }
    const police=this.police;
    police.chase+=dt;
    // 警车持续时长达到上限后自动撤离。
    if(police.chase>=POLICE.maxChaseSeconds){this.dismiss(now);return;}
    police.previous={s:police.s,d:police.d};
    // 速度自由:目标速度只由与玩家的距离决定——太近加速拉开,太远减速等待,
    // 窗口内按 keepGain 比例控制收敛到窗口中点(始终在撒网范围附近游走)。
    const gap=police.s-p.s; // 警车在玩家前方为正。
    const holdGap=(POLICE.keepMin+POLICE.keepMax)/2;
    let target=p.speed+clamp((holdGap-gap)*POLICE.keepGain,-14,14);
    if(gap<POLICE.keepMin)target=p.speed*POLICE.chaseRatio;
    else if(gap>POLICE.keepMax)target=p.speed*POLICE.closeRatio;
    police.speed=approach(police.speed,target,50*dt);
    const scale=road.pathScale(police.s,null);
    police.s+=police.speed/3.6*dt/scale;
    this.dodge(dt,game);
    // 进入撒网范围:按当前持续时长计算网尺寸与落下时间(逐渐升级),向玩家预判位置发射。
    if(gap<=POLICE.netRange&&now>=police.nextNet){
      police.nextNet=now+POLICE.netInterval;
      const size=Math.min(POLICE.netSizeBase+POLICE.netSizeGrowth*police.chase,POLICE.netSizeMax);
      const fall=Math.min(POLICE.netFallBase+POLICE.netFallGrowth*police.chase,POLICE.netFallMax);
      let s=p.s,route=p.route??null,distance=p.speed/3.6*fall;
      // 沿当前路线预判实际行驶距离，出口后续接主路，保持相对车道的横向偏移。
      while(distance>0){
        const step=Math.min(1,distance);
        s+=step/road.pathScale(s,route);distance-=step;
        if(route&&s>=road.route(route).end)route=null;
      }
      const d=p.d-road.branchCenter(p.s,p.route)+road.branchCenter(s,route);
      this.nets.push({id:'net'+this.netSeq++,s,d,size,fall,born:now,route,dimensions:{width:size,length:size}});
      game.audio?.netThrow();
    }
  }
  // 极快避让车流:在前方观察距离内给每条车道评分(阻挡越近罚分越重),
  // 选出最优车道后以 dodgeSpeed 的横向速度猛变过去,始终留在可行驶范围内。
  dodge(dt,game){
    const police=this.police,road=game.road;
    const lanes=road.available(police.s),base=road.branchCenter(police.s);
    let best=police.d,bestScore=-Infinity;
    for(let i=0;i<lanes;i++){
      const center=base+laneD(i);
      let score=12-Math.abs(center-police.d); // 轻微偏好当前车道,避免无谓变道。
      for(const car of game.traffic.cars){
        if(car.remove)continue;
        const ahead=car.s-police.s;
        if(ahead<-2||ahead>POLICE.dodgeLookahead)continue;
        // 车流对象不保证携带 dimensions,按车型查表取宽度。
        if(Math.abs(car.d-center)<(VEHICLES[car.rank].width+police.dimensions.width)/2+.9)score-=ahead<7?30:13;
      }
      if(score>bestScore){bestScore=score;best=center;}
    }
    const bounds=road.drivableBounds(police.s),step=POLICE.dodgeSpeed*dt;
    police.d=clamp(police.d+clamp(best-police.d,-step,step),bounds.min+.4,bounds.max-.4);
  }
  // 兜底接触:玩家与警车车身相撞(几乎不会发生,警车会自行拉开),按答题流程处理。
  contact(start,finish,cursor,road){
    const police=this.police;if(!police)return null;
    const previous=police.previous||police;
    const begin={...police,s:lerp(previous.s,police.s,cursor),d:lerp(previous.d,police.d,cursor)};
    const event=sweep(start,finish,begin,police,road);
    return event?{...event,police:true}:null;
  }
  // 落地渔网按世界坐标连续扫掠，返回所有网中最早的接触时刻；
  // 只判定已落地、未过期的渔网;查询阶段不写状态,命中标记由游戏层在事件结算时落笔,
  // 避免同一时间步内网事件晚于其它事件时被提前标记而静默失效。
  netContact(start,finish,now,road){
    let earliest=null;
    for(const net of this.nets){
      const age=now-net.born;
      if(age<net.fall||age>=net.fall+POLICE.netKeep||net.hit)continue;
      const event=sweep(start,finish,net,net,road);
      if(event&&(!earliest||event.time<earliest.time))earliest={...event,net,netCatch:true};
    }
    return earliest;
  }
}
