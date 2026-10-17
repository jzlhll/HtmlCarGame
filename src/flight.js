import { AIRCRAFT, FLIGHT, RUNWAY, AERODYNAMICS, worldHorizontalSpeed } from './config.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);

// 固定质量的三维受力积分；俯仰／滚转为限速操纵，不模拟完整刚体力矩。
export class Flight {
  constructor(aircraft, world) {
    this.world = world;
    this.route = world.route;
    this.climbComplete = false;
    this.aircraft = aircraft;
    this.previous = { position: { ...aircraft.position }, pitch: 0, bank: 0, heading: 0 };
    this.pitchTarget = 0;
    this.speedTapRemaining = 0; this.speedTapDirection = 0;
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
    this.gearWarningAnnounced = false;
    this.gearExtensionBlocked = false;
    this.landingAlignment = null;
    this.landingState = {};
    this.updateSpeedLimits();
  }

  altitude() {
    return this.aircraft.onGround ? 0 : Math.max(0, this.lowestPoint() - this.world.heightAt(this.aircraft.position.x, this.aircraft.position.z));
  }

  lowestPoint() {
    const a = this.aircraft, gearY = (1 - a.systems.gearPosition) * AIRCRAFT.gearRetractHeight;
    const cosine = Math.cos(a.pitch), sine = Math.sin(a.pitch), bankCosine = Math.cos(a.bank), bankSine = Math.sin(a.bank);
    const height = (x, y, z) => a.position.y + (y * bankCosine - x * bankSine) * cosine - z * sine;
    let lowest = Math.min(height(-AIRCRAFT.mainWheelX, gearY, AIRCRAFT.mainWheelZ),
      height(AIRCRAFT.mainWheelX, gearY, AIRCRAFT.mainWheelZ), height(0, gearY, AIRCRAFT.noseWheelZ));
    for (const point of AIRCRAFT.bodyContactPoints) lowest = Math.min(lowest, height(...point));
    return lowest;
  }

  canRetractGear() {
    return !this.aircraft.onGround && this.altitude() >= FLIGHT.gearHeight && this.aircraft.verticalSpeed > 0;
  }

  speedRate(direction) {
    const position = this.aircraft.systems.flapsPosition;
    const multiplier = 1 + (FLIGHT.speedModeRatio - 1) * position;
    return direction > 0 ? FLIGHT.speedRate / multiplier : FLIGHT.speedBrakeRate * multiplier / FLIGHT.speedModeRatio;
  }

  // 当前密度、减速板与坡度下维持平飞的参考边界；失速本身仍由迎角确认。
  updateSpeedLimits(density = AERODYNAMICS.seaLevelDensity * Math.exp(-Math.max(0, this.aircraft.position.y) / AERODYNAMICS.densityScaleHeight)) {
    const a = this.aircraft, aero = AERODYNAMICS;
    const peak = (aero.liftAtZero + aero.liftSlope * aero.criticalAlpha) * (1 - a.systems.flapsPosition * aero.wingBrakeLiftLoss);
    this.stallSpeed = Math.sqrt(2 * aero.mass * FLIGHT.gravity / (density * aero.wingArea * peak * Math.max(0.25, Math.cos(a.bank)))) * FLIGHT.kmhPerMps;
    this.safeSpeed = this.stallSpeed * aero.safeSpeedFactor;
  }

  // 接地判定与右侧指引共用同一状态，角度安全不代表其他条件已经满足。
  landingStatus() {
    const a=this.aircraft, route=this.route, destination=route.destination, state=this.landingState;
    state.heading=Math.atan2(Math.sin(a.heading),Math.cos(a.heading));
    state.pitch=a.pitch>=route.landingMinPitch && a.pitch<=route.landingMaxPitch;
    state.bank=Math.abs(a.bank)<=route.landingMaxBank;
    state.aligned=Math.abs(state.heading)<=route.landingMaxHeading+1e-9;
    state.attitude=state.pitch && state.bank && state.aligned;
    state.runway=Math.abs(a.position.x-destination.x)+AIRCRAFT.wingspan/2<=destination.width/2 && a.position.z<=destination.threshold && a.position.z>=destination.threshold-destination.length;
    state.gear=a.systems.gearPosition>=0.99; state.flaps=a.systems.flapsPosition>=0.99;
    state.speed=a.airspeed<=route.landingMaxSpeed; state.sink=a.verticalSpeed>=-route.landingMaxSink;
    state.stable=!this.stalled;
    state.ready=state.runway && state.attitude && state.gear && state.flaps && state.speed && state.sink && state.stable;
    const factor=route.landingDangerFactor;
    const severe=!state.stable || a.pitch<route.landingMinPitch*factor || a.pitch>route.landingMaxPitch*factor || Math.abs(a.bank)>route.landingMaxBank*factor || Math.abs(state.heading)>route.landingMaxHeading*factor || a.airspeed>route.landingMaxSpeed*factor || a.verticalSpeed < -route.landingMaxSink*factor;
    state.severity=a.landed || state.ready ? 'safe' : severe || this.altitude()<=route.landingDangerHeight ? 'danger' : 'caution';
    return state;
  }

  settleLanding(dt) {
    const alignment=this.landingAlignment;
    if (!alignment) return false;
    const a=this.aircraft, route=this.route, blend=1-Math.exp(-route.landingSettleResponse*dt), rate=route.landingSettleRate*dt;
    alignment.elapsed+=dt;
    for (const [key,target] of [['pitch',0],['bank',0],['heading',alignment.heading]]) a[key]=approach(a[key],a[key]+(target-a[key])*blend,rate);
    if (alignment.elapsed>=route.landingSettleSeconds-1e-9) {
      a.pitch=0; a.bank=0; a.heading=alignment.heading;
      this.landingAlignment=null;
    }
    return true;
  }

  get thrustLocked() { return this.aircraft.birdStrikeCount >= this.route.birdThrustLockHits; }

  get stallGuidance() {
    const alpha = this.aircraft.angleOfAttack;
    if (Math.abs(alpha) < AERODYNAMICS.criticalAlpha - AERODYNAMICS.stallRecoveryMargin) {
      return this.thrustLocked ? '保持机翼平稳，等待失速解除；T 已失效，恢复后再平缓拉起。' : '保持机翼平稳，按 T 提速，等待失速解除后再平缓拉起。';
    }
    const direction = alpha < 0 ? '按 ↑ 平缓抬高机头' : '先按 ↓ 降低机头，恢复后再平缓 ↑ 拉起';
    return `${direction}；${this.thrustLocked ? 'T 已失效，关闭 W 并保持机翼平稳。' : '关闭 W 并按 T 提速。'}`;
  }

  get gearWarning() {
    const a=this.aircraft;
    return !a.onGround && !a.landed && a.systems.gearPosition<0.99 && a.verticalSpeed<0 && this.altitude()<FLIGHT.gearWarningHeight;
  }

  get maxSpeed() {
    return this.aircraft.birdStrike ? AERODYNAMICS.overspeedWarning * this.route.birdStrikeSpeedRatio : Infinity;
  }

  // 鸟击是明确的游戏限速：保留三维速度方向，不取消下坠或自动恢复高度。
  limitSpeed() {
    if (!this.aircraft.birdStrike) return;
    const a=this.aircraft, speed=Math.hypot(a.velocity.x,a.velocity.y,a.velocity.z)*FLIGHT.kmhPerMps, limit=this.maxSpeed;
    if (speed<=limit) return;
    const ratio=limit/speed;
    a.velocity.x*=ratio; a.velocity.y*=ratio; a.velocity.z*=ratio;
    a.airspeed=limit; a.verticalSpeed=a.velocity.y*FLIGHT.kmhPerMps;
    a.flightPathAngle=Math.atan2(a.velocity.y,Math.hypot(a.velocity.x,a.velocity.z));
    a.angleOfAttack=a.pitch-a.flightPathAngle;
  }

  command(key) {
    const a = this.aircraft, state = a.systems;
    if (key === 'T' || key === 'S') {
      if (key==='T' && this.thrustLocked) return {type:'blocked',key,condition:'bird-thrust-lock',reason:'Thrust unavailable（无法提速）：本关已遭两次鸟击，T 已失效，下一关恢复。'};
      if (key === 'T' && (state.engine !== 'RUNNING' || (a.onGround && state.parkingBrake))) return {
        type: 'blocked', key, condition: 'power', reason: '请先启动发动机并松开驻车刹车，再按 T 提速。',
      };
      const direction=key==='T'?1:-1;
      const pending=this.speedTapDirection===direction?this.speedTapRemaining:0;
      this.speedTapDirection=direction;
      this.speedTapRemaining=Math.min(pending+FLIGHT.speedTapKmh,direction>0?Math.max(0,this.maxSpeed-a.airspeed):a.airspeed);
      return { type: 'throttle', key };
    }
    if (key === 'UP' || key === 'DOWN') {
      if (a.landed || (a.onGround && a.airspeed < FLIGHT.rotationSpeed)) return null;
      // 反向操作从当前姿态开始，避免先偿还此前未能达到的目标角度。
      const direction = key === 'UP' ? 1 : -1;
      if ((this.pitchTarget - a.pitch) * direction < 0) this.pitchTarget = a.pitch;
      this.pitchTarget = clamp(this.pitchTarget + direction * FLIGHT.pitchTap,
        a.onGround ? 0 : FLIGHT.minPitch, a.onGround ? FLIGHT.groundMaxPitch : FLIGHT.maxPitch);
      return { type: 'pitch', key };
    }
    if (key !== 'G' && key !== 'W') return null;
    if (key === 'W') {
      if (['RETRACTING', 'EXTENDING'].includes(state.flaps)) return null;
      state.flaps = state.flaps === 'CLEAN' ? 'EXTENDING' : 'RETRACTING';
      return {type: 'flaps-start', key};
    }
    if (['RETRACTING', 'EXTENDING'].includes(state.gear)) return null;
    if (state.gear === 'UP') {
      if (a.onGround || a.airspeed > this.route.gearMaxSpeed) {
        this.gearExtensionBlocked=a.airspeed>this.route.gearMaxSpeed;
        return {type:'blocked',key,condition:'extension-speed',reason:`Gear（起落架）：先减速至 ${Math.round(this.route.gearMaxSpeed)} km/h 以下再放下。`};
      }
      state.gear = 'EXTENDING';
    } else {
      if (a.landed) return {type: 'blocked', key, condition: 'taxi', reason: '着陆后保持起落架放下。'};
      if (!this.canRetractGear()) return {
        type: 'blocked', key, condition: 'gear-height', reason: `Gear（起落架）[G]：离地至少 ${FLIGHT.gearHeight} 米且正在爬升时才能收起。`,
      };
      state.gear = 'RETRACTING';
    }
    return {type: 'gear-start', key};
  }

  step(dt, held) {
    const a = this.aircraft, state = a.systems;
    this.events.length = 0;
    const airborneAtStart = !a.onGround;
    if (a.airspeed<=this.route.gearMaxSpeed || state.gear!=='UP') this.gearExtensionBlocked=false;
    Object.assign(this.previous.position, a.position);
    this.previous.pitch = a.pitch; this.previous.bank = a.bank; this.previous.heading = a.heading;
    const aligning = a.landed && this.settleLanding(dt);
    const pressingThrust=held.has('T') && !this.thrustLocked;
    if (this.thrustLocked && this.speedTapDirection>0) this.speedTapRemaining=0;
    if ((held.has('S') && this.speedTapDirection>0) || (!held.has('S') && pressingThrust && this.speedTapDirection<0)) this.speedTapRemaining=0;
    if ((this.speedTapDirection>0 && (state.engine!=='RUNNING' || (a.onGround && state.parkingBrake) || a.airspeed>=this.maxSpeed)) || (this.speedTapDirection<0 && a.airspeed<=0)) this.speedTapRemaining=0;
    const pulse = this.speedTapRemaining > 1e-7;
    const previousSpeed=a.airspeed;
    const slow = held.has('S') || (!pressingThrust && pulse && this.speedTapDirection < 0);
    const advancing = !this.thrustLocked && !slow && (pressingThrust || (pulse && this.speedTapDirection > 0));
    // 额度单位为km/h；点按末步缩小变速力，长按仍持续按当前W速率施力。
    const pulseRate=this.speedTapRemaining/(FLIGHT.kmhPerMps*dt);
    const thrustRate=held.has('T')?this.speedRate(1):Math.min(this.speedRate(1),pulseRate);
    const brakeRate=held.has('S')?this.speedRate(-1):Math.min(this.speedRate(-1),pulseRate);
    a.wheelBrake = a.onGround && slow;
    const pitchInput = Number(held.has('up')) - Number(held.has('down'));
    const turnInput = aligning ? 0 : Number(held.has('right')) - Number(held.has('left'));
    const aero = AERODYNAMICS;
    const pressure = a.onGround ? 1 : clamp((a.airspeed / aero.controlReferenceSpeed) ** 2, aero.minimumControl, 1);
    const effectiveness = pressure * (this.stalled ? aero.stallControl : 1);
    // 目标与实际使用相同操纵速率，低动压或失速时不积压长按目标。
    const pitchRate = FLIGHT.pitchRate * pressure * (this.stalled ? aero.stallPitchControl : 1);
    if (a.landed || (a.onGround && a.airspeed < FLIGHT.rotationSpeed)) this.pitchTarget = 0;
    else this.pitchTarget = clamp(this.pitchTarget + pitchInput * pitchRate * dt,
      a.onGround ? 0 : FLIGHT.minPitch, a.onGround ? FLIGHT.groundMaxPitch : FLIGHT.maxPitch);
    if (!aligning) a.pitch = approach(a.pitch, this.pitchTarget, pitchRate * dt);
    if (!a.onGround) {
      const sign = Math.sign(a.angleOfAttack);
      const separation = clamp((Math.abs(a.angleOfAttack) - aero.criticalAlpha) / aero.postStallDecay, 0, 1);
      let correctionRate = aero.stallPitchRate * separation;
      // 保留气动回正，但不让它将玩家的持续操纵反向；猛拉仍承担失速升阻力。
      if (pitchInput * sign > 0) correctionRate = Math.min(correctionRate, pitchRate * aero.stallOpposingPitchRatio);
      const before = a.pitch;
      a.pitch = clamp(a.pitch - sign * correctionRate * dt, FLIGHT.minPitch, FLIGHT.maxPitch);
      // 气动回正同步移动目标，松键后不再自动追赶过期的机头角度。
      this.pitchTarget = clamp(this.pitchTarget + a.pitch - before, FLIGHT.minPitch, FLIGHT.maxPitch);
    }
    if (a.onGround) { if (!aligning) a.bank = 0; }
    else a.bank = approach(a.bank, a.bank + (turnInput * FLIGHT.maxBank - a.bank) * (1 - Math.exp(-FLIGHT.bankResponse * dt)), aero.maxRollRate * effectiveness * dt);
    const horizontal = a.onGround ? a.airspeed / FLIGHT.kmhPerMps : Math.hypot(a.velocity.x, a.velocity.z);
    const speed = a.onGround ? a.airspeed / FLIGHT.kmhPerMps : Math.hypot(horizontal, a.velocity.y);
    const speedKmh = speed * FLIGHT.kmhPerMps;
    const gamma = a.onGround ? 0 : Math.atan2(a.velocity.y, horizontal);
    const alpha = a.pitch - gamma;
    const density = aero.seaLevelDensity * Math.exp(-Math.max(0, a.position.y) / aero.densityScaleHeight);
    this.updateSpeedLimits(density);
    const qArea = 0.5 * density * speed ** 2 * aero.wingArea;
    const critical = aero.criticalAlpha;
    const wingLift = 1 - state.flapsPosition * aero.wingBrakeLiftLoss;
    let cl = (aero.liftAtZero + aero.liftSlope * alpha) * wingLift;
    const excess = Math.max(0, Math.abs(alpha) - critical);
    if (excess > 0) {
      const peak = (aero.liftAtZero + aero.liftSlope * Math.sign(alpha) * critical) * wingLift;
      cl = peak * (aero.postStallLiftFraction + (1 - aero.postStallLiftFraction) * Math.exp(-excess / aero.postStallDecay));
    }
    const separated = 1 - Math.exp(-excess / aero.postStallDecay);
    const highSpeedDrag = aero.highSpeedDrag * Math.max(0, speedKmh / aero.overspeedWarning - 1) ** 2;
    const cd = highSpeedDrag + aero.parasiteDrag + aero.inducedDrag * cl ** 2 + state.flapsPosition * aero.wingBrakeDrag + state.gearPosition * aero.gearDrag + aero.stallDrag * separated;
    const groundSpoilers = a.landed && a.onGround;
    const lift = qArea * cl * (groundSpoilers ? aero.landingGroundLift : 1), drag = qArea * (cd + (groundSpoilers ? aero.landingGroundDrag : 0));
    const capacity = aero.maxThrust * density / aero.seaLevelDensity / (1 + speedKmh / aero.thrustSpeedScale);
    const rolling = a.onGround ? aero.rollingFriction * Math.max(0, aero.mass * FLIGHT.gravity - lift) : 0;
    const accelerating = advancing && state.engine === 'RUNNING' && !(a.onGround && state.parkingBrake);
    // 只补偿正常平飞配平阻力；失速、超速和过度拉升增加的阻力必须消耗能量。
    const peak = (aero.liftAtZero + aero.liftSlope * critical) * wingLift;
    const trimCl = a.onGround ? cl : clamp(aero.mass * FLIGHT.gravity / Math.max(1, qArea), 0, peak);
    const trimDrag = qArea * (aero.parasiteDrag + aero.inducedDrag * trimCl ** 2 + state.flapsPosition * aero.wingBrakeDrag + state.gearPosition * aero.gearDrag + (groundSpoilers ? aero.landingGroundDrag : 0));
    const authority = a.onGround ? 1 : clamp((speedKmh / this.stallSpeed - aero.lowSpeedPowerStart) / (1 - aero.lowSpeedPowerStart), 0, 1);
    // 只有玩家的T请求提供推力；请求结束后不补动力、不保速，继续承受阻力和重力。
    const requested = accelerating ? (trimDrag + rolling) * authority + aero.mass * thrustRate : 0;
    const demanded = state.engine === 'RUNNING' && !(a.onGround && state.parkingBrake) ? Math.min(capacity * a.powerLimit, requested) : 0;
    a.throttle = capacity ? demanded / capacity : 0;
    a.enginePower += (a.throttle - a.enginePower) * (1 - Math.exp(-dt / aero.engineResponseSeconds));
    if (a.enginePower < 1e-6) a.enginePower = 0;
    const thrust = this.thrustLocked ? 0 : state.engine === 'RUNNING' ? demanded : capacity * a.enginePower;
    const speedBrake = slow ? aero.mass * brakeRate : 0;
    a.angleOfAttack = alpha; a.flightPathAngle = gamma;
    a.lift = lift; a.drag = drag; a.thrust = thrust; a.loadFactor = lift / (aero.mass * FLIGHT.gravity);
    if (a.onGround) {
      const normal = Math.max(0, aero.mass * FLIGHT.gravity - lift - thrust * Math.sin(a.pitch));
      const braking = state.parkingBrake ? aero.brakeFriction * normal : 0;
      const acceleration = (thrust * Math.cos(a.pitch) - drag - speedBrake - aero.rollingFriction * normal - braking) / aero.mass;
      a.airspeed = Math.max(0, speed + acceleration * dt) * FLIGHT.kmhPerMps;
      const steering = FLIGHT.groundTurnRate * a.airspeed / (a.airspeed + FLIGHT.groundTurnSpeed) / (1 + a.airspeed / FLIGHT.groundTurnSpeed);
      const gripTurn = aero.tireFriction * normal / aero.mass / Math.max(1, a.airspeed / FLIGHT.kmhPerMps);
      a.heading += turnInput * Math.min(steering, gripTurn) * dt;
      if (a.landed) a.position.y += this.route.destination.elevation - this.lowestPoint();
      else a.position.y = Math.sin(a.pitch) * AIRCRAFT.mainWheelZ;
      a.verticalSpeed = a.landed ? 0 : (a.position.y - this.previous.position.y) / dt * FLIGHT.kmhPerMps;
      a.velocity.x = Math.sin(a.heading) * a.airspeed / FLIGHT.kmhPerMps;
      a.velocity.z = -Math.cos(a.heading) * a.airspeed / FLIGHT.kmhPerMps;
      a.velocity.y = a.verticalSpeed / FLIGHT.kmhPerMps;
      if (!this.rotateAnnounced && a.airspeed >= FLIGHT.rotationSpeed) {
        this.rotateAnnounced = true; this.events.push({ type: 'rotation-ready', key: 'UP' });
      }
      if (!a.landed && a.airspeed >= FLIGHT.rotationSpeed && state.flapsPosition <= FLIGHT.takeoffBrakePosition && normal === 0) {
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
      a.velocity.x += (thrust * forwardX - (drag + speedBrake) * ux + lift * (normalX * cosine + rightX * sine)) / aero.mass * dt;
      a.velocity.y += ((thrust * Math.sin(a.pitch) - (drag + speedBrake) * uy + lift * normalY * cosine) / aero.mass - FLIGHT.gravity) * dt;
      a.velocity.z += (thrust * forwardZ - (drag + speedBrake) * uz + lift * (normalZ * cosine + rightZ * sine)) / aero.mass * dt;
      a.airspeed = Math.hypot(a.velocity.x, a.velocity.y, a.velocity.z) * FLIGHT.kmhPerMps;
      a.verticalSpeed = a.velocity.y * FLIGHT.kmhPerMps;
      const heading = Math.atan2(a.velocity.x, -a.velocity.z);
      a.heading += Math.atan2(Math.sin(heading - a.heading), Math.cos(heading - a.heading));
    }
    this.limitSpeed();
    if ((this.speedTapDirection>0 && accelerating) || (this.speedTapDirection<0 && slow)) this.speedTapRemaining=Math.max(0,this.speedTapRemaining-Math.max(0,this.speedTapDirection*(a.airspeed-previousSpeed)));
    if (airborneAtStart) a.position.y += a.velocity.y * dt;
    a.position.x += worldHorizontalSpeed(a.velocity.x) * dt; a.position.z += worldHorizontalSpeed(a.velocity.z) * dt;
    if (!a.onGround) {
      a.flightPathAngle = Math.atan2(a.velocity.y, Math.hypot(a.velocity.x, a.velocity.z));
      a.angleOfAttack = a.pitch - a.flightPathAngle;
      this.stallEntry = Math.abs(a.angleOfAttack) > critical ? this.stallEntry + dt : 0;
      this.stallRecovery = Math.abs(a.angleOfAttack) < critical - aero.stallRecoveryMargin ? this.stallRecovery + dt : 0;
      if (!this.stalled && this.stallEntry >= aero.stallEntrySeconds) {
        this.stalled = true;
        this.events.push({ type: 'stall', key: 'alpha', reason: `Stall（失速）：${this.stallGuidance}` });
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
      this.events.push({ type: 'overspeed', key: 'airspeed', reason: '空速过高：S 减速，W 打开机翼减速板，平缓改出俯冲，避免猛拉机头。' });
    } else if (this.overspeed && a.airspeed < aero.overspeedClear) this.overspeed = false;
    for (const [system, seconds, key] of [['gear', FLIGHT.gearSeconds, 'G'], ['flaps', FLIGHT.flapsSeconds, 'W']]) {
      const retracting = state[system] === 'RETRACTING';
      if (!retracting && state[system] !== 'EXTENDING') continue;
      const field = `${system}Position`;
      state[field] = clamp(state[field] + (retracting ? -1 : 1) * dt / seconds, 0, 1);
      if (retracting ? state[field] <= 1e-9 : state[field] >= 1 - 1e-9) {
        state[field] = retracting ? 0 : 1;
        state[system] = system === 'gear' ? retracting ? 'UP' : 'DOWN' : retracting ? 'CLEAN' : 'TAKEOFF';
        this.events.push({ type: `${system}-${retracting ? 'up' : 'down'}`, key });
      }
    }
    if (this.gearWarning && !this.gearWarningAnnounced) {
      this.gearWarningAnnounced=true;
      this.events.push({type:'gear-warning',key:'landing-gear',reason:'Landing gear（起落架警告）：立即按 G 放轮！未完全放下就触地会爆炸。'});
    } else if (state.gearPosition>=0.99 || this.altitude()>=FLIGHT.gearWarningClearHeight) this.gearWarningAnnounced=false;
    this.maxAirspeed = Math.max(this.maxAirspeed, a.airspeed);
    this.maxAltitude = Math.max(this.maxAltitude, this.altitude());
    if (a.onGround && !a.landed) {
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
    } else if (a.landed && a.onGround) {
      const destination = this.route.destination, apron = destination.apron;
      for (const point of [[-AIRCRAFT.mainWheelX, 0, AIRCRAFT.mainWheelZ], [AIRCRAFT.mainWheelX, 0, AIRCRAFT.mainWheelZ], [0, 0, AIRCRAFT.noseWheelZ]]) {
        const x = a.position.x + Math.cos(a.heading) * point[0] - Math.sin(a.heading) * point[2];
        const z = a.position.z + Math.sin(a.heading) * point[0] + Math.cos(a.heading) * point[2];
        const runway = Math.abs(x - destination.x) <= destination.width / 2 && z <= destination.threshold && z >= destination.threshold - destination.length;
        const parking = Math.abs(x - apron.x) <= apron.width / 2 && Math.abs(z - apron.z) <= apron.length / 2;
        if (!runway && !parking) { this.events.push({type: 'failed', key: 'taxi', reason: `轮子驶出了${this.route.destinationName}机场跑道或机坪。`}); break; }
      }
    } else if (!a.onGround && this.lowestPoint() < this.world.baseHeightAt(a.position.x, a.position.z) - FLIGHT.contactTolerance) {
      const destination = this.route.destination;
      const landing=this.landingStatus();
      if (landing.ready) {
        a.position.y += this.route.destination.elevation - this.lowestPoint(); a.onGround = true; a.landed = true;
        a.velocity.y = 0; a.verticalSpeed = 0; this.pitchTarget = 0; this.lowSpeed = false;
        this.landingAlignment={elapsed:0,heading:a.heading-landing.heading};
        this.events.push({type: 'landed', key: 'airport', reason: 'Touchdown（安全着陆）：机身自动摆正，W 保持打开，S 减速并在跑道内停稳，注意避让停放的飞机与卡车。'});
      } else this.events.push({type: 'failed', key: 'ground', destructive: true, reason: !landing.gear && !this.world.isSeaAt?.(a.position.x,a.position.z) ? '起落架未完全放下就触地，飞机撞地爆炸。' : landing.runway ? '着陆条件不安全：检查起落架、机翼减速板、速度、下降率和姿态。' : this.world.isSeaAt?.(a.position.x,a.position.z) ? '飞机坠入了海面。' : this.stalled ? '持续失速导致下坠，飞机撞到了地面。' : `飞机在${this.route.destinationName}机场跑道外撞地。`});
    }
    const low = !a.onGround && a.airspeed < this.safeSpeed;
    if (low && !this.lowSpeed) this.events.push({ type: 'low-speed', key: 'airspeed', reason: `Airspeed low（空速偏低）：当前坡度与海拔建议至少 ${Math.ceil(this.safeSpeed) } km/h；${this.thrustLocked ? 'T 已失效，保持机翼平稳并减小迎角' : '关闭 W、T 提速，减小迎角'}。` });
    if (low) this.lowSpeed = true;
    this.lowSpeedRecovery = a.airspeed > this.safeSpeed * aero.speedWarningClear ? this.lowSpeedRecovery + dt : 0;
    if (this.lowSpeedRecovery >= AERODYNAMICS.warningRecoverySeconds) this.lowSpeed = false;
    const success = !a.onGround && !this.stalled && !this.overspeed && !this.pitchHigh && !this.pitchLow && this.altitude() >= FLIGHT.completionHeight && a.airspeed >= FLIGHT.climbMinSpeed && a.airspeed <= Math.max(FLIGHT.climbMaxSpeed, this.route.cruiseSpeed * 1.05) && a.verticalSpeed > 0 && Math.abs(a.bank) <= FLIGHT.successBank && state.gear === 'UP' && state.flaps === 'CLEAN';
    this.completionSeconds = success ? this.completionSeconds + dt : 0;
    if (!this.climbComplete && this.completionSeconds >= FLIGHT.completionHoldSeconds) { this.climbComplete = true; this.events.push({ type: 'climb-complete', key: 'flight' }); }
    return this.events;
  }
}
