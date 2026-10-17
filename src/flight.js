import { AIRCRAFT, FLIGHT, RUNWAY, AERODYNAMICS, worldHorizontalSpeed, isWithinRunway } from './config.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);

// 游戏化飞行：T／S控制前进速度，姿态控制航迹；低速失速只影响垂直运动。
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
    this.stalled = false;
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
    if (direction <= 0) return FLIGHT.speedBrakeRate * FLIGHT.speedMultiplier;
    const a = this.aircraft;
    const multiplier = !a.onGround ? FLIGHT.airSpeedMultiplier : a.landed ? FLIGHT.speedMultiplier : FLIGHT.takeoffSpeedMultiplier;
    return FLIGHT.speedRate * multiplier;
  }

  // W即时切换，关闭只接受T，打开只接受S。
  canChangeSpeed(direction) {
    const state = this.aircraft.systems;
    return direction > 0 ? state.flaps === 'CLEAN' : state.flaps === 'TAKEOFF';
  }

  updateSpeedLimits() {
    this.stallSpeed = FLIGHT.stallSpeed;
    this.stallRecoverySpeed = FLIGHT.stallRecoverySpeed;
  }

  // 接地判定与右侧指引共用同一状态，角度安全不代表其他条件已经满足。
  landingStatus() {
    const a=this.aircraft, route=this.route, destination=route.destination, state=this.landingState;
    state.heading=Math.atan2(Math.sin(a.heading),Math.cos(a.heading));
    state.pitch=a.pitch>=route.landingMinPitch-1e-9 && a.pitch<=route.landingMaxPitch+1e-9;
    state.runway=isWithinRunway(a.position,destination);
    state.gear=a.systems.gear==='DOWN' && a.systems.gearPosition>=0.99;
    state.speed=a.airspeed>=route.landingMinSpeed-1e-9 && a.airspeed<=route.landingMaxSpeed+1e-9;
    state.ready=state.runway && state.pitch && state.gear && state.speed;
    const factor=route.landingDangerFactor;
    const severe=a.pitch<route.landingMinPitch*factor || a.pitch>route.landingMaxPitch*factor
      || a.airspeed>route.landingMaxSpeed*factor || a.airspeed<route.landingMinSpeed/factor;
    state.severity=a.landed || state.ready ? 'safe' : severe || this.altitude()<=route.landingDangerHeight ? 'danger' : 'caution';
    return state;
  }

  landingFailureReason(landing) {
    const a = this.aircraft, route = this.route, runway = route.destination;
    const number = value => Number(value.toFixed(2));
    const degrees = angle => number(angle * 180 / Math.PI);
    if (this.world.isSeaAt?.(a.position.x, a.position.z)) return '海面触地：飞机落入海中，未抵达机场跑道。';
    if (!landing.runway) {
      if (a.position.z > runway.threshold) return `提前触地：距离${route.destinationName}机场跑道入口还有${Math.ceil(a.position.z - runway.threshold)}米。`;
      if (a.position.z < runway.threshold - runway.length) return `越过跑道触地：已超出${route.destinationName}机场跑道末端${Math.ceil(runway.threshold - runway.length - a.position.z)}米。`;
      const overflow = Math.abs(a.position.x - runway.x) - runway.width / 2;
      return `跑道侧边触地：机身位置超出${a.position.x < runway.x ? '左' : '右'}侧边界${number(overflow)}米。`;
    }
    if (!landing.gear) {
      const state = a.systems.gear;
      return state === 'EXTENDING' || state === 'RETRACTING'
        ? `Gear（起落架）未放妥：触地时仍在${state === 'EXTENDING' ? '放轮' : '收轮'}，放下进度${Math.round(a.systems.gearPosition * 100)}%。`
        : 'Gear（起落架）未放下：触地时仍处于收起状态。';
    }
    if (!landing.speed) return `接地速度${a.airspeed < route.landingMinSpeed ? '过低' : '过高'}：${number(a.airspeed)} km/h，允许${number(route.landingMinSpeed)}–${number(route.landingMaxSpeed)} km/h。`;
    return `接地机头${a.pitch < route.landingMinPitch ? '过低' : '过高'}：俯仰${degrees(a.pitch)}°，允许${degrees(route.landingMinPitch)}°至${degrees(route.landingMaxPitch)}°。`;
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
    if (this.thrustLocked) return '空速不足，飞机正在下沉；本关两次鸟击，T 已失效。';
    if (this.aircraft.systems.engine !== 'RUNNING') return '空速不足，飞机正在下沉；先按 F 启动发动机。';
    return '空速不足，飞机正在下沉；关闭 W 后按 T 提速到 165 km/h，解除下沉。';
  }

  get gearWarning() {
    const a=this.aircraft;
    return !a.onGround && !a.landed && a.systems.gearPosition<0.99 && a.verticalSpeed<0 && this.altitude()<FLIGHT.gearWarningHeight;
  }

  get maxSpeed() {
    return FLIGHT.maxSpeed * (this.aircraft.birdStrike ? this.route.birdStrikeSpeedRatio : 1);
  }

  // 最高速度只约束前进速度，保留垂直下坠动量，不能用下落速度冒充空速。
  limitSpeed() {
    const a = this.aircraft, limit = this.maxSpeed;
    if (a.airspeed <= limit) return;
    const ratio = limit / a.airspeed;
    a.velocity.x *= ratio; a.velocity.z *= ratio;
    a.airspeed = limit;
  }

  command(key) {
    const a = this.aircraft, state = a.systems;
    if (key === 'T' || key === 'S') {
      if (key==='T' && this.thrustLocked) return {type:'blocked',key,condition:'bird-thrust-lock',reason:'Thrust unavailable（无法提速）：本关已遭两次鸟击，T 已失效，下一关恢复。'};
      if (key === 'T' && (state.engine !== 'RUNNING' || (a.onGround && state.parkingBrake))) return {
        type: 'blocked', key, condition: 'power', reason: '请先启动发动机并松开驻车刹车，再按 T 提速。',
      };
      const direction=key==='T'?1:-1;
      if (!this.canChangeSpeed(direction)) return {
        type: 'blocked', key, condition: 'wing-brake', reason: key === 'T'
          ? 'T（提速）：请先关闭 W。'
          : 'S（减速）：请先打开 W。',
      };
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
      this.speedTapRemaining = 0; this.speedTapDirection = 0;
      const open = state.flaps === 'CLEAN';
      state.flaps = open ? 'TAKEOFF' : 'CLEAN';
      state.flapsPosition = open ? 1 : 0;
      return {type: open ? 'flaps-down' : 'flaps-up', key};
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
    const aero = AERODYNAMICS;
    const thrustAllowed = this.canChangeSpeed(1) && !this.thrustLocked && state.engine === 'RUNNING' && !(a.onGround && state.parkingBrake);
    const brakeAllowed = this.canChangeSpeed(-1) && !(a.onGround && state.parkingBrake);
    const pressingThrust = held.has('T') && thrustAllowed;
    const pressingBrake = held.has('S') && brakeAllowed;
    if ((this.speedTapDirection > 0 && (!thrustAllowed || a.airspeed >= this.maxSpeed)) ||
        (this.speedTapDirection < 0 && (!brakeAllowed || a.airspeed <= 0))) this.speedTapRemaining = 0;
    if ((pressingBrake && this.speedTapDirection > 0) || (pressingThrust && this.speedTapDirection < 0)) this.speedTapRemaining = 0;
    const pulse = this.speedTapRemaining > 1e-7;
    const slow = brakeAllowed && (pressingBrake || (!pressingThrust && pulse && this.speedTapDirection < 0));
    const accelerating = thrustAllowed && !slow && (pressingThrust || (pulse && this.speedTapDirection > 0));
    const previousSpeed = a.airspeed;
    // 空速是独立的前进速度状态，重力／下坠不会把它被动加到失速阈值以上。
    const direction = accelerating ? 1 : slow ? -1 : 0;
    let rate = direction ? this.speedRate(direction) * (accelerating ? a.powerLimit : 1) : 0;
    if (direction && !(accelerating ? pressingThrust : pressingBrake)) rate = Math.min(rate, this.speedTapRemaining / (FLIGHT.kmhPerMps * dt));
    const manualSpeed = Math.max(0, previousSpeed + direction * rate * FLIGHT.kmhPerMps * dt);
    if (direction === this.speedTapDirection) this.speedTapRemaining = Math.max(0, this.speedTapRemaining - Math.abs(manualSpeed - previousSpeed));
    // 固定阻力与W阻力独立叠加，不消耗T／S主动额度；合并变速后再限制速度。
    const decayRate = FLIGHT.speedDecayRate + (state.flaps === 'TAKEOFF' ? FLIGHT.wingBrakeDeceleration : 0);
    a.airspeed = clamp(manualSpeed - decayRate * dt, 0, this.maxSpeed);
    a.wheelBrake = a.onGround && slow;
    a.throttle = accelerating ? a.powerLimit : 0;
    a.enginePower += (a.throttle - a.enginePower) * (1 - Math.exp(-dt / aero.engineResponseSeconds));
    if (a.enginePower < 1e-6) a.enginePower = 0;
    a.thrust = accelerating ? aero.mass * rate : 0;
    a.drag = aero.mass * ((slow ? rate : 0) + decayRate / FLIGHT.kmhPerMps);
    a.lift = a.onGround ? 0 : aero.mass * FLIGHT.gravity;
    a.loadFactor = a.onGround ? 0 : 1;
    const stalled = !a.onGround && (this.stalled ? a.airspeed < this.stallRecoverySpeed : a.airspeed < this.stallSpeed);
    if (stalled !== this.stalled) {
      this.stalled = stalled;
      this.events.push(stalled ? {type: 'stall', key: 'airspeed', reason: `Stall（失速）：${this.stallGuidance}`} : {type: 'stall-recovered', key: 'airspeed'});
    }
    const pitchInput = Number(held.has('up')) - Number(held.has('down'));
    const turnInput = aligning ? 0 : Number(held.has('right')) - Number(held.has('left'));
    if (a.landed || (a.onGround && a.airspeed < FLIGHT.rotationSpeed)) this.pitchTarget = 0;
    else this.pitchTarget = clamp(this.pitchTarget + pitchInput * FLIGHT.pitchRate * dt,
      a.onGround ? 0 : FLIGHT.minPitch, a.onGround ? FLIGHT.groundMaxPitch : FLIGHT.maxPitch);
    if (!aligning) a.pitch = approach(a.pitch, this.pitchTarget, FLIGHT.pitchRate * dt);
    if (a.onGround) { if (!aligning) a.bank = 0; }
    else a.bank = approach(a.bank, a.bank + (turnInput * FLIGHT.maxBank - a.bank) * (1 - Math.exp(-FLIGHT.bankResponse * dt)), aero.maxRollRate * dt);
    if (a.onGround) {
      const steering = FLIGHT.groundTurnRate * a.airspeed / (a.airspeed + FLIGHT.groundTurnSpeed) / (1 + a.airspeed / FLIGHT.groundTurnSpeed);
      const gripTurn = aero.tireFriction * FLIGHT.gravity / Math.max(1, a.airspeed / FLIGHT.kmhPerMps);
      a.heading += turnInput * Math.min(steering, gripTurn) * dt;
      if (a.landed) a.position.y += this.route.destination.elevation - this.lowestPoint();
      else a.position.y = Math.sin(a.pitch) * AIRCRAFT.mainWheelZ;
      a.velocity.y = 0; a.verticalSpeed = 0;
      if (!this.rotateAnnounced && a.airspeed >= FLIGHT.rotationSpeed) {
        this.rotateAnnounced = true; this.events.push({type: 'rotation-ready', key: 'UP'});
      }
      if (!a.landed && a.airspeed >= FLIGHT.rotationSpeed && state.flaps === 'CLEAN' && state.engine === 'RUNNING' && a.pitch >= FLIGHT.takeoffPitch) {
        a.onGround = false; this.liftOffSpeed = a.airspeed;
        a.velocity.y = a.airspeed / FLIGHT.kmhPerMps * Math.sin(a.pitch);
        this.events.push({type: 'liftoff', key: 'UP'});
      }
    } else {
      const speed = a.airspeed / FLIGHT.kmhPerMps;
      a.heading += (speed > 0 ? FLIGHT.gravity * Math.tan(a.bank) / Math.max(20, speed) : 0) * dt;
      let targetVertical = speed * Math.sin(a.pitch);
      if (this.stalled) {
        const severity = clamp(1 - a.airspeed / this.stallSpeed, 0, 1);
        const sink = FLIGHT.stallMinSink + (FLIGHT.stallMaxSink - FLIGHT.stallMinSink) * severity;
        targetVertical = Math.min(targetVertical, -sink / FLIGHT.kmhPerMps);
      }
      // 连续改变垂直速度；提速、减速和恢复失速都不瞬移高度或抹除下坠。
      a.velocity.y += (targetVertical - a.velocity.y) * (1 - Math.exp(-FLIGHT.verticalResponse * dt));
    }
    const forward = a.airspeed / FLIGHT.kmhPerMps * (a.onGround ? 1 : Math.cos(a.pitch));
    // 接地归正期间沿跑道滑行，避免残余航向和机轮留边造成二次误判。
    const travelHeading = aligning ? this.landingAlignment?.heading ?? a.heading : a.heading;
    a.velocity.x = Math.sin(travelHeading) * forward;
    a.velocity.z = -Math.cos(travelHeading) * forward;
    a.verticalSpeed = a.velocity.y * FLIGHT.kmhPerMps;
    if (airborneAtStart) a.position.y += a.velocity.y * dt;
    a.position.x += worldHorizontalSpeed(a.velocity.x) * dt; a.position.z += worldHorizontalSpeed(a.velocity.z) * dt;
    a.flightPathAngle = Math.atan2(a.velocity.y, Math.hypot(a.velocity.x, a.velocity.z));
    a.angleOfAttack = a.pitch - a.flightPathAngle;
    const descentRisk = !a.onGround && !this.stalled && (a.pitch < aero.pitchLowWarning || (this.altitude() < aero.groundWarningHeight && a.flightPathAngle < aero.descentWarningAngle));
    this.pitchLowRecovery = !descentRisk ? this.pitchLowRecovery + dt : 0;
    if (!this.pitchLow && descentRisk) {
      this.pitchLow = true;
      this.events.push({type: 'pitch-low', key: 'pitch', reason: '下降危险，请平缓抬高机头（↑）并留出离地高度。'});
    } else if (this.pitchLow && this.pitchLowRecovery >= aero.warningRecoverySeconds) this.pitchLow = false;
    if (!a.onGround && !this.overspeed && a.airspeed > aero.overspeedWarning) {
      this.overspeed = true;
      this.events.push({type: 'overspeed', key: 'airspeed', reason: '空速过高：打开 W 减速，可再按 S 加强减速。'});
    } else if (this.overspeed && a.airspeed < aero.overspeedClear) this.overspeed = false;
    const retracting = state.gear === 'RETRACTING';
    if (retracting || state.gear === 'EXTENDING') {
      state.gearPosition = clamp(state.gearPosition + (retracting ? -1 : 1) * dt / FLIGHT.gearSeconds, 0, 1);
      if (retracting ? state.gearPosition <= 1e-9 : state.gearPosition >= 1 - 1e-9) {
        state.gearPosition = retracting ? 0 : 1;
        state.gear = retracting ? 'UP' : 'DOWN';
        this.events.push({ type: retracting ? 'gear-up' : 'gear-down', key: 'G' });
      }
    }
    if (this.gearWarning && !this.gearWarningAnnounced) {
      this.gearWarningAnnounced=true;
      this.events.push({type:'gear-warning',key:'landing-gear',reason:'Landing gear（起落架警告）：立即按 G 放轮！未完全放下就触地会爆炸。'});
    } else if (state.gearPosition>=0.99 || this.altitude()>=FLIGHT.gearWarningClearHeight) this.gearWarningAnnounced=false;
    this.maxAirspeed = Math.max(this.maxAirspeed, a.airspeed);
    this.maxAltitude = Math.max(this.maxAltitude, this.altitude());
    if (a.onGround && !a.landed) {
      for (const [name, x, z] of [['左主轮', -AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ], ['右主轮', AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ], ['前轮', 0, AIRCRAFT.noseWheelZ]]) {
        const wheelX = a.position.x + Math.cos(a.heading) * x - Math.sin(a.heading) * z;
        const wheelZ = a.position.z + Math.sin(a.heading) * x + Math.cos(a.heading) * z;
        if (Math.abs(wheelX) > RUNWAY.width / 2) {
          this.events.push({ type: 'failed', key: 'runway', reason: `起飞滑跑越界：${name}从跑道${wheelX < 0 ? '左' : '右'}侧驶出${Number((Math.abs(wheelX) - RUNWAY.width / 2).toFixed(2))}米。` }); break;
        }
        if (wheelZ < RUNWAY.startOffset - RUNWAY.length || wheelZ > RUNWAY.startOffset) {
          this.events.push({ type: 'failed', key: 'runway', reason: `起飞滑跑越界：${name}驶出跑道${wheelZ < RUNWAY.startOffset - RUNWAY.length ? '末端' : '起点'}${Number((wheelZ < RUNWAY.startOffset - RUNWAY.length ? RUNWAY.startOffset - RUNWAY.length - wheelZ : wheelZ - RUNWAY.startOffset).toFixed(2))}米。` }); break;
        }
      }
    } else if (a.landed && a.onGround) {
      const destination = this.route.destination;
      if (!isWithinRunway(a.position, destination)) {
        const edge = a.position.z < destination.threshold - destination.length ? '末端'
          : a.position.z > destination.threshold ? '入口' : a.position.x < destination.x ? '左侧' : '右侧';
        this.events.push({type: 'failed', key: 'taxi', reason: `着陆滑行越界：机身位置驶出${this.route.destinationName}机场跑道${edge}。`});
      }
    } else if (!a.onGround && this.lowestPoint() < this.world.baseHeightAt(a.position.x, a.position.z) - FLIGHT.contactTolerance) {
      const destination = this.route.destination;
      const landing=this.landingStatus();
      if (landing.ready) {
        a.position.y += this.route.destination.elevation - this.lowestPoint(); a.onGround = true; a.landed = true;
        a.velocity.y = 0; a.verticalSpeed = 0; this.pitchTarget = 0; this.stalled = false;
        this.landingAlignment={elapsed:0,heading:a.heading-landing.heading};
        this.events.push({type: 'landed', key: 'airport', reason: 'Touchdown（安全着陆）：机身自动摆正，打开Wing brake（机翼减速板）后可按S加强减速，在跑道内停稳并避让停放的飞机与卡车。'});
      } else this.events.push({type: 'failed', key: 'ground', destructive: true, reason: this.landingFailureReason(landing)});
    }
    const success = !a.onGround && !this.stalled && !this.overspeed && !this.pitchLow && this.altitude() >= FLIGHT.completionHeight && a.airspeed >= FLIGHT.climbMinSpeed && a.airspeed <= Math.max(FLIGHT.climbMaxSpeed, this.route.cruiseSpeed * 1.05) && a.verticalSpeed > 0 && Math.abs(a.bank) <= FLIGHT.successBank && state.gear === 'UP' && state.flaps === 'CLEAN';
    this.completionSeconds = success ? this.completionSeconds + dt : 0;
    if (!this.climbComplete && this.completionSeconds >= FLIGHT.completionHoldSeconds) { this.climbComplete = true; this.events.push({ type: 'climb-complete', key: 'flight' }); }
    return this.events;
  }
}
