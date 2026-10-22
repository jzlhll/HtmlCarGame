import { cloudField } from './weather-world.js';
import { WEATHER, WEATHER_MOTION, WHITE_CLOUD_SCALE, SCENERY, worldHorizontalSpeed } from './config.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function cloudX(cloud,seconds=0) {
  if(cloud.kind!=='storm')return cloud.x;
  const omega=2*Math.PI/WEATHER_MOTION.periodSeconds,phase=cloud.id*2.399963;
  const amplitude=worldHorizontalSpeed(WEATHER.windKmh/3.6)/omega;
  return cloud.x+amplitude*(Math.sin(omega*seconds+phase)-Math.sin(phase));
}
export function cloudZ(cloud) { return cloud.z; }

// 天气只推进预生成云的变换和固定时钟，不在游玩阶段建立模型或纹理。
export class Weather {
  constructor(aircraft,world) {
    this.aircraft=aircraft;this.world=world;this.seconds=0;this.kind='clear';this.radarAvailable=true;
    this.visibility=SCENERY.fogFar;this.strength=0;this.currentCloud=-1;this.events=[];
    this.randomState=new Uint32Array(WEATHER.maxClouds);this.nextFlash=new Float64Array(WEATHER.maxClouds);
    for(let i=0;i<WEATHER.maxClouds;i++){this.randomState[i]=((world.runSeed??WEATHER.seed)+i*19571)>>>0;this.nextFlash[i]=4+this.random(i)*10;}
    this.flash={at:-Infinity,cloud:-1,hit:false,x:0,y:0,z:0,endX:0,endY:0,endZ:0};
    this.sample(aircraft.position);
  }
  random(id){const state=this.randomState[id]=(Math.imul(this.randomState[id],1664525)+1013904223)>>>0;return state/4294967296;}

  sample(position) {
    let white=0,storm=0,whiteVisibility=WEATHER.whiteVisibility,current=-1;
    for(const cloud of this.world.weather?.clouds||[]){
      const dx=position.x-cloudX(cloud,this.seconds),dz=position.z-cloudZ(cloud,this.seconds),c=Math.cos(cloud.heading),s=Math.sin(cloud.heading);
      const whiteCloud=cloud.kind==='white';
      const x=(c*dx-s*dz)/(WEATHER.width*cloud.scaleX*(whiteCloud?WHITE_CLOUD_SCALE.width:1)),y=(position.y-cloud.y)/(WEATHER.height*(whiteCloud?WHITE_CLOUD_SCALE.height:1)),z=(s*dx+c*dz)/(WEATHER.length*cloud.scaleZ);
      if(Math.abs(x)>.5||Math.abs(y)>.5||Math.abs(z)>.5)continue;
      const depth=clamp(-cloudField(x,y,z,this.world.weather.templates[cloud.variant])*3,0,1);
      if(cloud.kind==='white'&&depth>white){white=depth;whiteVisibility=cloud.thin?WEATHER.thinVisibility:WEATHER.whiteVisibility;}
      if(cloud.kind==='storm'&&depth>storm){storm=depth;current=cloud.id;}
    }
    this.kind=white>.08?'white':storm>.08?'storm':'clear';this.radarAvailable=this.kind!=='white';this.currentCloud=current;
    this.strength=this.kind==='white'?white:this.kind==='storm'?storm:0;
    this.visibility=this.kind==='white'?SCENERY.fogFar+(whiteVisibility-SCENERY.fogFar)*white:this.kind==='storm'?SCENERY.fogFar*(1-(1-WEATHER.stormVisibilityRatio)*storm):SCENERY.fogFar;
    return this.kind;
  }

  step(dt) {
    this.seconds+=dt;this.events.length=0;this.sample(this.aircraft.position);
    for(const cloud of this.world.weather?.clouds||[]){
      if(cloud.kind!=='storm'||this.seconds<this.nextFlash[cloud.id])continue;
      this.nextFlash[cloud.id]=this.seconds+WEATHER.flashInterval[0]+this.random(cloud.id)*(WEATHER.flashInterval[1]-WEATHER.flashInterval[0]);
      const x=cloudX(cloud,this.seconds),z=cloudZ(cloud,this.seconds),a=this.aircraft;
      if(Math.hypot(x-a.position.x,z-a.position.z)>18000)continue;
      const hit=!a.onGround&&!a.landed&&this.kind==='storm'&&this.currentCloud===cloud.id&&!a.lightningStrike&&this.random(cloud.id)<WEATHER.strikeChance;
      if(this.seconds-this.flash.at<WEATHER.flashSeconds&&!hit)continue;
      Object.assign(this.flash,{at:this.seconds,cloud:cloud.id,hit,x:x+(this.random(cloud.id)-.5)*WEATHER.width*.65,y:cloud.y+WEATHER.height*.45,z:z+(this.random(cloud.id)-.5)*WEATHER.length*.65});
      this.flash.endX=hit?a.position.x:this.flash.x+(this.random(cloud.id)-.5)*220;
      this.flash.endY=hit?a.position.y+4:Math.max(0,cloud.y-400);
      this.flash.endZ=hit?a.position.z:this.flash.z+(this.random(cloud.id)-.5)*220;
      if(hit){a.lightningStrike=true;this.events.push({type:'lightning-hit',key:'weather',reason:'Lightning fault（雷击故障）：本关无法再提速，仍可转向、调整高度和减速。'});}
      else this.events.push({type:'lightning-flash',key:'weather'});
    }
    return this.events;
  }
}
