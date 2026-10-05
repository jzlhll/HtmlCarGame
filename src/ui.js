import { VEHICLES, MAX_RANK, VEHICLE_DEFENSE, UPGRADE_POINTS, NITRO } from './config.js';
import { CAUSES } from './game.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>Math.floor(v).toLocaleString('zh-CN');
const time=s=>Math.floor(s/60)+' 分 '+Math.floor(s%60)+' 秒';
const ROAD_NOTICE_SECONDS=2.5; // 同一次缓行事件只短暂预告一次，暂停冻结计时。
export class UI {
  constructor(game){
    this.game=game;this.overlay=document.getElementById('overlay');this.toast=document.getElementById('toast');this.toastSeconds=0;this.resetConfirm=false;this.displayed={};
    this.noticeRoad=null;this.roadNotices=new Map();
    this.elements=Object.fromEntries(['distance','elapsed','speed','speed-fill','nitro','nitro-state','nitro-fill','nitro-reserve-fill','defense','defense-fill','rank','progress','growth-fill','road-alert','rear-alert','storage-warning','hud'].map(id=>[id,document.getElementById(id)]));
    this.overlay.addEventListener('click',event=>{
      const action=event.target.closest('[data-action]')?.dataset.action;
      if(action==='quit'&&game.state==='PAUSED')game.finish('quit');
      if(action==='back')game.ready();
      if(action==='reset'){this.resetConfirm=true;this.render();}
      if(action==='cancel-reset'){this.resetConfirm=false;this.render();}
      if(action==='confirm-reset'){game.store.reset();this.resetConfirm=false;this.render();}
    });
    this.overlay.addEventListener('change',event=>{
      if(event.target.dataset.action!=='debug'||!['READY','RESULT'].includes(game.state))return;
      game.debugMode=event.target.checked;
      game.input.container.focus({preventScroll:true});
    });
    game.onChange=()=>{this.resetConfirm=false;this.render();};this.render();
  }
  notify(message){this.toast.textContent=message;this.toast.hidden=false;this.toastSeconds=2.8;this.game.audio?.beep(.7);}
  warning(){
    const {store}=this.game;this.elements['storage-warning'].hidden=!store.warning;this.elements['storage-warning'].textContent=store.warning;
  }
  records(){
    const d=this.game.store.data;
    const list=d.leaderboard.length?'<ol class="record-list">'+d.leaderboard.map((r,i)=>'<li><span>'+String(i+1).padStart(2,'0')+' · '+escape(VEHICLES[r.highestRank].name)+'</span><b>'+format(r.score)+' 米</b></li>').join('')+'</ol>':'<p>完成一局后，成绩会保存在这个浏览器。</p>';
    return '<details><summary>本机排行榜</summary>'+list+'</details>'+(this.game.store.warning?'<button class="reset-button" data-action="reset">重置本游戏记录</button>':'');
  }
  render(){
    const g=this.game;
    const debugOption='<label class="debug-option"><input type="checkbox" data-action="debug"'+(g.debugMode?' checked':'')+'><span>调试模式 · 死亡后复活</span></label>';
    // 替换弹窗前保留游戏焦点，点击结束后仍能直接使用空格。
    if(this.overlay.contains(document.activeElement))g.input.container.focus({preventScroll:true});
    this.warning();
    if(g.state!=='RUNNING'){this.elements['rear-alert'].hidden=true;this.elements['road-alert'].hidden=true;}
    this.elements['hud'].hidden=g.state==='READY'||g.state==='PREPARING';
    if(this.resetConfirm){
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="重置记录确认"><div class="eyebrow">LOCAL RECORDS</div><h2>重置本游戏记录？</h2><p class="reset-copy">将删除本游戏的本机排行榜。其他网站的记录不会受影响。</p><button class="button" data-action="confirm-reset">确认重置</button><button class="button secondary" data-action="cancel-reset">取消</button></section>';return;
    }
    if(g.state==='READY'){
      this.overlay.innerHTML='<section class="card intro-card"><div class="eyebrow">FOUR SEASONS / ENDLESS ROAD</div><h1>四季车途</h1><p>从一辆自行车开始，穿过四季、高架与河谷，在分叉路口自行选择路线，跑得更远。</p><div class="rules"><div class="rule"><b>侧碰吞吃</b>横向靠近车身，重叠足够可吞吃低级车；自行车可吃同级，其他车型喷气时也可吃同级，否则同级侧碰会惯性弹开，1.5 秒内无法转向；轻微擦角只推开。</div><div class="rule"><b>观察车流</b>追尾低级车将其撞飞；自行车追尾同级结束，其他同级扣分减速。积分不足降级并短暂无敌，碰撞高级车结束。曾升坦克或运行超过 75 秒后躲避路边碉堡的火箭与塔楼的子弹；防御耗尽降一级。河道谷底速度减半，火车只从高架桥下经过。</div></div><p class="driving-help"><kbd>← / →</kbd> 左右横移，吞吃一辆车回气 '+NITRO.eatCharge+' 管，同方向持续侧移超过 '+NITRO.eatSideSeconds+' 秒时吞吃回气翻倍；低于最高车速 60% 时按住 <kbd>↑</kbd> 加速，达到后喷气，松开留气，最多存 '+NITRO.capacity+' 管，每管可喷 '+NITRO.boostSeconds+' 秒。</p>'+debugOption+'<div class="start-prompt">按 <kbd>空格</kbd> 开始这一程</div><div class="best"><span>最佳距离</span><strong>'+format(g.store.data.leaderboard[0]?.score||0)+' 米</strong></div>'+this.records()+'</section>';
    }else if(g.state==='PREPARING')this.overlay.innerHTML='<section class="card"><h2>道路准备中</h2><p>正在分配本局的道路与车流。</p></section>';
    else if(g.state==='PAUSED')this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="游戏已暂停"><div class="eyebrow">TAKE A BREATH</div><h2>游戏已暂停</h2><p>当前 '+format(g.player.distance)+' 米 · '+VEHICLES[g.player.rank].name+'<br>按空格继续，↓ 刹车，左右横移，↑ 低速加速，达到最高车速 60% 后喷气，松开留气。</p><button class="button secondary" data-action="quit">结束游戏</button></section>';
    else if(g.state==='RESULT'){
      const r=g.result,total=r.eatenByType.reduce((a,b)=>a+b,0);
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="本局结算"><div class="eyebrow">JOURNEY COMPLETE</div><h2>'+ (r.endReason==='quit'?'本局已结束':'旅程到这里')+'</h2><div class="result-score">'+format(r.score)+'<small>米 / 分</small></div><p class="fatal-mark">'+(r.endReason==='quit'?'主动结束':CAUSES[r.deathCause]||'车辆损毁')+'</p><div class="result-grid"><div><span>最高车型</span><strong>'+VEHICLES[r.highestRank].name+'</strong></div><div><span>吞吃车辆</span><strong>'+total+' 辆</strong></div><div><span>行驶时间</span><strong>'+time(r.activeSeconds)+'</strong></div><div><span>起始季节</span><strong>'+r.startSeason+'</strong></div></div>'+(g.debugRun?'<p>调试局不计入排行榜。</p>':'')+debugOption+'<p>按 <kbd>空格</kbd> 开始新一局</p><button class="button" data-action="back">返回</button>'+this.records()+'</section>';
    }else this.overlay.replaceChildren();
  }
  update(dt){
    const g=this.game,p=g.player,e=this.elements,shown=this.displayed,distance=Math.floor(p.distance),elapsed=Math.floor(g.activeSeconds),speed=Math.round(p.speed),speedRatio=Math.min(1,p.speed/VEHICLES[p.rank].playerMax);
    if(shown.distance!==distance){e.distance.textContent=format(distance);shown.distance=distance;}
    if(shown.elapsed!==elapsed){e.elapsed.textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');shown.elapsed=elapsed;}
    if(shown.speed!==speed){e.speed.textContent=String(speed);shown.speed=speed;}
    if(shown.speedRatio!==speedRatio){e['speed-fill'].style.width=(speedRatio*100)+'%';shown.speedRatio=speedRatio;}
    const defense=Math.round(Math.max(0,Math.min(1,p.defense/VEHICLE_DEFENSE[p.rank].max))*100);
    if(shown.defense!==defense){e.defense.textContent=defense+'%';e['defense-fill'].style.width=defense+'%';shown.defense=defense;}
    const nitro=g.nitro,charge=Math.floor(nitro.tanks*100),seconds=nitro.tanks*NITRO.boostSeconds;
    const phase=nitro.boost>0?'喷气 · 剩余 '+seconds.toFixed(1)+'s':nitro.recovery>0?'回落 '+nitro.recovery.toFixed(1)+'s':nitro.tanks>0?'可喷 '+seconds.toFixed(1)+'s':'吞吃车辆回气';
    if(shown.nitroTanks!==charge){e.nitro.textContent=Math.floor(nitro.tanks)+' / '+NITRO.capacity+' 管';e.nitro.setAttribute('aria-label','剩余氮气 '+nitro.tanks.toFixed(2)+' 管，最多 '+NITRO.capacity+' 管');shown.nitroTanks=charge;}
    if(shown.nitroPhase!==phase){e['nitro-state'].textContent=phase;shown.nitroPhase=phase;}
    if(shown.nitroCharge!==charge){e['nitro-fill'].style.width=Math.min(100,charge)+'%';e['nitro-reserve-fill'].style.width=Math.min(100,Math.max(0,charge-100))+'%';shown.nitroCharge=charge;}
    if(shown.rank!==p.rank){e.rank.textContent=VEHICLES[p.rank].name;shown.rank=p.rank;}
    if(shown.growthRank!==p.rank||shown.xp!==p.xp){
      const threshold=UPGRADE_POINTS[p.rank];
      e.progress.textContent=format(p.xp)+' / '+format(threshold);
      e.progress.setAttribute('aria-label','总积分 '+p.xp+'，'+(p.rank===MAX_RANK?'坦克上限':'下一车型门槛')+' '+threshold);
      e['growth-fill'].style.width=Math.min(100,Math.max(0,p.xp)/threshold*100)+'%';shown.growthRank=p.rank;shown.xp=p.xp;
    }
    if(g.state==='RUNNING'){
      if(this.noticeRoad!==g.road){this.noticeRoad=g.road;this.roadNotices.clear();}
      const notices=[];
      // 同一事件的不同车道共享提示计时，换一辆最近车或暂时离开预警范围都不重新弹出。
      const queueEvents=new Map();
      for(const car of g.traffic.cars){
        if(!car.convoy||car.remove||g.player.route)continue;
        const key='queue:'+car.convoy.id.split(':')[0];
        if(!queueEvents.has(key))queueEvents.set(key,[]);
        queueEvents.get(key).push(car);
      }
      for(const [key,cars]of queueEvents){
        const queues=cars.filter(car=>car.s>p.s&&car.s<p.s+240);
        if(!queues.length)continue;
        const nearest=queues.reduce((a,b)=>a.s<b.s?a:b),lanes=new Set(queues.map(car=>car.lane));
        notices.push({key,distance:nearest.s-p.s,text:'前方 '+lanes.size+' 个车道排队缓行 · '+Math.round(nearest.desired*3.6)+' km/h · '+Math.ceil(nearest.s-p.s)+' 米'});
      }
      // 缓行记录保留到整个事件回收，避免移动车队触发重复提示。
      for(const key of this.roadNotices.keys())if(!queueEvents.has(key))this.roadNotices.delete(key);
      notices.sort((a,b)=>a.distance-b.distance);
      const notice=notices.find(item=>!this.roadNotices.has(item.key)||g.activeSeconds<this.roadNotices.get(item.key).until);
      if(notice&&!this.roadNotices.has(notice.key)){this.roadNotices.set(notice.key,{until:g.activeSeconds+ROAD_NOTICE_SECONDS});this.game.audio?.beep(.85);}
      if(e['road-alert'].hidden!==!notice)e['road-alert'].hidden=!notice;
      if(notice&&shown.roadNotice!==notice.text){e['road-alert'].textContent=notice.text;shown.roadNotice=notice.text;}
      const rear=g.traffic.approachingRear(p);
      if(e['rear-alert'].hidden!==!rear){if(rear)this.game.audio?.rear();e['rear-alert'].hidden=!rear;}
      if(rear){
        const direction=rear.sameLane?'正后方':rear.car.d<p.d?'左后方':'右后方';
        const notice=direction+'来车 · '+Math.ceil(rear.gap)+' 米';
        if(shown.rearNotice!==notice){e['rear-alert'].textContent=notice;shown.rearNotice=notice;}
      }
      this.toastSeconds-=dt;if(this.toastSeconds<=0)this.toast.hidden=true;
    }else{e['road-alert'].hidden=true;e['rear-alert'].hidden=true;this.toast.hidden=true;}
  }
}
