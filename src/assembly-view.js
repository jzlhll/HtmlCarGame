import { ASSEMBLY } from './config.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=seconds=>{const value=Math.ceil(seconds);return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');};

// 两阶段节点在开局时一起准备，选择、消除与连线只更新既有节点。
export class AssemblyView {
  constructor(root,game,onChange,onNotice){
    Object.assign(this,{root,game,onChange,onNotice});
    root.addEventListener('click',event=>{
      if(game.state!=='playing')return;const button=event.target.closest('button[data-puzzle]');if(!button)return;
      const round=game.assembly;if(!round)return;
      if(button.dataset.puzzle==='submit'){
        const result=game.submitAssembly();if(result)this.onNotice(result.advanced?(result.stage===1?'第一阶段结束，开始陨石连线！':'两阶段已完成'):'本次答对 '+result.correct+' 个，错误项已释放，请重新选择');
      }else if(button.dataset.puzzle==='clear'){round.selected=[];round.pending=null;round.version++;}
      else round[button.dataset.puzzle](button.dataset.id);
      this.onChange();
    });
    this.observer=new ResizeObserver(()=>{this.layoutMeteors();this.drawLines();});this.observer.observe(root);
  }
  prepare(round){
    this.round=round;this.lastVersion=-1;this.lastSecond=-1;
    const meanings=round.meanings.map(entry=>'<button class="meaning-chip" data-puzzle="meaning" data-id="'+escape(entry.id)+'" title="'+escape(entry.meaning)+'"><span>'+escape(entry.meaning)+'</span><small></small></button>'),half=Math.ceil(meanings.length/2);
    this.root.innerHTML='<header class="assembly-heading"><div><span class="eyebrow">组装飞机 · 航母碎片</span><h2 id="assembly-title"></h2></div><div class="assembly-clock"><strong role="timer" id="assembly-timer"></strong><span id="assembly-checks"></span></div></header><p id="assembly-help" class="assembly-help"></p><div class="assembly-board" id="assembly-board"><div class="meaning-row">'+meanings.slice(0,half).join('')+'</div><div class="fragment-field">'+round.fragments.map((item,index)=>'<button class="metal-fragment shape-'+index%4+'" data-puzzle="fragment" data-id="'+escape(item.id)+'"><span lang="en">'+escape(item.text)+'</span><small></small></button>').join('')+'</div><div class="meaning-row">'+meanings.slice(half).join('')+'</div></div><div class="meteor-scroll" id="meteor-scroll" hidden><div class="meteor-field" id="meteor-field"><svg class="meteor-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+round.roster.map(()=>'<line hidden/>').join('')+'</svg>'+round.meteors.map(item=>'<button class="meteor" data-side="'+item.side+'" data-puzzle="meteor" data-id="'+escape(item.id)+'" title="'+escape(item.text)+'"><span'+(item.side==='en'?' lang="en"':'')+'>'+escape(item.text)+'</span></button>').join('')+'</div></div><footer class="assembly-footer"><div><span id="assembly-selection" aria-live="polite"></span><button class="text-button" data-puzzle="clear">清空选择</button></div><button class="primary-button" data-puzzle="submit" id="assembly-submit">提交验证</button></footer>';
    this.fragmentNodes=[...this.root.querySelectorAll('[data-puzzle="fragment"]')];this.meaningNodes=[...this.root.querySelectorAll('[data-puzzle="meaning"]')];this.meteorNodes=[...this.root.querySelectorAll('[data-puzzle="meteor"]')];this.lines=[...this.root.querySelectorAll('line')];this.layoutMeteors();
  }
  layoutMeteors(){
    if(!this.round||!this.meteorNodes)return;const field=this.root.querySelector('#meteor-field');if(!field)return;
    const width=this.root.clientWidth;if(!width)return;const columns=width>=850?6:width>=580?4:3,rows=Math.ceil(this.round.meteors.length/columns);
    field.style.minHeight=rows*(columns===6?98:110)+'px';this.positions=new Map();
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
    this.root.inert=this.game.state!=='playing';
    const second=Math.ceil(round.remaining);if(this.lastSecond!==second){this.root.querySelector('#assembly-timer').textContent=time(round.remaining);this.lastSecond=second;}
    if(this.lastVersion===round.version)return;this.lastVersion=round.version;
    this.root.dataset.stage=round.stage;this.root.querySelector('#assembly-title').textContent=round.stage===1?'01 / 单词碎片组装':'02 / 陨石连线';
    this.root.querySelector('#assembly-help').textContent=round.stage===1?'按拼写顺序选择碎片，再点击中文释义。再次点击碎片可反选，点击待定释义可拆开重组。全部分配后提交。':'任选一个中文和一个英文陨石建立待定连线。点击已连接的陨石可撤线重连，全部连完后提交。';
    this.root.querySelector('#assembly-checks').textContent='剩余验证 '+round.checksLeft+' / '+ASSEMBLY.maxChecks+' 次';
    this.root.querySelector('#assembly-board').hidden=round.stage!==1;this.root.querySelector('#meteor-scroll').hidden=round.stage!==2;
    const used=round.used;
    for(const node of this.fragmentNodes){const id=node.dataset.id,index=round.selected.indexOf(id);node.hidden=round.removedFragments.has(id);node.classList.toggle('selected',index>=0);node.classList.toggle('pending',used.has(id));node.setAttribute('aria-pressed',String(index>=0));node.disabled=used.has(id);node.querySelector('small').textContent=index>=0?String(index+1):'';}
    for(const node of this.meaningNodes){const id=node.dataset.id;node.hidden=round.solved.has(id)&&round.stage===1;node.classList.toggle('pending',round.assignments.has(id));node.querySelector('small').textContent=round.stage===1?round.answer(id):'';node.setAttribute('aria-label',node.querySelector('span').textContent+(round.assignments.has(id)?'，待定，点击重新组装':''));}
    for(const node of this.meteorNodes){const id=node.dataset.id;node.hidden=round.removedMeteors.has(id)&&round.stage===2;node.classList.toggle('selected',round.pending===id);node.classList.toggle('pending',used.has(id)||round.assignments.has(id));node.setAttribute('aria-pressed',String(round.pending===id));}
    this.root.querySelector('#assembly-submit').disabled=!round.allAssigned;
    const selection=round.stage===1?round.selected.map(id=>round.fragments.find(item=>item.id===id).text).join(' · '):round.meteors.find(item=>item.id===round.pending)?.text;
    this.root.querySelector('#assembly-selection').textContent=selection||('待定 '+round.assignments.size+' / '+(round.roster.length-round.solved.size));
    this.root.querySelector('[data-puzzle="clear"]').disabled=!round.selected.length&&!round.pending;this.layoutMeteors();this.drawLines();
  }
}
