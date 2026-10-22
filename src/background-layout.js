import { BACKGROUND, HOME } from './config.js';
import { backgroundOrder } from './random.js';

const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

// 只保存背景事件的位置元数据；所有天体等速移动，确定后的相对位置不再改变。
export class BackgroundLayout {
  constructor(plan) {
    if (!plan.length) throw new Error('Missing background plan');
    this.plan = plan;
    this.views = new Map();
  }

  getFrame(time, viewWidth, viewHeight, menu) {
    if (!Number.isFinite(time) || !Number.isFinite(viewWidth) || !Number.isFinite(viewHeight)
      || viewWidth <= 0 || viewHeight <= 0) throw new Error('Invalid background viewport or time');
    const elapsed = Math.max(0, time), latest = Math.floor(elapsed / BACKGROUND.spawnIntervalSeconds);
    const key = menu ? 'menu' : 'game';
    let state = this.views.get(key);
    if (!state || state.width !== viewWidth || state.height !== viewHeight || latest < state.latest) {
      state = { width: viewWidth, height: viewHeight, menu: !!menu, latest: -1, events: [], orders: new Map() };
      this.views.set(key, state);
    }
    for (let event = state.latest + 1; event <= latest; event++) {
      const item = this.createEvent(state, event);
      state.events.push(item);
      if (state.events.length > BACKGROUND.models.length) state.events.shift();
      state.latest = event;
    }
    const speed = Math.round(BACKGROUND.planetBaseSpeed * BACKGROUND.speedScale);
    for (const item of state.events) item.y = item.startY - (elapsed - item.event * BACKGROUND.spawnIntervalSeconds) * speed;
    return state.events;
  }

  createEvent(state, event) {
    const round = Math.floor(event / this.plan.length);
    if (!state.orders.has(round)) state.orders.set(round, backgroundOrder(BACKGROUND.seed, round, this.plan.length));
    for (const cached of state.orders.keys()) if (cached < round - 1) state.orders.delete(cached);
    const plan = this.plan[state.orders.get(round)[event % this.plan.length]];
    const definition = BACKGROUND.models[plan.planet];
    const constellation = BACKGROUND.constellations.some(chart => chart.kind === definition.kind);
    const halo = constellation ? 1.25 : definition.kind === 'sun' ? BACKGROUND.sunHaloScale : definition.kind === 'saturn' ? 2.05 : 1.045;
    // 银河也采用完整旋转半径，不能用初始扁椭圆的高度计算避让。
    const rightOnly = state.menu && definition.radius >= HOME.largeBodyMinRadius;
    const fit = Math.min(1, state.width * BACKGROUND.maxModelWidthFraction / (2 * plan.scale * halo),
      state.height * BACKGROUND.maxModelHeightFraction / (2 * plan.scale * halo),
      rightOnly ? state.width * HOME.largeBodyMaxWidthFraction / (2 * plan.scale * halo) : 1,
      rightOnly ? Math.max(0, state.width / 2 - HOME.largeBodyCenterGap) / (2 * plan.scale * halo) : 1);
    const radius = plan.scale * fit, extent = radius * halo, halfWidth = extent;
    const margin = Math.max(0, state.width / 2 - halfWidth);
    const centerGap = Math.min(HOME.largeBodyCenterGap, Math.max(0, state.width / 2 - halfWidth * 2));
    const left = rightOnly ? halfWidth + centerGap : -margin, right = margin;
    const preferred = clamp((rightOnly ? Math.abs(plan.x) : plan.x) * state.width, left, right);
    const speed = Math.round(BACKGROUND.planetBaseSpeed * BACKGROUND.speedScale);
    const spacing = BACKGROUND.spawnIntervalSeconds * speed;
    const nominal = state.height / 2 + extent + event * spacing;
    const gap = BACKGROUND.modelGap;
    const obstacles = state.events.map(item => ({ x: item.x, travelY: item.startY + item.event * spacing, extent: item.extent }));
    let free = [[left, right]];
    for (const obstacle of obstacles) {
      const separation = extent + obstacle.extent + gap;
      const dy = nominal - obstacle.travelY;
      if (Math.abs(dy) >= separation) continue;
      const reach = Math.sqrt(Math.max(0, separation * separation - dy * dy));
      const blockedLeft = obstacle.x - reach, blockedRight = obstacle.x + reach;
      free = free.flatMap(([lower, upper]) => {
        if (blockedRight <= lower || blockedLeft >= upper) return [[lower, upper]];
        const remaining = [];
        if (blockedLeft > lower) remaining.push([lower, blockedLeft]);
        if (blockedRight < upper) remaining.push([blockedRight, upper]);
        return remaining;
      });
    }
    let x = preferred, travelY = nominal;
    if (free.length) {
      x = free.map(([lower, upper]) => clamp(preferred, lower, upper))
        .reduce((best, value) => Math.abs(value - preferred) < Math.abs(best - preferred) ? value : best);
    } else {
      // 横向没有空隙时，只增加新事件在屏幕外的进入距离。
      const candidates = new Set([preferred, left, right]);
      for (const obstacle of obstacles) {
        const separation = extent + obstacle.extent + gap;
        candidates.add(clamp(obstacle.x - separation, left, right));
        candidates.add(clamp(obstacle.x + separation, left, right));
      }
      let best = Infinity;
      for (const candidate of candidates) {
        let ceiling = nominal;
        for (const obstacle of obstacles) {
          const separation = extent + obstacle.extent + gap, dx = candidate - obstacle.x;
          if (Math.abs(dx) >= separation) continue;
          ceiling = Math.max(ceiling, obstacle.travelY + Math.sqrt(Math.max(0, separation * separation - dx * dx)));
        }
        if (ceiling < best || (ceiling === best && Math.abs(candidate - preferred) < Math.abs(x - preferred))) {
          best = ceiling;
          x = candidate;
        }
      }
      travelY = best;
    }
    return { event, plan, radius, halfWidth, extent, x, startY: travelY - event * spacing };
  }
}
