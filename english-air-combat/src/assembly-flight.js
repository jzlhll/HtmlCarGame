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
    const t=clamp(round.time/round.introDuration),{burstAt,settleAt}=ASSEMBLY.visuals.nova,still=this.still;
    if(t>=1&&view.novaSettled)return;
    const charge=clamp(t/burstAt),burst=clamp((t-burstAt)/(settleAt-burstAt)),ease=1-(1-burst)**3,fade=1-clamp((t-.7)/.3),event=view.element.querySelector('.nova-event');
    event.style.opacity=t>=1?'0':'1';event.style.setProperty('--charge',charge);event.style.setProperty('--burst',ease);
    event.style.setProperty('--planet-scale',String(t<burstAt?1+Math.sin(charge*Math.PI)*.08-charge**5*.19:Math.max(0,.81-burst*6)));
    event.style.setProperty('--planet-alpha',String(1-clamp(burst*9)));event.style.setProperty('--crack-alpha',String(charge**4*(1-clamp(burst*5))));
    event.style.setProperty('--aura-alpha',String(t<burstAt?.12+charge**2*.45:fade*.32));
    event.style.setProperty('--core-alpha',String(t<burstAt?charge**7*.3:(1-clamp(burst*1.8))*.95));event.style.setProperty('--flare-alpha',String(t<burstAt?charge**12*.2:Math.max(0,1-burst*4.3)));
    event.style.setProperty('--spark-alpha',String((burst>0?1:0)*fade));event.style.setProperty('--debris-alpha',String((burst>0?1:0)*(1-clamp((burst-.4)/.6))));
    event.style.setProperty('--shock-one',String(.75+ease*7));event.style.setProperty('--shock-one-alpha',String((burst>0?1:0)*(1-clamp(burst*1.3))*.85));
    const second=clamp((burst-.1)/.9);event.style.setProperty('--shock-two',String(.6+(1-(1-second)**3)*6));event.style.setProperty('--shock-two-alpha',String((burst>.1?1:0)*(1-second)*.65));
    event.style.setProperty('--cloud-alpha',String((burst>0?1:0)*Math.sin(burst*Math.PI)*.4));
    view.fragments.forEach((node,index)=>{
      const target=positions[index],motion=this.view.fragmentMotion[index],q=clamp((t-burstAt-motion.delay)/(settleAt-burstAt-motion.delay)),p=still?1:1-(1-q)**3;
      const dx=target.x-size.width*.5,dy=target.y-size.height*.44,length=Math.hypot(dx,dy)||1,arc=still?0:Math.sin(q*Math.PI)*(1-q)*Math.min(size.width,size.height)*motion.arc;
      const x=size.width*.5+dx*p-dy/length*arc,y=size.height*.44+dy*p+dx/length*arc;
      node.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) scale('+(still?1:.07+.93*p)+')';node.style.visibility=q>0||!round.introRemaining?'visible':'hidden';
      node.style.setProperty('--birth-spin',still?'0deg':(1-p)*motion.spin+'deg');node.style.setProperty('--letter-reveal',still?'1':String(clamp((q-.1)/.2)));
    });
    view.novaSettled=t>=1;
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
