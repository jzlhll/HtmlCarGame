import { FLIGHT, RUNWAY, STARTUP_STEPS, TAKEOFF_CONTROLS, CLIMB_CONTROLS, LEVELS, JOURNEY, displayHeight } from './config.js';

import { APP_VERSION } from './version.js';
import { NavigationUI } from './navigation-ui.js';
import { setText, setBilingual, enlargeChinese } from './dom.js';

const formatSpeed = value => Math.round(value);
const degrees = value => Math.round(value * 180 / Math.PI);
const startupControls = STARTUP_STEPS.filter(step => step.key !== 'W');
const bilingual = (english, chinese) => `${english}<small>${chinese}</small>`;


export class UI {
  constructor(game, container) {
    this.game = game;
    this.navigation = new NavigationUI(game);
    this.container = container;
    this.error = false;
    this.preparing = false;
    this.upgrading = true;
    this.sessionNotice = '';
    setText(document.getElementById('app-version'), APP_VERSION);
    this.onEnter = () => game.enterCockpit({landingDebug: this.elements['landing-debug'].checked});
    this.renderBriefing();
    this.availabilityCopy = container.querySelector('.availability').textContent;
    this.lastSecond = -1;
    setText(document.getElementById('runway-number'), '深圳机场');
    setText(document.getElementById('runway-code'), `Runway ${RUNWAY.designator} / engine OFF`);
    this.elements = {};
    for (const id of ['welcome', 'preview-banner', 'instruments', 'startup-strip', 'pause-overlay',
      'exterior-caption', 'elapsed', 'error-overlay', 'error-message', 'resume-button', 'intro-sequence', 'countdown-number', 'countdown-caption', 'countdown-heading', 'countdown-tip', 'landing-debug', 'pause-copy', 'startup-hint-copy', 'startup-prompt', 'attitude-preview', 'gear-preview', 'gear-preview-label', 'flight-status', 'airspeed-value', 'altitude-value', 'vertical-speed-value', 'attitude-value', 'attitude-label', 'ground-speed', 'flight-guide', 'result-overlay', 'result-title', 'result-reason', 'result-caption', 'result-stats', 'restart-button', 'next-level-button']) {
      this.elements[id] = document.getElementById(id);
    }
    this.attitudeMark = container.querySelector('.attitude-mark');
    setText(this.elements['startup-hint-copy'], `${startupControls.filter(step => step.kind === 'prepare').map(step => step.key).join('、')} 可任意顺序操作，再次按键可撤销准备。`);
    container.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'retry-upgrade') { this.onUpgradeRetry?.(); return; }
      if (!action || this.error || this.upgrading) return;
      if (action === 'enter' && !this.preparing) this.onEnter();
      if (action === 'pause') game.togglePause();
      if (action === 'exterior') game.returnToExterior();
    });
    container.addEventListener('keydown', event => {
      if (this.error || event.code !== 'Tab') return;
      const overlay = this.upgrading ? document.getElementById('upgrade-overlay') : this.game.paused ? this.elements['pause-overlay'] : this.game.phase === 'RESULT' ? this.elements['result-overlay'] : null;
      if (!overlay) return;
      const buttons = overlay.querySelectorAll('button:not([hidden]), a[href]:not([hidden])');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    this.render();
    enlargeChinese(container);
  }

  renderBriefing() {
    const route = this.game.route;
    const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    this.container.querySelector('.intro-copy').innerHTML = `第 ${route.id} 关：深圳起飞，抵达${route.destinationName}。`;
    setText(this.container.querySelector('.availability'), `${formatTime(route.deadline)} · 起飞至${route.destinationName}机场`);
    setText(this.container.querySelector('.welcome .eyebrow'), `Flight ${route.id}`);
    const stops = [{english: 'Shenzhen airport', chinese: '深圳机场', z: 0}, ...route.sectors];
    this.container.querySelector('#route-briefing').innerHTML = `
      <div class="level-selector" aria-label="选择飞行关卡">${LEVELS.map(level => `<a href="?level=${level.id}" ${level.id === route.id ? 'aria-current="page"' : ''}>${level.id} · ${level.destinationEnglish}<small>${level.destinationName}</small></a>`).join('')}</div>
      <header><span>Flight plan<small>第 ${route.id} 关 · 深圳 → ${route.destinationName}</small></span><b>${formatTime(route.deadline)}</b></header>
      <ol class="route-stops">${stops.map(stop => `<li><span>${stop.english}<small>${stop.chinese}</small></span></li>`).join('')}</ol>
      <div class="route-profile"><span>Open scenery<small>平坦机场 · 循环地景 · 飞行上限${displayHeight(route.ceiling)} m</small></span></div>
      <footer>${formatSpeed(route.cruiseSpeed)} km/h · ${(Math.abs(route.destination.threshold) / 1000).toFixed(1)} km<small>建议巡航 · 压缩航线 · 时限包含着陆停机</small></footer>`;
  }

  setPreparing(preparing, progress) {
    this.preparing = preparing;
    const button = this.container.querySelector('[data-action="enter"]');
    button.disabled = preparing || this.upgrading;
    this.elements['landing-debug'].disabled = preparing || this.upgrading;
    button.setAttribute('aria-busy', String(preparing));
    setText(this.container.querySelector('.availability'), preparing ? `准备起飞中${progress===undefined?'…':` · ${progress}%`}` : this.sessionNotice || this.availabilityCopy);
  }

  setSessionNotice(message) {
    this.sessionNotice = message;
    if (!this.preparing) setText(this.container.querySelector('.availability'),message || this.availabilityCopy);
  }

  setUpgrade(state) {
    this.upgrading = Boolean(state);
    const overlay=document.getElementById('upgrade-overlay');
    overlay.hidden=!state;
    if (state) {
      setText(document.getElementById('upgrade-title'), state.title);
      setText(document.getElementById('upgrade-message'), state.message);
      document.getElementById('upgrade-progress').value=state.progress ?? document.getElementById('upgrade-progress').value;
      setText(document.getElementById('upgrade-percentage'), `${Math.round(document.getElementById('upgrade-progress').value)}%`);
      document.getElementById('upgrade-retry').hidden=!state.failed;
      overlay.setAttribute('aria-busy',String(!state.failed));
      if (state.failed) document.getElementById('upgrade-retry').focus({preventScroll:true});
    }
    this.container.querySelector('[data-action="enter"]').disabled=this.upgrading || this.preparing;
    this.elements['landing-debug'].disabled=this.upgrading || this.preparing;
    this.render();
  }

  render() {
    const inside = this.game.view === 'COCKPIT', intro = this.game.phase === 'INTRO';
    const started = inside || intro || Boolean(this.game.result), result = this.game.phase === 'RESULT';
    this.container.dataset.view = this.game.view;
    this.elements.welcome.hidden = started;
    this.container.querySelector('#route-briefing').hidden = started;
    this.elements['exterior-caption'].hidden = started;
    this.elements['intro-sequence'].hidden = !intro;
    for (const id of ['instruments', 'startup-strip', 'attitude-preview']) this.elements[id].hidden = !inside;
    this.elements['preview-banner'].hidden = !inside || this.game.phase !== 'STARTUP' || this.game.startupHintDismissed;
    this.elements.elapsed.hidden = !started;
    this.elements['pause-overlay'].hidden = !this.game.paused;
    this.elements['result-overlay'].hidden = !result;
    for (const child of this.container.children) {
      child.inert = this.upgrading ? child.id !== 'upgrade-overlay' : child.id !== 'error-overlay' && (this.error || (this.game.paused && child.id !== 'pause-overlay') || (result && child.id !== 'result-overlay'));
    }
    this.container.querySelector('.session').hidden=!started;
    setText(this.elements['pause-copy'], intro ? '倒数和镜头停在这里，准备好后继续。' : '飞机与计时停在这里，准备好后继续。');
    if (result) {
      const value = this.game.result;
      this.elements['next-level-button'].hidden = !value.success || this.game.route.id >= LEVELS.length;
      this.elements['next-level-button'].href = `?level=${this.game.route.id + 1}`;
      setText(this.elements['result-title'], value.success ? '🎉 恭喜！航程完成' : '💥 失败！再试一次');
      setText(this.elements['result-caption'], value.success ? 'Congratulations' : 'Flight failed');
      setText(this.elements['result-reason'], value.reason);
      this.elements['result-stats'].innerHTML = [['用时', `${Math.floor(value.seconds / 60)}分${Math.floor(value.seconds % 60)}秒`], ['最高高度', `${Math.round(displayHeight(value.maxAltitude))} m`], ['离地速度', value.liftOffSpeed ? `${Math.round(value.liftOffSpeed)} km/h` : '尚未离地'], ['最高空速', `${Math.round(value.maxAirspeed)} km/h`]].map(([name, data]) => `<div><dt>${name}</dt><dd>${data}</dd></div>`).join('');
    }
    if (result) enlargeChinese(this.elements['result-stats']);
    this.update();
    if (this.error || this.upgrading) return;
    if (result) this.elements['restart-button'].focus({ preventScroll: true });
    else if (this.game.paused) this.elements['resume-button'].focus({ preventScroll: true });
    else this.container.focus({ preventScroll: true });
  }

  setFlow() {
    const phase = this.game.phase;
    const flow = this.game.aircraft.landed ? 'taxi' : !this.game.aircraft.onGround ? 'climb' : phase === 'TAKEOFF_ROLL' ? 'roll' : 'startup';
    if (flow === this.flow && phase === this.flowPhase) return;
    this.flow = flow; this.flowPhase = phase;
    this.container.dataset.controls=flow;
    const taxi = [TAKEOFF_CONTROLS[0], TAKEOFF_CONTROLS[1], TAKEOFF_CONTROLS[2], {key: 'R', english: 'Release', label: '驻车刹车'}, CLIMB_CONTROLS[4]];
    const steps = flow === 'startup' ? startupControls : flow === 'roll' ? TAKEOFF_CONTROLS : flow === 'taxi' ? taxi : CLIMB_CONTROLS.map(step => step.key === 'G' ? {...step, label: '起落架'} : step);
    const title = flow === 'startup' ? ['Preflight', '起飞准备'] : flow === 'roll' ? ['Takeoff roll', '跑道起飞'] : flow === 'taxi' ? ['Parking', '跑道内停稳'] : phase === 'APPROACH' ? ['Approach', `${this.game.route.destinationName}进近`] : phase === 'CRUISE' ? ['Cruise', '巡航'] : ['Initial climb', '离地爬升'];
    this.elements['startup-strip'].classList.toggle('flight-controls', flow !== 'startup');
    this.elements['startup-strip'].setAttribute('aria-label', title[1] + '操作');
    this.elements['startup-strip'].innerHTML = `<span class="strip-label">${bilingual(...title)}<small id="startup-count"></small></span>${steps.map(step => `<div class="startup-key" data-key="${step.key}"><kbd>${step.key}</kbd><span>${bilingual(step.english, step.shortLabel || step.label)}</span><b class="switch-state"></b></div>`).join('')}`;
    enlargeChinese(this.elements['startup-strip']);
    this.startupItems = [...this.elements['startup-strip'].querySelectorAll('.startup-key')];
    this.startupCount = document.getElementById('startup-count');
    this.startupStates = this.startupItems.map(element => ({element, status: element.querySelector('.switch-state'),
      title: `${element.querySelector('span').firstChild.textContent}（${element.querySelector('small').textContent}）[${element.dataset.key}]`}));
  }

  updateSystems() {
    this.setFlow();
    this.updateLandingGuide();
    const a = this.game.aircraft, systems = a.systems, flight = this.game.flight;
    const speed = this.game.mission.approaching && !a.onGround ? Number(a.airspeed.toFixed(2)) : Math.round(a.airspeed), altitude = Math.floor(displayHeight(flight.altitude()));
    const gearReady = flight.canRetractGear();
    const gearHidden = this.game.view !== 'COCKPIT' || flight.altitude() >= FLIGHT.gearPreviewHeight || ['COMPLETE', 'RESULT'].includes(this.game.phase);
    if (this.elements['gear-preview'].hidden !== gearHidden) this.elements['gear-preview'].hidden = gearHidden;
    const gearWarning = !gearHidden && flight.gearWarning;
    const gearWarningPulse = gearWarning && Math.floor(this.game.activeSeconds / FLIGHT.gearWarningPulseSeconds) % 2 === 0;
    const pitch = Number((a.pitch * 180 / Math.PI).toFixed(1)), bank = degrees(a.bank);
    const signature = [this.game.phase, this.game.runId, systems.lights, systems.door, systems.harness, systems.avionics, systems.engine, systems.flaps, systems.gear, flight.thrustLocked, a.birdStrikeCount, flight.gearWarning, gearWarningPulse, flight.gearExtensionBlocked, this.game.mission.offCourse, this.game.mission.approaching, systems.parkingBrake, a.wheelBrake, speed, altitude, a.verticalSpeed.toFixed(1), pitch, bank, gearReady, Math.floor(flight.completionSeconds * 10), degrees(a.angleOfAttack * 10), degrees(a.flightPathAngle * 10), a.loadFactor.toFixed(1), flight.pitchLow, flight.stalled, a.birdStrike, Math.round(this.game.mission.targetAltitude), this.game.prompts.current].join('|');
    if (signature === this.lastSystemsSignature) return;
    this.lastSystemsSignature = signature;
    this.elements['gear-preview'].classList.toggle('is-gear-warning', gearWarning);
    this.elements['gear-preview'].classList.toggle('is-warning-pulse', gearWarningPulse);
    this.container.classList.toggle('lights-on', systems.lights);
    this.container.classList.toggle('avionics-on', systems.avionics);
    if (this.flow === 'startup') {
      let completed = 0;
      startupControls.forEach((step, index) => {
        const done = this.game.systems.isComplete(step), busy = step.kind === 'engine' && systems.engine === 'STARTING';
        this.setItem(index, done, busy, done ? step.readyState || 'ON' : busy ? 'Starting' : step.pendingState || 'OFF');
        if (done) completed++;
      });
      setText(this.startupCount, `${completed} / ${startupControls.length}`);
    } else if (this.flow === 'roll' || this.flow === 'taxi') {
      const rotate = a.airspeed >= FLIGHT.rotationSpeed;
      this.setItem(0, true, false, '');
      this.setItem(1, true, false, '');
      this.setItem(2, true, false, '');
      this.setItem(3, this.flow === 'taxi' ? systems.parkingBrake : rotate, false, this.flow === 'taxi' ? systems.parkingBrake ? 'ON' : 'OFF' : '');
      this.setWingBrake(4);
      setText(this.startupCount, this.flow === 'taxi' ? `${formatSpeed(this.game.aircraft.airspeed)} km/h` : '');
    } else {
      this.setItem(0, true, false, '');
      this.setItem(1, !flight.pitchLow && !flight.stalled, flight.pitchLow || flight.stalled, '');
      this.setItem(2, Math.abs(a.bank) <= FLIGHT.successBank, false, '');
      const gearBusy = ['EXTENDING', 'RETRACTING'].includes(systems.gear), landing = this.game.mission.approaching;
      const gearDone = systems.gear === (landing ? 'DOWN' : 'UP');
      this.setItem(3, gearDone || gearReady, gearBusy, gearBusy ? systems.gear === 'EXTENDING' ? 'Opening' : 'Closing' : systems.gear==='DOWN'?'Open':'Closed');
      this.setWingBrake(4);
      setText(this.startupCount, '');
    }
    for (const [id, value] of [['airspeed-value', speed], ['altitude-value', altitude], ['vertical-speed-value', a.verticalSpeed.toFixed(1)]]) setText(this.elements[id], systems.avionics ? value : 'OFF');
    setBilingual(this.elements['ground-speed'], 'Flight speed', '飞行速度');
    setText(this.elements['attitude-value'], !systems.avionics ? 'OFF' : pitch === 0 ? 'Level' : `${pitch > 0 ? '+' : ''}${pitch.toFixed(1)}°`);
    setBilingual(this.elements['attitude-label'], !systems.avionics ? 'Avionics OFF' : pitch === 0 ? '' : pitch > 0 ? 'Up' : 'Down',
      !systems.avionics ? '仪表关闭' : pitch === 0 ? '水平' : pitch > 0 ? '向上' : '向下');
    if (this.displayBank !== bank) { this.attitudeMark.style.setProperty('--bank', `${-bank}deg`); this.displayBank = bank; }
    if (this.displayPitch !== pitch) { this.attitudeMark.style.setProperty('--horizon', `${50 + pitch * 2}%`); this.displayPitch = pitch; }
    setBilingual(this.elements['gear-preview-label'], `${altitude} m · ↓${Math.max(0, -a.verticalSpeed).toFixed(1)} km/h`, `${systems.gear === 'DOWN' ? '起落架放下' : systems.gear === 'UP' ? '起落架收起' : '起落架移动中'} · ${systems.flaps === 'CLEAN' ? '减速板关闭' : '减速板打开'}`);
    this.elements['airspeed-value'].classList.toggle('is-critical', !a.onGround && flight.stalled && !(this.game.mission.approaching && flight.landingStatus().ready));
    const prompt=this.game.prompts.current;
    this.elements['startup-prompt'].hidden=!prompt;
    setText(this.elements['startup-prompt'],prompt || '');
  }

  // 顶部优先显示异常；低空进近时始终同时显示接地速度范围。
  updateLandingGuide() {
    const game=this.game,a=game.aircraft,flight=game.flight,mission=game.mission;
    const landingStatus=mission.approaching && !a.onGround && !a.landed ? flight.landingStatus() : null;
    let warning=null;
    if(game.view==='COCKPIT' && !['STARTUP','CRASH','COMPLETE','RESULT'].includes(game.phase)) {
      if(flight.stalled && !landingStatus?.ready) warning=['Stall',flight.stallGuidance,'danger'];
      else if(flight.gearWarning) warning=['Landing gear','起落架未完全放下，触地会爆炸！','danger'];
      else if(flight.pitchLow && !landingStatus?.ready) warning=['Descent danger','下降危险，可能撞地。','danger'];
      else if(flight.thrustLocked) warning=['Thrust unavailable','两次鸟击，T 加速失效，下一关恢复。','danger'];
      else if(mission.contacts.some(contact=>!contact.hit&&!contact.rearBypass&&contact.danger)) warning=['Collision risk','前方有飞机或雁群，注意避让。','danger'];
      else if(mission.offCourse) warning=['Off course','已偏离航线，请调整方向。','warning'];
      else if(a.birdStrike) warning=['Bird damage','玻璃受损，本关最高速度降至 80%。','warning'];
      if(!warning && mission.approaching && !a.onGround && !a.landed) {
        const altitude=flight.altitude(),status=landingStatus;
        if(altitude<=FLIGHT.gearWarningHeight && (status.runway || altitude<=game.route.landingDangerHeight) && !status.ready) {
          if(!status.gear) warning=['Landing gear','起落架未完全放下，触地会爆炸！','danger'];
          else if(!status.pitch) warning=['Landing pitch','接地俯仰须保持−3°到+3°。','danger'];
          else if(!status.runway) warning=['Runway position','机身位置尚未进入跑道范围。','danger'];
        }
      }
      if(landingStatus && flight.altitude()<game.route.landingGuideHeight) {
        const range=`${game.route.landingMinSpeed}–${game.route.landingMaxSpeed} km/h`;
        let hint=landingStatus.speed?'着陆速度在允许范围内，请保持。':'';
        if(a.airspeed<game.route.landingMinSpeed) hint=flight.thrustLocked
          ? '着陆速度偏低，提速功能已失效，当前无法满足接地速度。'
          : a.systems.engine!=='RUNNING' ? '着陆速度偏低，请先启动Engine（发动机）再提速。'
          : a.systems.flaps!=='CLEAN' ? '着陆速度偏低，请先关闭Wing brake（机翼减速板）再提速。' : '着陆速度偏低，请提速。';
        warning=warning ? [`${warning[0]} · Landing speed ${range}`,[warning[1],hint].filter(Boolean).join(' '),warning[2]]
          : [`Landing speed ${range}`,hint,a.airspeed<game.route.landingMinSpeed?'warning':'info'];
      }
    }
    const banner=this.elements['flight-status'];
    banner.hidden=!warning;
    const signature=warning?warning.join('|'):'';
    if(signature===this.landingSignature)return;
    this.landingSignature=signature;
    banner.classList.toggle('is-danger',warning?.[2]==='danger');
    banner.classList.toggle('is-info',warning?.[2]==='info');
    if(warning)setBilingual(this.elements['flight-guide'],warning[0],warning[1]);
    else setText(this.elements['flight-guide'],'');
  }

  setWingBrake(index) {
    const systems = this.game.aircraft.systems;
    this.setItem(index, systems.lights, false, systems.flaps === 'TAKEOFF' ? 'Open' : 'Closed');
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
      const remaining = Math.max(1, Math.ceil(this.game.introDuration - this.game.introSeconds - 1e-9));
      setText(this.elements['countdown-number'], remaining);
      for (const id of ['countdown-heading', 'countdown-caption', 'countdown-tip']) this.elements[id].hidden = this.game.landingDebug;
      setText(this.elements['countdown-heading'], 'Prepare for departure');
      setText(this.elements['countdown-caption'], ['进入驾驶舱', '机场与跑道', '机身与机翼', '跑道与起点'][remaining - 1]);
      setText(this.elements['countdown-tip'], '发动机保持关闭');
    }
    const second = this.game.mission.started ? Math.ceil(this.game.mission.remaining) : Math.floor(this.game.activeSeconds);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    setText(this.elements.elapsed, `${String(Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}`);
  }

  showError(message) {
    this.error = true;
    setText(this.elements['error-message'], message);
    this.elements['error-overlay'].hidden = false;
    this.render();
  }

  clearError() {
    this.error = false;
    this.elements['error-overlay'].hidden = true;
    this.render();
  }
}
