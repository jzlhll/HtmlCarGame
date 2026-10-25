import { ASSEMBLY } from './config.js';
const clamp=value=>Math.max(0,Math.min(1,value));

// 全部动画读取本轮有效时间；暂停冻结，换轮仅使用已准备的节点。
export class AssemblyFlight {
  constructor(view){this.view=view;this.root=view.root;this.game=view.game;this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');this.reducedMotion?.addEventListener('change',()=>view.onChange());this.root.addEventListener('scroll',()=>this.measure(),true);}
  get still(){return this.game.storage.settings.reducedMotion||!!this.reducedMotion?.matches;}
  prepare(){this.origin=null;this.cannonPoint=null;}
  measure(){
    const view=this.view.activeView;if(!view||this.game.assembly?.stage!==2)return;
    const root=view.element.querySelector('.escort-board').getBoundingClientRect(),field=view.element.querySelector('.enemy-sky').getBoundingClientRect(),pivot=view.element.querySelector('.cannon-pivot').getBoundingClientRect();
    this.origin={x:field.left-root.left,y:field.top-root.top};this.cannonPoint={x:pivot.left-root.left+pivot.width/2,y:pivot.top-root.top+pivot.height*.65};
  }
  update(){
    const round=this.game.assembly,view=this.view.activeView;if(!round||!view)return;
    if(round.stage===1)this.nova(round,view);else this.escort(round,view);
  }
  nova(round,view){
    const positions=this.view.fragmentPositions,size=this.view.fieldSize;if(!positions||!size)return;
    const t=clamp(round.time/round.introDuration),spread=clamp((t-.28)/.72),ease=1-(1-spread)**3,still=this.still;
    const event=view.element.querySelector('.nova-event');event.style.opacity=String(clamp((1-t)/.36));event.style.setProperty('--nova-spread',spread);event.style.setProperty('--planet-scale',String(t<.28?1+t*.8:Math.max(0,1-spread*4)));event.style.setProperty('--flash-opacity',still?'0':String(Math.max(0,1-Math.abs(t-.3)*18)));
    view.fragments.forEach((node,index)=>{
      const target=positions[index],p=still?1:ease,x=size.width*.5+(target.x-size.width*.5)*p,y=size.height*.44+(target.y-size.height*.44)*p;
      node.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) scale('+(still?1:.18+.82*ease)+')';node.style.visibility=spread>0||!round.introRemaining?'visible':'hidden';
    });
  }
  escort(round,view){
    const layout=this.view.enemyLayout;if(!layout)return;
    const {columns,rows,cellWidth,height}=layout,positions=new Map(),intro=round.introRemaining>0,still=this.still;
    view.enemies.forEach((node,index)=>{
      const enemy=round.enemies[index],column=index%columns,row=Math.floor(index/columns),x=(column+.5)*cellWidth+round.drift(enemy)*cellWidth*ASSEMBLY.visuals.enemyDriftRatio;
      const finalY=(row+.5)*height/rows,delay=row*.3+column*.12,duration=round.introDuration-(rows-1)*.3-(columns-1)*.12,p=clamp((round.time-delay)/duration),ease=1-(1-p)**3;
      const y=intro&&!still?-100-row*30+(finalY+100+row*30)*ease:finalY;
      node.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%)';node.style.opacity=intro&&still?String(p):'';positions.set(enemy.id,{x,y});
    });
    if(!this.origin||!this.cannonPoint)this.measure();if(!this.origin||!this.cannonPoint)return;
    const target=positions.get(round.shot?.enemy||round.pending),guide=view.element.querySelector('.aim-guide'),line=guide.querySelector('line'),cannon=view.element.querySelector('.meaning-cannon'),shell=view.element.querySelector('.meaning-shell');
    if(target){
      const point={x:target.x+this.origin.x,y:target.y+this.origin.y},from=this.cannonPoint,dx=point.x-from.x,dy=point.y-from.y,angle=Math.atan2(dx,-dy)*180/Math.PI;
      cannon.style.setProperty('--aim-angle',angle+'deg');guide.toggleAttribute('hidden',intro);line.setAttribute('x1',from.x);line.setAttribute('y1',from.y);line.setAttribute('x2',point.x);line.setAttribute('y2',point.y);
      shell.hidden=!round.shot;
      if(round.shot){const t=clamp(round.shot.age/ASSEMBLY.visuals.flightSeconds),x=from.x+dx*t,y=from.y+dy*t;shell.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%)';}
    }else{guide.setAttribute('hidden','');shell.hidden=true;cannon.style.setProperty('--aim-angle','0deg');}
  }
}
