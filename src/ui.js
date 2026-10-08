import { CAMERA, FLIGHT, RUNWAY, STARTUP_STEPS, SYSTEMS, TAKEOFF_CONTROLS, CLIMB_CONTROLS, AERODYNAMICS } from './config.js';

const knots = value => Math.round(value * FLIGHT.knotsPerMps);
const degrees = value => Math.round(value * 180 / Math.PI);
const phases = { READY: '外部视角', INTRO: '正在进入驾驶舱', STARTUP: '驾驶舱 · 起飞准备', TAKEOFF_ROLL: '跑道滑跑', INITIAL_CLIMB: '离地爬升', COMPLETE: '初始爬升完成', RESULT: '本次飞行结束' };

export class UI {
  constructor(game, container) {
    this.game = game;
    this.container = container;
    this.error = false;
    this.lastSecond = -1;
    document.getElementById('runway-number').textContent = `${RUNWAY.designator} 号跑道`;
    document.getElementById('runway-code').textContent = `Runway ${RUNWAY.designator} / engine OFF`;
    this.elements = {};
    for (const id of ['welcome', 'preview-banner', 'instruments', 'startup-strip', 'pause-overlay',
      'cockpit-actions', 'exterior-caption', 'elapsed', 'phase-label', 'error-overlay', 'error-message', 'resume-button', 'intro-sequence', 'countdown-number', 'countdown-caption', 'pause-copy', 'startup-hint-copy', 'startup-prompt', 'attitude-preview', 'attitude-preview-label', 'aero-readout', 'airspeed-value', 'altitude-value', 'vertical-speed-value', 'engine-value', 'attitude-label', 'brake-state', 'ground-speed', 'heading-value', 'throttle-value', 'flight-guide', 'result-overlay', 'result-title', 'result-reason', 'result-caption', 'result-stats', 'restart-button']) {
      this.elements[id] = document.getElementById(id);
    }
    this.attitudeMark = container.querySelector('.attitude-mark');
    this.elements['startup-hint-copy'].textContent = `${STARTUP_STEPS.filter(step => step.kind === 'prepare').map(step => step.key).join('、')} 可任意顺序操作，再按同一字母关闭。`;
    container.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action || this.error) return;
      if (action === 'enter') game.enterCockpit();
      if (action === 'pause') game.togglePause();
      if (action === 'exterior') game.returnToExterior();
    });
    container.addEventListener('keydown', event => {
      if (this.error || event.code !== 'Tab') return;
      const overlay = this.game.paused ? this.elements['pause-overlay'] : this.game.phase === 'RESULT' ? this.elements['result-overlay'] : null;
      if (!overlay) return;
      const buttons = overlay.querySelectorAll('button');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    this.render();
  }

  render() {
    const inside = this.game.view === 'COCKPIT', intro = this.game.phase === 'INTRO';
    const started = inside || intro, result = this.game.phase === 'RESULT';
    this.container.dataset.view = this.game.view;
    this.elements.welcome.hidden = started;
    this.elements['exterior-caption'].hidden = started;
    this.elements['intro-sequence'].hidden = !intro;
    for (const id of ['instruments', 'startup-strip', 'aero-readout', 'attitude-preview']) this.elements[id].hidden = !inside;
    this.elements['preview-banner'].hidden = !inside || this.game.phase !== 'STARTUP' || this.game.startupHintDismissed;
    this.elements['cockpit-actions'].hidden = !started;
    this.elements.elapsed.hidden = !started;
    this.elements['pause-overlay'].hidden = !this.game.paused;
    this.elements['result-overlay'].hidden = !result;
    for (const child of this.container.children) {
      child.inert = child.id !== 'error-overlay' && (this.error || (this.game.paused && child.id !== 'pause-overlay') || (result && child.id !== 'result-overlay'));
    }
    this.elements['phase-label'].textContent = phases[this.game.phase];
    this.elements['pause-copy'].textContent = intro ? '倒数和镜头停在这里，准备好后继续。' : '飞机与计时停在这里，准备好后继续。';
    if (result) {
      const value = this.game.result;
      this.elements['result-title'].textContent = value.success ? '起飞成功' : '本次飞行结束';
      this.elements['result-caption'].textContent = value.success ? 'Flight complete' : 'Try again';
      this.elements['result-reason'].textContent = value.reason;
      this.elements['result-stats'].innerHTML = [['用时', `${Math.floor(value.seconds / 60)}分${Math.floor(value.seconds % 60)}秒`], ['最高高度', `${Math.round(value.maxAltitude)} m`], ['离地速度', value.liftOffSpeed ? `${Math.round(value.liftOffSpeed * FLIGHT.knotsPerMps)} kt` : '尚未离地'], ['最高空速', `${Math.round(value.maxAirspeed * FLIGHT.knotsPerMps)} kt`]].map(([name, data]) => `<div><dt>${name}</dt><dd>${data}</dd></div>`).join('');
    }
    this.update();
    if (this.error) return;
    if (result) this.elements['restart-button'].focus({ preventScroll: true });
    else if (this.game.paused) this.elements['resume-button'].focus({ preventScroll: true });
    else this.container.focus({ preventScroll: true });
  }

  setFlow() {
    const phase = this.game.phase;
    const flow = ['INITIAL_CLIMB', 'COMPLETE', 'RESULT'].includes(phase) && !this.game.aircraft.onGround ? 'climb' : phase === 'TAKEOFF_ROLL' || (phase === 'RESULT' && this.game.aircraft.onGround) ? 'roll' : 'startup';
    if (flow === this.flow) return;
    this.flow = flow;
    const steps = flow === 'startup' ? STARTUP_STEPS : flow === 'roll' ? TAKEOFF_CONTROLS : CLIMB_CONTROLS;
    this.elements['startup-strip'].classList.toggle('flight-controls', flow !== 'startup');
    this.elements['startup-strip'].setAttribute('aria-label', flow === 'startup' ? '起飞准备按键及状态' : flow === 'roll' ? '跑道起飞操作' : '离地爬升操作');
    this.elements['startup-strip'].innerHTML = `<span class="strip-label">${flow === 'startup' ? '起飞准备' : flow === 'roll' ? '跑道起飞' : '离地爬升'}<small id="startup-count"></small></span>${steps.map(step => `<div class="startup-key" data-key="${step.key}"><kbd>${step.key}</kbd><span>${step.shortLabel || step.label}<small>${step.english}</small></span><b class="switch-state"></b></div>`).join('')}`;
    this.startupItems = [...this.elements['startup-strip'].querySelectorAll('.startup-key')];
    this.startupCount = document.getElementById('startup-count');
  }

  updateSystems() {
    this.setFlow();
    const a = this.game.aircraft, systems = a.systems, flight = this.game.flight;
    const speed = Math.round(a.airspeed * FLIGHT.knotsPerMps), altitude = Math.floor(flight.altitude());
    const pitch = degrees(a.pitch), bank = degrees(a.bank), throttle = Math.round(a.throttle * 100);
    const heading = (degrees(a.heading) % 360 + 360) % 360 || 360;
    const rpm = Math.round(systems.engine === 'RUNNING' ? SYSTEMS.engineIdlePercent + a.enginePower * (100 - SYSTEMS.engineIdlePercent) : systems.engineProgress * SYSTEMS.engineIdlePercent);
    const signature = [this.game.phase, this.game.runId, systems.lights, systems.door, systems.harness, systems.avionics, systems.engine, rpm, systems.flaps, systems.gear, systems.parkingBrake, a.wheelBrake, speed, altitude, a.verticalSpeed.toFixed(1), pitch, bank, heading, throttle, flight.canRetractGear(), flight.canRetractFlaps(), Math.floor(flight.completionSeconds * 10), degrees(a.angleOfAttack * 10), degrees(a.flightPathAngle * 10), a.loadFactor.toFixed(1), flight.pitchHigh, flight.pitchLow, flight.overspeed, flight.stalled, flight.lowSpeed, this.game.prompts.current].join('|');
    if (signature === this.lastSystemsSignature) return;
    this.lastSystemsSignature = signature;
    this.container.classList.toggle('lights-on', systems.lights);
    this.container.classList.toggle('avionics-on', systems.avionics);
    if (this.flow === 'startup') {
      let completed = 0;
      STARTUP_STEPS.forEach((step, index) => {
        const done = this.game.systems.isComplete(step), busy = step.kind === 'engine' && systems.engine === 'STARTING';
        this.setItem(index, done, busy, done ? 'ON' : busy ? 'Starting' : 'OFF');
        if (done) completed++;
      });
      this.startupCount.textContent = `${completed} / ${STARTUP_STEPS.length}`;
    } else if (this.flow === 'roll') {
      const rotate = a.airspeed >= FLIGHT.rotationSpeed;
      this.setItem(0, a.throttle > 0, false, `${throttle}%`);
      this.setItem(1, a.wheelBrake, false, a.wheelBrake ? '轮刹' : '收油');
      this.setItem(2, true, false, '修正方向');
      this.setItem(3, rotate, false, rotate ? '可抬头' : `${knots(FLIGHT.rotationSpeed)} kt`);
      this.startupCount.textContent = `目标 ${knots(FLIGHT.rotationSpeed)} kt`;
    } else {
      this.setItem(0, true, false, `${throttle}%`);
      this.setItem(1, !flight.pitchHigh && !flight.pitchLow && !flight.stalled, flight.pitchHigh || flight.pitchLow || flight.stalled, `${pitch}°`);
      this.setItem(2, Math.abs(a.bank) <= FLIGHT.successBank, false, `${bank}°`);
      for (const [index, name, ready] of [[3, 'gear', flight.canRetractGear()], [4, 'flaps', flight.canRetractFlaps()]]) {
        const busy = systems[name] === 'RETRACTING', done = systems[name] === (name === 'gear' ? 'UP' : 'CLEAN');
        this.setItem(index, done || ready, busy, done ? '已收起' : busy ? '收起中' : ready ? '可收起' : name === 'gear' ? `${FLIGHT.gearHeight} m ↑` : `${FLIGHT.flapsHeight} m / ${knots(FLIGHT.climbMinSpeed)} kt`);
      }
      this.startupCount.textContent = `目标 ${FLIGHT.completionHeight} m`;
    }
    for (const [id, value] of [['airspeed-value', speed], ['altitude-value', altitude], ['vertical-speed-value', a.verticalSpeed.toFixed(1)]]) this.elements[id].textContent = systems.avionics ? value : 'OFF';
    this.elements['ground-speed'].textContent = systems.avionics ? `${Math.round(a.airspeed * 3.6)} km/h` : 'km/h';
    this.elements['heading-value'].textContent = systems.avionics ? `航向 ${heading}°` : '航向 OFF';
    this.elements['attitude-preview-label'].textContent = `俯仰 ${pitch}° · 坡度 ${bank}°`;
    this.elements['attitude-label'].textContent = systems.avionics ? `俯仰 ${pitch}° · 坡度 ${bank}°` : '仪表关闭';
    this.attitudeMark.style.setProperty('--bank', `${-bank}deg`);
    this.attitudeMark.style.setProperty('--horizon', `${50 + pitch * 2}%`);
    const engineValue = systems.avionics ? `${rpm}%` : 'OFF';
    this.elements['engine-value'].innerHTML = `${engineValue} <em>${engineValue}</em>`;
    this.elements['throttle-value'].textContent = `油门 ${throttle}%`;
    const alphaWarning = Math.abs(a.angleOfAttack) > AERODYNAMICS.criticalAlpha + systems.flapsPosition * AERODYNAMICS.flapsCriticalBonus - AERODYNAMICS.alphaWarningMargin;
    const condition = flight.stalled ? '失速' : flight.pitchHigh ? '仰角过大' : flight.pitchLow ? '下降危险' : flight.overspeed ? '空速过高' : alphaWarning ? '迎角偏高' : flight.lowSpeed ? '空速偏低' : '正常';
    const readout = this.elements['aero-readout'];
    readout.textContent = systems.avionics ? `迎角 ${(a.angleOfAttack * 180 / Math.PI).toFixed(1)}° · 航迹 ${(a.flightPathAngle * 180 / Math.PI).toFixed(1)}° · 升力载荷 ${a.loadFactor.toFixed(1)} g · ${condition}` : '飞行仪表 OFF';
    readout.classList.toggle('is-warning', condition !== '正常');
    this.elements['brake-state'].textContent = systems.parkingBrake ? '驻车刹车 ON' : a.wheelBrake ? '轮刹 ON' : '刹车 OFF';
    const prompt = this.game.prompts.current;
    this.elements['startup-prompt'].hidden = !prompt;
    this.elements['startup-prompt'].textContent = prompt || '';
    this.elements['startup-prompt'].classList.toggle('is-flight-warning', ['pitch-high', 'pitch-low', 'stall'].includes(this.game.prompts.type));
    const guide = this.elements['flight-guide'];
    guide.hidden = this.flow === 'startup' || this.game.phase === 'RESULT';
    guide.classList.toggle('is-warning', flight.lowSpeed || flight.pitchHigh || flight.pitchLow || flight.overspeed || flight.stalled);
    if (this.game.phase === 'COMPLETE') guide.textContent = '起飞成功 · 初始爬升已完成';
    else if (this.flow === 'roll') guide.textContent = a.airspeed >= FLIGHT.rotationSpeed ? '已到抬轮速度 · ↑ 抬头至约 10°，保持方向' : `T 加油门 · 约 ${FLIGHT.rollTargetSeconds} 秒达到 ${knots(FLIGHT.rotationSpeed)} kt · ↑ 抬头 · S 收油，收至零后按住轮刹`;
    else if (flight.stalled) guide.textContent = a.angleOfAttack < 0 ? '失速 · ↑ 平缓抬高机头减小负迎角，保持机翼平稳' : '失速 · ↓ 降低机头减小迎角，T 增加油门，保持机翼平稳';
    else if (flight.pitchHigh) guide.textContent = '仰角过大 · ↓ 降低机头；持续拉高会消耗速度，可能失速下坠';
    else if (flight.pitchLow) guide.textContent = '下降危险 · ↑ 平缓抬高机头，保持安全空速，避免撞地';
    else if (flight.overspeed) guide.textContent = '空速过高 · S 收油减速，平缓改出俯冲';
    else if (this.flow === 'climb') guide.textContent = flight.lowSpeed ? '空速偏低 · T 增加油门，↓ 适当降低机头恢复速度' : `建议俯仰 ${FLIGHT.recommendedPitch.join("–")}° · 保持 ${knots(FLIGHT.climbMinSpeed)}–${knots(FLIGHT.climbMaxSpeed)} kt、平翼和正爬升 · 收轮收襟翼 · ${FLIGHT.completionHeight} m 后保持 ${Math.min(FLIGHT.completionHoldSeconds, flight.completionSeconds).toFixed(1)} / ${FLIGHT.completionHoldSeconds} 秒`;
  }

  setItem(index, ready, busy, state) {
    const item = this.startupItems[index];
    item.classList.toggle('is-on', ready);
    item.classList.toggle('is-busy', busy);
    item.querySelector('.switch-state').textContent = state;
    item.title = `${item.querySelector('small').textContent}（${item.querySelector('span').firstChild.textContent}）[${item.dataset.key}]，${state}`;
  }

  update() {
    this.updateSystems();
    if (this.game.phase === 'INTRO') {
      const remaining = Math.max(1, Math.ceil(CAMERA.introSeconds - this.game.introSeconds - 1e-9));
      const number = String(remaining);
      if (this.elements['countdown-number'].textContent !== number) {
        this.elements['countdown-number'].textContent = number;
        this.elements['countdown-caption'].textContent = ['进入驾驶舱', '机场与跑道', '机身与机翼', '跑道与起点'][remaining - 1];
      }
    }
    const second = Math.floor(this.game.activeSeconds);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    this.elements.elapsed.textContent = `${String(Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}`;
  }

  showError(message) {
    this.error = true;
    this.elements['error-message'].textContent = message;
    this.elements['error-overlay'].hidden = false;
    this.render();
  }

  clearError() {
    this.error = false;
    this.elements['error-overlay'].hidden = true;
    this.render();
  }
}
