import { SYSTEMS } from './config.js';

const priorities = { 'truck-hit': 3, blocked: 1, waterfall: 1 };

// 这里只管理短时操作反馈；飞行安全与角度信息由顶部持续状态显示。
export class Prompts {
  constructor() {
    this.seen = new Set();
    this.current = null;
    this.type = null;
    this.remaining = 0;
  }

  receive(event) {
    if (event.type==='blocked' && ['extension-speed','bird-thrust-lock'].includes(event.condition)) return;
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
