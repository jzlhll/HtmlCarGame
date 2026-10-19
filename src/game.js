import { Weather } from './weather.js';
import { freshRunSeed } from './world-variation.js';
import { AIRCRAFT, CAMERA, DESTRUCTION, FLIGHT, FLIGHT_PHASES, LANDING_DEBUG, worldHorizontalSpeed, createRoute } from './config.js';
import { AircraftSystems } from './aircraft-systems.js';
import { Prompts } from './prompts.js';
import { Flight } from './flight.js';
import { RouteWorld } from './route-world.js';
import { Mission } from './mission.js';

const NO_INPUT = new Set();

// 统一推进有效时间、阶段与事件；飞机系统和飞行响应独立处理。
export class Game {
  constructor(levelId = 1,{deferWorld=false}={}) {
    this.onChange = () => {};
    this.onEvent = () => {};
    this.route = createRoute(levelId);
    this.world = new RouteWorld(this.route,{defer:deferWorld});
    this.runId = 0;
    this.reset();
  }

  reset() {
    this.runId++;
    this.world.setRunSeed(freshRunSeed());
    this.eventRevision = 0;
    this.startupHintDismissed = false;
    this.landingDebug = false;
    this.result = null;
    this.destruction = null;
    this.glassFailure = false;
    this.birdImpactAt = -Infinity;
    this.glassImpactAt = -Infinity;
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
      landed: false,
      lightningStrike: false, lightningHitAt: -Infinity,
      birdStrike: false,
      birdStrikeCount: 0,
      glassDamage: 0,
      systems: {
        lights: false,
        door: false, // true 表示舱门已关闭并锁定，false 表示打开。
        harness: false,
        avionics: false,
        engine: 'OFF',
        engineProgress: 0,
        flaps: 'CLEAN', // 沿用内部状态名，默认关闭机翼减速板。
        flapsPosition: 0,
        gear: 'DOWN',
        gearPosition: 1,
        parkingBrake: true,
      },
    };
    this.systems = new AircraftSystems(this.aircraft);
    this.flight = new Flight(this.aircraft, this.world);
    this.weather = new Weather(this.aircraft, this.world);
    this.mission = new Mission(this.aircraft, this.flight, this.world);
  }

  get introDuration() { return this.landingDebug ? LANDING_DEBUG.countdownSeconds : CAMERA.introSeconds; }

  enterCockpit({landingDebug = false} = {}) {
    if (this.phase !== 'READY') return;
    this.landingDebug = landingDebug;
    if (landingDebug) this.prepareLandingDebug();
    this.phase = 'INTRO';
    this.view = landingDebug ? 'COCKPIT' : 'SEQUENCE';
    this.activeSeconds = 0;
    this.introSeconds = 0;
    this.onChange();
  }

  prepareLandingDebug() {
    const a = this.aircraft, setup = LANDING_DEBUG, destination = this.route.destination;
    // 按关闭W、不操作时的自然降速计算约30秒航程，侧偏避开中央地标。
    const seconds = Math.min(setup.runwaySeconds, setup.speed / FLIGHT.speedDecayRate);
    const distance = worldHorizontalSpeed((setup.speed * seconds - FLIGHT.speedDecayRate * seconds * seconds / 2) / FLIGHT.kmhPerMps);
    const forward = Math.sqrt(distance * distance - setup.lateralOffset * setup.lateralOffset);
    a.position.x = destination.x + setup.lateralOffset;
    a.position.z = destination.threshold + forward;
    a.position.y = Math.max(destination.elevation, this.world.heightAt(a.position.x, a.position.z)) + setup.runwayHeight;
    a.heading = Math.atan2(-setup.lateralOffset, forward);
    a.airspeed = setup.speed; a.onGround = false; a.enginePower = 1;
    a.velocity.x = Math.sin(a.heading) * setup.speed / FLIGHT.kmhPerMps;
    a.velocity.z = -Math.cos(a.heading) * setup.speed / FLIGHT.kmhPerMps;
    Object.assign(a.systems, {lights: true, door: true, harness: true, avionics: true, engine: 'RUNNING', engineProgress: 1,
      gear: 'UP', gearPosition: 0, flaps: 'CLEAN', flapsPosition: 0, parkingBrake: false});
    Object.assign(this.flight.previous.position, a.position);
    this.flight.previous.heading = a.heading;
    this.flight.climbComplete = true; this.flight.rotateAnnounced = true;
    this.flight.maxAltitude = this.flight.altitude(); this.flight.maxAirspeed = a.airspeed;
    this.mission.path = [[a.position.x, a.position.z]];
    this.mission.approaching = true;
    this.startupHintDismissed = true;
  }

  space() {
    if (this.phase === 'READY') this.enterCockpit();
    else this.togglePause();
  }

  togglePause() {
    if (['READY', 'RESULT'].includes(this.phase)) return;
    this.paused = !this.paused;
    if (this.paused) this.flight.speedTapRemaining = 0;
    this.onChange();
  }

  pause() {
    if (['READY', 'RESULT'].includes(this.phase) || this.paused) return;
    this.paused = true;
    this.flight.speedTapRemaining = 0;
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

  command(key, {repeat = false} = {}) {
    if (!['STARTUP', ...FLIGHT_PHASES].includes(this.phase) || this.paused) return;
    key = key.toUpperCase();
    const flying = this.phase !== 'STARTUP';
    const stationary = this.aircraft.onGround && this.aircraft.airspeed < FLIGHT.stopSpeed;
    let event;
    if (['T', 'S', 'UP', 'DOWN'].includes(key)) event = flying ? this.flight.command(key, {repeat}) : null;
    else if (key === 'G' || (key === 'W' && flying && (!stationary || this.aircraft.landed))) event = this.flight.command(key);
    else event = this.systems.command(key, { stationary });
    if (key === 'W' && ['flaps-up', 'flaps-down', 'prepared', 'unprepared'].includes(event?.type)) { this.flight.speedTapRemaining = 0; this.flight.speedTapDirection = 0; }
    if (!event) return;
    if (key === 'W') this.flight.updateSpeedLimits();
    if (event.type === 'released') { this.phase = this.aircraft.landed ? 'TAXI' : 'TAKEOFF_ROLL'; this.mission.start(); }
    else if (!this.aircraft.landed && stationary && this.aircraft.systems.parkingBrake && this.aircraft.onGround) this.phase = 'STARTUP';
    this.emit(event);
    this.onChange();
  }

  finish(success, reason, destructive = false, glassFailure = false) {
    if (['CRASH', 'RESULT', 'COMPLETE'].includes(this.phase)) return;
    this.result = { success, reason, seconds: this.mission.elapsed, maxAltitude: this.flight.maxAltitude,
      maxAirspeed: this.flight.maxAirspeed, liftOffSpeed: this.flight.liftOffSpeed };
    this.glassFailure=glassFailure;
    this.phase = success ? 'COMPLETE' : destructive||glassFailure ? 'CRASH' : 'RESULT';
    this.completionElapsed = 0;
    this.aircraft.wheelBrake = false;
    this.flight.speedTapRemaining = 0;
    if(glassFailure){this.glassImpactAt=this.activeSeconds;this.emit({type:'glass-break',key:'glass'});}
    if (this.phase === 'CRASH'&&!glassFailure) {
      this.destruction = {position: {...this.aircraft.position}, heading: this.aircraft.heading};
      this.view = 'EXTERIOR';
      this.aircraft.systems.engine = 'OFF'; this.aircraft.enginePower = 0;
      this.emit({type: 'destroyed', key: 'impact'});
    }
    this.onChange();
  }

  emit(event) {
    if (event.type !== 'blocked') this.eventRevision++;
    event.id = `${this.runId}:${this.eventRevision}:${event.type}:${event.key}:${event.condition || ''}`;
    if (event.condition==='bird-thrust-lock') event.id=`${this.runId}:bird-thrust-lock`;
    if (event.type === 'bird-strike') this.birdImpactAt = this.activeSeconds;
    if (event.type === 'bird-strike'||event.type === 'tree-strike') this.glassImpactAt = this.activeSeconds;
    this.prompts.receive(event);
    this.onEvent(event);
  }

  step(dt, held = NO_INPUT) {
    if (!this.active) return;
    if (this.phase === 'COMPLETE' || this.phase === 'CRASH') {
      this.completionElapsed += dt;
      const seconds = this.phase === 'CRASH' ? (this.glassFailure?DESTRUCTION.glass.failureSeconds:DESTRUCTION.seconds) : FLIGHT.completionFeedbackSeconds;
      if (this.completionElapsed >= seconds - 1e-9) {
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
    if (FLIGHT_PHASES.includes(this.phase)) {
      for(const event of this.weather.step(dt)){
        if(event.type==='lightning-hit'){this.aircraft.lightningHitAt=this.activeSeconds;this.flight.speedTapRemaining=0;this.aircraft.throttle=0;this.aircraft.thrust=0;}
        this.emit(event);
      }
      const events = this.flight.step(dt, held);
      // 接地或越界优先于同一步中的完成条件，结算只执行一次。
      const failed = events.find(item => item.type === 'failed');
      if (failed) { this.emit(failed); this.finish(false, failed.reason, failed.destructive, failed.key==='glass'); return; }
      for (const item of events) {
        // 同一步已安全接地时，不再播报触地前产生的失速或下降警告。
        if (this.aircraft.landed && ['stall', 'stall-recovered', 'pitch-low'].includes(item.type)) continue;
        if (item.type === 'liftoff') this.phase = 'INITIAL_CLIMB';
        this.emit(item);
        if (item.type === 'climb-complete' && !this.mission.approaching) this.phase = 'CRUISE';
        if (item.type === 'landed') this.phase = 'LANDING_ROLL';
        this.onChange();
      }
    }
    if (this.mission.started) {
      this.mission.weatherRadarAvailable=this.weather.radarAvailable;
      const missionEvents = this.mission.step(dt);
      const failed = missionEvents.find(item => item.type === 'failed');
      if (failed) { this.emit(failed); this.finish(false, failed.reason, failed.destructive, failed.key==='glass'); return; }
      for (const item of missionEvents) {
        if (item.type === 'approach') this.phase = 'APPROACH';
        this.emit(item);
        if (item.type === 'complete') { this.finish(true, item.reason); return; }
        this.onChange();
      }
      if (this.phase === 'LANDING_ROLL' && this.aircraft.airspeed < this.route.taxiSpeed) { this.phase = 'TAXI'; this.onChange(); }
    }
    if (this.phase === 'INTRO') {
      this.introSeconds = Math.min(this.introDuration, this.introSeconds + dt);
      if (this.introSeconds >= this.introDuration - 1e-9) {
        this.introSeconds = this.introDuration;
        this.phase = this.landingDebug ? 'APPROACH' : 'STARTUP';
        this.view = 'COCKPIT';
        if (this.landingDebug) this.mission.start();
        this.onChange();
      }
    }
  }
}
