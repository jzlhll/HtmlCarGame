import { STARTUP_STEPS, SYSTEMS } from './config.js';

// 五项准备相互独立，点火和放行分别检查依赖；不在渲染或界面中补齐状态。
export class AircraftSystems {
  constructor(aircraft) {
    this.aircraft = aircraft;
    this.engineElapsed = 0;
  }

  isComplete(step) {
    const state = this.aircraft.systems;
    if (step.kind === 'engine') return state.engine === 'RUNNING';
    if (step.kind === 'release') return !state.parkingBrake;
    if (step.system === 'flaps') return state.flaps === 'TAKEOFF';
    return state[step.system];
  }

  missingPreparation() {
    return STARTUP_STEPS.filter(step => step.kind === 'prepare' && !this.isComplete(step));
  }

  command(key, { stationary = true } = {}) {
    key = key.toUpperCase();
    const step = STARTUP_STEPS.find(item => item.key === key);
    if (!step) return null;
    const state = this.aircraft.systems;
    if (!stationary && (step.kind === 'release' || ['door', 'harness', 'flaps'].includes(step.system))) return {
      type: 'blocked', key, condition: 'moving', reason: '请先收油并停稳；滑跑和飞行中不能操作舱门、安全带或驻车刹车。',
    };
    if (step.kind === 'prepare') {
      const enabled = !this.isComplete(step);
      state[step.system] = step.system === 'flaps' ? enabled ? 'TAKEOFF' : 'CLEAN' : enabled;
      if (step.system === 'flaps') state.flapsPosition = enabled ? 1 : 0;
      if (!enabled && stationary) state.parkingBrake = true;
      return { type: enabled ? 'prepared' : 'unprepared', key };
    }
    if (step.kind === 'engine' && state.engine !== 'OFF') {
      state.engine = 'OFF';
      state.engineProgress = 0;
      if (stationary) state.parkingBrake = true;
      this.engineElapsed = 0;
      return { type: 'engine-stop', key };
    }
    if (step.kind === 'release' && !state.parkingBrake) {
      state.parkingBrake = true;
      return { type: 'brake-set', key };
    }
    const missing = this.missingPreparation().filter(item => this.aircraft.onGround || item.system !== 'flaps');
    if (missing.length) return {
      type: 'blocked', key, reason: `请先完成 ${missing.map(item => `${item.english}（${item.label}）[${item.key}]`).join('、')}`,
      condition: missing.map(item => item.key).join(''),
    };
    if (step.kind === 'engine') {
      state.engine = 'STARTING';
      state.engineProgress = 0;
      this.engineElapsed = 0;
      return { type: 'engine-start', key };
    }
    if (state.engine !== 'RUNNING') return {
      type: 'blocked', key, condition: state.engine,
      reason: state.engine === 'STARTING' ? '发动机正在启动，请等待就绪后重新按 R。' : '请先按 Fire（发动机启动）[F]，等待发动机就绪。',
    };
    if (this.aircraft.throttle !== 0) return {
      type: 'blocked', key, condition: 'throttle', reason: '请先将油门收至零，再按 Release（松驻车刹车）[R]。',
    };
    state.parkingBrake = false;
    return { type: 'released', key };
  }

  step(dt) {
    const state = this.aircraft.systems;
    if (state.engine === 'OFF') return null;
    this.engineElapsed += dt;
    if (state.engine !== 'STARTING') return null;
    state.engineProgress = Math.min(1, this.engineElapsed / SYSTEMS.engineStartSeconds);
    if (this.engineElapsed < SYSTEMS.engineStartSeconds - 1e-9) return null;
    state.engineProgress = 1;
    state.engine = 'RUNNING';
    return { type: 'engine-ready', key: 'F' };
  }
}
