import { AIRCRAFT } from './config.js';

const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const courses = { 'head-on': '迎面', 'same-way': '同向', crossing: '侧向', diagonal: '斜向' };

// 单一有效时钟管理航程、遭遇、奖励和停机判定；暂停由 Game 阻止推进。
export class Mission {
  constructor(aircraft, flight, world) {
    this.aircraft = aircraft; this.flight = flight; this.world = world;
    this.route = world.route;
    this.started = false; this.elapsed = 0; this.flightSeconds = 0; this.path = [[aircraft.position.x, aircraft.position.z]];
    this.sampleElapsed = 0; this.contacts = []; this.nextEncounter = 0;
    this.ceilingFault = false; this.ceilingRecovery = 0; this.waterfallsPassed = new Set();
    this.parkSeconds = 0; this.approaching = false; this.offCourse = false;
    this.events = [];
  }

  start() { this.started = true; }
  get remaining() { return Math.max(0, this.route.deadline - this.elapsed); }
  get runwayDistance() { return this.aircraft.position.z - this.route.destination.threshold; }
  get parkDistance() { const p = this.route.destination.park; return Math.hypot(this.aircraft.position.x - p.x, this.aircraft.position.z - p.z); }
  get targetAltitude() { return Math.min(this.world.baseHeightAt(this.aircraft.position.x, this.aircraft.position.z) + this.route.cruiseHeight, this.route.destination.elevation + Math.max(0, (this.runwayDistance + this.route.touchdownOffset) * Math.tan(this.route.glideSlope))); }
  get sector() { return this.route.sectors.find(item => -this.aircraft.position.z <= -item.z + 1000) || this.route.sectors.at(-1); }
  get alert() { return this.ceilingFault || this.contacts.some(contact => contact.danger); }

  spawn(spec, index) {
    const a = this.aircraft, forward = {x: Math.sin(a.heading), z: -Math.cos(a.heading)}, right = {x: Math.cos(a.heading), z: Math.sin(a.heading)};
    const direction = spec.course === 'head-on' ? [-forward.x, -forward.z] : spec.course === 'same-way' ? [forward.x, forward.z] : spec.course === 'crossing' ? [right.x, right.z] : [right.x * 0.7 - forward.x * 0.7, right.z * 0.7 - forward.z * 0.7];
    const velocity = {x: direction[0] * spec.speed, y: 0, z: direction[1] * spec.speed};
    const position = {x: a.position.x - (velocity.x - a.velocity.x) * this.route.radarLead + right.x * spec.offset,
      y: Math.max(this.world.baseHeightAt(a.position.x, a.position.z) + 100, a.position.y + a.velocity.y * this.route.radarLead + spec.height), z: a.position.z - (velocity.z - a.velocity.z) * this.route.radarLead + right.z * spec.offset};
    this.contacts.push({id: index, kind: spec.kind, course: spec.course, position, previous: {...position}, velocity,
      heading: Math.atan2(velocity.x, -velocity.z), age: 0, danger: false, warned: false});
  }

  birdOffsets(contact) {
    if (contact.offsets && contact.offsetHeading === contact.heading && contact.offsetKind === contact.kind) return contact.offsets;
    const cosine = Math.cos(contact.heading), sine = Math.sin(contact.heading);
    contact.offsets = contact.kind !== 'geese' ? [[0, AIRCRAFT.bodyHeight * this.route.trafficScale, 0]] : Array.from({length: this.route.birdCount}, (_, i) => {
      const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
      const x = side * row * this.route.birdSpacing, z = row * this.route.birdSpacing;
      return [x * cosine - z * sine, (i % 3 - 1) * this.route.birdVerticalSpacing, x * sine + z * cosine];
    });
    contact.offsetHeading = contact.heading; contact.offsetKind = contact.kind;
    contact.offsetMin = [Infinity, Infinity, Infinity]; contact.offsetMax = [-Infinity, -Infinity, -Infinity];
    for (const offset of contact.offsets) for (let i = 0; i < 3; i++) {
      contact.offsetMin[i] = Math.min(contact.offsetMin[i], offset[i]); contact.offsetMax[i] = Math.max(contact.offsetMax[i], offset[i]);
    }
    return contact.offsets;
  }

  trafficCollision(contact, sweep = this.world.prepareBodySweep(this.aircraft, this.flight.previous)) {
    const plane = contact.kind === 'aircraft', offsets = this.birdOffsets(contact), bounds = this.world.sweepBounds;
    const horizontal = plane ? this.route.trafficRadius * this.route.trafficScale : this.route.birdRadius * this.route.birdScale;
    const vertical = plane ? this.route.trafficHeight * this.route.trafficScale : this.route.birdHeight * this.route.birdScale;
    const position = contact.position, previous = contact.previous;
    // 以双方完整扫掠范围预筛选，保留迎面高速相遇与大雁阵形边缘的接触。
    for (let i = 0; i < 3; i++) {
      const axis = ['x', 'y', 'z'][i], radius = i === 1 ? vertical : horizontal;
      if (Math.max(previous[axis], position[axis]) + contact.offsetMax[i] + radius < bounds.min[axis]
        || Math.min(previous[axis], position[axis]) + contact.offsetMin[i] - radius > bounds.max[axis]) return false;
    }
    for (const offset of offsets) for (const {from, to, radius} of sweep) {
      const rx = horizontal + radius, ry = vertical + radius;
      const x = (from.x - previous.x - offset[0]) / rx, y = (from.y - previous.y - offset[1]) / ry, z = (from.z - previous.z - offset[2]) / rx;
      const dx = (to.x - position.x - offset[0]) / rx - x, dy = (to.y - position.y - offset[1]) / ry - y, dz = (to.z - position.z - offset[2]) / rx - z;
      const length = dx * dx + dy * dy + dz * dz;
      const t = length ? clamp(-(x * dx + y * dy + z * dz) / length, 0, 1) : 0;
      if ((x + dx * t) ** 2 + (y + dy * t) ** 2 + (z + dz * t) ** 2 <= 1) return true;
    }
    return false;
  }

  step(dt) {
    const events = this.events, a = this.aircraft, flight = this.flight;
    events.length = 0;
    if (!this.started) return events;
    this.elapsed += dt;
    if (!a.onGround && !a.landed) this.flightSeconds += dt;
    if (this.elapsed > this.route.deadline + 1e-8) return [{type: 'failed', key: 'deadline', reason: `${this.route.deadline} 秒已到，尚未在${this.route.destinationName}机场停机圈内停妥。`}];
    this.sampleElapsed += dt;
    if (this.sampleElapsed >= this.route.sampleSeconds) {
      this.sampleElapsed %= this.route.sampleSeconds;
      this.path.push([a.position.x, a.position.z]);
    }
    const collision = this.world.collision(a, flight.previous);
    if (collision) return [{type: 'failed', key: 'obstacle', reason: `飞机碰撞了${collision}。`}];
    if (!a.landed && !a.onGround && this.runwayDistance < this.route.approachDistance && !this.approaching) {
      this.approaching = true;
      events.push({type: 'approach', key: 'airport', reason: `Approach（${this.route.destinationName}进近）：减速至 160–180 kt，G 放轮，W 打开机翼减速板，沿跑道下降。`});
    }
    const high = a.position.y > this.route.ceiling;
    this.ceilingRecovery = a.position.y < this.route.ceilingClear ? this.ceilingRecovery + dt : 0;
    if (high && !this.ceilingFault) {
      this.ceilingFault = true;
      events.push({type: 'ceiling', key: 'altitude', reason: 'Altitude limit（超出 10000 米）：动力故障！立即降低高度。'});
    } else if (this.ceilingFault && this.ceilingRecovery >= this.route.ceilingRecovery) {
      this.ceilingFault = false;
      events.push({type: 'fault-recovered', key: 'altitude', reason: 'Power restored（动力恢复）：已回到安全高度。'});
    }
    a.powerLimit = this.ceilingFault ? this.route.faultPower : 1;
    const offCourse = Math.abs(a.position.x) > this.route.courseDeviation;
    if (offCourse && !this.offCourse) events.push({type: 'off-course', key: 'route', reason: 'Off course（偏离航线）：参考左侧轨迹，回到目的地方向，倒计时仍继续。'});
    this.offCourse = offCourse;
    for (const fall of this.world.waterfalls) {
      if (a.onGround || this.waterfallsPassed.has(fall.id)) continue;
      const previous = flight.previous.position;
      const crossed = (previous.z - fall.z) * (a.position.z - fall.z) <= 0 && previous.z !== a.position.z;
      const t = crossed ? (fall.z - previous.z) / (a.position.z - previous.z) : 0;
      const x = previous.x + (a.position.x - previous.x) * t, y = previous.y + (a.position.y - previous.y) * t;
      const through = fall.passable && crossed && Math.abs(x - fall.x) + AIRCRAFT.wingspan / 2 < fall.width / 2 && y > fall.bottom + 15 && y < fall.top - 15;
      const over = !fall.passable && Math.hypot(a.position.x - fall.x, a.position.z - fall.z) < fall.bonusRadius && a.position.y > fall.top + fall.clearanceMin && a.position.y < fall.top + fall.clearanceMax;
      if (through || over) {
        this.waterfallsPassed.add(fall.id);
        events.push({type: 'waterfall', key: fall.id, reason: through ? '🎉 恭喜！你安全穿越了空中瀑布。' : '🎉 恭喜！你安全飞越了瀑布。'});
      }
    }
    while (this.nextEncounter < this.route.encounters.length && this.flightSeconds >= this.route.encounters[this.nextEncounter].at) {
      if (!a.onGround && !a.landed) this.spawn(this.route.encounters[this.nextEncounter], this.nextEncounter);
      this.nextEncounter++;
    }
    for (const contact of this.contacts) {
      Object.assign(contact.previous, contact.position); contact.age += dt;
      for (const axis of ['x', 'y', 'z']) contact.position[axis] += contact.velocity[axis] * dt;
      const rx = contact.position.x - a.position.x, rz = contact.position.z - a.position.z;
      const vx = contact.velocity.x - a.velocity.x, vz = contact.velocity.z - a.velocity.z;
      const squared = vx * vx + vz * vz;
      const closest = squared ? -(rx * vx + rz * vz) / squared : 0;
      contact.closestSeconds = Math.max(0, closest);
      contact.danger = closest >= 0 && closest < this.route.radarHorizon && Math.hypot(rx + vx * closest, rz + vz * closest) < this.route.radarDanger && Math.abs(contact.position.y - a.position.y - a.velocity.y * closest) < this.route.radarVertical;
      if (!contact.warned && (contact.danger || contact.age <= dt * 2)) {
        contact.warned = true;
        events.push({type: 'traffic', key: `contact-${contact.id}`, reason: `${contact.kind === 'geese' ? 'Geese（大雁群）' : 'Traffic（其他飞机）'}：${courses[contact.course]}接近，请参考雷达箭头，调整方向或高度避让。`});
      }
      if (!a.onGround && this.trafficCollision(contact, this.world.bodySweep)) return [{type: 'failed', key: 'traffic', reason: contact.kind === 'geese' ? '飞机撞上了大雁群。' : '飞机与其他飞机发生碰撞。'}];
    }
    let live = 0;
    for (const contact of this.contacts) if (contact.age < this.route.contactLifetime) this.contacts[live++] = contact;
    this.contacts.length = live;
    const parked = a.landed && a.onGround && this.parkDistance + Math.hypot(AIRCRAFT.length / 2, AIRCRAFT.wingspan / 2) <= this.route.destination.park.radius && a.airspeed <= this.route.parkedSpeed;
    this.parkSeconds = parked ? this.parkSeconds + dt : 0;
    if (this.parkSeconds >= this.route.parkHold) events.push({type: 'complete', key: 'parking', reason: `已安全抵达${this.route.destinationName}，在目标停机圈内停妥。`});
    return events;
  }
}
