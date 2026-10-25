import { ASSEMBLY } from './config.js';
import { flightSprite } from './assembly-art.js';

// 输入沿用题目状态；飞行器和牵引线只在开局预建，全部运动读取有效游戏时间。
export class AssemblyFlight {
  constructor(view){
    this.view=view;this.root=view.root;this.game=view.game;this.gesture=null;this.suppressClick=false;
    this.root.addEventListener('pointerdown',event=>this.down(event));
    this.root.addEventListener('pointermove',event=>this.move(event));
    this.root.addEventListener('pointerup',event=>this.up(event));
    this.root.addEventListener('pointercancel',()=>this.cancel());
    this.root.addEventListener('keydown',event=>{const node=event.target.closest('[data-puzzle="route"]');if(!node||this.game.state!=='playing'||!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();this.view.moveRoute(node.dataset.id,(this.view.routeY.get(node.dataset.id)??500)+(event.key==='ArrowUp'?-ASSEMBLY.visuals.routeStep:ASSEMBLY.visuals.routeStep));});
    this.root.addEventListener('click',event=>{if(this.suppressClick){this.suppressClick=false;event.stopImmediatePropagation();event.preventDefault();}},true);
  }
  prepare(){
    this.cancel();this.flights=[];this.lastAssignments=new Map();this.roundIndex=-1;this.lastVersion=-1;
    this.layer=document.createElement('div');this.layer.className='sortie-effects';this.layer.setAttribute('aria-hidden','true');
    this.layer.innerHTML='<svg class="tractor-lines"><path/></svg>'+Array.from({length:ASSEMBLY.wordsPerRound},()=>'<div class="sortie-craft" hidden>'+flightSprite()+'</div>').join('');this.root.append(this.layer);
    this.line=this.layer.querySelector('path');this.crafts=[...this.layer.querySelectorAll('.sortie-craft')];
  }
  nodeAt(x,y){const node=document.elementFromPoint(x,y)?.closest('button[data-puzzle]');return node&&this.root.contains(node)?node:null;}
  down(event){
    const node=event.target.closest('[data-puzzle]');if(this.game.state!=='playing'||!node||node.disabled||event.button!==0)return;
    if(!['fragment','meteor','route'].includes(node.dataset.puzzle))return;
    this.suppressClick=false;this.gesture={pointer:event.pointerId,node,x:event.clientX,y:event.clientY,dragged:false,nodes:[node],round:this.game.assembly.roundIndex};
  }
  move(event){
    const g=this.gesture;if(!g||event.pointerId!==g.pointer)return;
    if(this.game.state!=='playing'||g.round!==this.game.assembly.roundIndex){this.cancel();return;}
    if(!g.dragged&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<8)return;
    if(!g.dragged){g.dragged=true;this.root.setPointerCapture(event.pointerId);}event.preventDefault();
    if(g.node.dataset.puzzle==='route'){const field=this.view.activeRound.querySelector('.meteor-field').getBoundingClientRect();this.view.moveRoute(g.node.dataset.id,(event.clientY-field.top)/field.height*1000);return;}
    if(this.game.assembly.stage===1){
      const steps=Math.ceil(Math.hypot(event.clientX-g.x,event.clientY-g.y)/12);
      for(let i=1;i<=steps;i++){const node=this.nodeAt(g.x+(event.clientX-g.x)*i/steps,g.y+(event.clientY-g.y)*i/steps);if(node?.dataset.puzzle==='fragment'&&!node.disabled&&!g.nodes.includes(node)){const box=node.getBoundingClientRect(),x=g.x+(event.clientX-g.x)*i/steps,y=g.y+(event.clientY-g.y)*i/steps;if(Math.hypot(x-box.x-box.width/2,y-box.y-box.height/2)<Math.min(box.width,box.height)*.18)g.nodes.push(node);}}
    }
    g.x=event.clientX;g.y=event.clientY;
    for(const item of g.nodes)item.classList.add('towing');
    const box=this.root.getBoundingClientRect(),points=g.nodes.map(item=>{const b=item.getBoundingClientRect();return [b.x+b.width/2-box.x,b.y+b.height/2-box.y];});points.push([event.clientX-box.x,event.clientY-box.y]);
    this.line.setAttribute('d',points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' '));
  }
  up(event){
    const g=this.gesture;if(!g||event.pointerId!==g.pointer)return;
    if(g.dragged&&this.game.state==='playing'&&g.round===this.game.assembly.roundIndex){
      const target=this.nodeAt(event.clientX,event.clientY),round=this.game.assembly;
      if(g.node.dataset.puzzle==='route'){this.suppressClick=true;this.cancel();return;}
      const occupied=target&&(round.stage===1?round.assignments.has(target.dataset.id):target!==g.node&&(round.assignments.has(target.dataset.id)||round.used.has(target.dataset.id)));
      if(occupied){this.suppressClick=true;this.view.onNotice('目标已分配，请先点击撤回，再重新派遣。');this.cancel();return;}
      if(round.stage===1){
        for(const node of g.nodes)if(!round.selected.includes(node.dataset.id))round.fragment(node.dataset.id);
        if(target?.dataset.puzzle==='meaning')round.meaning(target.dataset.id);
      }else if(target?.dataset.puzzle==='meteor'&&target.dataset.side!==g.node.dataset.side){
        // 已配对端点先撤销，未配对端点再选中，复用原有一对一规则。
        if(round.assignments.has(g.node.dataset.id)||round.used.has(g.node.dataset.id))round.meteor(g.node.dataset.id);
        round.pending=null;round.meteor(g.node.dataset.id);round.meteor(target.dataset.id);
      }
      this.suppressClick=true;this.view.onChange();
    }
    this.cancel();
  }
  cancel(){
    if(this.gesture){for(const node of this.gesture.nodes)node.classList.remove('towing');if(this.root.hasPointerCapture(this.gesture.pointer))this.root.releasePointerCapture(this.gesture.pointer);}
    this.gesture=null;this.line?.setAttribute('d','');
  }
  center(node){const a=node.getBoundingClientRect(),b=this.root.getBoundingClientRect();return {x:a.x+a.width/2-b.x,y:a.y+a.height/2-b.y};}
  launch(){
    for(const flight of this.flights)flight.craft.hidden=true;this.flights=[];
    const round=this.game.assembly;
    for(const [id,parts] of round.assignments){
      const source=(round.stage===1?this.view.meaningNodes:this.view.meteorNodes).find(node=>node.dataset.id===id),target=this.view.meteorNodes.find(node=>node.dataset.id===parts[0]);
      if(!source)continue;const craft=this.crafts[this.flights.length],from=this.center(source),to=round.stage===1?{x:from.x,y:-45}:this.center(target);craft.hidden=false;
      this.flights.push({craft,from,to,id,launch:true,route:this.view.routes?.get(id),started:this.game.elapsed});
    }
  }
  update(){
    if(!this.layer)return;const round=this.game.assembly;if(!round)return;
    if(this.game.state!=='playing')this.cancel();
    if(this.roundIndex!==round.roundIndex){this.cancel();this.roundIndex=round.roundIndex;this.flights=this.flights.filter(flight=>{if(flight.launch)return true;flight.craft.hidden=true;return false;});this.lastAssignments.clear();this.lastVersion=-1;}
    const nodes=round.stage===1?this.view.fragmentNodes:this.view.meteorNodes;
    if(this.lastVersion!==round.version){
    for(let i=this.flights.length-1;i>=0;i--){const flight=this.flights[i];if(!flight.launch&&round.assignments.get(flight.id)?.join('|')!==flight.signature){flight.craft.hidden=true;this.flights.splice(i,1);}}
    for(const [id,parts] of round.assignments){
      const signature=parts.join('|');if(this.lastAssignments.get(id)===signature)continue;
      const from=nodes.find(node=>node.dataset.id===(round.stage===1?parts[0]:id)),to=(round.stage===1?this.view.meaningNodes:nodes).find(node=>node.dataset.id===(round.stage===1?id:parts[0]));
      if(from&&to){const slot=this.crafts.findIndex(craft=>craft.hidden);if(slot>=0){const craft=this.crafts[slot];craft.hidden=false;this.flights.push({craft,id,signature,from:this.center(from),to:this.center(to),started:this.game.elapsed});}}
    }
    this.lastAssignments=new Map([...round.assignments].map(([key,value])=>[key,value.join('|')]));this.lastVersion=round.version;
    }
    for(let i=this.flights.length-1;i>=0;i--){
      const flight=this.flights[i],t=Math.min(1,(this.game.elapsed-flight.started)/ASSEMBLY.visuals.flightSeconds),ease=t*t*(3-2*t),arc=this.game.storage.settings.reducedMotion?0:Math.sin(t*Math.PI)*35,dx=flight.to.x-flight.from.x,dy=flight.to.y-flight.from.y;
      const route=flight.route||this.view.routes?.get(flight.id),point=route?this.view.routePoint(route,ease):null;
      flight.craft.style.transform='translate('+(point?point.x:flight.from.x+dx*ease)+'px,'+(point?point.y:flight.from.y+dy*ease-arc)+'px) translate(-50%,-50%) rotate('+Math.atan2(dx,-dy)*180/Math.PI+'deg)';flight.craft.style.opacity=this.game.storage.settings.reducedMotion?'0':String(Math.min(1,(1-t)*5));
      if(t>=1){flight.craft.hidden=true;this.flights.splice(i,1);}
    }
  }
}
