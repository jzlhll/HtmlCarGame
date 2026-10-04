import { VEHICLES, UPGRADE_POINTS } from './config.js';
import { CAUSES } from './game.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>Math.floor(v).toLocaleString('zh-CN');
const time=s=>Math.floor(s/60)+' 分 '+Math.floor(s%60)+' 秒';
export class UI {
  constructor(game){
    this.game=game;this.overlay=document.getElementById('overlay');this.toast=document.getElementById('toast');this.toastSeconds=0;this.resetConfirm=false;this.roadNotice=null;this.displayed={};
    this.elements=Object.fromEntries(['distance','elapsed','speed','speed-fill','rank','progress','growth-fill','road-alert','storage-warning','hud'].map(id=>[id,document.getElementById(id)]));
    this.overlay.addEventListener('click',event=>{
      const action=event.target.closest('[data-action]')?.dataset.action;
      if(action==='quit'&&game.state==='PAUSED')game.finish('quit');
      if(action==='back')game.ready();
      if(action==='reset'){this.resetConfirm=true;this.render();}
      if(action==='cancel-reset'){this.resetConfirm=false;this.render();}
      if(action==='confirm-reset'){game.store.reset();this.resetConfirm=false;this.render();}
    });
    game.onChange=()=>{this.resetConfirm=false;this.render();};this.render();
  }
  notify(message){this.toast.textContent=message;this.toast.hidden=false;this.toastSeconds=2.8;}
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
    // 替换弹窗前保留游戏焦点，点击结束后仍能直接使用空格。
    if(this.overlay.contains(document.activeElement))g.input.container.focus({preventScroll:true});
    this.warning();
    this.elements['hud'].hidden=g.state==='READY'||g.state==='PREPARING';
    if(this.resetConfirm){
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="重置记录确认"><div class="eyebrow">LOCAL RECORDS</div><h2>重置本游戏记录？</h2><p class="reset-copy">将删除本游戏的本机排行榜。其他网站的记录不会受影响。</p><button class="button" data-action="confirm-reset">确认重置</button><button class="button secondary" data-action="cancel-reset">取消</button></section>';return;
    }
    if(g.state==='READY'){
      this.overlay.innerHTML='<section class="card intro-card"><div class="eyebrow">FOUR SEASONS / ENDLESS ROAD</div><h1>四季车途</h1><p>从一辆自行车开始，沿四季变换的道路跑得更远。</p><div class="rules"><div class="rule"><b>侧碰吞吃</b>侧面接触时，车头超过对方车头或位于对方后半段，可以吞吃同级或低级车。</div><div class="rule"><b>观察车流</b>追尾同级或高级车、侧碰高级车都会结束。</div></div><div class="start-prompt">按 <kbd>空格</kbd> 开始这一程</div><div class="best"><span>最佳距离</span><strong>'+format(g.store.data.leaderboard[0]?.score||0)+' 米</strong></div>'+this.records()+'</section>';
    }else if(g.state==='PREPARING')this.overlay.innerHTML='<section class="card"><h2>道路准备中</h2><p>正在分配本局的道路与车流。</p></section>';
    else if(g.state==='PAUSED')this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="游戏已暂停"><div class="eyebrow">TAKE A BREATH</div><h2>游戏已暂停</h2><p>当前 '+format(g.player.s)+' 米 · '+VEHICLES[g.player.rank].name+'<br>按空格继续，按住 ↓ 刹车，松开后自动缓慢提速。</p><button class="button secondary" data-action="quit">结束游戏</button></section>';
    else if(g.state==='RESULT'){
      const r=g.result,total=r.eatenByType.reduce((a,b)=>a+b,0);
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="本局结算"><div class="eyebrow">JOURNEY COMPLETE</div><h2>'+ (r.endReason==='quit'?'本局已结束':'旅程到这里')+'</h2><div class="result-score">'+format(r.score)+'<small>米 / 分</small></div><p class="fatal-mark">'+(r.endReason==='quit'?'主动结束':CAUSES[r.deathCause]||'车辆损毁')+'</p><div class="result-grid"><div><span>最高车型</span><strong>'+VEHICLES[r.highestRank].name+'</strong></div><div><span>吞吃车辆</span><strong>'+total+' 辆</strong></div><div><span>行驶时间</span><strong>'+time(r.activeSeconds)+'</strong></div><div><span>起始季节</span><strong>'+r.startSeason+'</strong></div></div><p>按 <kbd>空格</kbd> 开始新一局</p><button class="button" data-action="back">返回</button>'+this.records()+'</section>';
    }else this.overlay.replaceChildren();
  }
  update(dt){
    const g=this.game,p=g.player,e=this.elements,shown=this.displayed,distance=Math.floor(p.s),elapsed=Math.floor(g.activeSeconds),speed=Math.round(p.speed),speedRatio=p.speed/VEHICLES[p.rank].playerMax;
    if(shown.distance!==distance){e.distance.textContent=format(distance);shown.distance=distance;}
    if(shown.elapsed!==elapsed){e.elapsed.textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');shown.elapsed=elapsed;}
    if(shown.speed!==speed){e.speed.textContent=String(speed);shown.speed=speed;}
    if(shown.speedRatio!==speedRatio){e['speed-fill'].style.width=(speedRatio*100)+'%';shown.speedRatio=speedRatio;}
    if(shown.rank!==p.rank){e.rank.textContent=String(p.rank).padStart(2,'0')+' / '+VEHICLES[p.rank].name;shown.rank=p.rank;}
    if(shown.growthRank!==p.rank||shown.xp!==p.xp){
      e.progress.textContent=p.rank===6?'最高等级':format(p.xp)+' / '+format(UPGRADE_POINTS[p.rank]);
      e['growth-fill'].style.width=(p.rank===6?100:p.xp/UPGRADE_POINTS[p.rank]*100)+'%';shown.growthRank=p.rank;shown.xp=p.xp;
    }
    if(g.state==='RUNNING'){
      const next=g.road.closures(p.s,450).find(c=>c.end>=p.s);
      if(next){
        e['road-alert'].textContent=next.kind==='wall'?'外侧车道截止 · '+Math.max(0,Math.ceil(next.end-p.s))+' 米后撞墙':'外侧车道逐渐收窄 · 提前向内并道';
        if(next.kind==='taper'){
          // 用累计路段位置区分每轮收窄，只提醒一次；暂停不消耗显示时间。
          if(this.roadNotice?.road!==g.road||this.roadNotice.start!==next.start)this.roadNotice={road:g.road,start:next.start,until:g.activeSeconds+3};
          e['road-alert'].hidden=g.activeSeconds>=this.roadNotice.until;
        }else e['road-alert'].hidden=false;
      }
      else{
        const rear=g.traffic.cars.find(car=>car.direction===1&&car.s<p.s&&car.speed>p.speed/3.6+.5&&p.s-car.s<Math.max(45,(car.speed-p.speed/3.6)*5));
        if(rear){e['road-alert'].textContent=rear.d<p.d?'左后方来车 · 留意并道':'右后方来车 · 留意并道';e['road-alert'].hidden=false;}
        else e['road-alert'].hidden=true;
      }
      this.toastSeconds-=dt;if(this.toastSeconds<=0)this.toast.hidden=true;
    }else{e['road-alert'].hidden=true;this.toast.hidden=true;}
  }
}
