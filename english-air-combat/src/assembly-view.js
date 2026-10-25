import { ASSEMBLY } from './config.js';
import { splitWord } from './assembly.js';
import { AssemblyFlight } from './assembly-flight.js';
import { flightSprite,salvageSprite } from './assembly-art.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=seconds=>{const value=Math.ceil(seconds);return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');};

// 四轮节点在开局时一起准备，换轮只切换已有题面，选择和连线复用节点。
export class AssemblyView {
  constructor(root,game,onChange,onNotice){
    Object.assign(this,{root,game,onChange,onNotice});this.flight=new AssemblyFlight(this);
    root.addEventListener('click',event=>{
      if(game.state!=='playing')return;const button=event.target.closest('button[data-puzzle]');if(!button)return;
      const round=game.assembly;if(!round)return;
      if(button.dataset.puzzle==='submit'){
        if(round.stage===2)this.flight.launch();
        const result=game.submitAssembly();if(result)this.onNotice(result.advanced?(round.done?'四轮已完成':'第 '+result.round+' 轮结束，开始第 '+(round.roundIndex+1)+' 轮'+(round.stage===1?'碎片拼接':'护航编队')+'！'):'本次答对 '+result.correct+' 个，错误项已释放，请重新选择');
      }else if(button.dataset.puzzle==='clear')round.clear();
      else if(button.dataset.puzzle==='fragment'&&!round.pending)this.onNotice('先点击中文释义，再按顺序点击碎片');
      else round[button.dataset.puzzle](button.dataset.id);
      this.onChange();
    });
    root.addEventListener('scroll',()=>{this.drawLines();},true);
    this.observer=new ResizeObserver(()=>{this.layoutFragments();this.layoutMeteors();this.drawLines();this.updateLaunch();});this.observer.observe(root);
  }
  prepare(round){
    this.observer.disconnect();this.observer.observe(this.root);
    this.round=round;this.lastVersion=-1;this.lastSecond=-1;this.lastRoundIndex=-1;this.routes=new Map();
    const panels=round.rounds.map((content,index)=>{
      const meanings=content.meanings.map((entry,channel)=>'<button class="meaning-chip radio-channel" data-puzzle="meaning" data-id="'+escape(entry.id)+'"><span class="radio-number" aria-hidden="true">'+String(channel+1).padStart(2,'0')+'</span><span class="meaning-text">'+escape(entry.meaning)+'</span><span class="assembly-answer" lang="en"></span><span class="radio-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button>');
      return '<section class="assembly-round" data-round-index="'+index+'" hidden><div class="assembly-board radio-board"><div class="radio-scroll" role="group" aria-label="释义频道，可独立滚动"><div class="radio-channels">'+meanings.join('')+'</div></div><div class="radio-tray"><div class="radio-belt"><span>待接收 · 字母信号</span><small>逐片点选 · 可撤回</small></div><div class="fragment-field">'+content.fragments.map((item,part)=>'<button class="metal-fragment shape-'+part%4+'" data-puzzle="fragment" data-id="'+escape(item.id)+'">'+salvageSprite(part)+'<span class="fragment-label" lang="en">'+escape(item.text)+'</span></button>').join('')+'</div></div></div><div class="meteor-scroll" hidden><div class="meteor-field"><svg class="meteor-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+content.entries.map(()=>'<path hidden/>').join('')+'</svg>'+content.meteors.map((item)=>'<button class="meteor" data-side="'+item.side+'" data-puzzle="meteor" data-id="'+escape(item.id)+'" title="'+escape(item.text)+'" aria-label="'+escape(item.text)+'">'+flightSprite(item.side==='en'?'fighter':'beacon')+'<span class="meteor-label"'+(item.side==='en'?' lang="en"':'')+'>'+(item.side==='en'?splitWord(item.text).map(escape).join('<wbr>'):escape(item.text))+'</span></button>').join('')+'</div></div></section>';
    });
    this.root.innerHTML='<header class="assembly-heading"><div><span class="eyebrow">星际联队 · 拼接与护航</span><h2 id="assembly-title"></h2></div><div class="assembly-clock"><strong role="timer" id="assembly-timer"></strong><span id="assembly-checks"></span></div></header><p id="assembly-help" class="assembly-help"></p>'+panels.join('')+'<footer class="assembly-footer"><div><span id="assembly-selection" aria-live="polite"></span><button class="text-button" data-puzzle="clear">清空选择</button></div><button class="primary-button" data-puzzle="submit" id="assembly-submit">提交验证</button></footer>';
    this.flight.prepare();
    for(const board of this.root.querySelectorAll('.radio-board'))this.observer.observe(board);
    this.roundViews=[...this.root.querySelectorAll('.assembly-round')].map(element=>({element,fragments:[...element.querySelectorAll('[data-puzzle="fragment"]')],meanings:[...element.querySelectorAll('[data-puzzle="meaning"]')],meteors:[...element.querySelectorAll('[data-puzzle="meteor"]')],lines:[...element.querySelectorAll('.meteor-lines path')]}));
  }
  // 为所有碎片一次分配可见网格，剩余高度交给频道列表，避免双层滚动。
  layoutFragments(){
    if(!this.round||this.round.stage!==1||!this.activeRound)return;
    const board=this.activeRound.querySelector('.radio-board'),width=board.clientWidth,height=board.clientHeight;
    if(!width||!height)return;
    const side=width>=660&&height<380,gap=6,trayWidth=side?Math.floor((width-gap)*.58):width,beltHeight=28;
    const budget=side?height-beltHeight:height-Math.min(160,Math.max(80,height*.2))-beltHeight-gap;
    const count=this.round.fragments.length,longest=Math.max(...this.round.fragments.map(item=>item.text.length)),preferred=this.game.touchMode?24:28;
    let best=null;
    for(const minimum of [18,12]){
      for(let columns=1;columns<=Math.min(count,Math.floor(trayWidth/(minimum===18?60:44)));columns++)for(let font=preferred;font>=minimum;font--){
        const cellWidth=(trayWidth-gap*(columns-1))/columns,lines=Math.ceil(longest*font*.62/(cellWidth-20));
        const rowHeight=Math.max(44,Math.ceil(font*1.25*lines+18)),rows=Math.ceil(count/columns),needed=rows*rowHeight+(rows-1)*gap;
        if(needed>budget)continue;
        const score=font*40-lines*90-needed*.06-Math.abs(cellWidth-110)*.12;
        if(!best||score>best.score)best={columns,font,rows,needed,score};
      }
      if(best)break;
    }
    // 极矮分屏无法保留常规触屏尺寸时，仍按实际格子容纳完整片段。
    if(!best){const columns=Math.max(1,Math.floor(trayWidth/44)),rows=Math.ceil(count/columns),rowHeight=(budget-(rows-1)*gap)/rows,cellWidth=(trayWidth-gap*(columns-1))/columns;best={columns,rows,font:Math.max(6,Math.floor(Math.min((rowHeight-8)/1.25,(cellWidth-20)/(longest*.62)))),needed:Math.max(0,budget)};}
    board.dataset.layout=side?'side':'stack';
    for(const [name,value] of Object.entries({'--signal-columns':best.columns,'--signal-rows':best.rows,'--signal-font':best.font+'px','--signal-tray-height':Math.ceil(best.needed+beltHeight)+'px'}))if(board.style.getPropertyValue(name)!==String(value))board.style.setProperty(name,value);
  }
  layoutMeteors(){
    if(!this.round||!this.meteorNodes)return;const field=this.activeRound?.querySelector('.meteor-field');if(!field)return;
    const width=this.root.clientWidth;if(!width)return;
    const compact=width<580,columns=compact?2:3,rows=Math.ceil(this.round.entries.length/columns),half=50;
    field.style.minHeight=rows*(this.game.touchMode?150:160)+'px';this.positions=new Map();
    const sides={en:0,zh:0};
    this.round.meteors.forEach(item=>{
      const index=sides[item.side]++,x=(item.side==='en'?0:half)+((index%columns)+.5)/columns*half,y=(Math.floor(index/columns)+.5)/rows*1000;
      this.positions.set(item.id,{x:x*10,y});const node=this.meteorNodes.find(node=>node.dataset.id===item.id);node.style.left=x+'%';node.style.top=y/10+'%';node.style.width=(44/columns)+'%';node.style.height=(84/rows)+'%';
    });
  }

  // 连线只表达待定配对，飞行动画读取同一条自动曲线。
  routePoint(route,t){
    const u=1-t;return {x:u*u*u*route.from.x+3*u*u*t*route.controlFrom.x+3*u*t*t*route.controlTo.x+t*t*t*route.to.x,y:u*u*u*route.from.y+3*u*u*t*route.controlFrom.y+3*u*t*t*route.controlTo.y+t*t*t*route.to.y};
  }
  drawLines(){
    if(!this.lines||!this.positions)return;let index=0;this.routes.clear();
    const field=this.activeRound.querySelector('.meteor-field'),box=field.getBoundingClientRect(),rootBox=this.root.getBoundingClientRect();
    if(this.round.stage===2)for(const [english,[chinese]] of this.round.assignments){
      const from=this.positions.get(english),to=this.positions.get(chinese);if(!from||!to)continue;
      const convert=p=>({x:box.left-rootBox.left+p.x/1000*box.width,y:box.top-rootBox.top+p.y/1000*box.height});
      this.routes.set(english,{from:convert(from),controlFrom:convert({x:500,y:from.y}),controlTo:convert({x:500,y:to.y}),to:convert(to)});
      const line=this.lines[index++];line.removeAttribute('hidden');line.setAttribute('d','M'+from.x+' '+from.y+' C500 '+from.y+' 500 '+to.y+' '+to.x+' '+to.y);
    }
    for(;index<this.lines.length;index++)this.lines[index].setAttribute('hidden','');
  }
  updateLaunch(){
    const submit=this.root.querySelector('#assembly-submit');if(!submit)return;submit.disabled=!this.round.allAssigned;
    submit.textContent=(this.round.stage===1?'提交验证':'编队出击')+' · '+this.round.checksLeft+'次';
  }
  render(){
    const round=this.game.assembly,visible=!!round&&['playing','paused'].includes(this.game.state);this.root.hidden=!visible;if(!visible)return;
    if(this.round!==round)this.prepare(round);
    if(this.lastRoundIndex!==round.roundIndex){
      if(this.activeRound)this.activeRound.hidden=true;
      const view=this.roundViews[round.roundIndex];this.activeRound=view.element;this.activeRound.hidden=false;this.fragmentNodes=view.fragments;this.meaningNodes=view.meanings;this.meteorNodes=view.meteors;this.lines=view.lines;this.lastRoundIndex=round.roundIndex;this.routes.clear();this.lastVersion=-1;this.lastSecond=-1;
    }
    this.root.inert=this.game.state!=='playing';this.root.dataset.motion=this.game.storage.settings.reducedMotion?'still':this.game.state==='playing'?'running':'paused';
    const second=Math.ceil(round.remaining);if(this.lastSecond!==second){this.root.querySelector('#assembly-timer').textContent=time(round.remaining);this.lastSecond=second;}
    this.flight.update();if(this.lastVersion===round.version)return;this.lastVersion=round.version;
    this.root.dataset.stage=round.stage;const label=round.stage===1?'组频':'护航',title=this.root.querySelector('#assembly-title');title.textContent=this.game.touchMode?label+' · '+(round.roundIndex+1)+'/'+round.rounds.length:'第 '+(round.roundIndex+1)+' / '+round.rounds.length+' 轮 · '+(round.stage===1?'无线电组频':'护航编队');title.setAttribute('aria-label','第 '+(round.roundIndex+1)+' 轮，共 '+round.rounds.length+' 轮，'+label);
    this.root.querySelector('#assembly-help').textContent=round.stage===1?'先选中文频道，再逐片接收字母信号；待定单词显示在释义下方。全部拼好后统一验证。':'从左侧单词战机拖向右侧释义航标，或依次点选两端；点击已连线端点可撤回，全部配对后统一验证。';
    this.root.querySelector('#assembly-checks').textContent='剩余验证 '+round.checksLeft+' / '+ASSEMBLY.maxChecks+' 次';
    this.activeRound.querySelector('.assembly-board').hidden=round.stage!==1;this.activeRound.querySelector('.meteor-scroll').hidden=round.stage!==2;
    const used=round.used;
    const activeParts=round.stage===1?(round.assignments.get(round.pending)||[]):[];
    for(const node of this.fragmentNodes){const id=node.dataset.id,index=activeParts.indexOf(id);node.hidden=round.removedFragments.has(id);node.classList.toggle('selected',index>=0);node.classList.toggle('pending',used.has(id));node.setAttribute('aria-pressed',String(index>=0));node.disabled=used.has(id)&&index<0;}
    for(const node of this.meaningNodes){
      const id=node.dataset.id,answer=round.stage===1?round.answer(id):'',active=round.stage===1&&round.pending===id;
      node.hidden=round.solved.has(id)&&round.stage===1;node.classList.toggle('pending',round.assignments.has(id));node.classList.toggle('selected',active);node.setAttribute('aria-pressed',String(active));node.querySelector('.assembly-answer').textContent=answer;
      node.setAttribute('aria-label',node.querySelector('.meaning-text').textContent+(answer?'，待定拼接 '+answer:'')+(active?'，当前释义':''));
    }
    for(const node of this.meteorNodes){const id=node.dataset.id;node.hidden=round.removedMeteors.has(id)&&round.stage===2;node.classList.toggle('selected',round.pending===id);node.classList.toggle('pending',used.has(id)||round.assignments.has(id));node.setAttribute('aria-pressed',String(round.pending===id));}
    const submit=this.root.querySelector('#assembly-submit');submit.disabled=!round.allAssigned;submit.textContent=(round.stage===1?'提交验证':'编队出击')+' · '+round.checksLeft+'次';submit.setAttribute('aria-label','提交验证，剩余 '+round.checksLeft+' 次');
    const selection=round.stage===1?round.meanings.find(item=>item.id===round.pending)?.meaning:round.meteors.find(item=>item.id===round.pending)?.text;
    this.root.querySelector('#assembly-selection').textContent=selection||(round.stage===1?'先选择中文释义':this.game.touchMode?'战机 → 航标':'待定 '+round.assignments.size+' / '+(round.entries.length-round.solved.size));
    const clear=this.root.querySelector('[data-puzzle="clear"]');clear.disabled=round.stage===1?!activeParts.length:!round.pending;clear.textContent=round.stage===1?'清空拼接':'取消选择';this.layoutFragments();this.layoutMeteors();this.drawLines();this.updateLaunch();this.flight.update();
  }
}
