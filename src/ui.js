import { VEHICLES, MAX_RANK, VEHICLE_DEFENSE, UPGRADE_POINTS, NITRO, CAR_COLORS, SHELL, POLICE, RESCUE_LIMIT } from './config.js';
import { TEST_OVERRIDES } from './test-overrides.js';
import { CAUSES } from './game.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>Math.floor(v).toLocaleString('zh-CN');
const time=s=>Math.floor(s/60)+' 分 '+Math.floor(s%60)+' 秒';
export class UI {
  constructor(game){
    this.game=game;this.overlay=document.getElementById('overlay');this.toast=document.getElementById('toast');this.toastSeconds=0;this.resetConfirm=false;this.displayed={};
    this.elements=Object.fromEntries(['distance','elapsed','speed','speed-fill','nitro','nitro-state','nitro-fill','nitro-reserve-fill','defense','defense-fill','rank','progress','growth-fill','rear-alert','storage-warning','hud','test-badge'].map(id=>[id,document.getElementById(id)]));
    // URL 测试参数生效时显示角标,Agent 截图可直接确认,避免把测试结果当默认行为。
    this.elements['test-badge'].hidden=!TEST_OVERRIDES.active;
    this.elements['test-badge'].title=TEST_OVERRIDES.keys.join('\n');
    this.touchControls=document.getElementById('touch-controls');this.mobileToolbar=document.getElementById('mobile-toolbar');
    this.pauseButton=document.getElementById('pause-game');this.restartButton=document.getElementById('restart-game');
    this.pauseButton.addEventListener('click',()=>game.space());
    this.restartButton.addEventListener('click',()=>game.restart());
    this.overlay.addEventListener('click',event=>{
      const action=event.target.closest('[data-action]')?.dataset.action;
      if(action==='play')game.space();
      if(action==='quit'&&game.state==='PAUSED')game.finish('quit');
      if(action==='pick-color')game.setColor(event.target.closest('[data-color]')?.dataset.color);
      if(action==='back')game.ready();
      if(action==='quiz'&&game.state==='QUIZ')game.answerQuiz(Number(event.target.closest('[data-action]').dataset.choice));
      if(action==='reset'){this.resetConfirm=true;this.render();}
      if(action==='cancel-reset'){this.resetConfirm=false;this.render();}
      if(action==='confirm-reset'){game.store.reset();this.resetConfirm=false;this.render();}
    });
    this.overlay.addEventListener('change',event=>{
      if(event.target.dataset.action!=='debug'||game.state!=='READY')return;
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
    const g=this.game,mobile=g.input.touchMode;
    this.touchControls.hidden=!mobile||g.input.landscape||g.state!=='RUNNING';
    this.mobileToolbar.hidden=!mobile;
    this.pauseButton.hidden=!['RUNNING','PAUSED'].includes(g.state);
    this.pauseButton.textContent=g.state==='PAUSED'?'继续':'暂停';this.pauseButton.setAttribute('aria-label',g.state==='PAUSED'?'继续游戏':'暂停游戏');
    this.restartButton.disabled=g.state==='PREPARING';
    document.getElementById('nitro-label').textContent=mobile?'加速 / 氮气':'加速 / 氮气 · ↑';
    this.quizTimer=null;this.quizSeconds=null;
    const debugOption='<label class="debug-option"><input type="checkbox" data-action="debug"'+(g.debugMode?' checked':'')+'><span>调试模式 · 死亡后复活</span></label>';
    // 替换弹窗前保留游戏焦点，点击结束后仍能直接使用空格。
    if(this.overlay.contains(document.activeElement))g.input.container.focus({preventScroll:true});
    this.warning();
    if(g.state!=='RUNNING'){this.elements['rear-alert'].hidden=true;}
    this.elements['hud'].hidden=g.state==='READY'||g.state==='PREPARING';
    if(this.resetConfirm){
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="重置记录确认"><div class="eyebrow">LOCAL RECORDS</div><h2>重置本游戏记录？</h2><p class="reset-copy">将删除本游戏的本机排行榜。其他网站的记录不会受影响。</p><button class="button" data-action="confirm-reset">确认重置</button><button class="button secondary" data-action="cancel-reset">取消</button></section>';return;
    }
    if(g.state==='READY'){
      const colorButtons=CAR_COLORS.map(c=>'<button class="color-chip'+(c.id===g.carColor?' selected':'')+'" data-action="pick-color" data-color="'+c.id+'" aria-label="汽车颜色 '+c.name+'" aria-pressed="'+(c.id===g.carColor)+'" title="'+c.name+'"><i style="background:'+c.css+'"></i></button>').join('');
      this.overlay.innerHTML='<section class="card intro-card"><div class="eyebrow">FOUR SEASONS / ENDLESS ROAD</div><div class="intro-head"><h1>四季车途</h1><div class="head-pickers"><div class="color-picker"><span>汽车颜色：</span><div class="color-mini">'+colorButtons+'</div></div></div></div><blockquote class="intro-quote">从一辆自行车开始，穿过四季、高架与河谷，在分叉路口自行选择路线，跑得更远。</blockquote><p class="driving-help">'+(mobile?'左手摇杆左右横移，右手按住刹车或加速。<br>持续按住加速，达到车型最高速后自动喷气，极速时仍耗气。':'<kbd>← / →</kbd> 左右横移 <kbd>↑</kbd> 加速 <kbd>↓</kbd> 刹车 <kbd>空格</kbd> 开始 / 暂停')+'</p><button type="button" class="start-prompt" data-action="play">'+(mobile?'开始这一程':'按 <kbd>空格</kbd> 开始这一程')+'</button><div class="best"><span>最佳距离</span><strong>'+format(g.store.data.leaderboard[0]?.score||0)+' 米</strong></div>'+this.records()+(mobile?'<details class="intro-rules"><summary>玩法说明</summary>':'')+'<div class="rules"><div class="rule"><b>侧碰吞吃</b>横向重叠足够即可吞吃低级车；自行车与喷气中的其他车型可吃同级，否则同级侧碰弹开并短暂无法转向，擦角只推开。</div><div class="rule"><b>警车追击</b>警车随机出现并保持距离，每3秒在玩家车道前方2秒车程处撒网，至少40米；网越撒越大，生成即生效，碰到即被抓并弹题，数学限时'+POLICE.quizMathSeconds+'秒、语文'+POLICE.quizChineseSeconds+'秒、英语'+POLICE.quizEnglishSeconds+'秒，答对放行，答错或超时结束。提前变道或刹车躲开。</div><div class="rule"><b>观察车流</b>追尾低级车将其撞飞；自行车追尾同级结束，其他同级追尾立即降级并减速。闪电伤害削减防御，防御耗尽降一级。前'+RESCUE_LIMIT+'次致命事件可答题复活，答题失败或机会用尽后再死亡则结束。</div><div class="rule"><b>天降炮击</b>有效运行 2 分钟后天空随机投弹：红色预警圈后炸毁 '+SHELL.areaSize+'×'+SHELL.areaSize+' 米起、每 30 秒增大 20% 的区域内的一切，被直接命中立即死亡，坦克只损失 1/3 防御、卡车 1/2。看到预警圈马上离开。</div></div>'+(mobile?'</details>':'')+debugOption+'</section>';
    }else if(g.state==='PREPARING')this.overlay.innerHTML='<section class="card"><h2>道路准备中</h2><p>正在分配本局的道路与车流。</p></section>';
    else if(g.state==='PAUSED')this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="游戏已暂停"><div class="eyebrow">TAKE A BREATH</div><h2>游戏已暂停</h2><p>当前 '+format(g.player.distance)+' 米 · '+VEHICLES[g.player.rank].name+'<br>'+(mobile?'点击继续行驶；左侧摇杆横移，右侧刹车与加速 / 氮气。':'按空格继续，↓ 刹车，左右横移，↑ 持续加速到最高车速后自动喷气，极速时仍耗气，松开留气。')+'</p><button class="button" data-action="play">继续行驶</button><button class="button secondary" data-action="quit">结束游戏</button></section>';
    else if(g.state==='QUIZ'&&g.quiz){
      const question=g.quiz,seconds=Math.ceil(g.quizRemaining()),rescue=question.rescue;
      const subject={math:'数学',chinese:'语文',english:'英语'}[question.subject];
      const source=question.subject==='english'?'<div class="quiz-source">'+escape(question.bookTitle)+' · Unit '+question.unit+' · '+(question.type==='word'?'单词补全':'句子选词')+'</div>':'';
      this.overlay.innerHTML='<section class="card quiz-card" role="dialog" aria-modal="true" aria-label="'+(rescue?'答题复活':'警车拦查答题')+'"><div class="eyebrow">'+(rescue?'ONE MORE CHANCE':'POLICE CHECK')+'</div><h2>'+(rescue?'第'+g.rescueUsed+'次遇险 · 答题复活':'被警车拦下 · 答题')+'</h2><div class="quiz-timer" role="timer" aria-label="答题剩余时间"><span>'+subject+' · 剩余</span><strong>'+seconds+'</strong><span>秒</span></div>'+source+'<p class="quiz-question'+(question.subject==='english'?' quiz-english':'')+'">'+escape(question.text)+'</p><div class="quiz-options">'+question.options.map((option,index)=>'<button class="quiz-option" data-action="quiz" data-choice="'+index+'"><b>'+(index+1)+'</b>'+escape(option)+'</button>').join('')+'</div><p class="quiz-hint">'+(rescue?'答对原地复活，本局第 '+g.rescueUsed+' / '+RESCUE_LIMIT+' 次机会；答错或超时结束本局。':'答对继续行驶，答错或超时游戏结束。')+'</p></section>';
      this.quizTimer=this.overlay.querySelector('.quiz-timer strong');this.quizSeconds=seconds;
    }
    else if(g.state==='RESULT'){
      const r=g.result,total=r.eatenByType.reduce((a,b)=>a+b,0);
      const solution=r.failedQuiz?'<div class="quiz-solution"><span>本题正确答案</span><p>'+escape(r.failedQuiz)+'</p></div>':'';
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="本局结算"><div class="eyebrow">JOURNEY COMPLETE</div><h2>'+ (r.endReason==='quit'?'本局已结束':'旅程到这里')+'</h2><div class="result-score">'+format(r.score)+'<small>米 / 分</small></div><p class="fatal-mark">'+(r.endReason==='quit'?'主动结束':CAUSES[r.deathCause]||'车辆损毁')+'</p>'+solution+'<div class="result-grid"><div><span>最高车型</span><strong>'+VEHICLES[r.highestRank].name+'</strong></div><div><span>吞吃车辆</span><strong>'+total+' 辆</strong></div><div><span>行驶时间</span><strong>'+time(r.activeSeconds)+'</strong></div><div><span>起始季节</span><strong>'+r.startSeason+'</strong></div></div><button class="button" data-action="play">'+(mobile?'再来一局':'按空格 / 点击开始新一局')+'</button><button class="button secondary" data-action="back">返回首页</button>'+this.records()+'</section>';
    }else this.overlay.replaceChildren();
  }
  update(dt){
    const g=this.game;
    if(g.state==='QUIZ'&&this.quizTimer){
      const seconds=Math.ceil(g.quizRemaining());
      if(this.quizSeconds!==seconds){
        this.quizTimer.textContent=String(seconds);this.quizSeconds=seconds;
        this.quizTimer.parentElement.classList.toggle('urgent',seconds<=10);
      }
    }
    const p=g.player,e=this.elements,shown=this.displayed,distance=Math.floor(p.distance),elapsed=Math.floor(g.activeSeconds),speed=Math.round(p.speed),speedRatio=Math.min(1,p.speed/VEHICLES[p.rank].playerMax);
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
      const rear=g.traffic.approachingRear(p);
      if(e['rear-alert'].hidden!==!rear){if(rear)this.game.audio?.rear();e['rear-alert'].hidden=!rear;}
      if(rear){
        const direction=rear.sameLane?'正后方':rear.car.d<p.d?'左后方':'右后方';
        const notice=direction+'来车 · '+Math.ceil(rear.gap)+' 米';
        if(shown.rearNotice!==notice){e['rear-alert'].textContent=notice;shown.rearNotice=notice;}
      }
      this.toastSeconds-=dt;if(this.toastSeconds<=0)this.toast.hidden=true;
    }else{e['rear-alert'].hidden=true;this.toast.hidden=true;}
  }
}
