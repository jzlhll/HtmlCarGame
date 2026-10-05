import { AUDIO, MAX_RANK, VEHICLES, clamp } from './config.js';

// 全部音效由 Web Audio 实时合成，不加载音频文件；上下文在首次用户手势（开始游戏）时创建。
// 环境声（发动机、喷气、横风、流水、火车、坦克、掠过车流）按帧更新增益、声像与音高，
// 火车、坦克与掠过车辆额外按接近速率做多普勒音高变化；事件声按次触发，暂停与结算立即静音。
export class GameAudio {
  constructor(){this.context=null;this.scrapeAt=0;this.trainDistance=Infinity;this.tankDistance=Infinity;this.sites=[];this.passing=new Map();}
  ensure(){
    if(this.context){this.context.resume();return;}
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    const ctx=this.context=new Ctx();
    const master=this.master=ctx.createGain();master.gain.value=AUDIO.master;
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-16;limiter.knee.value=8;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.2;
    master.connect(limiter);limiter.connect(ctx.destination);
    // 两秒白噪声缓冲，供所有噪声源循环共享。
    const noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    this.noiseBuffer=noise;
    this.engine=this.engineLoop();this.jet=this.jetLoop();this.wind=this.windLoop();
    this.water=this.waterLoop();this.train=this.trainLoop();this.tank=this.tankLoop();
  }
  noiseSource(){const src=this.context.createBufferSource();src.buffer=this.noiseBuffer;src.loop=true;src.start();return src;}
  ramp(param,value,time=.08){param.setTargetAtTime(value,this.context.currentTime,time);}
  panner(pan){
    if(!pan||!this.context.createStereoPanner)return null;
    const node=this.context.createStereoPanner();node.pan.value=clamp(pan,-1,1);return node;
  }
  engineLoop(){
    const ctx=this.context,gain=ctx.createGain();gain.gain.value=0;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=560;filter.Q.value=1.1;
    const saw=ctx.createOscillator();saw.type='sawtooth';saw.frequency.value=AUDIO.engine.baseHz;
    const sub=ctx.createOscillator();sub.type='triangle';sub.frequency.value=AUDIO.engine.baseHz*2;
    const subGain=ctx.createGain();subGain.gain.value=.4;
    saw.connect(filter);sub.connect(subGain);subGain.connect(filter);filter.connect(gain);gain.connect(this.master);
    saw.start();sub.start();
    return {gain,saw,sub};
  }
  jetLoop(){
    const ctx=this.context,gain=ctx.createGain();gain.gain.value=0;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=AUDIO.engine.jetHz;filter.Q.value=.7;
    const src=this.noiseSource();src.connect(filter);filter.connect(gain);gain.connect(this.master);
    return {gain,filter};
  }
  windLoop(){
    const ctx=this.context,gain=ctx.createGain();gain.gain.value=0;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=480;filter.Q.value=.5;
    const lfo=ctx.createOscillator();lfo.frequency.value=.5;
    const depth=ctx.createGain();depth.gain.value=240;lfo.connect(depth);depth.connect(filter.frequency);lfo.start();
    let last=gain;
    if(ctx.createStereoPanner){this.windPan=ctx.createStereoPanner();filter.connect(this.windPan);last=this.windPan;}
    const src=this.noiseSource();src.connect(filter);last.connect(gain);gain.connect(this.master);
    return {gain};
  }
  waterLoop(){
    const ctx=this.context,gain=ctx.createGain();gain.gain.value=0;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=950;filter.Q.value=1.3;
    const lfo=ctx.createOscillator();lfo.frequency.value=1.6;
    const depth=ctx.createGain();depth.gain.value=320;lfo.connect(depth);depth.connect(filter.frequency);lfo.start();
    const src=this.noiseSource();src.connect(filter);filter.connect(gain);gain.connect(this.master);
    return {gain};
  }
  trainLoop(){
    // 方波幅度调制产生“哐当哐当”的行进节奏；声像随火车横穿桥下左右移动。
    const ctx=this.context,out=ctx.createGain();out.gain.value=0;
    const pulse=ctx.createGain();pulse.gain.value=.6;
    const lfo=ctx.createOscillator();lfo.type='square';lfo.frequency.value=4.4;
    const depth=ctx.createGain();depth.gain.value=.4;lfo.connect(depth);depth.connect(pulse.gain);lfo.start();
    const rumble=ctx.createBiquadFilter();rumble.type='lowpass';rumble.frequency.value=130;rumble.Q.value=.8;
    const clatter=ctx.createBiquadFilter();clatter.type='bandpass';clatter.frequency.value=1100;clatter.Q.value=1.2;
    const clatterGain=ctx.createGain();clatterGain.gain.value=.16;
    let last=pulse;
    const pan=this.panner(0);if(pan){pulse.connect(pan);last=pan;}
    const src=this.noiseSource();src.connect(rumble);src.connect(clatter);
    clatter.connect(clatterGain);clatterGain.connect(pulse);rumble.connect(pulse);last.connect(out);out.connect(this.master);
    return {gain:out,lfo,rumble,clatter,pan};
  }
  tankLoop(){
    // 低通履带噪声叠加慢速幅度调制，形成贴近的轰隆感；声像按坦克所在侧偏置。
    const ctx=this.context,out=ctx.createGain();out.gain.value=0;
    const pulse=ctx.createGain();pulse.gain.value=.7;
    const lfo=ctx.createOscillator();lfo.frequency.value=9.5;
    const depth=ctx.createGain();depth.gain.value=.3;lfo.connect(depth);depth.connect(pulse.gain);lfo.start();
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=95;filter.Q.value=.9;
    let last=pulse;
    const pan=this.panner(0);if(pan){pulse.connect(pan);last=pan;}
    const src=this.noiseSource();src.connect(filter);filter.connect(pulse);last.connect(out);out.connect(this.master);
    return {gain:out,lfo,filter,pan};
  }
  doppler(distance,dt,previous){
    // 接近时音高抬升、远离时下降；参照速率取声源常见相对速度上限。
    const closing=Number.isFinite(previous)?(previous-distance)/Math.max(dt,1e-4):0;
    return clamp(1+closing/60,.82,1.3);
  }
  update(dt,game){
    if(!this.context)return;
    const run=game.state==='RUNNING',p=game.player,t=this.context.currentTime;
    // 发动机：音高随车速抬升，喷气时叠加气流噪声。
    const ratio=clamp(p.speed/VEHICLES[p.rank].playerMax,0,1.7);
    const hz=AUDIO.engine.baseHz+ratio*AUDIO.engine.speedHz;
    this.ramp(this.engine.saw.frequency,hz,.05);this.ramp(this.engine.sub.frequency,hz*2,.05);
    this.ramp(this.engine.gain.gain,run?AUDIO.engine.gain*(.3+.7*Math.min(ratio,1)):0,.1);
    this.ramp(this.jet.gain.gain,run&&game.nitro.boost>0?AUDIO.engine.jetGain:0,.07);
    // 横风：秋季风场开启时按风向偏置声像。
    const event=game.weather.event,windOn=run&&event&&event.season===2&&(!event.route||event.route===p.route);
    this.ramp(this.wind.gain.gain,windOn?AUDIO.wind.gain:0,.25);
    if(this.windPan)this.windPan.pan.setTargetAtTime(windOn?event.wind*AUDIO.wind.pan:0,t,.15);
    // 河道流水：按玩家与河道段的距离连续淡入淡出，由远及近再远去。
    let water=0;
    if(run){
      game.road.infrastructure(p.s-90,p.s+90,this.sites);
      for(const site of this.sites){
        if(site.kind!=='dip'||site.feature!=='river')continue;
        const distance=p.s<site.flatStart?site.flatStart-p.s:p.s>site.flatEnd?p.s-site.flatEnd:0;
        water=Math.max(water,clamp(1-distance/AUDIO.water.range,0,1));
      }
    }
    this.ramp(this.water.gain.gain,water*water*AUDIO.water.gain,.2);
    // 火车：按桥下火车与玩家的直线距离控制哐当声，声像随横穿方向移动并叠加多普勒。
    // 暂停后 trains 数组冻结滞留，计算必须随 run 门控，否则 setState 静音后又被拉高。
    let train=0,trainPan=0,trainDistance=Infinity;
    if(run)for(const item of game.infrastructure.trains){
      const distance=Math.hypot(item.site.center-p.s,item.d-p.d);
      const proximity=clamp(1-distance/AUDIO.train.range,0,1);
      if(proximity>train){train=proximity;trainPan=clamp(item.d/50,-1,1)*AUDIO.train.pan*proximity;trainDistance=distance;}
    }
    if(train){
      const factor=this.doppler(trainDistance,dt,this.trainDistance);
      this.trainDistance=trainDistance;
      this.ramp(this.train.lfo.frequency,4.4*factor,.1);
      this.ramp(this.train.rumble.frequency,130*factor,.1);this.ramp(this.train.clatter.frequency,1100*factor,.1);
      if(this.train.pan)this.train.pan.pan.setTargetAtTime(trainPan,t,.12);
    }else this.trainDistance=Infinity;
    this.ramp(this.train.gain.gain,train*train*AUDIO.train.gain,.15);
    // 坦克：附近系统坦克的履带低频轰隆，按距离与所在侧衰减，同样带多普勒；随 run 门控。
    let tank=0,tankPan=0,tankDistance=Infinity;
    if(run)for(const car of game.traffic.cars){
      if(car.rank!==MAX_RANK||car.remove)continue;
      const distance=Math.hypot(car.s-p.s,car.d-p.d),proximity=clamp(1-distance/AUDIO.tank.range,0,1);
      if(proximity>tank){tank=proximity;tankPan=clamp((car.d-p.d)/10,-1,1)*AUDIO.tank.pan*proximity;tankDistance=distance;}
    }
    if(tank){
      const factor=this.doppler(tankDistance,dt,this.tankDistance);
      this.tankDistance=tankDistance;
      this.ramp(this.tank.lfo.frequency,9.5*factor,.1);
      this.ramp(this.tank.filter.frequency,95*factor,.1);
      if(this.tank.pan)this.tank.pan.pan.setTargetAtTime(tankPan,t,.15);
    }else this.tankDistance=Infinity;
    this.ramp(this.tank.gain.gain,tank*tank*AUDIO.tank.gain,.2);
    // 掠过车流：车辆从前进越过玩家的瞬间播放带声像的呼啸，音量按横向距离与相对速度衰减。
    if(run){
      const seen=new Map();
      for(const car of game.traffic.cars){
        if(car.remove)continue;
        const distance=Math.abs(car.s-p.s);
        if(distance>60)continue;
        seen.set(car.id,{s:car.s,d:car.d,direction:car.direction,speed:car.speed});
        const old=this.passing.get(car.id);
        if(!old||!(old.s>p.s&&car.s<=p.s))continue;
        const lateral=Math.abs(car.d-p.d),relative=car.direction<0?p.speed+car.speed:p.speed-car.speed;
        if(lateral>AUDIO.pass.range||relative<AUDIO.pass.minSpeed)continue;
        const strength=clamp(1-lateral/AUDIO.pass.range,0,1)*clamp(relative/30,0,1);
        this.pass(Math.sign(car.d-p.d)||1,strength*strength*AUDIO.pass.gain);
      }
      this.passing=seen;
    }else this.passing.clear();
    // 路边刮蹭：持续刮擦时周期性短噪声。
    if(run&&game.scraping&&t>=this.scrapeAt){this.scrape();this.scrapeAt=t+.13;}
  }
  setState(state){
    if(!this.context||state==='RUNNING')return;
    // 暂停、结算或返回首页立即静音全部环境声，事件声自然衰减。
    for(const loop of [this.engine,this.jet,this.wind,this.water,this.train,this.tank])this.ramp(loop.gain.gain,0,.05);
  }
  tone(type,f0,f1,dur,gain,delay=0,pan=0){
    const ctx=this.context,t=ctx.currentTime+delay;
    const osc=ctx.createOscillator();osc.type=type;osc.frequency.setValueAtTime(Math.max(1,f0),t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
    const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);
    g.gain.linearRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    osc.connect(g);let last=g;
    const panner=this.panner(pan);if(panner){g.connect(panner);last=panner;}
    last.connect(this.master);osc.start(t);osc.stop(t+dur+.05);
  }
  burst(f0,f1,type,Q,dur,gain,delay=0,pan=0){
    const ctx=this.context,t=ctx.currentTime+delay;
    const src=ctx.createBufferSource();src.buffer=this.noiseBuffer;src.loop=true;
    const filter=ctx.createBiquadFilter();filter.type=type;filter.Q.value=Q;
    filter.frequency.setValueAtTime(Math.max(20,f0),t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);
    g.gain.linearRampToValueAtTime(gain,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    src.connect(filter);filter.connect(g);let last=g;
    const panner=this.panner(pan);if(panner){g.connect(panner);last=panner;}
    last.connect(this.master);src.start(t);src.stop(t+dur+.1);
  }
  pass(pan,gain){
    if(!this.context)return;
    this.burst(820,300,'bandpass',.9,.55,gain,0,clamp(pan,-1,1)*.65);
    this.burst(240,110,'lowpass',.7,.4,gain*.7,.02,clamp(pan,-1,1)*.4);
  }
  collision(group){
    if(!this.context)return;
    // 射弹命中音由 hurtProjectile 播放（按同刻事件组只响一次），此处不重复触发。
    for(const e of group)switch(e.action){
      case 'eat':this.eat();break;
      case 'bounce':this.side();break;
      case 'graze':this.graze();break;
      case 'cowDowngrade':this.side();break;
      case 'knockaway':case 'downgrade':case 'wall':case 'roadwork':this.crash();break;
    }
  }
  beep(mult=1){
    if(!this.context)return;
    const hz=AUDIO.beep.hz*mult;
    this.tone('square',hz,hz,.07,AUDIO.beep.gain);this.tone('square',hz,hz,.07,AUDIO.beep.gain,.12);
  }
  rear(){if(!this.context)return;this.tone('square',1180,1180,.06,.04);this.tone('square',1180,1180,.06,.04,.11);}
  start(){if(!this.context)return;this.tone('sawtooth',55,135,.7,.08);this.burst(250,900,'lowpass',.6,.6,.04);}
  freeze(){if(!this.context)return;this.tone('triangle',2100,320,.5,.11);this.burst(5200,3600,'highpass',.8,.4,.05,.02);this.tone('sine',340,180,.35,.07,.06);}
  thunder(){if(!this.context)return;this.burst(3200,2600,'highpass',.7,.12,.24);this.burst(420,55,'lowpass',.6,1.6,.5,.03);this.tone('sine',58,26,1.2,.26,.05);}
  explosion(){if(!this.context)return;this.burst(2400,1800,'bandpass',.8,.14,.2);this.burst(850,48,'lowpass',.5,1.4,.55,.02);this.tone('sine',88,26,1.1,.4,.02);}
  crash(){if(!this.context)return;this.burst(1900,1400,'bandpass',.9,.09,.16);this.burst(380,120,'bandpass',.7,.32,.4,.01);this.tone('square',175,60,.24,.18);}
  side(){if(!this.context)return;this.burst(520,240,'bandpass',.8,.2,.3);this.tone('sine',150,72,.24,.24);}
  graze(){if(!this.context)return;this.burst(2600,1900,'bandpass',2,.16,.11);}
  eat(){if(!this.context)return;this.tone('sine',270,85,.2,.17);this.burst(600,240,'lowpass',.7,.12,.12,.01);}
  impact(){if(!this.context)return;this.tone('square',720,520,.08,.13);this.burst(1800,1200,'bandpass',1.4,.1,.17);}
  mud(){if(!this.context)return;this.burst(380,150,'lowpass',.8,.4,.3);}
  bump(){if(!this.context)return;this.tone('sine',130,58,.28,.28);this.burst(260,110,'lowpass',.7,.22,.22,.01);}
  splash(){if(!this.context)return;this.burst(950,380,'bandpass',.9,.7,.3);this.burst(2600,1900,'highpass',.8,.3,.07,.03);}
  upgrade(){if(!this.context)return;[523,659,784].forEach((hz,i)=>this.tone('sine',hz,hz,.22,.09,i*.09));}
  downgrade(){if(!this.context)return;this.tone('sine',392,330,.2,.09);this.tone('sine',330,262,.26,.09,.11);}
  horse(){if(!this.context)return;[1318,1760,2217].forEach((hz,i)=>this.tone('sine',hz,hz,.26,.06,i*.07));}
  result(){if(!this.context)return;this.tone('sine',587,587,.25,.07);this.tone('sine',466,466,.4,.07,.14);}
  scrape(){if(!this.context)return;this.burst(3200,2500,'bandpass',3,.09,.06);}
}
