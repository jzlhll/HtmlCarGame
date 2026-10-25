import { ASSEMBLY } from './config.js';
import { createRandom } from './random.js';
import { AssemblyFlight } from './assembly-flight.js';
import { evilSprite,machineSprite,salvageSprite,novaSprite } from './assembly-art.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=seconds=>{const value=Math.ceil(seconds);return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');};

// 所有轮次的星球、碎片、回收机、飞机和炮弹均在开局预建。
export class AssemblyView {
  constructor(root,game,onChange){
    Object.assign(this,{root,game,onChange});this.flight=new AssemblyFlight(this);
    root.addEventListener('click',event=>{
      const round=game.assembly,button=event.target.closest('button[data-puzzle]');if(game.state!=='playing'||!round||round.introRemaining||!button||button.disabled)return;
      const action=button.dataset.puzzle;
      if(action==='submit')game.submitAssembly();
      else if(action==='fire')round.fire();
      else if(['fragment','meaning','enemy','clear'].includes(action))round[action](button.dataset.id);
      this.onChange();
    });
    this.observer=new ResizeObserver(()=>this.layout());this.observer.observe(root);
  }
  prepare(round){
    this.observer.disconnect();this.observer.observe(this.root);this.round=round;this.lastVersion=-1;this.lastRoundIndex=-1;this.lastSecond=-1;
    this.root.style.setProperty('--escort-scale',ASSEMBLY.visuals.escortScale);
    const panels=round.rounds.map((content,index)=>{
      const stage=Math.floor(index/ASSEMBLY.roundsPerStage)+1;
      if(stage===1)return '<section class="assembly-round" data-round-index="'+index+'" hidden><div class="nova-board"><div class="nova-backdrop" aria-hidden="true">'+novaSprite(content.sceneSeed,content.hue)+'</div><div class="nova-field" aria-label="超新星单词碎片">'+content.fragments.map((item,part)=>'<button class="metal-fragment nova-fragment" data-puzzle="fragment" data-id="'+escape(item.id)+'">'+salvageSprite(part)+'<span class="fragment-label" lang="en">'+escape(item.text)+'</span></button>').join('')+'</div><div class="collector-dock" role="group" aria-label="中文释义碎片回收机">'+content.meanings.map(entry=>'<button class="recovery-unit" data-puzzle="meaning" data-id="'+escape(entry.id)+'"><span class="collector-meaning">'+escape(entry.meaning)+'</span>'+machineSprite()+'<span class="collector-answer" lang="en"></span></button>').join('')+'</div></div></section>';
      return '<section class="assembly-round" data-round-index="'+index+'" hidden><div class="escort-board"><div class="enemy-scroll"><div class="enemy-sky" aria-label="十二架邪恶飞机">'+content.enemies.map(enemy=>'<button class="evil-plane" data-puzzle="enemy" data-id="'+escape(enemy.id)+'">'+evilSprite(enemy.skin)+'<span class="enemy-word" lang="en">'+escape(enemy.text)+'</span><span class="attached-meaning"></span></button>').join('')+'</div></div><div class="cannon-dock"><button class="meaning-cannon" data-puzzle="fire" aria-label="炮弹机，点击发射中文释义"><span class="ammo-caption"></span><span class="cannon-pivot">'+machineSprite(true)+'</span></button></div><svg class="aim-guide" aria-hidden="true"><line/></svg><span class="meaning-shell" hidden></span></div></section>';
    });
    this.root.innerHTML='<header class="assembly-heading"><h2 id="assembly-title"></h2><div class="assembly-clock"><strong role="timer" id="assembly-timer"></strong></div></header>'+panels.join('')+'<footer class="assembly-footer"><div><span id="assembly-selection" aria-live="polite"></span><button class="text-button" data-puzzle="clear">清空拼接</button></div><button class="primary-button" data-puzzle="submit" id="assembly-submit">提交验证</button></footer>';
    this.views=[...this.root.querySelectorAll('.assembly-round')].map(element=>({element,fragments:[...element.querySelectorAll('.nova-fragment')],collectors:[...element.querySelectorAll('.recovery-unit')],enemies:[...element.querySelectorAll('.evil-plane')]}));
    for(const field of this.root.querySelectorAll('.nova-field,.enemy-scroll,.enemy-sky'))this.observer.observe(field);
    this.flight.prepare();
  }
  layout(){
    if(!this.round||!this.activeView||this.root.hidden)return;
    if(this.round.stage===1)this.layoutFragments();else this.layoutEnemies();
    this.flight.measure();this.flight.update();
  }
  layoutFragments(){
    const field=this.activeView.element.querySelector('.nova-field'),width=field.clientWidth,height=field.clientHeight;if(!width||!height)return;
    const count=this.round.fragments.length,cell=Math.sqrt(width*height/count),w=Math.min(148,Math.max(54,cell*1.08)),h=Math.min(76,Math.max(44,cell*.64)),random=createRandom(this.round.sceneSeed),points=[];
    const preferred=this.game.touchMode?ASSEMBLY.visuals.touchFragmentFont:ASSEMBLY.visuals.fragmentFont,longest=Math.max(...this.round.fragments.map(item=>item.text.length));let font=preferred;
    while(font>12&&Math.ceil(longest*font*.62/(w-12))*font*1.25>h-12)font--;
    for(const node of this.activeView.fragments){
      let best=null;
      for(let attempt=0;attempt<90;attempt++){
        const x=w/2+8+random()*Math.max(0,width-w-16),y=h/2+6+random()*Math.max(0,height-h-12);
        const score=points.length?Math.min(...points.map(p=>((x-p.x)/(w+8))**2+((y-p.y)/(h+8))**2)):1;
        if(!best||score>best.score)best={x,y,score};
      }
      points.push(best);node.style.width=w+'px';node.style.height=h+'px';node.style.fontSize=font+'px';
    }
    this.fragmentPositions=points;this.fieldSize={width,height};this.activeView.novaSettled=false;
    const motion=createRandom(this.round.sceneSeed^0x5350494e);this.fragmentMotion=points.map(()=>({delay:motion()*.045,arc:(motion()-.5)*.13,spin:(motion()-.5)*440}));
    const event=this.activeView.element.querySelector('.nova-event');event.style.top=height*.44+'px';event.style.setProperty('--nova-size',Math.min(240,width*.48,height*.72)+'px');event.style.setProperty('--nova-reach',Math.hypot(width,height)*.58+'px');
    const dock=this.activeView.element.querySelector('.collector-dock'),columns=width>=720?3:2,answerFont=width>=720?21:18;
    dock.style.setProperty('--collector-columns',columns);dock.style.setProperty('--answer-lines',Math.max(1,Math.ceil(Math.max(...this.round.entries.map(entry=>entry.word.length))*answerFont*.62/(width/columns-24))));
  }
  layoutEnemies(){
    const scroll=this.activeView.element.querySelector('.enemy-scroll'),field=this.activeView.element.querySelector('.enemy-sky'),width=scroll.clientWidth;if(!width)return;
    const columns=width>=720?4:3,rows=Math.ceil(this.round.enemies.length/columns),cellWidth=width/columns;
    for(const node of this.activeView.enemies)node.style.width=(cellWidth*.88)+'px';
    const wordHeight=Math.max(...this.activeView.enemies.map(node=>node.querySelector('.enemy-word').scrollHeight)),meaningFont=width>=720?14:13;
    const meaningHeight=Math.ceil(Math.max(...this.round.meanings.map(entry=>entry.meaning.length))*meaningFont/(cellWidth*.88-10))*meaningFont*1.3;
    const preferredModel=84*ASSEMBLY.visuals.escortScale,modelHeight=Math.max(ASSEMBLY.visuals.enemyMinModelHeight,Math.min(preferredModel,scroll.clientHeight/rows*.92-wordHeight-meaningHeight-8));
    const minimumRow=(wordHeight+meaningHeight+modelHeight+8)/.92,rowHeight=Math.max(minimumRow,Math.min(ASSEMBLY.visuals.enemyRowHeight,scroll.clientHeight/rows)),height=Math.max(scroll.clientHeight,rows*rowHeight);
    field.style.height=height+'px';field.style.setProperty('--enemy-model-height',modelHeight+'px');field.style.setProperty('--attachment-height',meaningHeight+'px');
    this.enemyLayout={width,height,columns,rows,cellWidth};
    this.activeView.enemies.forEach((node,index)=>{node.style.height=(height/rows*.92)+'px';});
  }
  render(){
    const round=this.game.assembly,visible=!!round&&['playing','paused'].includes(this.game.state);this.root.hidden=!visible;if(!visible)return;
    if(this.round!==round)this.prepare(round);
    let changedRound=false;
    if(this.lastRoundIndex!==round.roundIndex){
      if(this.activeView)this.activeView.element.hidden=true;this.activeView=this.views[round.roundIndex];this.activeView.element.hidden=false;this.lastRoundIndex=round.roundIndex;this.lastVersion=-1;this.lastSecond=-1;changedRound=true;
    }
    const intro=round.introRemaining>0;
    this.root.dataset.stage=round.stage;this.root.dataset.intro=String(intro);this.root.dataset.motion=this.flight.still?'still':this.game.state==='playing'?'running':'paused';this.root.inert=this.game.state!=='playing';
    const second=Math.ceil(round.remaining);if(this.lastSecond!==second){this.root.querySelector('#assembly-timer').textContent=time(round.remaining);this.lastSecond=second;}
    if(this.lastVersion!==round.version){
      this.lastVersion=round.version;
      const title=round.stage===1?'超新星爆发':'护航编队';this.root.querySelector('#assembly-title').textContent=title+' · '+(round.roundIndex+1)+' / '+round.rounds.length;
      const used=round.used,parts=round.stage===1?(round.assignments.get(round.pending)||[]):[];
      for(const node of this.activeView.fragments){const id=node.dataset.id,selected=parts.includes(id);node.hidden=round.removedFragments.has(id);node.classList.toggle('pending',used.has(id));node.classList.toggle('selected',selected);node.disabled=intro||used.has(id)&&!selected;node.setAttribute('aria-pressed',String(selected));}
      for(const node of this.activeView.collectors){const id=node.dataset.id,selected=id===round.pending;node.hidden=round.solved.has(id);node.disabled=intro;node.classList.toggle('selected',selected);node.querySelector('.collector-answer').textContent=round.answer(id);node.setAttribute('aria-pressed',String(selected));}
      for(const node of this.activeView.enemies){
        const id=node.dataset.id,linked=round.assignments.get(id)?.[0],meaning=linked?round.entries.find(entry=>'zh:'+entry.id===linked)?.meaning:'';
        node.hidden=round.removedMeteors.has(id);node.classList.toggle('aimed',round.pending===id);node.classList.toggle('tagged',!!linked);node.disabled=intro||!!round.shot;node.querySelector('.attached-meaning').textContent=meaning||'';node.setAttribute('aria-pressed',String(round.pending===id));
        node.setAttribute('aria-label',node.querySelector('.enemy-word').textContent+(meaning?'，已贴中文 '+meaning+'，点击回收':'，点击瞄准'));
      }
      const cannon=this.activeView.element.querySelector('.meaning-cannon');
      if(cannon){
        const ammo=round.shot?.meaning||round.ammunition;cannon.disabled=intro||!!round.shot||!ammo;cannon.querySelector('.ammo-caption').textContent=ammo?.meaning||'';
        this.activeView.element.querySelector('.meaning-shell').textContent=round.shot?.meaning.meaning||'';
      }
      const submit=this.root.querySelector('#assembly-submit');submit.disabled=!round.allAssigned;submit.textContent='提交验证 · '+round.checksLeft+'次';
      this.root.querySelector('#assembly-selection').textContent=!intro&&round.stage===2?(round.assignments.size+round.solved.size)+' / '+round.entries.length:'';
      const clear=this.root.querySelector('[data-puzzle="clear"]');clear.textContent=round.stage===1?'清空拼接':'取消瞄准';clear.disabled=intro||!!round.shot||(round.stage===1?!parts.length:!round.pending);
    }
    if(changedRound)this.layout();this.flight.update();
  }
}
