import { AUDIO, FLIGHT } from './config.js';
import { VOICE_BANK_URL, VOICE_CLIPS } from './voice-clips.js';

// 一个音频上下文复用持续声源，短音与播报只由有效事件触发。
export class FlightAudio {
  constructor(container) {
    this.context = null;
    this.game = null;
    this.unavailable = false;
    this.shots = new Set();
    this.parameterTargets = new WeakMap();
    this.silent = true;
    this.voices = []; this.pendingSpeech = null; this.voiceCheckedAt = -Infinity;
    this.voiceBank = null; this.voiceSource = null; this.voiceBankFailed = false;
    this.voiceBankData = fetch(VOICE_BANK_URL).then(response => {
      if (!response.ok) throw new Error('Voice bank HTTP ' + response.status);
      return response.arrayBuffer();
    }).catch(error => { this.voiceBankFailed = true; console.warn('Voice bank load failed', error); return null; });
    window.speechSynthesis?.addEventListener('voiceschanged', () => { this.refreshVoices(); this.flushSpeech(); });
    this.refreshVoices();
    const unlock = () => this.unlock();
    container.addEventListener('pointerdown', unlock, { capture: true });
    container.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('blur', () => this.silence());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.silence(); });
    window.addEventListener('pagehide', () => this.silence());
  }

  unlock() {
    this.refreshVoices();
    if (this.unavailable) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) { this.unavailable = true; return; }
        this.context = new Context();
        this.createSources();
        this.prepareVoiceBank();
      }
      if (this.context.state === 'suspended') this.context.resume().then(() => {
        // 恢复音频是异步操作，只读取当前游戏状态，不恢复旧的声音任务。
        if (this.game) this.update(this.game);
      }).catch(error => console.warn('Audio resume failed', error));
    } catch (error) {
      console.warn('Audio initialization failed', error);
      this.unavailable = true;
      this.silence();
    }
  }

  createSources() {
    const context = this.context;
    this.master = context.createGain(); this.master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = AUDIO.limiterThreshold;
    limiter.ratio.value = AUDIO.limiterRatio;
    this.master.connect(limiter); limiter.connect(context.destination);
    this.voiceGain = context.createGain(); this.voiceGain.gain.value = AUDIO.voice.volume;
    this.voiceGain.connect(limiter);
    this.engine = this.oscillator('sine', AUDIO.engineIdleHz);
    this.harmonic = this.oscillator('triangle', AUDIO.engineIdleHz * AUDIO.engineHarmonic);
    this.motor = this.oscillator('sine', AUDIO.motorHz);
    this.alarm = this.oscillator('sine', AUDIO.alarmLow);
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * AUDIO.noiseSeconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    this.fan = this.noiseChannel(noise, 'lowpass', AUDIO.fanIdleHz);
    this.wind = this.noiseChannel(noise, 'bandpass', AUDIO.windIdleHz);
    this.wheels = this.noiseChannel(noise, 'lowpass', AUDIO.wheelIdleHz);
    noise.start();
  }

  oscillator(type, frequency) {
    const source = this.context.createOscillator(), gain = this.context.createGain();
    source.type = type; source.frequency.value = frequency; gain.gain.value = 0;
    source.connect(gain); gain.connect(this.master); source.start();
    return { source, gain };
  }

  noiseChannel(source, type, frequency) {
    const filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = AUDIO.noiseQ;
    gain.gain.value = 0; source.connect(filter); filter.connect(gain); gain.connect(this.master);
    return { filter, gain };
  }

  // 开始点击请求固定女声短句；语音独立增益，准备时也可播放。
  speechEnabled(game) {
    return !document.hidden && !game.paused && !['CRASH', 'COMPLETE', 'RESULT'].includes(game.phase);
  }

  unlockSpeech() {
    const game = this.game;
    if (!game || game.phase !== 'READY' || !this.speechEnabled(game) || this.welcomeRunId === game.runId) return;
    this.welcomeRunId = game.runId;
    this.refreshVoices();
    this.speak(AUDIO.voice.welcome, 1);
  }

  enabled(game) {
    return !this.unavailable && !document.hidden && game.active && game.phase !== 'COMPLETE';
  }

  silence(cancelVoice = true) {
    if (this.silent && !this.shots.size && !this.utterance && !this.voiceSource && !this.pendingSpeech) return;
    this.silent = true;
    if (this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0, now);
      this.parameterTargets.delete(this.master.gain);
    }
    for (const shot of this.shots) { shot.source.stop(); shot.source.disconnect(); shot.filter?.disconnect(); shot.gain.disconnect(); }
    this.shots.clear();
    if (cancelVoice) this.cancelSpeech();
  }

  cancelSpeech() {
    this.pendingSpeech = null;
    if (this.voiceSource) {
      const source = this.voiceSource; this.voiceSource = null;
      source.onended = null; source.stop(); source.disconnect();
    }
    if (!this.utterance) return;
    this.utterance = null;
    window.speechSynthesis?.cancel();
  }

  target(parameter, value) {
    if (this.parameterTargets.get(parameter) === value) return;
    this.parameterTargets.set(parameter, value);
    parameter.setTargetAtTime(value, this.context.currentTime, AUDIO.smoothingSeconds);
  }

  update(game) {
    this.game = game;
    if (this.runId !== game.runId) {
      this.silence();
      this.runId = game.runId;
      this.countdown = null;
    }
    const countdown = game.phase === 'INTRO' ? Math.max(1, Math.ceil(game.introDuration - game.introSeconds - 1e-9)) : null;
    const tick = countdown !== null && countdown !== this.countdown;
    if (!this.speechEnabled(game)) this.cancelSpeech();
    else {
      if (this.utterance && game.activeSeconds - (this.speechStarted ?? this.speechRequested) >= (this.speechStarted === null ? AUDIO.voice.startTimeoutSeconds : AUDIO.voice.maxSeconds)) this.cancelSpeech();
      this.flushSpeech();
    }
    if (!this.enabled(game)) {
      this.countdown = countdown; this.silence(!this.speechEnabled(game)); return;
    }
    if (!this.context || this.context.state !== 'running') return;
    this.countdown = countdown;
    this.silent = false;
    this.target(this.master.gain, AUDIO.masterGain);
    if (tick) this.cue(AUDIO.cues.countdown);
    if (game.phase==='CRASH') {
      this.cancelSpeech();
      for (const channel of [this.engine,this.harmonic,this.fan,this.wind,this.wheels,this.motor,this.alarm]) this.target(channel.gain.gain,0);
      return;
    }
    const duck = this.utterance || this.voiceSource ? AUDIO.voiceDuck : 1;
    const a = game.aircraft, state = a.systems;
    const starting = state.engine === 'STARTING', running = state.engine === 'RUNNING';
    const power = starting ? state.engineProgress : Math.max(0, Math.min(1, a.enginePower));
    const engineLevel = starting ? AUDIO.startLevel * state.engineProgress : running ? AUDIO.idleLevel + (1 - AUDIO.idleLevel) * power : 0;
    const frequency = starting ? AUDIO.engineStartHz + power * AUDIO.engineStartSweep : AUDIO.engineIdleHz + power * AUDIO.enginePowerSweep;
    this.target(this.engine.source.frequency, frequency);
    this.target(this.harmonic.source.frequency, frequency * AUDIO.engineHarmonic);
    this.target(this.engine.gain.gain, engineLevel * AUDIO.engineGain * duck);
    this.target(this.harmonic.gain.gain, engineLevel * AUDIO.harmonicGain * duck);
    this.target(this.fan.gain.gain, engineLevel * AUDIO.fanGain * duck);
    this.target(this.fan.filter.frequency, AUDIO.fanIdleHz + power * AUDIO.fanPowerSweep);
    const speed = Math.max(0, Math.min(AUDIO.speedCap, a.airspeed / FLIGHT.rotationSpeed));
    this.target(this.wind.gain.gain, AUDIO.windGain * duck * speed * speed * (a.onGround ? AUDIO.groundWindScale : 1));
    this.target(this.wind.filter.frequency, AUDIO.windIdleHz + speed * AUDIO.windSpeedSweep);
    const wheelLevel = a.onGround ? Math.min(1, speed) : 0;
    const bumps = 1 + AUDIO.wheelRoughness * Math.sin(game.activeSeconds * AUDIO.wheelBumpRate * (1 + speed));
    this.target(this.wheels.gain.gain, AUDIO.wheelGain * duck * wheelLevel * bumps * (a.wheelBrake ? AUDIO.brakeGainScale : 1));
    this.target(this.wheels.filter.frequency, AUDIO.wheelIdleHz + speed * AUDIO.wheelSpeedSweep);
    const gear = ['RETRACTING', 'EXTENDING'].includes(state.gear);
    this.target(this.motor.gain.gain, gear ? AUDIO.motorGain * duck : 0);
    this.target(this.motor.source.frequency, AUDIO.motorHz);
    const alarm = game.mission.alert || game.flight.stalled || game.flight.gearWarning;
    const phase = game.activeSeconds % AUDIO.alarmPeriod;
    const pulse = phase < AUDIO.alarmPulse || (phase > AUDIO.alarmPulse * 2 && phase < AUDIO.alarmPulse * 3);
    this.target(this.alarm.gain.gain, alarm && pulse ? AUDIO.alarmGain : 0);
    this.target(this.alarm.source.frequency, game.mission.ceilingFault ? AUDIO.alarmHigh : AUDIO.alarmLow);
  }

  cue(cue) {
    if (!cue || this.context?.state !== 'running') return;
    if (this.shots.size >= AUDIO.maxShots) return;
    const now = this.context.currentTime, source = this.context.createOscillator(), gain = this.context.createGain();
    const shot = { source, gain }; this.shots.add(shot);
    source.type = cue.type;
    source.frequency.setValueAtTime(cue.frequency, now);
    source.frequency.exponentialRampToValueAtTime(cue.endFrequency, now + cue.seconds);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(cue.gain, now + AUDIO.attackSeconds);
    gain.gain.exponentialRampToValueAtTime(AUDIO.gainFloor, now + cue.seconds);
    source.connect(gain); gain.connect(this.master);
    source.onended = () => { this.shots.delete(shot); source.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + cue.seconds);
  }

  noiseBurst(cue) {
    if (this.context?.state!=='running' || !this.noiseBuffer || this.shots.size>=AUDIO.maxShots) return;
    const now=this.context.currentTime, source=this.context.createBufferSource(), gain=this.context.createGain(), filter=this.context.createBiquadFilter();
    source.buffer=this.noiseBuffer; filter.type='lowpass';
    filter.frequency.setValueAtTime(cue.frequency,now); filter.frequency.exponentialRampToValueAtTime(cue.endFrequency,now+cue.seconds);
    gain.gain.setValueAtTime(cue.gain,now); gain.gain.exponentialRampToValueAtTime(AUDIO.gainFloor,now+cue.seconds);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    const shot={source,gain,filter}; this.shots.add(shot);
    source.onended=()=>{this.shots.delete(shot);source.disconnect();filter.disconnect();gain.disconnect();};
    source.start(now);source.stop(now+cue.seconds);
  }

  receive(event, game) {
    if (event.type==='destroyed') this.silence();
    this.update(game);
    if (event.type==='destroyed') {
      if (this.enabled(game)) {this.noiseBurst(AUDIO.explosion);this.cue(AUDIO.cues.explosion);}
      return;
    }
    if (!this.speechEnabled(game) || !game.active) return;
    if (event.type==='bird-strike'||event.type==='truck-hit') this.noiseBurst(AUDIO.birdImpact);
    if (event.type==='bird-strike') this.noiseBurst(AUDIO.glassImpact);
    if (game.flight.stalled && event.type === 'pitch-low') return;
    let words, cue = AUDIO.cues.confirm, priority = 1;
    if (event.type === 'prepared' || event.type === 'unprepared') {
      const done = event.type === 'prepared';
      words = AUDIO.voice[done ? 'prepared' : 'unprepared'][event.key];
      cue = event.key === 'D' || event.key === 'H' ? AUDIO.cues.latch : done ? AUDIO.cues.switchOn : AUDIO.cues.switchOff;
    } else {
      words = AUDIO.voice.events[event.type];
      if (!words) return;
      if (['gear-warning', 'bird-strike', 'stall', 'ceiling', 'traffic', 'pitch-low'].includes(event.type)) priority = 3;
      if (event.type === 'engine-start') cue = AUDIO.cues.start;
      else if (event.type === 'engine-stop' || event.type === 'brake-set') cue = AUDIO.cues.switchOff;
      else if (event.type === 'released') cue = AUDIO.cues.latch;
      else if (priority === 3) {
        cue = null;
        if (event.type === 'stall' || event.type === 'ceiling') priority = 4;
      }
    }
    if (['released', 'liftoff', 'climb-complete', 'approach', 'final-approach', 'landed'].includes(event.type)) { priority = 2; cue = null; }
    this.cue(cue);
    this.speak(words, priority);
  }

  prepareVoiceBank() {
    if (!this.context || this.voiceBankPreparation) return;
    this.voiceBankPreparation = this.voiceBankData.then(data => {
      if (!data) throw new Error('Voice bank data unavailable');
      return this.context.decodeAudioData(data);
    }).then(buffer => {
      this.voiceBank = buffer; this.flushSpeech();
    }).catch(error => {
      this.voiceBankFailed = true; console.warn('Voice bank decode failed', error); this.flushSpeech();
    });
  }

  refreshVoices() {
    this.voices = window.speechSynthesis?.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)) || [];
    this.voiceCheckedAt = this.game?.activeSeconds ?? 0;
  }

  speak(words, priority) {
    if (!words || !this.game || !this.speechEnabled(this.game)) return;
    if (((this.utterance || this.voiceSource) && priority < this.speechPriority) || (this.pendingSpeech && priority < this.pendingSpeech.priority)) return;
    // 语音素材尚未就绪时只保留最新一句，暂停、换局与超时立即丢弃。
    this.pendingSpeech = {words, priority, runId: this.game.runId, requestedAt: this.game.activeSeconds};
    this.flushSpeech();
  }

  flushSpeech() {
    const pending = this.pendingSpeech, game = this.game;
    if (!pending || !game) return;
    if (!this.speechEnabled(game) || pending.runId !== game.runId || game.activeSeconds - pending.requestedAt > AUDIO.voice.maxSeconds) {
      this.pendingSpeech = null; return;
    }
    const clip = VOICE_CLIPS[pending.words];
    if (clip && !this.voiceBankFailed) {
      if (!this.voiceBank || this.context?.state !== 'running') return;
      this.cancelSpeech();
      const source = this.context.createBufferSource();
      source.buffer = this.voiceBank; source.connect(this.voiceGain);
      this.voiceSource = source; this.speechPriority = pending.priority;
      source.onended = () => {
        source.disconnect();
        if (this.voiceSource === source) this.voiceSource = null;
      };
      source.start(this.context.currentTime, clip.offset, clip.duration);
      return;
    }
    // 仅资源加载失败或新增短句尚未入库时，尝试浏览器的英文女声。
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    if (!this.voices.length && game.activeSeconds - this.voiceCheckedAt >= AUDIO.voice.voiceRetrySeconds) this.refreshVoices();
    const preferred = voices => AUDIO.voice.preferredNames.map(name => voices.find(voice => voice.name.toLowerCase().includes(name.toLowerCase()))).find(Boolean);
    const local = this.voices.filter(voice => voice.localService);
    // 仅选明确的英文女声候选；不回退到列表首个可能是男声或特殊音效的声音。
    const voice = preferred(local) || preferred(this.voices);
    if (!voice) return;
    const synthesis = window.speechSynthesis;
    try {
      this.cancelSpeech();
      const utterance = new SpeechSynthesisUtterance(pending.words);
      utterance.voice = voice; utterance.lang = voice.lang;
      utterance.rate = AUDIO.voice.rate; utterance.pitch = AUDIO.voice.pitch; utterance.volume = AUDIO.voice.volume;
      this.utterance = utterance; this.speechPriority = pending.priority;
      this.speechRequested = game.activeSeconds; this.speechStarted = null;
      utterance.onstart = () => { if (this.utterance === utterance) this.speechStarted = game.activeSeconds; };
      const finish = () => { if (this.utterance === utterance) this.utterance = null; };
      utterance.onend = finish;
      utterance.onerror = event => {
        finish();
        if (!['canceled', 'interrupted'].includes(event.error)) console.warn('Speech playback failed', event.error);
      };
      if (synthesis.paused) synthesis.resume();
      synthesis.speak(utterance);
    } catch (error) { this.cancelSpeech(); console.warn('Speech playback failed', error); }
  }
}
