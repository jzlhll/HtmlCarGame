export class FlightInput {
  constructor(joystick) {
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.pointer = null;
    this.joystick = joystick;
    this.thumb = joystick.querySelector('.joystick-thumb');
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    window.addEventListener('keydown', event => {
      if (!arrows.includes(event.code)) return;
      if (/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      event.preventDefault();
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    joystick.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || this.pointer !== null) return;
      event.preventDefault();
      this.pointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      this.updateStick(event);
    });
    joystick.addEventListener('pointermove', event => {
      if (event.pointerId === this.pointer) this.updateStick(event);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      joystick.addEventListener(name, event => {
        if (event.pointerId === this.pointer) this.clear();
      });
    }
  }

  updateStick(event) {
    const rect = this.joystick.getBoundingClientRect();
    const radius = rect.width * 0.32;
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (rect.top + rect.height / 2 - event.clientY) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    this.stick.x = Math.abs(x) < 0.1 ? 0 : x;
    this.stick.y = Math.abs(y) < 0.1 ? 0 : y;
    this.thumb.style.transform = `translate(${x * radius}px, ${-y * radius}px)`;
  }

  read() {
    let x = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft')) + this.stick.x;
    let y = Number(this.keys.has('ArrowUp')) - Number(this.keys.has('ArrowDown')) + this.stick.y;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y };
  }

  clear() {
    this.keys.clear();
    this.pointer = null;
    this.stick.x = this.stick.y = 0;
    this.thumb.style.transform = '';
  }
}
