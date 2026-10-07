import { RUNWAY, STARTUP_STEPS } from './config.js';

export class UI {
  constructor(game, container) {
    this.game = game;
    this.container = container;
    this.error = false;
    this.lastSecond = -1;
    document.getElementById('runway-number').textContent = `${RUNWAY.designator} 号跑道`;
    document.getElementById('runway-code').textContent = `RUNWAY ${RUNWAY.designator} / ENGINE OFF`;
    this.elements = {};
    for (const id of ['welcome', 'preview-banner', 'instruments', 'startup-strip', 'pause-overlay',
      'cockpit-actions', 'exterior-caption', 'elapsed', 'phase-label', 'error-overlay', 'error-message', 'resume-button']) {
      this.elements[id] = document.getElementById(id);
    }
    this.elements['startup-strip'].innerHTML = `<span class="strip-label">起飞准备<small>尚未开放</small></span>${STARTUP_STEPS
      .map(step => `<div class="startup-key" title="${step.english}（${step.label}）[${step.key}]，后续开放"><kbd>${step.key}</kbd><span>${step.label}<small>${step.english}</small></span></div>`).join('')}`;
    container.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action || this.error) return;
      if (action === 'enter') game.enterCockpit();
      if (action === 'pause') game.togglePause();
      if (action === 'exterior') game.returnToExterior();
    });
    container.addEventListener('keydown', event => {
      if (!this.game.paused || this.error || event.code !== 'Tab') return;
      const buttons = this.elements['pause-overlay'].querySelectorAll('button');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    this.render();
  }

  render() {
    const inside = this.game.view === 'COCKPIT';
    this.container.dataset.view = this.game.view;
    this.elements.welcome.hidden = inside;
    this.elements['exterior-caption'].hidden = inside;
    for (const id of ['preview-banner', 'instruments', 'startup-strip', 'cockpit-actions', 'elapsed']) this.elements[id].hidden = !inside;
    this.elements['pause-overlay'].hidden = !this.game.paused;
    for (const child of this.container.children) {
      if (child.id !== 'pause-overlay' && child.id !== 'error-overlay') child.inert = this.game.paused || this.error;
    }
    this.elements['phase-label'].textContent = inside ? '驾驶舱 · 发动机关闭' : '外部视角';
    this.update();
    if (this.game.paused && !this.error) this.elements['resume-button'].focus({ preventScroll: true });
    else if (!this.error) this.container.focus({ preventScroll: true });
  }

  update() {
    const second = Math.floor(this.game.activeSeconds);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    const minutes = Math.floor(second / 60);
    this.elements.elapsed.textContent = `${String(minutes).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}`;
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
