import { AIR_CURRENTS } from './config.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
const labels={tailwind:['Tailwind','顺风正在加速'],headwind:['Headwind','逆风正在减速'],left:['Wind from left','左侧来风，飞机向右偏航'],right:['Wind from right','右侧来风，飞机向左偏航'],turbulence:['Turbulence','乱流正在扰动方向和姿态，操纵可抵消约一半']};

// 独立随机流和空中有效时钟，暂停／滑跑不消耗间隔，飞行中只计算已有状态。
export class AirCurrent {
  constructor(aircraft,seed=1){
    this.aircraft=aircraft;this.randomState=(seed^0x71ad3b95)>>>0;this.seconds=0;this.nextAt=AIR_CURRENTS.intervalSeconds;this.serial=0;
    this.kind=null;this.strength=0;this.speedRate=0;this.yawRate=0;this.pitchRate=0;this.bankOffset=0;this.remaining=0;this.controlYawLimit=Infinity;
  }
  random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  start(){
    const p=this.random();this.kind=p<AIR_CURRENTS.turbulenceChance?'turbulence':['tailwind','headwind','left','right'][Math.min(3,Math.floor((p-AIR_CURRENTS.turbulenceChance)/(1-AIR_CURRENTS.turbulenceChance)*4))];
    this.serial++;this.startedAt=this.nextAt;this.nextAt+=AIR_CURRENTS.intervalSeconds;
    this.duration=this.kind==='turbulence'?AIR_CURRENTS.turbulenceSeconds:AIR_CURRENTS.gustSeconds;
    this.initialSpeed=this.aircraft.airspeed;this.phaseA=this.random()*Math.PI*2;this.phaseB=this.random()*Math.PI*2;
  }
  clear(){this.kind=null;this.strength=0;this.speedRate=0;this.yawRate=0;this.pitchRate=0;this.bankOffset=0;this.remaining=0;this.controlYawLimit=Infinity;}
  step(dt){
    if(this.aircraft.onGround||this.aircraft.landed){this.clear();return;}
    this.seconds+=dt;
    if(!this.kind&&this.seconds>=this.nextAt-1e-9)this.start();
    if(!this.kind)return;
    const age=Math.max(0,this.seconds-this.startedAt),s=AIR_CURRENTS;
    if(age>=this.duration-1e-9){this.clear();return;}
    this.remaining=this.duration-age;this.strength=smooth(age/s.rampSeconds)*smooth(this.remaining/s.rampSeconds);
    this.speedRate=0;this.yawRate=0;this.pitchRate=0;this.bankOffset=0;this.controlYawLimit=Infinity;
    if(this.kind==='tailwind'||this.kind==='headwind'){
      // 两侧各一秒平滑坡道的面积为一秒，完整无操纵气流分别带来+50%／−60%速度增量。
      this.speedRate=this.initialSpeed*(this.kind==='tailwind'?s.tailwindRatio:s.headwindRatio)/(this.duration-s.rampSeconds)*this.strength;
    }else if(this.kind==='left'||this.kind==='right'){
      const direction=this.kind==='left'?1:-1;
      this.yawRate=direction*s.sideYawRate*this.strength;this.bankOffset=direction*s.sideBank*this.strength;
      this.controlYawLimit=s.sideYawRate*s.correctionRatio;
    }else{
      const yaw=.72*Math.sin(age*1.9+this.phaseA)+.28*Math.sin(age*4.3+this.phaseB);
      const pitch=.74*Math.sin(age*1.3+this.phaseB)+.26*Math.sin(age*3.1+this.phaseA);
      this.yawRate=yaw*s.turbulentYawRate*this.strength;this.pitchRate=pitch*s.turbulentPitchRate*this.strength;
      this.bankOffset=(.8*Math.sin(age*2.1+this.phaseB)+.2*Math.sin(age*4.1+this.phaseA))*s.turbulentBank*this.strength;
      this.controlYawLimit=s.turbulentYawRate*s.correctionRatio;
    }
  }
  limitSpeedRate(rateKmh,direction=0){
    if(!this.speedRate||direction*this.speedRate>=0)return rateKmh;
    return Math.min(rateKmh,Math.max(Math.abs(this.speedRate)*AIR_CURRENTS.correctionRatio,rateKmh*(1-this.strength)));
  }
  get guidance(){return this.kind?labels[this.kind]:null;}
}
