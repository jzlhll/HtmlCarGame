import { ASSEMBLY } from './config.js';
import { splitWord } from './assembly.js';
import { AssemblyFlight } from './assembly-flight.js';
import { rockDefinitions,rockSprite,flightSprite,salvageSprite } from './assembly-art.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=seconds=>{const value=Math.ceil(seconds);return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');};

// 四轮节点在开局时一起准备，换轮只切换已有题面，选择和连线复用节点。
export class AssemblyView {
  constructor(root,game,onChange,onNotice){
    Object.assign(this,{root,game,onChange,onNotice});this.flight=new AssemblyFlight(this);
    root.addEventListener('click',event=>{
      if(game.state!=='playing')return;const button=event.target.closest('button[data-puzzle]');if(!button)return;
      const round=game.assembly;if(!round)return;
      if(button.dataset.puzzle==='route')return;
      if(button.dataset.puzzle==='submit'){
        if(this.blockedRoutes)return;if(round.stage===2)this.flight.launch();
        const result=game.submitAssembly();if(result)this.onNotice(result.advanced?(round.done?'四轮已完成':'第 '+result.round+' 轮结束，开始第 '+(round.roundIndex+1)+' 轮'+(round.stage===1?'碎片拼接':'护航编队')+'！'):'本次答对 '+result.correct+' 个，错误项已释放，请重新选择');
      }else if(button.dataset.puzzle==='clear')round.clear();
      else if(button.dataset.puzzle==='fragment'&&!round.pending)this.onNotice('先点击中文释义，再按顺序点击碎片');
      else round[button.dataset.puzzle](button.dataset.id);
      this.onChange();
    });
    root.addEventListener('scroll',()=>{this.drawLines();},true);
    this.observer=new ResizeObserver(()=>{this.layoutMeteors();this.drawLines();this.updateLaunch();});this.observer.observe(root);
  }
  prepare(round){
    this.round=round;this.lastVersion=-1;this.lastSecond=-1;this.lastRoundIndex=-1;this.routeY=new Map();this.routes=new Map();this.blockedRoutes=0;
    const panels=round.rounds.map((content,index)=>{
      const meanings=content.meanings.map(entry=>'<button class="meaning-chip" data-puzzle="meaning" data-id="'+escape(entry.id)+'"><span class="meaning-text">'+escape(entry.meaning)+'</span><span class="assembly-answer" lang="en"></span></button>'),half=Math.ceil(meanings.length/2),fragmentWidth=Math.max(this.game.touchMode?64:92,Math.ceil(Math.max(...content.fragments.map(item=>item.text.length))*(this.game.touchMode?24:28)*.64+24));
      return '<section class="assembly-round" data-round-index="'+index+'" hidden><div class="assembly-board"><div class="meaning-row">'+meanings.slice(0,half).join('')+'</div><div class="fragment-field" style="--fragment-min-width:'+fragmentWidth+'px">'+content.fragments.map((item,part)=>'<button class="metal-fragment shape-'+part%4+'" data-puzzle="fragment" data-id="'+escape(item.id)+'">'+salvageSprite(part)+'<span class="fragment-label" lang="en">'+escape(item.text)+'</span></button>').join('')+'</div><div class="meaning-row">'+meanings.slice(half).join('')+'</div></div><div class="meteor-scroll" hidden><div class="meteor-field"><svg class="meteor-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+content.entries.map(()=>'<path hidden/>').join('')+'</svg>'+content.meteors.map((item)=>'<button class="meteor" data-side="'+item.side+'" data-puzzle="meteor" data-id="'+escape(item.id)+'" title="'+escape(item.text)+'" aria-label="'+escape(item.text)+'">'+flightSprite(item.side==='en'?'fighter':'beacon')+'<span class="meteor-label"'+(item.side==='en'?' lang="en"':'')+'>'+(item.side==='en'?splitWord(item.text).map(escape).join('<wbr>'):escape(item.text))+'</span></button>').join('')+[250,750].map((y,i)=>'<div class="route-asteroid" style="top:'+y/10+'%" aria-hidden="true">'+rockSprite(i,'meteor')+'</div>').join('')+content.entries.map(()=>'<button class="route-handle" data-puzzle="route" hidden aria-label="调整航线，拖动或使用上下方向键">◇</button>').join('')+'</div></div></section>';
    });
    this.root.style.setProperty('--route-rock-size',ASSEMBLY.visuals.routeObstacleRadius*2+'px');
    this.root.innerHTML=rockDefinitions()+'<header class="assembly-heading"><div><span class="eyebrow">星际联队 · 拼接与护航</span><h2 id="assembly-title"></h2></div><div class="assembly-clock"><strong role="timer" id="assembly-timer"></strong><span id="assembly-checks"></span></div></header><p id="assembly-help" class="assembly-help"></p>'+panels.join('')+'<footer class="assembly-footer"><div><span id="assembly-selection" aria-live="polite"></span><button class="text-button" data-puzzle="clear">清空选择</button></div><button class="primary-button" data-puzzle="submit" id="assembly-submit">提交验证</button></footer>';
    this.flight.prepare();
    this.roundViews=[...this.root.querySelectorAll('.assembly-round')].map(element=>({element,fragments:[...element.querySelectorAll('[data-puzzle="fragment"]')],meanings:[...element.querySelectorAll('[data-puzzle="meaning"]')],meteors:[...element.querySelectorAll('[data-puzzle="meteor"]')],lines:[...element.querySelectorAll('.meteor-lines path')]}));
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

  moveRoute(id,y){
    this.routeY.set(id,Math.max(ASSEMBLY.visuals.routeMargin,Math.min(1000-ASSEMBLY.visuals.routeMargin,y)));this.drawLines();this.updateLaunch();
  }
  // 两段三次曲线共用中间导航点，模型飞行与障碍检测读取同一条路线。
  routePoint(route,t){
    const second=t>=.5,k=second?(t-.5)*2:t*2,u=1-k,a=second?route.mid:route.from,b=second?{x:route.mid.x+35,y:route.mid.y}:{x:route.from.x+35,y:route.from.y},c=second?{x:route.to.x-35,y:route.to.y}:{x:route.mid.x-35,y:route.mid.y},d=second?route.to:route.mid;
    return {x:u*u*u*a.x+3*u*u*k*b.x+3*u*k*k*c.x+k*k*k*d.x,y:u*u*u*a.y+3*u*u*k*b.y+3*u*k*k*c.y+k*k*k*d.y};
  }
  drawLines(){
    if(!this.lines||!this.positions)return;let index=0;this.routes.clear();this.blockedRoutes=0;
    const field=this.activeRound.querySelector('.meteor-field'),box=field.getBoundingClientRect(),rootBox=this.root.getBoundingClientRect(),handles=[...field.querySelectorAll('.route-handle')];
    if(this.round.stage===2)for(const [english,[chinese]] of this.round.assignments){
      const from=this.positions.get(english),to=this.positions.get(chinese);if(!from||!to)continue;
      const y=this.routeY.get(english)??(ASSEMBLY.visuals.routeFirst+index*ASSEMBLY.visuals.routeSpacing);this.routeY.set(english,y);
      const convert=p=>({x:box.left-rootBox.left+p.x/1000*box.width,y:box.top-rootBox.top+p.y/1000*box.height}),route={from:convert(from),mid:convert({x:500,y}),to:convert(to)};
      let blocked=false;for(let sample=0;sample<=ASSEMBLY.visuals.routeSamples;sample++){const p=this.routePoint(route,sample/ASSEMBLY.visuals.routeSamples);if([250,750].some(ay=>{const asteroid=convert({x:500,y:ay});return Math.hypot(p.x-asteroid.x,p.y-asteroid.y)<ASSEMBLY.visuals.routeClearance;})){blocked=true;break;}}
      this.routes.set(english,route);if(blocked)this.blockedRoutes++;
      const line=this.lines[index],handle=handles[index++];line.removeAttribute('hidden');line.classList.toggle('blocked',blocked);line.setAttribute('d','M'+from.x+' '+from.y+' C'+(from.x+35/box.width*1000)+' '+from.y+' '+(500-35/box.width*1000)+' '+y+' 500 '+y+' C'+(500+35/box.width*1000)+' '+y+' '+(to.x-35/box.width*1000)+' '+to.y+' '+to.x+' '+to.y);
      handle.hidden=false;handle.dataset.id=english;handle.style.top=y/10+'%';handle.classList.toggle('blocked',blocked);handle.setAttribute('aria-label','调整 '+this.round.meteors.find(item=>item.id===english).text+' 的航线'+(blocked?'，需要绕开陨石':''));
    }
    for(;index<this.lines.length;index++){this.lines[index].setAttribute('hidden','');handles[index].hidden=true;}
  }
  updateLaunch(){
    const submit=this.root.querySelector('#assembly-submit');if(!submit)return;submit.disabled=!this.round.allAssigned||this.blockedRoutes>0;
    submit.textContent=this.blockedRoutes?'绕开陨石 · '+this.blockedRoutes+'条':(this.round.stage===1?'提交验证':'编队出击')+' · '+this.round.checksLeft+'次';
  }
  render(){
    const round=this.game.assembly,visible=!!round&&['playing','paused'].includes(this.game.state);this.root.hidden=!visible;if(!visible)return;
    if(this.round!==round)this.prepare(round);
    if(this.lastRoundIndex!==round.roundIndex){
      if(this.activeRound)this.activeRound.hidden=true;
      const view=this.roundViews[round.roundIndex];this.activeRound=view.element;this.activeRound.hidden=false;this.fragmentNodes=view.fragments;this.meaningNodes=view.meanings;this.meteorNodes=view.meteors;this.lines=view.lines;this.lastRoundIndex=round.roundIndex;this.routeY.clear();this.routes.clear();this.lastVersion=-1;this.lastSecond=-1;
    }
    this.root.inert=this.game.state!=='playing';this.root.dataset.motion=this.game.storage.settings.reducedMotion?'still':this.game.state==='playing'?'running':'paused';
    const second=Math.ceil(round.remaining);if(this.lastSecond!==second){this.root.querySelector('#assembly-timer').textContent=time(round.remaining);this.lastSecond=second;}
    this.flight.update();if(this.lastVersion===round.version)return;this.lastVersion=round.version;
    this.root.dataset.stage=round.stage;const label=round.stage===1?'拼接':'护航',title=this.root.querySelector('#assembly-title');title.textContent=this.game.touchMode?label+' · '+(round.roundIndex+1)+'/'+round.rounds.length:'第 '+(round.roundIndex+1)+' / '+round.rounds.length+' 轮 · '+(round.stage===1?'碎片拼接':'护航编队');title.setAttribute('aria-label','第 '+(round.roundIndex+1)+' 轮，共 '+round.rounds.length+' 轮，'+label);
    this.root.querySelector('#assembly-help').textContent=round.stage===1?'先点击中文释义，再按顺序逐个点击碎片；待定单词显示在释义下方。再次点本组碎片可撤回，全部拼好后提交验证。':'从左侧单词战机拖向右侧释义航标，规划护航航线；也可点选两端。拖动航线光点绕开陨石，编队完成后出击；点端点可撤回。';
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
    const clear=this.root.querySelector('[data-puzzle="clear"]');clear.disabled=round.stage===1?!activeParts.length:!round.pending;clear.textContent=round.stage===1?'清空拼接':'取消选择';this.layoutMeteors();this.drawLines();this.updateLaunch();this.flight.update();
  }
}
