import { AIRCRAFT } from './config.js';

// 第一阶段只管理场景预览；飞机状态为后续启动与飞行提供统一数据入口。
export class Game {
  constructor() {
    this.onChange = () => {};
    this.reset();
  }

  reset() {
    this.phase = 'READY';
    this.view = 'EXTERIOR';
    this.paused = false;
    this.activeSeconds = 0;
    this.aircraft = {
      position: { ...AIRCRAFT.initialPosition },
      velocity: { x: 0, y: 0, z: 0 },
      airspeed: 0,
      pitch: 0,
      bank: 0,
      heading: 0,
      verticalSpeed: 0,
      throttle: 0,
      onGround: true,
      systems: {
        lights: false,
        door: false,
        harness: false,
        avionics: false,
        engine: 'OFF',
        flaps: 'CLEAN',
        gear: 'DOWN',
        parkingBrake: true,
      },
    };
  }

  enterCockpit() {
    if (this.phase !== 'READY') return;
    this.phase = 'PREVIEW';
    this.view = 'COCKPIT';
    this.activeSeconds = 0;
    this.onChange();
  }

  space() {
    if (this.phase === 'READY') this.enterCockpit();
    else this.togglePause();
  }

  togglePause() {
    if (this.phase !== 'PREVIEW') return;
    this.paused = !this.paused;
    this.onChange();
  }

  pause() {
    if (this.phase !== 'PREVIEW' || this.paused) return;
    this.paused = true;
    this.onChange();
  }

  returnToExterior() {
    this.reset();
    this.onChange();
  }

  step(dt) {
    if (this.phase === 'PREVIEW' && !this.paused) this.activeSeconds += dt;
  }
}
