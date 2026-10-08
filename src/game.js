import { AIRCRAFT, CAMERA, FLIGHT } from './config.js';
import { AircraftSystems } from './aircraft-systems.js';
import { Prompts } from './prompts.js';
import { Flight } from './flight.js';

const NO_INPUT = new Set();

// 统一推进有效时间、阶段与事件；飞机系统和飞行响应独立处理。
export class Game {
  constructor() {
    this.onChange = () => {};
    this.onEvent = () => {};
    this.runId = 0;
    this.reset();
  }

  reset() {
    this.runId++;
    this.eventRevision = 0;
    this.startupHintDismissed = false;
    this.result = null;
    this.completionElapsed = 0;
    this.prompts = new Prompts();
    this.phase = 'READY';
    this.view = 'EXTERIOR';
    this.paused = false;
    this.activeSeconds = 0;
    this.introSeconds = 0;
    this.aircraft = {
      position: { ...AIRCRAFT.initialPosition },
      velocity: { x: 0, y: 0, z: 0 },
      airspeed: 0,
      pitch: 0,
      bank: 0,
      heading: 0,
      verticalSpeed: 0,
      throttle: 0,
      enginePower: 0,
      angleOfAttack: 0,
      flightPathAngle: 0,
      loadFactor: 0,
      lift: 0,
      drag: 0,
      thrust: 0,
      wheelBrake: false,
      onGround: true,
      systems: {
        lights: false,
        door: false,
        harness: false,
        avionics: false,
        engine: 'OFF',
        engineProgress: 0,
        flaps: 'CLEAN',
        flapsPosition: 0,
        gear: 'DOWN',
        gearPosition: 1,
        parkingBrake: true,
      },
    };
    this.systems = new AircraftSystems(this.aircraft);
    this.flight = new Flight(this.aircraft);
  }

  enterCockpit() {
    if (this.phase !== 'READY') return;
    this.phase = 'INTRO';
    this.view = 'SEQUENCE';
    this.activeSeconds = 0;
    this.introSeconds = 0;
    this.onChange();
  }

  space() {
    if (this.phase === 'READY') this.enterCockpit();
    else this.togglePause();
  }

  togglePause() {
    if (['READY', 'RESULT'].includes(this.phase)) return;
    this.paused = !this.paused;
    this.onChange();
  }

  pause() {
    if (['READY', 'RESULT'].includes(this.phase) || this.paused) return;
    this.paused = true;
    this.onChange();
  }

  returnToExterior() {
    this.reset();
    this.onChange();
  }

  dismissStartupHint() {
    if (this.phase !== 'STARTUP' || this.paused || this.startupHintDismissed) return;
    this.startupHintDismissed = true;
    this.onChange();
  }

  get active() {
    return !['READY', 'RESULT'].includes(this.phase) && !this.paused;
  }

  command(key) {
    if (!['STARTUP', 'TAKEOFF_ROLL', 'INITIAL_CLIMB'].includes(this.phase) || this.paused) return;
    key = key.toUpperCase();
    const flying = this.phase !== 'STARTUP';
    const stationary = this.aircraft.onGround && this.aircraft.airspeed < FLIGHT.stopSpeed && this.aircraft.throttle === 0;
    let event;
    if (['T', 'S', 'UP', 'DOWN'].includes(key)) event = flying ? this.flight.command(key) : null;
    else if (key === 'G' || (key === 'W' && flying && !stationary)) event = this.flight.command(key);
    else event = this.systems.command(key, { stationary });
    if (!event) return;
    if (event.type === 'released') this.phase = 'TAKEOFF_ROLL';
    else if (stationary && this.aircraft.systems.parkingBrake && this.aircraft.onGround) this.phase = 'STARTUP';
    this.emit(event);
    this.onChange();
  }

  finish(success, reason) {
    if (this.phase === 'RESULT' || this.phase === 'COMPLETE') return;
    this.result = { success, reason, seconds: this.activeSeconds, maxAltitude: this.flight.maxAltitude,
      maxAirspeed: this.flight.maxAirspeed, liftOffSpeed: this.flight.liftOffSpeed };
    this.phase = success ? 'COMPLETE' : 'RESULT';
    this.completionElapsed = 0;
    this.aircraft.wheelBrake = false;
    this.onChange();
  }

  emit(event) {
    if (event.type !== 'blocked') this.eventRevision++;
    event.id = `${this.runId}:${this.eventRevision}:${event.type}:${event.key}:${event.condition || ''}`;
    this.prompts.receive(event);
    this.onEvent(event);
  }

  step(dt, held = NO_INPUT) {
    if (!this.active) return;
    if (this.phase === 'COMPLETE') {
      this.completionElapsed += dt;
      if (this.completionElapsed >= FLIGHT.completionFeedbackSeconds) {
        this.phase = 'RESULT';
        this.onChange();
      }
      return;
    }
    this.activeSeconds += dt;
    this.prompts.step(dt);
    const event = this.systems.step(dt);
    if (event) {
      this.emit(event);
      this.onChange();
    }
    if (['TAKEOFF_ROLL', 'INITIAL_CLIMB'].includes(this.phase)) {
      const events = this.flight.step(dt, held);
      // 接地或越界优先于同一步中的完成条件，结算只执行一次。
      const failed = events.find(item => item.type === 'failed');
      if (failed) { this.emit(failed); this.finish(false, failed.reason); return; }
      for (const item of events) {
        if (item.type === 'liftoff') this.phase = 'INITIAL_CLIMB';
        this.emit(item);
        if (item.type === 'complete') { this.finish(true, '初始爬升已完成'); return; }
        this.onChange();
      }
    }
    if (this.phase === 'INTRO') {
      this.introSeconds = Math.min(CAMERA.introSeconds, this.introSeconds + dt);
      if (this.introSeconds >= CAMERA.introSeconds - 1e-9) {
        this.introSeconds = CAMERA.introSeconds;
        this.phase = 'STARTUP';
        this.view = 'COCKPIT';
        this.onChange();
      }
    }
  }
}
