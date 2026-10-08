import { AUDIO, MAX_RANK, VEHICLES, clamp } from './config.js';

// 游戏和试听共用的轮轨波形；撞缝节奏与共鸣取自参考音频分析，不加载录音。
export function trainSamples(sampleRate){
  const beat=AUDIO.train.clatter;
  const clatter=new Float32Array(Math.round(sampleRate*beat.period));
  for(let hit=0;hit<beat.hits.length;hit++){
    const [offset,weight,brightness]=beat.hits[hit];
    const layers=[[beat.body,weight,beat.bodyTail],[beat.metal,weight*brightness,beat.metalTail]];
    // 两次冲击保持轮轨音色，靠低频重量和金属亮度形成“哐当”，不把第二下移调成鼓点。
    for(const [modes,gain,tail]of layers){
      for(let mode=0;mode<modes.length;mode++){
        const [hz,strength,decay]=modes[mode],phase=(mode+hit)*beat.phaseStep;
        const end=Math.min(clatter.length,Math.ceil((offset+decay*beat.decayLimit)*sampleRate));
        for(let i=Math.ceil(offset*sampleRate);i<end;i++){
          const time=i/sampleRate-offset,attack=Math.min(1,time/beat.attack);
          const envelope=Math.exp(-time/decay)*(1+time/tail);
          clatter[i]+=attack*gain*strength*Math.cos(2*Math.PI*hz*time+phase)*envelope;
        }
      }
    }
  }
  const mean=clatter.reduce((sum,value)=>sum+value,0)/clatter.length;
  for(let i=0;i<clatter.length;i++)clatter[i]-=mean;
  let peak=0;for(const value of clatter)peak=Math.max(peak,Math.abs(value));
  if(peak>1)for(let i=0;i<clatter.length;i++)clatter[i]/=peak;
  return {clatter};
}
export function trainClatterRate(age){
  const beat=AUDIO.train.clatter;
  return beat.rateStart+(beat.rateEnd-beat.rateStart)*clamp(age/beat.accelerateSeconds,0,1);
}

// 全部音效由 Web Audio 实时合成，不加载音频文件；上下文在首次用户手势（开始游戏）时创建。
// 环境声（发动机、喷气、横风、流水、火车、坦克、掠过车流）按帧更新增益、声像与音高，
// 坦克与掠过车辆额外按接近速率做多普勒音高变化；事件声按次触发，暂停与结算立即静音。
export class GameAudio {
  constructor(){this.context=null;this.scrapeAt=0;this.grazeAt=0;this.tankDistance=Infinity;this.policeDistance=Infinity;this.sites=[];this.passing=new Map();}
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
    this.water=this.waterLoop();this.train=this.trainLoop();this.tank=this.tankLoop();this.police=this.policeLoop();
    this.dinosaurVoices=Object.fromEntries(Object.entries(AUDIO.dinosaurs).filter(([key])=>key!=='step').map(([key,cfg])=>[key,this.dinosaurLoop(cfg)]));
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
    // 成对轮轨敲击，共用距离增益与声像。
    const ctx=this.context,settings=AUDIO.train,out=ctx.createGain(),mix=ctx.createGain();out.gain.value=0;
    const pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
    if(pan){mix.connect(pan);pan.connect(out);}else mix.connect(out);
    out.connect(this.master);
    const samples=trainSamples(ctx.sampleRate),clatterBuffer=ctx.createBuffer(1,samples.clatter.length,ctx.sampleRate);
    clatterBuffer.getChannelData(0).set(samples.clatter);
    const clatter=ctx.createBufferSource();clatter.buffer=clatterBuffer;clatter.loop=true;
    const clatterGain=ctx.createGain();clatterGain.gain.value=settings.clatter.gain;
    clatter.connect(clatterGain);clatterGain.connect(mix);clatter.start();
    return {gain:out,pan,clatter};
  }
  dinosaurLoop(cfg){
    const ctx=this.context,gain=ctx.createGain(),filter=ctx.createBiquadFilter();gain.gain.value=0;
    filter.type='bandpass';filter.frequency.value=cfg.hz*4;filter.Q.value=1.4;
    const voice=ctx.createOscillator();voice.type='sawtooth';voice.frequency.value=cfg.hz;
    const breath=ctx.createBiquadFilter();breath.type='lowpass';breath.frequency.value=cfg.hz*7;
    const noiseGain=ctx.createGain();noiseGain.gain.value=.14;
    const noise=this.noiseSource();noise.connect(breath);breath.connect(noiseGain);noiseGain.connect(filter);voice.connect(filter);
    const vibrato=ctx.createOscillator(),depth=ctx.createGain();vibrato.frequency.value=7;depth.gain.value=cfg.hz*.045;vibrato.connect(depth);depth.connect(voice.frequency);vibrato.start();
    const pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
    if(pan){filter.connect(pan);pan.connect(gain);}else filter.connect(gain);
    gain.connect(this.master);voice.start();return {gain,pan,voice,filter};
  }
  updateDinosaurs(game,run){
    const p=game.player,now=game.activeSeconds,position=game.road.at(p.s,p.d,p.route);
    for(const [type,voice]of Object.entries(this.dinosaurVoices)){
      const cfg=AUDIO.dinosaurs[type];let strength=0,pan=0,phase=0;
      if(run&&game.level===2)for(const source of game.renderer?.dinosaurView.sources??[]){
        if(source.type!==type)continue;
        const point=game.road.at(source.s,source.d),distance=Math.hypot(point.x-position.x,point.z-position.z,(source.y??point.y)-position.y),proximity=clamp(1-distance/cfg.range,0,1);
        if(proximity>strength){strength=proximity;pan=clamp((source.d-p.d)/65,-1,1)*cfg.pan;phase=typeof source.id==='number'?source.id%7:source.id.length%7;}
      }
      const cycle=((now+phase)%cfg.period)/cfg.period,envelope=Math.pow(Math.max(0,Math.sin(cycle*Math.PI*2)),1.4);
      this.ramp(voice.gain.gain,strength*strength*cfg.gain*envelope,.08);
      this.ramp(voice.voice.frequency,cfg.hz*(.8+.35*Math.sin(cycle*Math.PI)),.1);
      this.ramp(voice.filter.frequency,cfg.hz*(3+2*envelope),.12);
      if(voice.pan)this.ramp(voice.pan.pan,pan,.1);
    }
  }
  dinosaurStep(foot,game){
    if(!this.context)return;
    const cfg=AUDIO.dinosaurs.step,p=game.player,distance=Math.hypot(foot.s-p.s,foot.d-p.d),gain=cfg.gain*Math.pow(clamp(1-distance/cfg.range,0,1),2),pan=clamp((foot.d-p.d)/12,-1,1);
    this.tone('sine',cfg.hz,cfg.hz*.4,.38,gain,0,pan);this.burst(260,75,'lowpass',.7,.3,gain*.8,0,pan);
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
  policeLoop(){
    // 警车警笛“嗯、嗯、嗯”:低频三角波按固定节奏通断形成短促脉冲,
    // 每个脉冲内频率轻微下滑模拟鸣响收尾;声像按警车所在侧偏置。
    const ctx=this.context,out=ctx.createGain();out.gain.value=0;
    const osc=ctx.createOscillator();osc.type='triangle';
    osc.frequency.value=AUDIO.police.hz;
    const drop=ctx.createOscillator();drop.type='sine';drop.frequency.value=AUDIO.police.pulseHz;
    const dropDepth=ctx.createGain();dropDepth.gain.value=AUDIO.police.dropHz/2;
    drop.connect(dropDepth);dropDepth.connect(osc.frequency);drop.start();
    const pulse=ctx.createGain();pulse.gain.value=.5;
    const gate=ctx.createOscillator();gate.type='square';gate.frequency.value=AUDIO.police.pulseHz;
    const gateDepth=ctx.createGain();gateDepth.gain.value=.5;
    gate.connect(gateDepth);gateDepth.connect(pulse.gain);gate.start();
    let last=pulse;
    const pan=this.panner(0);if(pan){pulse.connect(pan);last=pan;}
    osc.connect(pulse);last.connect(out);out.connect(this.master);osc.start();
    return {gain:out,pan};
  }
  doppler(distance,dt,previous){
    // 接近时音高抬升、远离时下降；参照速率取声源常见相对速度上限。
    const closing=Number.isFinite(previous)?(previous-distance)/Math.max(dt,1e-4):0;
    return clamp(1+closing/60,.82,1.3);
  }
  update(dt,game){
    if(!this.context)return;
    const run=game.state==='RUNNING',p=game.player,t=this.context.currentTime;
    this.updateDinosaurs(game,run);
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
    // 火车：只播放逐渐加快的轮轨“哐当”声，按距离与横穿位置淡入淡出。
    // 暂停后 trains 数组冻结滞留，计算必须随 run 门控，否则 setState 静音后又被拉高。
    let train=0,trainPan=0,trainItem=null;
    if(run&&game.level!==2)for(const item of game.infrastructure.trains){
      const distance=Math.hypot(item.site.center-p.s,item.d-p.d);
      const proximity=clamp(1-distance/AUDIO.train.range,0,1);
      if(proximity>train){train=proximity;trainPan=clamp((item.d-p.d)/50,-1,1)*AUDIO.train.pan*proximity;trainItem=item;}
    }
    if(train){
      this.ramp(this.train.clatter.playbackRate,trainClatterRate(trainItem.age),.1);
      if(this.train.pan)this.train.pan.pan.setTargetAtTime(trainPan,t,.12);
    }
    this.ramp(this.train.gain.gain,train*train*AUDIO.train.gain,.15);
    // 坦克：附近系统坦克的履带低频轰隆，按距离与所在侧衰减，同样带多普勒；随 run 门控。
    let tank=0,tankPan=0,tankDistance=Infinity;
    if(run)for(const car of game.traffic.cars){
      if(car.rank<MAX_RANK||car.remove)continue;
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
    // 警车警笛:按警车距离淡入,声像随所在侧偏置并叠加多普勒;随 run 门控,暂停与答题自动静音。
    let police=0,policePan=0,policeDistance=Infinity;
    if(run&&game.police?.police){
      const car=game.police.police,distance=Math.hypot(car.s-p.s,car.d-p.d);
      police=clamp(1-distance/AUDIO.police.range,0,1);
      policePan=clamp((car.d-p.d)/12,-1,1)*AUDIO.police.pan;
      policeDistance=distance;
    }
    if(police){
      const factor=this.doppler(policeDistance,dt,this.policeDistance);
      this.policeDistance=policeDistance;
      if(this.police.pan)this.police.pan.pan.setTargetAtTime(policePan,t,.15);
    }else this.policeDistance=Infinity;
    this.ramp(this.police.gain.gain,police*police*AUDIO.police.gain,.15);
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
    if(!this.context)return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(state==='RUNNING'?AUDIO.master:0,this.context.currentTime);
    if(state==='RUNNING')return;
    // 暂停、结算或返回首页关闭总增益，已经发出的事件声同时静音。
    for(const loop of [this.engine,this.jet,this.wind,this.water,this.train,this.tank,this.police,...Object.values(this.dinosaurVoices)])this.ramp(loop.gain.gain,0,.05);
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
    // 闪电等远程命中音由 Game.hurt 播放（按同刻事件组只响一次），此处不重复触发。
    for(const e of group)switch(e.action){
      case 'eat':this.eat();break;
      case 'bounce':this.side();break;
      case 'graze':this.graze();break;
      case 'cowDowngrade':case 'armorDowngrade':this.side();break;
      case 'knockaway':case 'downgrade':case 'wall':case 'roadwork':this.crash();break;
    }
  }
  beep(mult=1){
    if(!this.context)return;
    const hz=AUDIO.beep.hz*mult;
    this.tone('square',hz,hz,.07,AUDIO.beep.gain);this.tone('square',hz,hz,.07,AUDIO.beep.gain,.12);
  }
  rear(){if(!this.context)return;this.tone('square',1180,1180,.06,.04);this.tone('square',1180,1180,.06,.04,.11);}
  start(){this.grazeAt=0;if(!this.context)return;this.tone('sawtooth',55,135,.7,.08);this.burst(250,900,'lowpass',.6,.6,.04);}
  freeze(){if(!this.context)return;this.tone('triangle',2100,320,.5,.11);this.burst(5200,3600,'highpass',.8,.4,.05,.02);this.tone('sine',340,180,.35,.07,.06);}
  thunder(){if(!this.context)return;this.burst(3200,2600,'highpass',.7,.12,.24);this.burst(420,55,'lowpass',.6,1.6,.5,.03);this.tone('sine',58,26,1.2,.26,.05);}
  explosion(){if(!this.context)return;this.burst(2400,1800,'bandpass',.8,.14,.2);this.burst(850,48,'lowpass',.5,1.4,.55,.02);this.tone('sine',88,26,1.1,.4,.02);}
  crash(){if(!this.context)return;this.burst(1900,1400,'bandpass',.9,.09,.16);this.burst(380,120,'bandpass',.7,.32,.4,.01);this.tone('square',175,60,.24,.18);}
  side(){if(!this.context)return;this.burst(520,240,'bandpass',.8,.2,.3);this.tone('sine',150,72,.24,.24);}
  graze(){
    if(!this.context||this.context.currentTime<this.grazeAt)return;
    this.grazeAt=this.context.currentTime+AUDIO.graze.intervalSeconds;
    this.burst(2600,1900,'bandpass',2,.16,.11);
  }
  eat(){if(!this.context)return;this.tone('sine',270,85,.2,.17);this.burst(600,240,'lowpass',.7,.12,.12,.01);}
  impact(){if(!this.context)return;this.tone('square',720,520,.08,.13);this.burst(1800,1200,'bandpass',1.4,.1,.17);}
  mud(){if(!this.context)return;this.burst(380,150,'lowpass',.8,.4,.3);}
  netThrow(){if(!this.context)return;this.burst(1700,420,'bandpass',.8,.5,.12);} // 撒网:气流般的噪声下滑。
  netCatch(){if(!this.context)return;this.burst(900,180,'bandpass',.9,.3,.3);this.tone('sine',240,70,.4,.22,.02);} // 被网罩住:收网闷响。
  // 天降炮弹:下落啸声按落点剩余时长从高频滑向低频再收尾,命中为低频爆响加碎石噪声。
  shellWhistle(seconds){if(!this.context)return;const cfg=AUDIO.shell,dur=clamp(seconds,.4,4);this.tone('sine',cfg.whistleHz,cfg.whistleDropHz,dur,cfg.gain);}
  shellBoom(){if(!this.context)return;const cfg=AUDIO.shell;this.burst(2000,300,'bandpass',.6,.5,cfg.boomGain);this.burst(700,40,'lowpass',.5,1.8,cfg.boomGain,.02);this.tone('sine',70,22,1.4,cfg.boomGain*.7,.02);}
  bump(){if(!this.context)return;this.tone('sine',130,58,.28,.28);this.burst(260,110,'lowpass',.7,.22,.22,.01);}
  splash(){if(!this.context)return;this.burst(950,380,'bandpass',.9,.7,.3);this.burst(2600,1900,'highpass',.8,.3,.07,.03);}
  upgrade(){if(!this.context)return;[523,659,784].forEach((hz,i)=>this.tone('sine',hz,hz,.22,.09,i*.09));}
  downgrade(){if(!this.context)return;this.tone('sine',392,330,.2,.09);this.tone('sine',330,262,.26,.09,.11);}
  horse(){if(!this.context)return;[1318,1760,2217].forEach((hz,i)=>this.tone('sine',hz,hz,.26,.06,i*.07));}
  result(){if(!this.context)return;this.tone('sine',587,587,.25,.07);this.tone('sine',466,466,.4,.07,.14);}
  scrape(){if(!this.context)return;this.burst(3200,2500,'bandpass',3,.09,.06);}
}
