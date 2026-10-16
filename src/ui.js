import { LEVELS, ROCKETS, COINS, DINOSAURS, VEHICLES, MAX_RANK, VEHICLE_DEFENSE, UPGRADE_POINTS, NITRO, CAR_COLORS, RESCUE_LIMIT } from './config.js';
import { TEST_OVERRIDES } from './test-overrides.js';
import { CAUSES } from './game.js';
import { coinIcon } from './arsenal-icons.js';
import { mathText } from './math-display.js';
import { mathHelp } from './quiz-help.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>Math.floor(v).toLocaleString('zh-CN');
const time=s=>Math.floor(s/60)+' 分 '+Math.floor(s%60)+' 秒';
export class UI {
  constructor(game){
    this.game=game;this.overlay=document.getElementById('overlay');this.toast=document.getElementById('toast');this.toastSeconds=0;this.resetConfirm=false;this.displayed={};
    this.elements=Object.fromEntries(['distance','elapsed','speed','speed-fill','nitro','nitro-state','nitro-fill','nitro-reserve-fill','defense','defense-fill','rank','progress','growth-fill','rear-alert','storage-warning','hud','level-countdown','test-badge','arsenal-hud','coin-count','buy-rocket','dinosaur-defense','dinosaur-defense-value'].map(id=>[id,document.getElementById(id)]));
    document.getElementById('coin-icon').innerHTML=coinIcon;
    this.elements['buy-rocket'].addEventListener('click',()=>game.weaponAction(1));
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
      if(action==='quiz-help')game.openQuizHelp();
      if(action==='quiz-help-close'){game.closeQuizHelp();this.overlay.querySelector('.quiz-help-button')?.focus({preventScroll:true});}
      if(action==='reset'){this.resetConfirm=true;this.render();}
      if(action==='cancel-reset'){this.resetConfirm=false;this.render();}
      if(action==='confirm-reset'){game.store.reset();this.resetConfirm=false;this.render();}
    });
    this.overlay.addEventListener('change',event=>{
      const action=event.target.dataset.action;
      if(game.state!=='READY'||!['debug','debug-second-level','debug-third-level'].includes(action))return;
      if(action==='debug')game.debugMode=event.target.checked;
      else if(action==='debug-second-level'){game.debugSecondLevel=event.target.checked;if(event.target.checked)game.debugThirdLevel=false;}
      else{game.debugThirdLevel=event.target.checked;if(event.target.checked)game.debugSecondLevel=false;}
      this.render();
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
    for(const [id,compact,full] of [['distance-label','距离','行驶距离'],['elapsed-label','时间','运行时间'],['defense-label','防御','防御力'],['nitro-label','氮气','加速 / 氮气 · ↑']])document.getElementById(id).textContent=mobile?compact:full;
    const rocketButton=this.elements['buy-rocket'],cost=ROCKETS.normalCost;
    rocketButton.textContent=mobile?'普通炮 · '+cost:'1 · 普通炮 '+cost+' 金币';
    const description='消耗 '+cost+' 金币发射普通炮，清理前方 '+ROCKETS.range+' 米自身及左右相邻车道';
    rocketButton.setAttribute('aria-label',description);rocketButton.title=description;
    g.input.container.classList.toggle('level-two',g.level===2);
    this.elements['arsenal-hud'].hidden=g.level!==2||['READY','PREPARING','RESULT'].includes(g.state);
    this.quizTimer=null;this.quizSeconds=null;
    const debugOption='<label class="debug-option"><input type="checkbox" data-action="debug"'+(g.debugMode?' checked':'')+'><span>调试模式 · 死亡后复活</span></label><label class="debug-option"><input type="checkbox" data-action="debug-second-level"'+(g.debugSecondLevel?' checked':'')+'><span>调试 · 直接进入第二关</span></label><label class="debug-option"><input type="checkbox" data-action="debug-third-level"'+(g.debugThirdLevel?' checked':'')+'><span>调试 · 直接进入第三关</span></label>';
    // 替换弹窗前保留游戏焦点，点击结束后仍能直接使用空格。
    if(this.overlay.contains(document.activeElement))g.input.container.focus({preventScroll:true});
    this.warning();
    if(g.state!=='RUNNING'){this.elements['rear-alert'].hidden=true;}
    this.elements['hud'].hidden=['READY','PREPARING','LEVEL_EXIT','LEVEL_CLEAR'].includes(g.state);
    this.elements['level-countdown'].hidden=g.state!=='RUNNING'||!g.levelCountdown;
    if(this.resetConfirm){
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="重置记录确认"><div class="eyebrow">LOCAL RECORDS</div><h2>重置本游戏记录？</h2><p class="reset-copy">将删除本游戏的本机排行榜。其他网站的记录不会受影响。</p><button class="button" data-action="confirm-reset">确认重置</button><button class="button secondary" data-action="cancel-reset">取消</button></section>';return;
    }
    if(g.state==='READY'){
      const colorButtons=CAR_COLORS.map(c=>'<button class="color-chip'+(c.id===g.carColor?' selected':'')+'" data-action="pick-color" data-color="'+c.id+'" aria-label="汽车颜色 '+c.name+'" aria-pressed="'+(c.id===g.carColor)+'" title="'+c.name+'"><i style="background:'+c.css+'"></i></button>').join('');
      this.overlay.innerHTML='<section class="card intro-card"><div class="eyebrow">FOUR SEASONS / ENDLESS ROAD</div><div class="intro-head"><h1>四季车途</h1><div class="head-pickers"><div class="color-picker"><span>汽车颜色：</span><div class="color-mini">'+colorButtons+'</div></div></div></div><blockquote class="intro-quote">从一辆自行车开始，生存满'+time(LEVELS.firstSeconds)+'进入第二关，再坚持'+time(LEVELS.secondSeconds)+'进入第三关，最后坚持'+time(LEVELS.thirdSeconds)+'即可全部通关。</blockquote><p class="driving-help">'+(mobile?'左手摇杆左右横移，右手按住刹车或加速。<br>持续按住加速，达到车型最高速后自动喷气，极速时仍耗气。':'<kbd>← / →</kbd> 左右横移 <kbd>↑</kbd> 加速 <kbd>↓</kbd> 刹车 <kbd>空格</kbd> 开始 / 暂停')+'</p><button type="button" class="start-prompt" data-action="play">'+(mobile?'开始这一程':'按 <kbd>空格</kbd> 开始这一程')+'</button><div class="best"><span>最佳距离</span><strong>'+format(g.store.data.leaderboard[0]?.score||0)+' 米</strong></div>'+this.records()+(mobile?'<details class="intro-rules"><summary>玩法说明</summary>':'')+'<div class="rules"><div class="rule"><b>侧碰吞吃</b>侧碰低级或同级车可以吞吃升级；侧碰高级车会失控旋转。</div><div class="rule"><b>警车追击</b>警车会隔一会儿撒网捕捉，捉到后要答题，答对继续。</div><div class="rule"><b>观察车流</b>避开高级车，小心追尾；遇险时有答题复活的机会。</div><div class="rule"><b>天降炮击</b>看到红色预警圈及时躲开，第二关要小心大恐龙踩踏。</div></div>'+(mobile?'</details>':'')+debugOption+'</section>';
    }else if(g.state==='PREPARING')this.overlay.innerHTML='<div class="loading-status" role="status" aria-live="polite"><span class="loading-spinner" aria-hidden="true"></span><span>loading...</span></div>';
    else if(g.state==='LEVEL_CLEAR'&&g.level===2){
      const cards=[['火山 · 岩浆路','每十秒三连喷发，躲开前方岩浆；自行车碰到死亡，其他车降级。'],['海水 · 浮桥','每十秒海啸横扫，扣除 60% 满防御并失控旋转；自行车碰到死亡。'],['冰山 · 冰块路','崩塌覆盖区连续横移超过 0.8 秒会打滑旋转；撞上车道冰山直接死亡。']];
      this.overlay.innerHTML='<section class="card level-guide" role="dialog" aria-modal="true" aria-label="第二关通关"><div class="eyebrow">LEVEL COMPLETE / NEXT LEVEL</div><h2>恭喜！通过第二关。</h2><div class="level-guide-grid">'+cards.map(([title,copy])=>'<article><h3>'+title+'</h3><p>'+copy+'</p></article>').join('')+'</div><p class="level-guide-hint">第三关从零开始 · 六分钟通关 · 三分钟后四车道<br>火山 → 海水 → 冰山，每分钟轮换 · 空格进入第三关</p><button class="button" data-action="play">进入第三关</button></section>';
    }
    else if(g.state==='LEVEL_CLEAR'){
      const images=g.renderer?.guideImages()??[],cards=[['大型恐龙踩踏','恐龙左右跳跃踩向你，及时横移躲开。'],['装甲坦克','装甲坦克不能碰，请绕开行驶。'],['金币与火箭炮','小金币 '+COINS.smallValue+'、大金币 '+COINS.largeValue+'；按 1 消耗 '+ROCKETS.normalCost+' 金币清理自身及左右相邻车道，射程 '+ROCKETS.range+' 米。']];
      this.overlay.innerHTML='<section class="card level-guide" role="dialog" aria-modal="true" aria-label="第一关通关"><div class="eyebrow">LEVEL COMPLETE / NEXT LEVEL</div><h2>恭喜！通过第一关。</h2><div class="level-guide-grid">'+cards.map(([title,copy],i)=>'<article><img src="'+(images[i]??'')+'" alt="'+title+'模型"><h3>'+title+'</h3><p>'+copy+'</p></article>').join('')+'</div><p class="level-guide-hint">第二关从零开始 · 空格进入第二关</p><button class="button" data-action="play">进入第二关</button></section>';
    }
    else if(g.state==='PAUSED')this.overlay.innerHTML='<section class="card pause-card" role="dialog" aria-modal="true" aria-label="游戏已暂停"><div class="eyebrow">TAKE A BREATH</div><h2>游戏已暂停</h2><p>当前 '+format(g.player.distance)+' 米 · '+VEHICLES[g.player.rank].name+'<br>'+(mobile?'点击继续行驶；左侧摇杆横移，右侧刹车与加速 / 氮气。':'按空格继续，↓ 刹车，左右横移，↑ 持续加速到最高车速后自动喷气，极速时仍耗气，松开留气。')+'</p><button class="button" data-action="play">继续行驶</button><button class="button secondary" data-action="quit">结束游戏</button></section>';
    else if(g.state==='QUIZ'&&g.quiz){
      const question=g.quiz,seconds=Math.ceil(g.quizRemaining()),rescue=question.rescue;
      const help=question.subject==='math'?mathHelp(question.helpTopic):null;
      if(help&&question.helpRemaining!==undefined){
        this.overlay.innerHTML='<article class="card math-help-card" role="dialog" aria-modal="true" aria-label="数学学习帮助"><div class="help-paused">计时已暂停 · 剩余 '+seconds+' 秒</div><h2>'+escape(help.title)+'</h2><p class="help-current">这道题：'+mathText(question.text)+'</p><div class="math-help-body">'+help.html+'</div><footer class="help-footer"><button class="button" data-action="quiz-help-close">返回答题 · 继续计时</button></footer></article>';
        this.overlay.querySelector('[data-action="quiz-help-close"]').focus({preventScroll:true});return;
      }
      const subject={math:'数学',chinese:'语文',english:'英语'}[question.subject];
      const source=question.subject==='english'?'<div class="quiz-source">'+escape(question.bookTitle)+' · Unit '+question.unit+' · '+(question.type==='word'?'单词补全':'句子选词')+'</div>':question.poemSource?'<div class="quiz-source quiz-poem-source">'+escape(question.poemSource)+'</div>':'';
      this.overlay.innerHTML='<section class="card quiz-card" role="dialog" aria-modal="true" aria-label="'+(rescue?'答题复活':'警车拦查答题')+'"><div class="eyebrow">'+(rescue?'ONE MORE CHANCE':'POLICE CHECK')+'</div><h2>'+(rescue?'第'+g.rescueUsed+'次遇险 · 答题复活':'被警车拦下 · 答题')+'</h2><div class="quiz-timer" role="timer" aria-label="答题剩余时间"><span>'+subject+' · 剩余</span><strong>'+seconds+'</strong><span>秒</span></div>'+source+'<p class="quiz-question'+(question.subject==='english'?' quiz-english':question.poemSource?' quiz-poem':'')+'">'+(question.subject==='math'?mathText(question.text):escape(question.text))+'</p><div class="quiz-options">'+question.options.map((option,index)=>'<button class="quiz-option" data-action="quiz" data-choice="'+index+'"><b>'+(index+1)+'</b>'+(question.subject==='math'?mathText(option):escape(option))+'</button>').join('')+'</div><p class="quiz-hint">'+(rescue?'答对原地复活，本局第 '+g.rescueUsed+' / '+RESCUE_LIMIT+' 次机会；答错或超时结束本局。':'答对继续行驶，答错或超时游戏结束。')+'</p></section>';
      this.quizTimer=this.overlay.querySelector('.quiz-timer strong');this.quizSeconds=seconds;
      if(help){
        const button=document.createElement('button');button.type='button';button.className='quiz-help-button';button.dataset.action='quiz-help';button.innerHTML='<span aria-hidden="true">?</span> 学习帮助 <small>打开后暂停计时</small>';
        this.overlay.querySelector('.quiz-question').after(button);
      }
    }
    else if(g.state==='RESULT'){
      const r=g.result,total=r.eatenByType.reduce((a,b)=>a+b,0),completed=r.endReason==='complete';
      const solution=r.failedQuiz?'<div class="quiz-solution"><span>本题正确答案</span><p>'+mathText(r.failedQuiz)+'</p></div>':'';
      this.overlay.innerHTML='<section class="card" role="dialog" aria-modal="true" aria-label="'+(completed?'全部通关':'本局结算')+'"><div class="eyebrow">JOURNEY COMPLETE</div><h2>'+ (completed?'恭喜！全部通关。':r.endReason==='quit'?'本局已结束':'旅程到这里')+'</h2><div class="result-score">'+format(r.score)+'<small>米 / 分</small></div><p class="'+(completed?'':'fatal-mark')+'">'+(completed?'第三关已完成，本次旅程圆满结束。':r.endReason==='quit'?'主动结束':CAUSES[r.deathCause]||'车辆损毁')+'</p>'+solution+'<div class="result-grid"><div><span>最高车型</span><strong>'+VEHICLES[r.highestRank].name+'</strong></div><div><span>吞吃车辆</span><strong>'+total+' 辆</strong></div><div><span>行驶时间</span><strong>'+time(r.activeSeconds)+'</strong></div><div><span>'+(g.level===3?'起始环境':'起始季节')+'</span><strong>'+r.startSeason+'</strong></div></div><button class="button" data-action="play">'+(mobile?'再来一局':'按空格 / 点击开始新一局')+'</button><button class="button secondary" data-action="back">返回首页</button>'+this.records()+'</section>';
    }else this.overlay.replaceChildren();
  }
  update(dt){
    const g=this.game,countdown=g.levelCountdown;
    this.elements['level-countdown'].hidden=g.state!=='RUNNING'||!countdown;
    if(this.displayed.countdown!==countdown){this.elements['level-countdown'].textContent='即将过关 · '+countdown+' 秒';this.displayed.countdown=countdown;}
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
    const chaser=g.dinosaurs?.chaser,dinosaurDefense=chaser?Math.round(chaser.defense/DINOSAURS.defense*1000)/10:null;
    if(shown.dinosaurDefense!==dinosaurDefense){
      e['dinosaur-defense'].hidden=dinosaurDefense===null;e['dinosaur-defense-value'].textContent=dinosaurDefense===null?'':dinosaurDefense+'%';shown.dinosaurDefense=dinosaurDefense;
    }
    if(g.arsenal){
      const inventory=g.arsenal,blocked=g.state!=='RUNNING'||Boolean(g.player.spin),full=inventory.shots.length>=ROCKETS.capacity;
      if(shown['coin-count']!==inventory.balance||shown.arsenalBlocked!==blocked||shown.arsenalFull!==full){
        if(shown['coin-count']!==inventory.balance){e['coin-count'].textContent='× '+format(inventory.balance);shown['coin-count']=inventory.balance;}
        e['buy-rocket'].disabled=blocked||full||inventory.balance<ROCKETS.normalCost;
        shown.arsenalBlocked=blocked;shown.arsenalFull=full;
      }
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
