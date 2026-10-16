import { AUDIO, CAMERA, FLIGHT } from './config.js';

// 一个音频上下文复用持续声源，短音与播报只由有效事件触发。
export class FlightAudio {
  constructor(container) {
    this.context = null;
    this.game = null;
    this.unavailable = false;
    this.shots = new Set();
    this.parameterTargets = new WeakMap();
    this.silent = true;
    const unlock = () => this.unlock();
    container.addEventListener('pointerdown', unlock, { capture: true });
    container.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('blur', () => this.silence());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.silence(); });
    window.addEventListener('pagehide', () => this.silence());
  }

  unlock() {
    if (this.unavailable) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) { this.unavailable = true; return; }
        this.context = new Context();
        this.createSources();
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
    this.engine = this.oscillator('sine', AUDIO.engineIdleHz);
    this.harmonic = this.oscillator('triangle', AUDIO.engineIdleHz * AUDIO.engineHarmonic);
    this.motor = this.oscillator('sine', AUDIO.motorHz);
    this.alarm = this.oscillator('sine', AUDIO.alarmLow);
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * AUDIO.noiseSeconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
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

  enabled(game) {
    return !this.unavailable && !document.hidden && game.active && game.phase !== 'COMPLETE';
  }

  silence() {
    if (this.silent && !this.shots.size && !this.utterance) return;
    this.silent = true;
    if (this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0, now);
      this.parameterTargets.delete(this.master.gain);
    }
    for (const shot of this.shots) { shot.source.stop(); shot.source.disconnect(); shot.gain.disconnect(); }
    this.shots.clear();
    this.cancelSpeech();
  }

  cancelSpeech() {
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
    const countdown = game.phase === 'INTRO' ? Math.max(1, Math.ceil(CAMERA.introSeconds - game.introSeconds - 1e-9)) : null;
    const tick = countdown !== null && countdown !== this.countdown;
    if (!this.context || this.context.state !== 'running' || !this.enabled(game)) {
      if (!this.enabled(game)) this.countdown = countdown;
      this.silence();
      return;
    }
    this.countdown = countdown;
    this.silent = false;
    this.target(this.master.gain, AUDIO.masterGain);
    if (tick) this.cue(AUDIO.cues.countdown);
    if (this.utterance && game.activeSeconds - this.speechStarted >= AUDIO.voice.maxSeconds) this.cancelSpeech();
    const duck = this.utterance ? AUDIO.voiceDuck : 1;
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
    const gear = ['RETRACTING', 'EXTENDING'].includes(state.gear), flaps = ['RETRACTING', 'EXTENDING'].includes(state.flaps);
    this.target(this.motor.gain.gain, gear || flaps ? AUDIO.motorGain * duck : 0);
    this.target(this.motor.source.frequency, AUDIO.motorHz + (gear ? 0 : AUDIO.flapsMotorOffset));
    const alarm = game.mission.alert || game.flight.stalled;
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

  receive(event, game) {
    this.update(game);
    if (!this.enabled(game) || this.context?.state !== 'running') return;
    if (game.flight.stalled && ['pitch-high', 'pitch-low', 'low-speed'].includes(event.type)) return;
    let words, cue = AUDIO.cues.confirm, priority = 1;
    if (event.type === 'prepared' || event.type === 'unprepared') {
      const done = event.type === 'prepared';
      words = AUDIO.voice[done ? 'prepared' : 'unprepared'][event.key];
      cue = event.key === 'D' || event.key === 'H' ? AUDIO.cues.latch : done ? AUDIO.cues.switchOn : AUDIO.cues.switchOff;
    } else {
      words = AUDIO.voice.events[event.type];
      if (!words) return;
      if (['stall', 'ceiling', 'traffic', 'pitch-high', 'pitch-low', 'low-speed', 'overspeed'].includes(event.type)) priority = 2;
      if (event.type === 'engine-start') cue = AUDIO.cues.start;
      else if (event.type === 'engine-stop' || event.type === 'brake-set') cue = AUDIO.cues.switchOff;
      else if (event.type === 'released') cue = AUDIO.cues.latch;
      else if (priority === 2) {
        cue = null;
        if (event.type === 'stall' || event.type === 'ceiling') priority = 3;
      }
    }
    this.cue(cue);
    this.speak(words, priority);
  }

  speak(words, priority) {
    const synthesis = window.speechSynthesis;
    if (!words || !synthesis || !window.SpeechSynthesisUtterance) return;
    if (this.utterance && priority < this.speechPriority) return;
    const voices = synthesis.getVoices().filter(voice => voice.localService && /^en[-_]/i.test(voice.lang));
    const voice = AUDIO.voice.preferredNames.map(name => voices.find(item => item.name.includes(name))).find(Boolean) || voices[0];
    if (!voice) return;
    try {
      this.cancelSpeech();
      const utterance = new SpeechSynthesisUtterance(words);
      utterance.voice = voice; utterance.lang = voice.lang;
      utterance.rate = AUDIO.voice.rate; utterance.pitch = AUDIO.voice.pitch; utterance.volume = AUDIO.voice.volume;
      this.utterance = utterance; this.speechPriority = priority; this.speechStarted = this.game.activeSeconds;
      const finish = () => { if (this.utterance === utterance) this.utterance = null; };
      utterance.onend = finish; utterance.onerror = finish;
      synthesis.speak(utterance);
    } catch (error) { this.cancelSpeech(); console.warn('Speech playback failed', error); }
  }
}
