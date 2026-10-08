import { SYSTEMS } from './config.js';

const priorities = { blocked: 1, 'low-speed': 2, 'pitch-high': 3, 'pitch-low': 3, overspeed: 2, stall: 4 };

// 告警按进入事件去重；操纵输入不会刷新或提前清除安全提示。
export class Prompts {
  constructor() {
    this.seen = new Set();
    this.current = null;
    this.type = null;
    this.remaining = 0;
  }

  receive(event) {
    const priority = priorities[event.type];
    if (!event.reason || !priority) {
      if (this.type === 'blocked' || event.type === 'complete' || event.type === 'failed') this.clear();
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
