// 仅在 Android 打包副本内安装原生计时、暂停和朗读适配。
export function installAndroidHost({game, ui, input, audio, kind, pauseClock = () => {}, resumeClock = () => {}, invalidate = () => {}}) {
  const bridge = window.AndroidHost;
  if (!bridge || typeof bridge.postMessage !== 'function') {
    const failure = document.createElement('div');
    failure.className = 'android-host-failure';
    failure.textContent = '游戏与应用的连接未建立，请返回首页后重新进入。';
    document.body.append(failure);
    console.error('Android host bridge is unavailable');
    return;
  }
  let held = false, disposed = false, lastState = '', savedState, pausedAt = 0, carFrozen = false;
  let speaking = null, speechSerial = 0;
  const isEnglish = kind === 'english-air-combat';
  const isFlight = kind === 'low-altitude-flight';
  const post = message => {
    if (disposed) return false;
    try { bridge.postMessage(JSON.stringify(message)); return true; }
    catch (error) { console.error('Android host message failed', error); return false; }
  };
  const snapshot = () => {
    const state = isFlight ? game.phase : game.state;
    let eligible = false;
    if (!held && !document.hidden) {
      if (isEnglish) {
        eligible = game.state === 'playing' && !ui.dialogMode ||
          game.state === 'preview' && ui.dialogMode === 'preview' ||
          game.state === 'review' && ui.dialogMode === 'recap' && game.reviewRemaining > 0;
      } else if (isFlight) {
        eligible = !game.paused && !ui.preparing && !ui.upgrading && !ui.error &&
          ['STARTUP', 'TAKEOFF_ROLL', 'INITIAL_CLIMB', 'CRUISE', 'APPROACH', 'LANDING_ROLL', 'TAXI'].includes(state);
      } else {
        eligible = ['RUNNING', 'QUIZ', 'CAUGHT', 'LEVEL_EXIT'].includes(state);
      }
    }
    return {type: 'state', state: held ? 'android-paused' : state, eligible: Boolean(eligible)};
  };
  let controls;
  const report = (force = false) => {
    controls?.update();
    const message = snapshot(), key = JSON.stringify(message);
    if (force || key !== lastState) { lastState = key; post(message); }
  };
  const wrap = (target, key, block = false) => {
    const previous = target?.[key];
    if (typeof previous !== 'function') return;
    target[key] = function (...args) {
      if (block && held) return;
      const value = previous.apply(this, args);
      report();
      return value;
    };
  };
  // 状态写入后等当前输入处理结束再上报，避免把预习/设置弹窗的中间状态当学习。
  for (const key of isFlight ? ['phase', 'paused'] : ['state']) {
    let value = game[key];
    Object.defineProperty(game, key, {configurable: true, enumerable: true,
      get: () => value,
      set: next => { if (value === next) return; value = next; queueMicrotask(() => report()); }
    });
  }
  for (const key of ['render', 'dialog', 'closeDialog']) wrap(ui, key);
  wrap(game, 'onChange');
  for (const key of ['start', 'restart', 'resume', 'space', 'togglePause', 'command', 'enterCockpit']) wrap(game, key, true);
  const originalSpeech = isEnglish && ui.speech ? {
    play: ui.speech.play.bind(ui.speech), stop: ui.speech.stop.bind(ui.speech)
  } : null;
  const stopSpeech = () => {
    speaking = null;
    originalSpeech?.stop();
    post({type: 'stopSpeech'});
  };
  if (originalSpeech) {
    ui.speech.stop = stopSpeech;
    ui.speech.play = text => {
      stopSpeech();
      const word = String(text || '').trim();
      if (!word || held) return;
      const request = {id: globalThis.crypto?.randomUUID?.() || Date.now() + '-' + (++speechSerial) + '-' + Math.random(), text: word};
      speaking = request;
      if (!post({type: 'speak', ...request})) { speaking = null; originalSpeech.play(word); }
    };
  }
  bridge.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type !== 'speech' || !speaking || message.id !== speaking.id) return;
    if (message.status === 'error') {
      const request = speaking; speaking = null;
      console.warn('Android speech unavailable', message.message || 'Unknown speech error');
      if (!held && !document.hidden) originalSpeech?.play(request.text);
    } else if (message.status === 'done') speaking = null;
  };
  const pause = reason => {
    if (!held) {
      savedState = isFlight ? game.paused : game.state;
      pausedAt = performance.now();
      pauseClock(); held = true;
      controls?.clear(); input.clear();
      if (isFlight) game.pause();
      else if (isEnglish) { game.pause(); if (savedState === 'playing') ui.render(); }
      else {
        carFrozen = ['RUNNING', 'QUIZ', 'CAUGHT', 'DYING', 'LEVEL_EXIT'].includes(savedState);
        if (carFrozen) { game.pause(); game.state = 'PAUSED'; game.onChange(); }
      }
    }
    stopSpeech();
    if (isFlight) audio.silence();
    else if (isEnglish) audio.stop();
    else audio.setState('PAUSED');
    report(true);
  };
  const resume = () => {
    if (!held || disposed) return;
    held = false;
    if (isFlight) { if (!savedState && game.paused) game.togglePause(); }
    else if (isEnglish) {
      if (savedState === 'playing' && game.state === 'paused') { game.resume(); ui.closeDialog(); }
    } else {
      if (savedState === 'QUIZ' && game.quiz) game.quiz.deadline += performance.now() - pausedAt;
      if (carFrozen) game.state = savedState;
      input.clear(); game.onChange(); audio.setState(game.state);
    }
    resumeClock(); ui.render(); invalidate(); report(true);
  };
  const activity = event => {
    if (!event.isTrusted) return;
    if (held) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (event.type === 'keydown' && (event.repeat || event.altKey || event.ctrlKey || event.metaKey)) return;
    if (event.type === 'pointermove' && !event.buttons) return;
    if (!['pointerdown', 'pointermove', 'keydown'].includes(event.type)) return;
    queueMicrotask(() => { report(); if (snapshot().eligible) post({type: 'activity'}); });
  };
  for (const name of ['pointerdown', 'pointermove', 'keydown']) window.addEventListener(name, activity, {capture: true, passive: false});
  if (isFlight) controls = installFlightControls({game, input, canInput: () => !held, changed: () => report()});
  window.AndroidShell = {pause, resume, get paused() { return held; }};
  const timer = setInterval(() => report(true), 1000);
  const visibility = () => { if (document.hidden) pause('background'); else report(true); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', () => {
    pause('navigation'); disposed = true; clearInterval(timer); controls?.dispose();
    document.removeEventListener('visibilitychange', visibility);
    for (const name of ['pointerdown', 'pointermove', 'keydown']) window.removeEventListener(name, activity, true);
  }, {once: true});
  report(true);
}

// 触屏操作直接复用正式 Input 的命令与持续按下集合，不模拟键盘字符。
function installFlightControls({game, input, canInput, changed}) {
  const panel = document.createElement('section');
  panel.className = 'android-flight-controls'; panel.setAttribute('aria-label', '飞行触屏操作');
  const bar = document.createElement('div'); bar.className = 'android-controls-bar';
  const title = document.createElement('strong'); title.textContent = 'Flight controls';
  const subtitle = document.createElement('small'); subtitle.textContent = '飞行操作'; title.append(subtitle);
  const collapse = document.createElement('button'); collapse.type = 'button'; collapse.textContent = '收起操作'; collapse.setAttribute('aria-expanded', 'true');
  bar.append(title, collapse); panel.append(bar);
  const content = document.createElement('div'); content.className = 'android-controls-content'; panel.append(content);
  let collapsed = false, height = -1;
  collapse.onclick = () => { collapsed = !collapsed; content.hidden = collapsed; collapse.textContent = collapsed ? '展开操作' : '收起操作'; collapse.setAttribute('aria-expanded', String(!collapsed)); };
  const pointers = new Map();
  const clear = () => {
    for (const entry of pointers.values()) { clearTimeout(entry.timer); entry.button.classList.remove('held'); if (entry.held) input.held.delete(entry.action); }
    pointers.clear();
  };
  const add = (group, key, english, chinese, action = key, held = false, repeat = false) => {
    const button = document.createElement('button'); button.type = 'button';
    const cap = document.createElement('kbd'); cap.textContent = key;
    const label = document.createElement('span'); label.textContent = english;
    const meaning = document.createElement('small'); meaning.textContent = chinese; label.append(meaning);
    button.append(cap, label); group.append(button);
    button.oncontextmenu = event => event.preventDefault();
    button.addEventListener('pointerdown', event => {
      if (!canInput() || !event.isPrimary && event.pointerType === 'mouse' || event.button !== 0 || [...pointers.values()].some(value => value.button === button)) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      const entry = {button, action, held, timer: null}; pointers.set(event.pointerId, entry); button.classList.add('held');
      input.onActivity();
      if (held) input.held.add(action);
      input.onCommand(action, {repeat: false}); changed();
      if (repeat) {
        const again = () => {
          if (!pointers.has(event.pointerId) || !canInput()) return;
          input.onCommand(action, {repeat: true}); entry.timer = setTimeout(again, 80);
        };
        entry.timer = setTimeout(again, 400);
      }
    });
    const release = event => {
      const entry = pointers.get(event.pointerId); if (!entry || entry.button !== button) return;
      clearTimeout(entry.timer); pointers.delete(event.pointerId); button.classList.remove('held');
      if (entry.held) input.held.delete(entry.action);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, release);
  };
  const switches = document.createElement('div'); switches.className = 'android-flight-switches'; content.append(switches);
  for (const item of [['L','Lights','灯光'],['D','Door','舱门'],['H','Harness','安全带'],['A','Avionics','仪表'],['E','Engine','发动机'],['R','Release','放行 / 驻车'],['W','Wing brake','减速板'],['G','Gear','起落架']]) add(switches, ...item);
  const movement = document.createElement('div'); movement.className = 'android-flight-movement'; content.append(movement);
  add(movement, 'T', 'Thrust', '提速', 'T', true); add(movement, 'S', 'Slow', '减速', 'S', true);
  add(movement, '←', 'Left', '向左', 'left', true); add(movement, '→', 'Right', '向右', 'right', true);
  add(movement, '↑', 'Up', '抬头', 'up', true, true); add(movement, '↓', 'Down', '低头', 'down', true, true);
  add(movement, '␣', 'Pause', '暂停', 'space');
  document.body.append(panel);
  const measure = () => {
    const next = panel.hidden ? 0 : Math.ceil(panel.getBoundingClientRect().height);
    if (next === height) return; height = next;
    document.documentElement.style.setProperty('--android-controls-height', next + 'px');
    window.dispatchEvent(new Event('resize'));
  };
  const observer = new ResizeObserver(measure); observer.observe(panel);
  const update = () => { panel.hidden = ['READY', 'RESULT', 'INTRO'].includes(game.phase); if (panel.hidden) clear(); measure(); };
  return {clear, update, dispose: () => { clear(); observer.disconnect(); panel.remove(); }};
}
