import { WORLD, GAME, MODES } from './config.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class SurvivalGame {
  constructor() {
    this.bullets = Array.from({ length: GAME.maxBullets }, () => ({ active: false, id: 0, x: 0, y: 0, vx: 0, vy: 0 }));
    this.player = { x: 0, y: 0, dx: 0, dy: 0 };
    this.bounds = { width: WORLD.width, height: WORLD.height };
    this.mode = 'normal';
    this.reset();
    this.state = 'ready';
  }

  reset() {
    this.time = 0;
    this.countdown = GAME.countdown;
    this.returnTime = 0;
    this.spawnCredit = 0;
    this.count = 0;
    this.bulletId = 0;
    this.dodged = 0;
    this.crossedGoal = false;
    this.player.x = this.player.y = this.player.dx = this.player.dy = 0;
    for (const bullet of this.bullets) bullet.active = false;
    this.state = 'countdown';
  }

  spawn() {
    const bullet = this.bullets.find(item => !item.active);
    if (!bullet) return;
    const { width, height } = this.bounds;
    const horizontal = Math.random() < width / (width + height);
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = horizontal ? (Math.random() - 0.5) * width : side * (width / 2 + 3);
    const y = horizontal ? side * (height / 2 + 3) : (Math.random() - 0.5) * height;
    const aimed = Math.random() < 0.6;
    const targetX = aimed ? this.player.x + (Math.random() - 0.5) * 32 : (Math.random() - 0.5) * width;
    const targetY = aimed ? this.player.y + (Math.random() - 0.5) * 32 : (Math.random() - 0.5) * height;
    const distance = Math.hypot(targetX - x, targetY - y);
    const mode = MODES[this.mode];
    const speed = Math.min(mode.maxSpeed, mode.speed + this.time * 0.2) * (0.85 + Math.random() * 0.3);
    Object.assign(bullet, { active: true, id: ++this.bulletId, x, y, vx: (targetX - x) / distance * speed, vy: (targetY - y) / distance * speed });
    this.count++;
  }

  setBounds(width, height) {
    this.bounds.width = width;
    this.bounds.height = height;
    this.player.x = clamp(this.player.x, -width / 2 + 2, width / 2 - 2);
    this.player.y = clamp(this.player.y, -height / 2 + 2, height / 2 - 2);
  }

  movePlayer(dt, input) {
    this.player.dx = input.x;
    this.player.dy = input.y;
    this.player.x = clamp(this.player.x + input.x * WORLD.playerSpeed * dt, -this.bounds.width / 2 + 2, this.bounds.width / 2 - 2);
    this.player.y = clamp(this.player.y + input.y * WORLD.playerSpeed * dt, -this.bounds.height / 2 + 2, this.bounds.height / 2 - 2);
  }

  step(dt, input) {
    if (this.state === 'returning') {
      this.returnTime = Math.max(0, this.returnTime - dt);
      if (this.returnTime < 1e-8) { this.returnTime = 0; this.state = 'over'; }
      return;
    }
    if (this.state === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown <= GAME.countdown - GAME.expandDuration + 1e-8) this.movePlayer(dt, input);
      if (this.countdown < 1e-8) { this.countdown = 0; this.state = 'playing'; }
      return;
    }
    if (this.state !== 'playing') return;
    const oldX = this.player.x;
    const oldY = this.player.y;
    this.movePlayer(dt, input);
    const mode = MODES[this.mode];
    this.spawnCredit += Math.min(mode.maxRate, mode.rate + this.time * mode.acceleration) * dt;
    while (this.spawnCredit >= 1) { this.spawnCredit--; this.spawn(); }
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      // 在子弹与飞机的相对运动线段上检测，避免低帧率时穿透。
      const startX = bullet.x - oldX;
      const startY = bullet.y - oldY;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const moveX = bullet.x - this.player.x - startX;
      const moveY = bullet.y - this.player.y - startY;
      const lengthSq = moveX * moveX + moveY * moveY;
      const t = lengthSq ? clamp(-(startX * moveX + startY * moveY) / lengthSq, 0, 1) : 0;
      if (Math.hypot(startX + moveX * t, startY + moveY * t) < WORLD.playerRadius + WORLD.bulletRadius) {
        this.state = 'over';
        return;
      }
      if (Math.abs(bullet.x) > this.bounds.width / 2 + 6 || Math.abs(bullet.y) > this.bounds.height / 2 + 6) {
        bullet.active = false;
        this.count--;
        this.dodged++;
      }
    }
    this.time += dt;
    if (this.time >= GAME.goal) this.crossedGoal = true;
  }
}
