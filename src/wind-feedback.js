import { WIND_EFFECTS } from './config.js';

// 声画共用气流有效时间；暂停不推进脉冲，不建立额外计时器。
export function windPulse(current) {
  const age=Math.max(0,current.seconds-current.startedAt);
  return Math.pow(.5+.5*Math.sin(age*Math.PI*2*WIND_EFFECTS.pulseHz),2);
}

export class WindFeedback {
  constructor(container) {
    const ns='http://www.w3.org/2000/svg',make=(name,attrs={})=>{
      const element=document.createElementNS(ns,name);
      for(const [key,value]of Object.entries(attrs))element.setAttribute(key,value);
      return element;
    };
    this.element=make('svg',{class:'wind-traces',viewBox:'0 0 1280 720',preserveAspectRatio:'none','aria-hidden':'true'});
    this.element.style.display='none';
    const defs=make('defs'),clip=make('clipPath',{id:'wind-window-clip'});
    clip.append(make('path',{d:'M60 40H1220L1180 520H100Z'}));defs.append(clip);this.element.append(defs);
    const window=make('g',{'clip-path':'url(#wind-window-clip)'});this.element.append(window);
    this.banks=[];
    for(const radial of [false,true]){
      const bank=make('g'),waves=[];window.append(bank);
      for(let w=0;w<WIND_EFFECTS.waves;w++){
        const wave=make('g');bank.append(wave);waves.push(wave);
        for(let i=0;i<WIND_EFFECTS.tracesPerWave;i++){
          const y=65+(i*67+w*43)%450,x=(i*191+w*127)%800-400;
          const angle=i/WIND_EFFECTS.tracesPerWave*Math.PI*2+w*.19,dx=Math.cos(angle),dy=Math.sin(angle);
          const d=radial
            ? `M${640+dx*190} ${300+dy*130}Q${640+dx*380-dy*16} ${300+dy*260+dx*16} ${640+dx*580} ${300+dy*390}`
            : `M${x} ${y}q145 -24 310 4`;
          wave.append(make('path',{d,fill:'none',stroke:'#e6f5ff','stroke-width':1.2+(i%3)*.5,'stroke-opacity':.35+(i%4)*.12,'stroke-linecap':'round','vector-effect':'non-scaling-stroke'}));
        }
      }
      this.banks.push({bank,waves});
    }
    container.append(this.element);
  }

  update(game) {
    const current=game.airCurrent,a=game.aircraft;
    const visible=Boolean(current?.kind&&current.strength>0&&game.view==='COCKPIT'&&!a.onGround&&!a.landed&&!['CRASH','COMPLETE','RESULT','READY','INTRO'].includes(game.phase));
    // SVG不支持HTML hidden属性，显式使用display；暂停保留静止痕迹。
    this.element.style.display=visible?'block':'none';
    if(!visible)return;
    const radial=current.kind==='tailwind'||current.kind==='headwind',age=Math.max(0,current.seconds-current.startedAt);
    const opacity=WIND_EFFECTS.opacity*current.strength*(.4+.6*windPulse(current));
    for(let bankIndex=0;bankIndex<this.banks.length;bankIndex++){
      const {bank,waves}=this.banks[bankIndex];bank.style.display=Boolean(bankIndex)===radial?'':'none';
      if(Boolean(bankIndex)!==radial)continue;
      for(let i=0;i<waves.length;i++){
        const p=(age/WIND_EFFECTS.travelSeconds+i/waves.length)%1;
        waves[i].setAttribute('opacity',opacity*Math.sin(p*Math.PI));
        if(radial){
          const scale=current.kind==='headwind'?.45+p*1.4:1.85-p*1.4;
          waves[i].setAttribute('transform',`translate(640 300) scale(${scale}) translate(-640 -300)`);
        }else{
          const direction=current.kind==='right'?-1:1,rotation=current.kind==='turbulence'?Math.sin(age*1.7)*32:-5;
          waves[i].setAttribute('transform',`translate(${direction*(-650+p*2100)} 0) rotate(${rotation} 640 300)`);
        }
      }
    }
  }
}
