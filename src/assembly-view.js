import { ASSEMBLY } from './config.js';
import { splitWord } from './assembly.js';
import { rockDefinitions,rockSprite } from './assembly-art.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=seconds=>{const value=Math.ceil(seconds);return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');};

// 四轮节点在开局时一起准备，换轮只切换已有题面，选择和连线复用节点。
export class AssemblyView {
  constructor(root,game,onChange,onNotice){
    Object.assign(this,{root,game,onChange,onNotice});
    root.addEventListener('click',event=>{
      if(game.state!=='playing')return;const button=event.target.closest('button[data-puzzle]');if(!button)return;
      const round=game.assembly;if(!round)return;
      if(button.dataset.puzzle==='submit'){
        const result=game.submitAssembly();if(result)this.onNotice(result.advanced?(round.done?'四轮已完成':'第 '+result.round+' 轮结束，开始第 '+(round.roundIndex+1)+' 轮'+(round.stage===1?'碎片组装':'陨石连线')+'！'):'本次答对 '+result.correct+' 个，错误项已释放，请重新选择');
      }else if(button.dataset.puzzle==='clear'){round.selected=[];round.pending=null;round.version++;}
      else round[button.dataset.puzzle](button.dataset.id);
      this.onChange();
    });
    this.observer=new ResizeObserver(()=>{this.layoutMeteors();this.drawLines();});this.observer.observe(root);
  }
  prepare(round){
    this.round=round;this.lastVersion=-1;this.lastSecond=-1;this.lastRoundIndex=-1;
    const panels=round.rounds.map((content,index)=>{
      const meanings=content.meanings.map(entry=>'<button class="meaning-chip" data-puzzle="meaning" data-id="'+escape(entry.id)+'" title="'+escape(entry.meaning)+'"><span>'+escape(entry.meaning)+'</span><small></small></button>'),half=Math.ceil(meanings.length/2),fragmentWidth=Math.max(this.game.touchMode?64:92,Math.ceil(Math.max(...content.fragments.map(item=>item.text.length))*(this.game.touchMode?19:22)*.62+20));
      return '<section class="assembly-round" data-round-index="'+index+'" hidden><div class="assembly-board"><div class="meaning-row">'+meanings.slice(0,half).join('')+'</div><div class="fragment-field" style="--fragment-min-width:'+fragmentWidth+'px">'+content.fragments.map((item,part)=>'<button class="metal-fragment shape-'+part%4+'" data-puzzle="fragment" data-id="'+escape(item.id)+'">'+rockSprite(part,'fragment')+'<span class="fragment-label" lang="en">'+escape(item.text)+'</span><small></small></button>').join('')+'</div><div class="meaning-row">'+meanings.slice(half).join('')+'</div></div><div class="meteor-scroll" hidden><div class="meteor-field"><svg class="meteor-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+content.entries.map(()=>'<line hidden/>').join('')+'</svg>'+content.meteors.map((item,meteorIndex)=>'<button class="meteor" data-side="'+item.side+'" data-puzzle="meteor" data-id="'+escape(item.id)+'" title="'+escape(item.text)+'" aria-label="'+escape(item.text)+'">'+rockSprite(meteorIndex,'meteor')+'<span class="meteor-label"'+(item.side==='en'?' lang="en"':'')+'>'+(item.side==='en'?splitWord(item.text).map(escape).join('<wbr>'):escape(item.text))+'</span></button>').join('')+'</div></div></section>';
    });
    this.root.innerHTML=rockDefinitions()+'<header class="assembly-heading"><div><span class="eyebrow">组装飞机 · 航母碎片</span><h2 id="assembly-title"></h2></div><div class="assembly-clock"><strong role="timer" id="assembly-timer"></strong><span id="assembly-checks"></span></div></header><p id="assembly-help" class="assembly-help"></p>'+panels.join('')+'<footer class="assembly-footer"><div><span id="assembly-selection" aria-live="polite"></span><button class="text-button" data-puzzle="clear">清空选择</button></div><button class="primary-button" data-puzzle="submit" id="assembly-submit">提交验证</button></footer>';
    this.roundViews=[...this.root.querySelectorAll('.assembly-round')].map(element=>({element,fragments:[...element.querySelectorAll('[data-puzzle="fragment"]')],meanings:[...element.querySelectorAll('[data-puzzle="meaning"]')],meteors:[...element.querySelectorAll('[data-puzzle="meteor"]')],lines:[...element.querySelectorAll('line')]}));
  }
  layoutMeteors(){
    if(!this.round||!this.meteorNodes)return;const field=this.activeRound?.querySelector('.meteor-field');if(!field)return;
    const width=this.root.clientWidth;if(!width)return;const landscape=this.game.touchMode&&width>=580&&this.root.clientHeight<500,columns=width>=850||landscape?6:width>=580?4:3,rows=Math.ceil(this.round.meteors.length/columns);
    field.style.minHeight=rows*(this.game.touchMode?(landscape?84:90):columns===6?98:110)+'px';this.positions=new Map();
    this.round.meteors.forEach((item,index)=>{
      const x=((index%columns)+.5)/columns*1000,y=(Math.floor(index/columns)+.5)/rows*1000;
      this.positions.set(item.id,{x,y});const node=this.meteorNodes.find(node=>node.dataset.id===item.id);node.style.left=x/10+'%';node.style.top=y/10+'%';node.style.width=(94/columns)+'%';node.style.height=(84/rows)+'%';
    });
  }
  drawLines(){
    if(!this.lines||!this.positions)return;let index=0;
    for(const [english,[chinese]] of this.round.assignments){
      if(this.round.stage!==2)break;const from=this.positions.get(english),to=this.positions.get(chinese);if(!from||!to)continue;
      const line=this.lines[index++];line.removeAttribute('hidden');for(const [name,value] of Object.entries({x1:from.x,y1:from.y,x2:to.x,y2:to.y}))line.setAttribute(name,String(value));
    }
    for(;index<this.lines.length;index++)this.lines[index].setAttribute('hidden','');
  }
  render(){
    const round=this.game.assembly,visible=!!round&&['playing','paused'].includes(this.game.state);this.root.hidden=!visible;if(!visible)return;
    if(this.round!==round)this.prepare(round);
    if(this.lastRoundIndex!==round.roundIndex){
      if(this.activeRound)this.activeRound.hidden=true;
      const view=this.roundViews[round.roundIndex];this.activeRound=view.element;this.activeRound.hidden=false;this.fragmentNodes=view.fragments;this.meaningNodes=view.meanings;this.meteorNodes=view.meteors;this.lines=view.lines;this.lastRoundIndex=round.roundIndex;this.lastVersion=-1;this.lastSecond=-1;
    }
    this.root.inert=this.game.state!=='playing';this.root.dataset.motion=this.game.storage.settings.reducedMotion?'still':this.game.state==='playing'?'running':'paused';
    const second=Math.ceil(round.remaining);if(this.lastSecond!==second){this.root.querySelector('#assembly-timer').textContent=time(round.remaining);this.lastSecond=second;}
    if(this.lastVersion===round.version)return;this.lastVersion=round.version;
    this.root.dataset.stage=round.stage;const label=round.stage===1?'组装':'连线',title=this.root.querySelector('#assembly-title');title.textContent=this.game.touchMode?label+' · '+(round.roundIndex+1)+'/'+round.rounds.length:'第 '+(round.roundIndex+1)+' / '+round.rounds.length+' 轮 · '+(round.stage===1?'碎片组装':'陨石连线');title.setAttribute('aria-label','第 '+(round.roundIndex+1)+' 轮，共 '+round.rounds.length+' 轮，'+label);
    this.root.querySelector('#assembly-help').textContent=round.stage===1?(this.game.touchMode?'依次点碎片，再点释义。可反选、拆组；全部配好后提交。':'按拼写顺序选择碎片，再点击中文释义。再次点击碎片可反选，点击待定释义可拆开重组。全部分配后提交。'):(this.game.touchMode?'点单词与释义连线，点已连线陨石可撤线。上下滑动查看。':'任选一个中文和一个英文陨石建立待定连线。点击已连接的陨石可撤线重连，全部连完后提交。');
    this.root.querySelector('#assembly-checks').textContent='剩余验证 '+round.checksLeft+' / '+ASSEMBLY.maxChecks+' 次';
    this.activeRound.querySelector('.assembly-board').hidden=round.stage!==1;this.activeRound.querySelector('.meteor-scroll').hidden=round.stage!==2;
    const used=round.used;
    for(const node of this.fragmentNodes){const id=node.dataset.id,index=round.selected.indexOf(id);node.hidden=round.removedFragments.has(id);node.classList.toggle('selected',index>=0);node.classList.toggle('pending',used.has(id));node.setAttribute('aria-pressed',String(index>=0));node.disabled=used.has(id);node.querySelector('small').textContent=index>=0?String(index+1):'';}
    for(const node of this.meaningNodes){const id=node.dataset.id;node.hidden=round.solved.has(id)&&round.stage===1;node.classList.toggle('pending',round.assignments.has(id));node.querySelector('small').textContent=round.stage===1?round.answer(id):'';node.setAttribute('aria-label',node.querySelector('span').textContent+(round.assignments.has(id)?'，待定，点击重新组装':''));}
    for(const node of this.meteorNodes){const id=node.dataset.id;node.hidden=round.removedMeteors.has(id)&&round.stage===2;node.classList.toggle('selected',round.pending===id);node.classList.toggle('pending',used.has(id)||round.assignments.has(id));node.setAttribute('aria-pressed',String(round.pending===id));}
    const submit=this.root.querySelector('#assembly-submit');submit.disabled=!round.allAssigned;submit.textContent=this.game.touchMode?'提交 · '+round.checksLeft+'次':'提交验证';submit.setAttribute('aria-label','提交验证，剩余 '+round.checksLeft+' 次');
    const selection=round.stage===1?round.selected.map(id=>round.fragments.find(item=>item.id===id).text).join(' · '):round.meteors.find(item=>item.id===round.pending)?.text;
    this.root.querySelector('#assembly-selection').textContent=selection||(this.game.touchMode?'':'待定 '+round.assignments.size+' / '+(round.entries.length-round.solved.size));
    const clear=this.root.querySelector('[data-puzzle="clear"]');clear.disabled=!round.selected.length&&!round.pending;clear.textContent=this.game.touchMode?'重选':'清空选择';this.layoutMeteors();this.drawLines();
  }
}
