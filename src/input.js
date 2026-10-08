import { CONTROLS } from './config.js';

export class Input {
  constructor(container) {
    this.held = new Set();
    this.onCommand = () => {};
    this.onActivity = () => {};
    this.onBlur = () => {};
    window.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey && !/^Key[A-Z]$/.test(event.code)) return;
      if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      const control = CONTROLS[event.code];
      if (!event.repeat && (control || /^Key[A-Z]$/.test(event.code))) this.onActivity();
      if (!control) return;
      event.preventDefault();
      if (control.held) this.held.add(control.action);
      if ((!control.held || control.press) && !event.repeat) this.onCommand(control.action);
    });
    window.addEventListener('keyup', event => {
      const control = CONTROLS[event.code];
      if (control?.held) this.held.delete(control.action);
    });
    window.addEventListener('blur', () => {
      this.clear();
      this.onBlur();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clear();
        this.onBlur();
      }
    });
    container.addEventListener('pointerdown', event => {
      if (!event.target.closest('button, a, input, textarea, select')) container.focus({ preventScroll: true });
    });
  }

  clear() {
    this.held.clear();
  }
}
