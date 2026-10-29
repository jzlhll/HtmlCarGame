import { WIDTH, HEIGHT, CLASSIC_PERIOD, PUZZLE_PERIOD, LOCK_DELAY, CLASSIC_KINDS, PUZZLE_KINDS, cellsOf, dropInterval } from './config.js';

export class Game {
  constructor(mode, initialSpeed = 1, seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
    this.state = {
      mode, status: 'ready', initialSpeed: mode === 'classic' ? 1 : initialSpeed,
      speed: mode === 'classic' ? 1 : initialSpeed, level: 1, elapsed: 0, periodElapsed: 0,
      score: 0, lines: 0, pieces: 0, rng: seed || 1, bag: [], queue: [],
      board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill('')),
      active: null, fallElapsed: 0, lockElapsed: 0, lockResets: 0,
      bonusRemaining: 0, bonusPending: false,
    };
    this.events = [];
    this.revision = 0;
    if (mode === 'puzzle') {
      for (let y = HEIGHT - 6; y < HEIGHT; y++) {
        const hole = Math.floor(this.random() * WIDTH);
        for (let x = 0; x < WIDTH; x++) {
          this.state.board[y][x] = x !== hole && this.random() < 0.73 ? 'G' : '';
        }
        if (this.state.board[y].every(value => !value)) this.state.board[y][(hole + 1) % WIDTH] = 'G';
      }
      this.state.bonusRemaining = this.nextBonusInterval();
    }
    while (this.state.queue.length < 4) this.state.queue.push(this.draw());
    this.spawn();
  }

  random() {
    let x = this.state.rng;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state.rng = x >>> 0;
    return this.state.rng / 4294967296;
  }

  nextBonusInterval() { return 120000 + Math.floor(this.random() * 60001); }

  draw() {
    const s = this.state;
    if (!s.bag.length) {
      s.bag = [...(s.mode === 'classic' ? CLASSIC_KINDS : PUZZLE_KINDS)];
      for (let i = s.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]];
      }
    }
    return s.bag.pop();
  }

  spawn() {
    const s = this.state;
    let kind;
    if (s.bonusPending) {
      kind = 'bonus';
      s.bonusPending = false;
      s.bonusRemaining = this.nextBonusInterval();
      this.events.push('bonus');
    } else {
      kind = s.queue.shift();
      s.queue.push(this.draw());
    }
    const width = Math.max(...cellsOf({ kind, rotation: 0 }).map(cell => cell[0])) + 1;
    s.active = { kind, rotation: 0, x: Math.floor((WIDTH - width) / 2), y: 0 };
    s.fallElapsed = 0; s.lockElapsed = 0; s.lockResets = 0;
    if (!this.fits(s.active)) this.finish('gameOver');
    this.revision++;
  }

  fits(piece) {
    return cellsOf(piece).every(([x, y]) => {
      const px = piece.x + x, py = piece.y + y;
      return px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT &&
        (piece.kind === 'bonus' || !this.state.board[py][px]);
    });
  }

  landingY(piece = this.state.active) {
    if (piece.kind === 'bonus') {
      for (let y = HEIGHT - 1; y >= piece.y; y--) if (!this.state.board[y][piece.x]) return y;
      return null;
    }
    let y = piece.y;
    while (this.fits({ ...piece, y: y + 1 })) y++;
    return y;
  }

  grounded() {
    const a = this.state.active;
    return a.kind === 'bonus' ? this.landingY() === a.y : !this.fits({ ...a, y: a.y + 1 });
  }

  move(dx) {
    const s = this.state;
    if (s.status !== 'playing') return false;
    const next = { ...s.active, x: s.active.x + dx };
    if (!this.fits(next)) return false;
    const wasGrounded = this.grounded();
    s.active = next;
    if (wasGrounded && s.lockResets < 15) { s.lockElapsed = 0; s.lockResets++; }
    this.revision++;
    return true;
  }

  rotate(direction = 1) {
    const s = this.state;
    if (s.status !== 'playing' || s.active.kind === 'bonus' || s.active.kind === 'O') return false;
    const rotation = (s.active.rotation + direction + 4) % 4;
    const wasGrounded = this.grounded();
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [0, -2]]) {
      const next = { ...s.active, rotation, x: s.active.x + dx, y: s.active.y + dy };
      if (this.fits(next)) {
        s.active = next;
        if (wasGrounded && s.lockResets < 15) { s.lockElapsed = 0; s.lockResets++; }
        this.revision++;
        return true;
      }
    }
    return false;
  }

  hardDrop() {
    const s = this.state;
    if (s.status !== 'playing') return;
    const y = this.landingY();
    if (y === null) { this.events.push('noSpace'); return; }
    s.score += (y - s.active.y) * 2;
    s.active.y = y;
    this.lock();
  }

  lock() {
    const s = this.state, a = s.active;
    let count = 0;
    if (a.kind === 'bonus') {
      if (s.board[a.y][a.x] || this.landingY() !== a.y) return;
      s.board.splice(a.y, 1);
      count = 1;
      this.events.push('starClear');
    } else {
      for (const [x, y] of cellsOf(a)) s.board[a.y + y][a.x + x] = a.kind;
      const remaining = s.board.filter(row => !row.every(Boolean));
      count = HEIGHT - remaining.length;
      s.board = remaining;
      this.events.push(count ? 'clear' : 'lock');
    }
    while (s.board.length < HEIGHT) s.board.unshift(Array(WIDTH).fill(''));
    s.lines += count;
    s.score += ([0, 100, 300, 500, 800, 1200][count] || count * 300) * s.speed;
    s.pieces++;
    this.spawn();
    this.events.push('checkpoint');
    this.revision++;
  }

  finish(status) {
    this.state.status = status;
    this.events.push(status, 'checkpoint');
    this.revision++;
  }

  // 小步更新保持下落、锁定和关卡计时独立于显示帧率。
  step(dt, softDrop = false) {
    const s = this.state;
    if (s.status !== 'playing') return;
    s.elapsed += dt;
    s.periodElapsed += dt;
    const period = s.mode === 'classic' ? CLASSIC_PERIOD : PUZZLE_PERIOD;
    if (s.periodElapsed >= period) {
      if (s.mode === 'classic' && s.level === 7) {
        s.periodElapsed = period;
        this.finish('completed');
        return;
      }
      s.periodElapsed -= period;
      if (s.mode === 'classic') s.level++;
      s.speed++;
      this.events.push('speed', 'checkpoint');
      this.revision++;
    }
    if (s.mode === 'puzzle' && !s.bonusPending) {
      s.bonusRemaining = Math.max(0, s.bonusRemaining - dt);
      if (s.bonusRemaining === 0) { s.bonusPending = true; this.events.push('bonusReady'); this.revision++; }
    }
    const interval = softDrop ? Math.min(45, dropInterval(s.speed)) : dropInterval(s.speed);
    if (softDrop && !this.softDropping) s.fallElapsed = Math.min(s.fallElapsed, interval);
    this.softDropping = softDrop;
    s.fallElapsed += dt;
    while (s.fallElapsed >= interval) {
      s.fallElapsed -= interval;
      const target = this.landingY();
      if (target !== null && target > s.active.y) {
        s.active.y++;
        s.lockElapsed = 0;
        if (softDrop) s.score++;
        this.revision++;
      }
    }
    if (this.grounded()) {
      s.lockElapsed += dt;
      if (s.lockElapsed >= LOCK_DELAY) this.lock();
    } else s.lockElapsed = 0;
  }
}
