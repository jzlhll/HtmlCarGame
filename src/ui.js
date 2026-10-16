import { CAMERA, FLIGHT, RUNWAY, STARTUP_STEPS, SYSTEMS, TAKEOFF_CONTROLS, CLIMB_CONTROLS, AERODYNAMICS, LEVELS, JOURNEY } from './config.js';

import { NavigationUI } from './navigation-ui.js';
import { setText, setBilingual } from './dom.js';

const knots = value => Math.round(value * FLIGHT.knotsPerMps);
const degrees = value => Math.round(value * 180 / Math.PI);
const bilingual = (english, chinese) => `${english}<small>${chinese}</small>`;
const phases = { READY: '外部视角', INTRO: '正在进入驾驶舱', STARTUP: '驾驶舱 · 起飞准备', TAKEOFF_ROLL: '跑道滑跑', INITIAL_CLIMB: '离地爬升', CRUISE: '航程巡航', APPROACH: '机场进近', LANDING_ROLL: '着陆滑跑', TAXI: '滑向停机圈', COMPLETE: '🎉 航程完成', RESULT: '航程结算' };

export class UI {
  constructor(game, container) {
    this.game = game;
    this.navigation = new NavigationUI(game);
    this.container = container;
    this.error = false;
    this.preparing = false;
    this.renderBriefing();
    this.availabilityCopy = container.querySelector('.availability').textContent;
    this.lastSecond = -1;
    document.getElementById('runway-number').textContent = `${RUNWAY.designator} 号跑道`;
    document.getElementById('runway-code').textContent = `Runway ${RUNWAY.designator} / engine OFF`;
    this.elements = {};
    for (const id of ['welcome', 'preview-banner', 'instruments', 'startup-strip', 'pause-overlay',
      'cockpit-actions', 'exterior-caption', 'elapsed', 'phase-label', 'error-overlay', 'error-message', 'resume-button', 'intro-sequence', 'countdown-number', 'countdown-caption', 'pause-copy', 'startup-hint-copy', 'startup-prompt', 'attitude-preview', 'attitude-preview-label', 'gear-preview', 'gear-preview-label', 'aero-readout', 'airspeed-value', 'altitude-value', 'vertical-speed-value', 'engine-value', 'attitude-label', 'brake-state', 'ground-speed', 'heading-value', 'throttle-value', 'flight-guide', 'result-overlay', 'result-title', 'result-reason', 'result-caption', 'result-stats', 'restart-button', 'next-level-button']) {
      this.elements[id] = document.getElementById(id);
    }
    this.attitudeMark = container.querySelector('.attitude-mark');
    this.enginePrimary = this.elements['engine-value'].firstChild;
    this.engineSecondary = this.elements['engine-value'].querySelector('em');
    this.aeroItems = Array.from({length: 5}, () => document.createElement('span'));
    this.elements['aero-readout'].replaceChildren(...this.aeroItems);
    this.elements['startup-hint-copy'].textContent = `${STARTUP_STEPS.filter(step => step.kind === 'prepare').map(step => step.key).join('、')} 可任意顺序操作，再次按键可撤销准备。`;
    container.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action || this.error) return;
      if (action === 'enter' && !this.preparing) game.enterCockpit();
      if (action === 'pause') game.togglePause();
      if (action === 'exterior') game.returnToExterior();
    });
    container.addEventListener('keydown', event => {
      if (this.error || event.code !== 'Tab') return;
      const overlay = this.game.paused ? this.elements['pause-overlay'] : this.game.phase === 'RESULT' ? this.elements['result-overlay'] : null;
      if (!overlay) return;
      const buttons = overlay.querySelectorAll('button:not([hidden]), a[href]:not([hidden])');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    this.render();
  }

  renderBriefing() {
    const route = this.game.route;
    const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    this.container.querySelector('.intro-copy').innerHTML = `坐进驾驶舱，认识每一个按键。<br>第 ${route.id} 关：深圳起飞，抵达${route.destinationName}。`;
    this.container.querySelector('.availability').textContent = `${formatTime(route.deadline)} · 起飞至${route.destinationName}停机圈`;
    this.container.querySelector('.welcome .eyebrow').textContent = `Flight ${route.id}`;
    const stops = [{english: 'Shenzhen airport', chinese: '深圳机场', z: 0}, ...route.sectors];
    const profile = JOURNEY.elevationProfile.filter(([distance]) => distance <= -route.destination.threshold);
    const points = profile.map(([distance, height]) => `${12 + distance / -route.destination.threshold * 216},${62 - height / 1100 * 48}`).join(' ');
    this.container.querySelector('#route-briefing').innerHTML = `
      <div class="level-selector" aria-label="选择飞行关卡">${LEVELS.map(level => `<a href="?level=${level.id}" ${level.id === route.id ? 'aria-current="page"' : ''}>${level.id} · ${level.destinationEnglish}<small>${level.destinationName}</small></a>`).join('')}</div>
      <header><span>Flight plan<small>第 ${route.id} 关 · 深圳 → ${route.destinationName}</small></span><b>${formatTime(route.deadline)}</b></header>
      <ol class="route-stops">${stops.map(stop => `<li><span>${stop.english}<small>${stop.chinese}</small></span></li>`).join('')}</ol>
      <div class="route-profile"><svg viewBox="0 0 240 76" role="img" aria-label="路线地面从深圳零米逐渐升至${route.destination.elevation}米"><path d="M12 64H228"/><polyline points="${points}"/></svg><span>Terrain elevation<small>地面逐渐升高 · 0 → ${route.destination.elevation} m</small></span></div>
      <footer>${route.cruiseKnots} kt · ${(Math.abs(route.destination.threshold) / 1000).toFixed(1)} km<small>建议巡航 · 压缩航线 · 时限包含着陆停机</small></footer>`;
  }

  setPreparing(preparing) {
    this.preparing = preparing;
    const button = this.container.querySelector('[data-action="enter"]');
    button.disabled = preparing;
    button.setAttribute('aria-busy', String(preparing));
    this.container.querySelector('.availability').textContent = preparing ? '场景准备中…' : this.availabilityCopy;
  }

  render() {
    const inside = this.game.view === 'COCKPIT', intro = this.game.phase === 'INTRO';
    const started = inside || intro, result = this.game.phase === 'RESULT';
    this.container.dataset.view = this.game.view;
    this.elements.welcome.hidden = started;
    this.container.querySelector('#route-briefing').hidden = started;
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
    this.elements['phase-label'].textContent = result ? this.game.result.success ? '🎉 航程完成' : '💥 航程失败' : this.game.phase === 'APPROACH' ? `${this.game.route.destinationName}机场进近` : phases[this.game.phase];
    this.elements['pause-copy'].textContent = intro ? '倒数和镜头停在这里，准备好后继续。' : '飞机与计时停在这里，准备好后继续。';
    if (result) {
      const value = this.game.result;
      this.elements['next-level-button'].hidden = !value.success || this.game.route.id >= LEVELS.length;
      this.elements['next-level-button'].href = `?level=${this.game.route.id + 1}`;
      this.elements['result-title'].textContent = value.success ? '🎉 恭喜！航程完成' : '💥 失败！再试一次';
      this.elements['result-caption'].textContent = value.success ? 'Congratulations' : 'Flight failed';
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
    const flow = this.game.aircraft.landed ? 'taxi' : !this.game.aircraft.onGround ? 'climb' : phase === 'TAKEOFF_ROLL' ? 'roll' : 'startup';
    if (flow === this.flow && phase === this.flowPhase) return;
    this.flow = flow; this.flowPhase = phase;
    const taxi = [TAKEOFF_CONTROLS[0], TAKEOFF_CONTROLS[1], TAKEOFF_CONTROLS[2], {key: 'R', english: 'Release', label: '驻车刹车'}, CLIMB_CONTROLS[4]];
    const steps = flow === 'startup' ? STARTUP_STEPS : flow === 'roll' ? TAKEOFF_CONTROLS : flow === 'taxi' ? taxi : CLIMB_CONTROLS.map(step => step.key === 'G' ? {...step, label: '起落架'} : step);
    const title = flow === 'startup' ? ['Preflight', '起飞准备'] : flow === 'roll' ? ['Takeoff roll', '跑道起飞'] : flow === 'taxi' ? ['Parking', '驶入停机圈'] : phase === 'APPROACH' ? ['Approach', `${this.game.route.destinationName}进近`] : phase === 'CRUISE' ? ['Cruise', '巡航'] : ['Initial climb', '离地爬升'];
    this.elements['startup-strip'].classList.toggle('flight-controls', flow !== 'startup');
    this.elements['startup-strip'].setAttribute('aria-label', title[1] + '操作');
    this.elements['startup-strip'].innerHTML = `<span class="strip-label">${bilingual(...title)}<small id="startup-count"></small></span>${steps.map(step => `<div class="startup-key" data-key="${step.key}"><kbd>${step.key}</kbd><span>${bilingual(step.english, step.shortLabel || step.label)}</span><b class="switch-state"></b></div>`).join('')}`;
    this.startupItems = [...this.elements['startup-strip'].querySelectorAll('.startup-key')];
    this.startupCount = document.getElementById('startup-count');
    this.startupStates = this.startupItems.map(element => ({element, status: element.querySelector('.switch-state'),
      title: `${element.querySelector('span').firstChild.textContent}（${element.querySelector('small').textContent}）[${element.dataset.key}]`}));
  }

  updateSystems() {
    this.setFlow();
    const a = this.game.aircraft, systems = a.systems, flight = this.game.flight;
    const speed = Math.round(a.airspeed * FLIGHT.knotsPerMps), altitude = Math.floor(flight.altitude());
    const gearReady = flight.canRetractGear();
    const gearHidden = this.game.view !== 'COCKPIT' || flight.altitude() >= FLIGHT.gearPreviewHeight || ['COMPLETE', 'RESULT'].includes(this.game.phase);
    if (this.elements['gear-preview'].hidden !== gearHidden) this.elements['gear-preview'].hidden = gearHidden;
    const pitch = degrees(a.pitch), bank = degrees(a.bank);
    const heading = (degrees(a.heading) % 360 + 360) % 360 || 360;
    const rpm = Math.round(systems.engine === 'RUNNING' ? SYSTEMS.engineIdlePercent + a.enginePower * (100 - SYSTEMS.engineIdlePercent) : systems.engineProgress * SYSTEMS.engineIdlePercent);
    const signature = [this.game.phase, this.game.runId, systems.lights, systems.door, systems.harness, systems.avionics, systems.engine, rpm, systems.flaps, systems.gear, this.game.mission.approaching, systems.parkingBrake, a.wheelBrake, speed, altitude, a.verticalSpeed.toFixed(1), pitch, bank, heading, gearReady, Math.floor(flight.completionSeconds * 10), degrees(a.angleOfAttack * 10), degrees(a.flightPathAngle * 10), a.loadFactor.toFixed(1), flight.pitchHigh, flight.pitchLow, flight.overspeed, flight.stalled, flight.lowSpeed, a.airspeed < flight.stallSpeed, Math.ceil(flight.safeSpeed * FLIGHT.knotsPerMps), this.game.mission.ceilingFault, Math.round(this.game.mission.targetAltitude), this.game.prompts.current].join('|');
    if (signature === this.lastSystemsSignature) return;
    this.lastSystemsSignature = signature;
    this.container.classList.toggle('lights-on', systems.lights);
    this.container.classList.toggle('avionics-on', systems.avionics);
    if (this.flow === 'startup') {
      let completed = 0;
      STARTUP_STEPS.forEach((step, index) => {
        const done = this.game.systems.isComplete(step), busy = step.kind === 'engine' && systems.engine === 'STARTING';
        this.setItem(index, done, busy, done ? step.readyState || 'ON' : busy ? 'Starting' : step.pendingState || 'OFF');
        if (done) completed++;
      });
      setText(this.startupCount, `${completed} / ${STARTUP_STEPS.length}`);
    } else if (this.flow === 'roll' || this.flow === 'taxi') {
      const rotate = a.airspeed >= FLIGHT.rotationSpeed;
      this.setItem(0, true, false, '');
      this.setItem(1, true, false, '');
      this.setItem(2, true, false, 'Steady');
      this.setItem(3, this.flow === 'taxi' ? systems.parkingBrake : rotate, false, this.flow === 'taxi' ? systems.parkingBrake ? 'ON' : 'OFF' : rotate ? 'Ready' : `${knots(FLIGHT.rotationSpeed)} kt`);
      this.setWingBrake(4);
      setText(this.startupCount, this.flow === 'taxi' ? `${Math.round(this.game.mission.parkDistance)} m` : `${knots(FLIGHT.rotationSpeed)} kt`);
    } else {
      this.setItem(0, true, false, '');
      this.setItem(1, !flight.pitchHigh && !flight.pitchLow && !flight.stalled, flight.pitchHigh || flight.pitchLow || flight.stalled, `${pitch}°`);
      this.setItem(2, Math.abs(a.bank) <= FLIGHT.successBank, false, `${bank}°`);
      const gearBusy = ['EXTENDING', 'RETRACTING'].includes(systems.gear), landing = this.game.mission.approaching;
      const gearDone = systems.gear === (landing ? 'DOWN' : 'UP');
      this.setItem(3, gearDone || gearReady, gearBusy, gearBusy ? systems.gear === 'EXTENDING' ? 'Extending' : 'Retracting' : gearDone ? landing ? 'Down' : 'Up' : landing ? 'Deploy' : gearReady ? 'Ready' : `${FLIGHT.gearHeight} m ↑`);
      this.setWingBrake(4);
      setText(this.startupCount, `${Math.round(this.game.mission.targetAltitude)} m`);
    }
    for (const [id, value] of [['airspeed-value', speed], ['altitude-value', altitude], ['vertical-speed-value', a.verticalSpeed.toFixed(1)]]) setText(this.elements[id], systems.avionics ? value : 'OFF');
    setText(this.elements['ground-speed'], systems.avionics ? `${Math.round(a.airspeed * 3.6)} km/h` : 'km/h');
    setBilingual(this.elements['heading-value'], systems.avionics ? `Heading ${heading}°` : 'Heading OFF', '航向');
    setBilingual(this.elements['attitude-preview-label'], `Pitch ${pitch}° · Bank ${bank}°`, '俯仰 · 坡度');
    setBilingual(this.elements['attitude-label'], systems.avionics ? `Pitch ${pitch}° · Bank ${bank}°` : 'Avionics OFF', systems.avionics ? '俯仰 · 坡度' : '仪表关闭');
    if (this.displayBank !== bank) { this.attitudeMark.style.setProperty('--bank', `${-bank}deg`); this.displayBank = bank; }
    if (this.displayPitch !== pitch) { this.attitudeMark.style.setProperty('--horizon', `${50 + pitch * 2}%`); this.displayPitch = pitch; }
    const engineValue = systems.avionics ? `${rpm}%` : 'OFF';
    setText(this.enginePrimary, engineValue + ' '); setText(this.engineSecondary, engineValue);
    const brakeMoving = ['RETRACTING', 'EXTENDING'].includes(systems.flaps);
    setBilingual(this.elements['throttle-value'], `Wing brake ${brakeMoving ? 'moving' : systems.flaps === 'CLEAN' ? 'OFF' : 'ON'}`, brakeMoving ? '模式切换中' : systems.flaps === 'CLEAN' ? '提速快 · 减速慢' : '提速慢 · 减速快');
    setBilingual(this.elements['gear-preview-label'], `${altitude} m · ↓${Math.max(0, -a.verticalSpeed).toFixed(1)} m/s`, `${systems.gear === 'DOWN' ? '起落架放下' : systems.gear === 'UP' ? '起落架收起' : '起落架移动中'} · ${brakeMoving ? '减速板收放中' : systems.flaps === 'CLEAN' ? '减速板关闭' : '减速板打开'}`);
    const alphaWarning = Math.abs(a.angleOfAttack) > AERODYNAMICS.criticalAlpha - AERODYNAMICS.alphaWarningMargin;
    this.elements['airspeed-value'].classList.toggle('is-warning', !a.onGround && a.airspeed < flight.safeSpeed);
    this.elements['airspeed-value'].classList.toggle('is-critical', !a.onGround && a.airspeed < flight.stallSpeed);
    const condition = flight.stalled ? ['Stall', '失速'] : flight.pitchHigh ? ['Pitch high', '仰角过大'] : flight.pitchLow ? ['Descent warning', '下降危险'] : flight.overspeed ? ['Overspeed', '空速过高'] : alphaWarning ? ['Angle high', '迎角偏高'] : flight.lowSpeed ? ['Airspeed low', '空速偏低'] : ['Normal', '正常'];
    const readout = this.elements['aero-readout'];
    const aeroValues = systems.avionics ? [
      [`Angle of attack ${(a.angleOfAttack * 180 / Math.PI).toFixed(1)}°`, '迎角'],
      [`Flight path ${(a.flightPathAngle * 180 / Math.PI).toFixed(1)}°`, '航迹角'],
      [`Lift load ${a.loadFactor.toFixed(1)} g`, '升力载荷'],
      [`Min speed ${Math.ceil(flight.safeSpeed * FLIGHT.knotsPerMps)} kt`, '平飞安全参考'], condition,
    ] : [['Avionics OFF', '飞行仪表']];
    for (let i = 0; i < this.aeroItems.length; i++) {
      const item = this.aeroItems[i], hidden = i >= aeroValues.length;
      if (item.hidden !== hidden) item.hidden = hidden;
      if (!hidden) setBilingual(item, ...aeroValues[i]);
    }
    readout.classList.toggle('is-warning', condition[0] !== 'Normal');
    setBilingual(this.elements['brake-state'], ...(systems.parkingBrake ? ['Parking brake ON', '驻车刹车'] : a.wheelBrake ? ['Wheel brake ON', '轮刹'] : ['Brake OFF', '刹车']));
    const prompt = this.game.prompts.current;
    if (this.elements['startup-prompt'].hidden !== !prompt) this.elements['startup-prompt'].hidden = !prompt;
    setText(this.elements['startup-prompt'], prompt || '');
    this.elements['startup-prompt'].classList.toggle('is-flight-warning', ['pitch-high', 'pitch-low', 'stall'].includes(this.game.prompts.type));
    const guide = this.elements['flight-guide'];
    const guideHidden = this.flow === 'startup' || this.game.phase === 'RESULT';
    if (guide.hidden !== guideHidden) guide.hidden = guideHidden;
    guide.classList.toggle('is-warning', flight.lowSpeed || flight.pitchHigh || flight.pitchLow || flight.overspeed || flight.stalled);
    if (this.game.phase === 'COMPLETE') setText(guide, `🎉 恭喜！已安全抵达${this.game.route.destinationName}停机圈`);
    else if (this.flow === 'taxi') setText(guide, `W 打开后按 S 快速减速 · 低速滑入金色圈，距离 ${Math.round(this.game.mission.parkDistance)} m · 停稳，圈内保持 1 秒`);
    else if (this.game.mission.ceilingFault && !flight.stalled) setText(guide, 'Altitude fault（动力故障）· 超出 10000 米，↓ 降到 9800 米以下恢复动力');
    else if (this.flow === 'roll') setText(guide, a.airspeed >= FLIGHT.rotationSpeed ? '已到抬轮速度 · ↑ 抬头至约 10°，保持方向' : `W 关闭，T 提速 · 约 ${FLIGHT.rollTargetSeconds} 秒达到 ${knots(FLIGHT.rotationSpeed)} kt · ↑ 抬头 · S 减速，W 打开后减速更快`);
    else if (flight.stalled) setText(guide, a.angleOfAttack < 0 ? '失速 · ↑ 平缓抬高机头减小负迎角，保持机翼平稳' : '失速 · ↓ 降低机头减小迎角，W 关闭，T 提速，保持机翼平稳');
    else if (flight.pitchHigh) setText(guide, '仰角过大 · ↓ 降低机头；持续拉高会消耗速度，可能失速下坠');
    else if (flight.pitchLow) setText(guide, '下降危险 · ↑ 平缓抬高机头，保持安全空速，避免撞地');
    else if (flight.overspeed) setText(guide, '空速过高 · W 打开后按 S 减速，平缓改出俯冲');
    else if (this.flow === 'climb') setText(guide, flight.lowSpeed ? `空速偏低 · 当前姿态建议至少 ${Math.ceil(flight.safeSpeed * FLIGHT.knotsPerMps)} kt · W 关闭、T 提速，减小迎角` : this.game.mission.approaching ? `Approach（${this.game.route.destinationName}进近）· 目标海拔 ${Math.round(this.game.mission.targetAltitude)} m · 160–180 kt · G 放轮 / W 打开减速板 · 对准跑道，轻柔接地` : `Cruise（航程）· 约 ${this.game.route.cruiseKnots} kt、目标海拔 ${Math.round(this.game.mission.targetAltitude)} m，保持${this.game.route.destinationName}方向 · G 收轮 · W 保持关闭 · 左侧轨迹与雷达辅助避让`);
  }

  setWingBrake(index) {
    const state = this.game.aircraft.systems.flaps, open = state === 'TAKEOFF';
    const busy = state === 'EXTENDING' || state === 'RETRACTING';
    const landing = this.game.mission.approaching || this.game.aircraft.landed;
    this.setItem(index, !busy && (landing ? open : state === 'CLEAN'), busy,
      busy ? state === 'EXTENDING' ? 'Opening' : 'Closing' : open ? 'ON' : 'OFF');
  }

  setItem(index, ready, busy, state) {
    const item = this.startupStates[index];
    if (item.ready !== ready) { item.element.classList.toggle('is-on', ready); item.ready = ready; }
    if (item.busy !== busy) { item.element.classList.toggle('is-busy', busy); item.busy = busy; }
    if (item.state !== state) {
      setText(item.status, state); item.status.hidden = !state;
      item.element.title = item.title + (state ? `，${state}` : ''); item.state = state;
    }
  }

  update() {
    this.updateSystems();
    this.navigation.update();
    if (this.game.phase === 'INTRO') {
      const remaining = Math.max(1, Math.ceil(CAMERA.introSeconds - this.game.introSeconds - 1e-9));
      const number = String(remaining);
      if (this.elements['countdown-number'].textContent !== number) {
        this.elements['countdown-number'].textContent = number;
        this.elements['countdown-caption'].textContent = ['进入驾驶舱', '机场与跑道', '机身与机翼', '跑道与起点'][remaining - 1];
      }
    }
    const second = this.game.mission.started ? Math.ceil(this.game.mission.remaining) : Math.floor(this.game.activeSeconds);
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
