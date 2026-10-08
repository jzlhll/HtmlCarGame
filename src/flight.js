import { AIRCRAFT, FLIGHT, RUNWAY, AERODYNAMICS } from './config.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);

// 固定质量的三维受力积分；俯仰／滚转为限速操纵，不模拟完整刚体力矩。
export class Flight {
  constructor(aircraft) {
    this.aircraft = aircraft;
    this.previous = { position: { ...aircraft.position }, pitch: 0, bank: 0, heading: 0 };
    this.pitchTarget = 0;
    this.events = [];
    this.rotateAnnounced = false;
    this.lowSpeed = false;
    this.lowSpeedRecovery = 0;
    this.pitchHigh = false;
    this.stalled = false;
    this.stallEntry = 0;
    this.stallRecovery = 0;
    this.pitchRecovery = 0;
    this.pitchLow = false;
    this.pitchLowRecovery = 0;
    this.overspeed = false;
    this.completionSeconds = 0;
    this.maxAltitude = 0;
    this.maxAirspeed = 0;
    this.liftOffSpeed = 0;
  }

  altitude() {
    return this.aircraft.onGround ? 0 : Math.max(0, this.lowestPoint());
  }

  lowestPoint() {
    const a = this.aircraft, gearY = (1 - a.systems.gearPosition) * AIRCRAFT.gearRetractHeight;
    const cosine = Math.cos(a.pitch), sine = Math.sin(a.pitch);
    const height = (x, y, z) => a.position.y + (y * Math.cos(a.bank) - x * Math.sin(a.bank)) * cosine - z * sine;
    let lowest = Math.min(height(-AIRCRAFT.mainWheelX, gearY, AIRCRAFT.mainWheelZ),
      height(AIRCRAFT.mainWheelX, gearY, AIRCRAFT.mainWheelZ), height(0, gearY, AIRCRAFT.noseWheelZ));
    for (const point of AIRCRAFT.bodyContactPoints) lowest = Math.min(lowest, height(...point));
    return lowest;
  }

  canRetractGear() {
    return !this.aircraft.onGround && this.altitude() >= FLIGHT.gearHeight && this.aircraft.verticalSpeed > 0;
  }

  canRetractFlaps() {
    return !this.aircraft.onGround && this.altitude() >= FLIGHT.flapsHeight && this.aircraft.airspeed >= FLIGHT.climbMinSpeed;
  }

  command(key) {
    const a = this.aircraft, state = a.systems;
    if (key === 'T' || key === 'S') {
      a.throttle = clamp(a.throttle + (key === 'T' ? 1 : -1) * FLIGHT.throttleTap, 0, 1);
      return { type: 'throttle', key };
    }
    if (key === 'UP' || key === 'DOWN') {
      if (a.onGround && a.airspeed < FLIGHT.rotationSpeed) return null;
      this.pitchTarget = clamp(this.pitchTarget + (key === 'UP' ? 1 : -1) * FLIGHT.pitchTap,
        a.onGround ? 0 : FLIGHT.minPitch, a.onGround ? FLIGHT.groundMaxPitch : FLIGHT.maxPitch);
      return { type: 'pitch', key };
    }
    if (key !== 'G' && key !== 'W') return null;
    const gear = key === 'G';
    if (gear ? state.gear !== 'DOWN' : state.flaps !== 'TAKEOFF') return null;
    if (!(gear ? this.canRetractGear() : this.canRetractFlaps())) return {
      type: 'blocked', key, condition: gear ? 'gear-height' : 'flaps-height-speed',
      reason: gear ? `Gear（起落架）[G]：离地至少 ${FLIGHT.gearHeight} 米且正在爬升时才能收起。` : `Wing flaps（襟翼）[W]：离地至少 ${FLIGHT.flapsHeight} 米且空速达到 ${Math.round(FLIGHT.climbMinSpeed * FLIGHT.knotsPerMps)} kt 后才能收起。`,
    };
    state[gear ? 'gear' : 'flaps'] = 'RETRACTING';
    return { type: gear ? 'gear-start' : 'flaps-start', key };
  }

  step(dt, held) {
    const a = this.aircraft, state = a.systems;
    this.events.length = 0;
    Object.assign(this.previous.position, a.position);
    this.previous.pitch = a.pitch; this.previous.bank = a.bank; this.previous.heading = a.heading;
    const slow = held.has('S'), advancing = held.has('T') && !slow;
    if (slow || advancing) a.throttle = clamp(a.throttle + (slow ? -1 : 1) * FLIGHT.throttleRate * dt, 0, 1);
    a.wheelBrake = a.onGround && slow && a.throttle === 0;
    const pitchInput = Number(held.has('up')) - Number(held.has('down'));
    const turnInput = Number(held.has('right')) - Number(held.has('left'));
    if (a.onGround && a.airspeed < FLIGHT.rotationSpeed) this.pitchTarget = 0;
    else this.pitchTarget = clamp(this.pitchTarget + pitchInput * FLIGHT.pitchRate * dt,
      a.onGround ? 0 : FLIGHT.minPitch, a.onGround ? FLIGHT.groundMaxPitch : FLIGHT.maxPitch);
    const aero = AERODYNAMICS;
    const effectiveness = a.onGround ? 1 : clamp((a.airspeed / aero.controlReferenceSpeed) ** 2, aero.minimumControl, 1) * (this.stalled ? aero.stallControl : 1);
    a.pitch = approach(a.pitch, this.pitchTarget, FLIGHT.pitchRate * effectiveness * dt);
    if (a.onGround) a.bank = 0;
    else a.bank = approach(a.bank, a.bank + (turnInput * FLIGHT.maxBank - a.bank) * (1 - Math.exp(-FLIGHT.bankResponse * dt)), aero.maxRollRate * effectiveness * dt);
    const targetPower = state.engine === 'RUNNING' ? a.throttle : 0;
    a.enginePower += (targetPower - a.enginePower) * (1 - Math.exp(-dt / aero.engineResponseSeconds));
    if (a.enginePower < 1e-6) a.enginePower = 0;
    const horizontal = a.onGround ? a.airspeed : Math.hypot(a.velocity.x, a.velocity.z);
    const speed = a.onGround ? a.airspeed : Math.hypot(horizontal, a.velocity.y);
    const gamma = a.onGround ? 0 : Math.atan2(a.velocity.y, horizontal);
    const alpha = a.pitch - gamma;
    const density = aero.seaLevelDensity * Math.exp(-Math.max(0, a.position.y) / aero.densityScaleHeight);
    const qArea = 0.5 * density * speed ** 2 * aero.wingArea;
    const critical = aero.criticalAlpha + state.flapsPosition * aero.flapsCriticalBonus;
    let cl = aero.liftAtZero + aero.liftSlope * alpha + state.flapsPosition * aero.flapsLift;
    const excess = Math.max(0, Math.abs(alpha) - critical);
    if (excess > 0) {
      const peak = aero.liftAtZero + aero.liftSlope * Math.sign(alpha) * critical + state.flapsPosition * aero.flapsLift;
      cl = peak * (aero.postStallLiftFraction + (1 - aero.postStallLiftFraction) * Math.exp(-excess / aero.postStallDecay));
    }
    const separated = 1 - Math.exp(-excess / aero.postStallDecay);
    const cd = aero.parasiteDrag + aero.inducedDrag * cl ** 2 + state.flapsPosition * aero.flapsDrag + state.gearPosition * aero.gearDrag + aero.stallDrag * separated;
    const lift = qArea * cl, drag = qArea * cd;
    const thrust = aero.maxThrust * a.enginePower * density / aero.seaLevelDensity / (1 + speed / aero.thrustSpeedScale);
    a.angleOfAttack = alpha; a.flightPathAngle = gamma;
    a.lift = lift; a.drag = drag; a.thrust = thrust; a.loadFactor = lift / (aero.mass * FLIGHT.gravity);
    if (a.onGround) {
      const normal = Math.max(0, aero.mass * FLIGHT.gravity - lift - thrust * Math.sin(a.pitch));
      const braking = (a.wheelBrake || state.parkingBrake) ? aero.brakeFriction * normal : 0;
      const acceleration = (thrust * Math.cos(a.pitch) - drag - aero.rollingFriction * normal - braking) / aero.mass;
      a.airspeed = Math.max(0, speed + acceleration * dt);
      const steering = FLIGHT.groundTurnRate * a.airspeed / (a.airspeed + FLIGHT.groundTurnSpeed) / (1 + a.airspeed / FLIGHT.groundTurnSpeed);
      const gripTurn = aero.tireFriction * normal / aero.mass / Math.max(1, a.airspeed);
      a.heading += turnInput * Math.min(steering, gripTurn) * dt;
      a.position.y = Math.sin(a.pitch) * AIRCRAFT.mainWheelZ;
      a.verticalSpeed = (a.position.y - this.previous.position.y) / dt;
      a.velocity.x = Math.sin(a.heading) * a.airspeed;
      a.velocity.z = -Math.cos(a.heading) * a.airspeed;
      a.velocity.y = a.verticalSpeed;
      if (!this.rotateAnnounced && a.airspeed >= FLIGHT.rotationSpeed) {
        this.rotateAnnounced = true; this.events.push({ type: 'rotation-ready', key: 'UP' });
      }
      if (a.airspeed >= FLIGHT.rotationSpeed && state.flapsPosition >= FLIGHT.liftOffFlapsPosition && normal === 0) {
        a.onGround = false; this.liftOffSpeed = a.airspeed;
        this.events.push({ type: 'liftoff', key: 'UP' });
      }
    } else {
      // 升力垂直于气流，滚转将部分升力转向水平面；阻力始终与速度相反。
      const safeSpeed = Math.max(speed, 1e-6);
      const ux = a.velocity.x / safeSpeed, uy = a.velocity.y / safeSpeed, uz = a.velocity.z / safeSpeed;
      const rightX = horizontal > 1e-6 ? -a.velocity.z / horizontal : Math.cos(a.heading);
      const rightZ = horizontal > 1e-6 ? a.velocity.x / horizontal : Math.sin(a.heading);
      const normalX = -rightZ * uy, normalY = rightZ * ux - rightX * uz, normalZ = rightX * uy;
      const cosine = Math.cos(a.bank), sine = Math.sin(a.bank);
      const forwardX = Math.sin(a.heading) * Math.cos(a.pitch), forwardZ = -Math.cos(a.heading) * Math.cos(a.pitch);
      a.velocity.x += (thrust * forwardX - drag * ux + lift * (normalX * cosine + rightX * sine)) / aero.mass * dt;
      a.velocity.y += ((thrust * Math.sin(a.pitch) - drag * uy + lift * normalY * cosine) / aero.mass - FLIGHT.gravity) * dt;
      a.velocity.z += (thrust * forwardZ - drag * uz + lift * (normalZ * cosine + rightZ * sine)) / aero.mass * dt;
      a.airspeed = Math.hypot(a.velocity.x, a.velocity.y, a.velocity.z);
      a.verticalSpeed = a.velocity.y;
      const heading = Math.atan2(a.velocity.x, -a.velocity.z);
      a.heading += Math.atan2(Math.sin(heading - a.heading), Math.cos(heading - a.heading));
      a.position.y += a.velocity.y * dt;
    }
    a.position.x += a.velocity.x * dt; a.position.z += a.velocity.z * dt;
    if (!a.onGround) {
      a.flightPathAngle = Math.atan2(a.velocity.y, Math.hypot(a.velocity.x, a.velocity.z));
      a.angleOfAttack = a.pitch - a.flightPathAngle;
      this.stallEntry = Math.abs(a.angleOfAttack) > critical ? this.stallEntry + dt : 0;
      this.stallRecovery = Math.abs(a.angleOfAttack) < critical - aero.stallRecoveryMargin ? this.stallRecovery + dt : 0;
      if (!this.stalled && this.stallEntry >= aero.stallEntrySeconds) {
        this.stalled = true;
        this.events.push({ type: 'stall', key: 'alpha', reason: a.angleOfAttack < 0 ? 'Stall（失速）：平缓抬高机头（↑），减小负迎角，保持机翼平稳。' : 'Stall（失速）：立即降低机头（↓），增加油门，保持机翼平稳。' });
      } else if (this.stalled && this.stallRecovery >= aero.stallRecoverySeconds) {
        this.stalled = false; this.events.push({ type: 'stall-recovered', key: 'alpha' });
      }
    }
    const highPitch = a.pitch > aero.pitchWarning;
    this.pitchRecovery = a.pitch < aero.pitchWarningClear ? this.pitchRecovery + dt : 0;
    if (!this.pitchHigh && highPitch) {
      this.pitchHigh = true;
      this.events.push({ type: 'pitch-high', key: 'pitch', reason: '您的仰角过大，需要降低机头（按 ↓）。' });
    } else if (this.pitchHigh && this.pitchRecovery >= aero.warningRecoverySeconds) this.pitchHigh = false;
    const safeAlpha = Math.abs(a.angleOfAttack) < critical - aero.alphaWarningMargin;
    const descentRisk = !a.onGround && safeAlpha && !this.stalled && (a.pitch < aero.pitchLowWarning || (this.altitude() < aero.groundWarningHeight && a.flightPathAngle < aero.descentWarningAngle));
    this.pitchLowRecovery = a.pitch > aero.pitchLowClear && a.flightPathAngle > aero.descentWarningAngle ? this.pitchLowRecovery + dt : 0;
    if (!this.pitchLow && descentRisk) {
      this.pitchLow = true;
      this.events.push({ type: 'pitch-low', key: 'pitch', reason: a.pitch < aero.pitchLowWarning ? '您的俯角过大，需要适当抬高机头（按 ↑）。' : '下降过快且接近地面，请平缓抬高机头（↑）。' });
    } else if (this.pitchLow && this.pitchLowRecovery >= aero.warningRecoverySeconds) this.pitchLow = false;
    if (!a.onGround && !this.overspeed && a.airspeed > aero.overspeedWarning) {
      this.overspeed = true;
      this.events.push({ type: 'overspeed', key: 'airspeed', reason: '空速过高：S 收油减速，平缓改出俯冲，避免猛拉机头。' });
    } else if (this.overspeed && a.airspeed < aero.overspeedClear) this.overspeed = false;
    for (const [system, seconds, key] of [['gear', FLIGHT.gearSeconds, 'G'], ['flaps', FLIGHT.flapsSeconds, 'W']]) {
      if (state[system] !== 'RETRACTING') continue;
      const field = `${system}Position`;
      state[field] = Math.max(0, state[field] - dt / seconds);
      if (state[field] <= 1e-9) {
        state[field] = 0; state[system] = system === 'gear' ? 'UP' : 'CLEAN';
        this.events.push({ type: `${system}-up`, key });
      }
    }
    this.maxAirspeed = Math.max(this.maxAirspeed, a.airspeed);
    this.maxAltitude = Math.max(this.maxAltitude, this.altitude());
    if (a.onGround) {
      for (const [x, z] of [[-AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ], [AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ], [0, AIRCRAFT.noseWheelZ]]) {
        const wheelX = a.position.x + Math.cos(a.heading) * x - Math.sin(a.heading) * z;
        const wheelZ = a.position.z + Math.sin(a.heading) * x + Math.cos(a.heading) * z;
        if (Math.abs(wheelX) > RUNWAY.width / 2) {
          this.events.push({ type: 'failed', key: 'runway', reason: '轮子驶出了跑道边界' }); break;
        }
        if (wheelZ < RUNWAY.startOffset - RUNWAY.length || wheelZ > RUNWAY.startOffset) {
          this.events.push({ type: 'failed', key: 'runway', reason: '已冲出跑道末端' }); break;
        }
      }
    } else if (this.lowestPoint() < -FLIGHT.contactTolerance) this.events.push({ type: 'failed', key: 'ground', reason: this.stalled ? '持续失速导致下坠，飞机撞到了地面' : '离地后飞机撞到了地面' });
    const low = !a.onGround && a.airspeed < FLIGHT.warningSpeed;
    if (low && !this.lowSpeed) this.events.push({ type: 'low-speed', key: 'airspeed', reason: 'Airspeed low（空速偏低）：增加油门，适当降低机头恢复速度。' });
    if (low) this.lowSpeed = true;
    this.lowSpeedRecovery = a.airspeed > FLIGHT.warningSpeedClear ? this.lowSpeedRecovery + dt : 0;
    if (this.lowSpeedRecovery >= AERODYNAMICS.warningRecoverySeconds) this.lowSpeed = false;
    const success = !a.onGround && !this.stalled && !this.pitchHigh && !this.pitchLow && this.altitude() >= FLIGHT.completionHeight && a.airspeed >= FLIGHT.climbMinSpeed && a.airspeed <= FLIGHT.climbMaxSpeed && a.verticalSpeed > 0 && Math.abs(a.bank) <= FLIGHT.successBank && state.gear === 'UP' && state.flaps === 'CLEAN';
    this.completionSeconds = success ? this.completionSeconds + dt : 0;
    if (this.completionSeconds >= FLIGHT.completionHoldSeconds) this.events.push({ type: 'complete', key: 'flight' });
    return this.events;
  }
}
