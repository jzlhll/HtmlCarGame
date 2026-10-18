import { SYSTEMS } from './config.js';

const priorities = { 'truck-hit': 3, blocked: 1, waterfall: 1, ceiling: 1 };

// 管理短时反馈；最高点反馈与飞行安全信息统一在顶部显示。
export class Prompts {
  constructor() {
    this.seen = new Set();
    this.current = null;
    this.type = null;
    this.remaining = 0;
  }

  receive(event) {
    if (event.type==='blocked' && ['extension-speed','bird-thrust-lock','lightning-thrust-lock'].includes(event.condition)) return;
    const priority = priorities[event.type];
    if (!event.reason || !priority) {
      if (this.type === 'blocked' || event.type === 'complete' || event.type === 'failed' || event.type === 'destroyed') this.clear();
      return;
    }
    if (this.seen.has(event.id)) return;
    this.seen.add(event.id);
    if (this.current && priorities[this.type] > priority) return;
    this.current = event.reason;
    this.type = event.type;
    this.remaining = SYSTEMS.promptSeconds;
  }

  clear() {
    this.current = null;
    this.type = null;
    this.remaining = 0;
  }

  step(dt) {
    if (!this.current) return;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining === 0) this.clear();
  }
}
