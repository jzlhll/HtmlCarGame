import { RENDER_QUALITY } from './config.js';

// 系统信息只决定初档，持续帧间隔决定后续降档与恢复；物理步长保持独立。
export class RenderQuality {
  constructor({cores=0,memory=0,pixelRatio=1,width=1,height=1,maxTextureSize=Infinity}={}){
    this.initialLevel=cores&&cores<=2||memory&&memory<=2?2:cores&&cores<=4||memory&&memory<=4||maxTextureSize<8192?1:0;
    this.deviceRatio=Math.min(pixelRatio,RENDER_QUALITY.maxPixelRatio);this.resize(width,height);this.reset();
  }
  resize(width,height){
    this.maxRatio=Math.min(this.deviceRatio,Math.sqrt(RENDER_QUALITY.pixelBudget/Math.max(1,width*height)));
    this.minRatio=Math.min(RENDER_QUALITY.minPixelRatio,this.maxRatio);
    if(this.ratio!==undefined)this.ratio=Math.max(this.minRatio,Math.min(this.ratio,this.maxRatio));
  }
  clearWindow(){this.seconds=0;this.frames=0;this.slow=0;this.logicMs=0;this.renderMs=0;this.staticMs=0;}
  reset(){
    this.level=this.initialLevel;this.ratio=Math.max(this.minRatio,this.maxRatio-this.level*RENDER_QUALITY.pixelStep);
    this.warmup=RENDER_QUALITY.warmupSeconds;this.cooldown=0;this.goodSeconds=0;this.fast=false;this.metrics=null;this.clearWindow();
  }
  get detailLevel(){return Math.max(this.level,this.fast?1:0);}
  get settings(){return RENDER_QUALITY.levels[this.detailLevel];}
  sample(interval,live,game,cost={}){
    if(!live){this.clearWindow();this.warmup=RENDER_QUALITY.warmupSeconds;this.goodSeconds=0;return;}
    this.fast=game.nitro.boost>0||(this.fast?game.player.speed>RENDER_QUALITY.fastExitSpeed:game.player.speed>=RENDER_QUALITY.firstLevelFastSpeed);
    if(!Number.isFinite(interval)||interval<=0)return;
    if(this.warmup>0){this.warmup-=interval;return;}
    this.cooldown=Math.max(0,this.cooldown-interval);
    const target=game.level===2?RENDER_QUALITY.secondLevelFps:this.fast?RENDER_QUALITY.firstLevelFastFps:RENDER_QUALITY.normalFps,period=1/target;
    this.seconds+=interval;this.frames++;if(interval>period*RENDER_QUALITY.slowFrameFactor)this.slow++;
    this.logicMs+=cost.logicMs??0;this.renderMs+=cost.renderMs??0;this.staticMs+=cost.staticMs??0;
    if(this.seconds<RENDER_QUALITY.windowSeconds)return;
    const average=this.seconds/this.frames,slowRatio=this.slow/this.frames,cpu=(this.logicMs+this.renderMs)/this.frames;
    this.metrics={fps:1/average,slowRatio,logicMs:this.logicMs/this.frames,renderMs:this.renderMs/this.frames,staticMs:this.staticMs/this.frames};
    if(average>period*RENDER_QUALITY.downFrameFactor||slowRatio>RENDER_QUALITY.downSlowRatio){
      this.goodSeconds=0;
      if(this.cooldown===0){
        if(this.ratio>this.minRatio)this.ratio=Math.max(this.minRatio,this.ratio-RENDER_QUALITY.pixelStep);
        else this.level=Math.min(RENDER_QUALITY.levels.length-1,this.level+1);
        this.cooldown=RENDER_QUALITY.downCooldown;
      }
    }else if(average<=period*RENDER_QUALITY.recoverFrameFactor&&slowRatio<=RENDER_QUALITY.recoverSlowRatio&&cpu<period*1000*RENDER_QUALITY.recoverCpuFraction){
      this.goodSeconds+=this.seconds;
      if(this.cooldown===0&&this.goodSeconds>=RENDER_QUALITY.recoverSeconds){
        if(this.level>0)this.level--;else this.ratio=Math.min(this.maxRatio,this.ratio+RENDER_QUALITY.pixelStep);
        this.goodSeconds=0;this.cooldown=RENDER_QUALITY.recoverCooldown;
      }
    }else this.goodSeconds=0;
    this.clearWindow();
  }
}
