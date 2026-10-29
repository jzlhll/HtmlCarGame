import { GAME, MODES, REPLAY, WORLD } from './config.js';

const CAPACITY = Math.ceil(REPLAY.duration * REPLAY.sampleRate) + 2;
const STRIDE = 6 + GAME.maxBullets * 3;
const round = value => Math.round(value * 1000) / 1000;
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e7;

function validClip(clip) {
  if (!clip || clip.format !== 1 || !Object.hasOwn(MODES, clip.mode)) return false;
  if (!finite(clip.startTime) || !finite(clip.endTime) || clip.startTime < 0 || clip.endTime <= REPLAY.duration + 1e-8) return false;
  if (Math.abs(clip.endTime - clip.startTime - REPLAY.duration) > 1e-6) return false;
  if (!Array.isArray(clip.frames) || clip.frames.length < 2 || clip.frames.length > CAPACITY) return false;
  let previous = -1;
  for (const frame of clip.frames) {
    if (!frame || !finite(frame.time) || frame.time <= previous || frame.time > clip.endTime) return false;
    if (!finite(frame.width) || !finite(frame.height) || frame.width <= 0 || frame.height <= 0) return false;
    if (!Array.isArray(frame.player) || frame.player.length !== 3 || !frame.player.every(finite)) return false;
    if (!Array.isArray(frame.bullets) || frame.bullets.length % 4 || frame.bullets.length > GAME.maxBullets * 4) return false;
    const slots = new Set();
    for (let i = 0; i < frame.bullets.length; i += 4) {
      const [slot, id, x, y] = frame.bullets.slice(i, i + 4);
      if (!Number.isInteger(slot) || slot < 0 || slot >= GAME.maxBullets || slots.has(slot)) return false;
      if (!Number.isSafeInteger(id) || id <= 0 || !finite(x) || !finite(y)) return false;
      slots.add(slot);
    }
    previous = frame.time;
  }
  return clip.frames[0].time <= clip.startTime && Math.abs(previous - clip.endTime) < 1e-8;
}

// 环形缓冲只保留最近五秒；回放复用现有场景和预分配弹幕槽位。
export class FlightReplay {
  constructor(onStorageError = () => {}, storage) {
    this.onStorageError = onStorageError;
    this.samples = new Float64Array(CAPACITY * STRIDE);
    this.nextBullets = new Float64Array(GAME.maxBullets * 3);
    this.model = {
      state: 'replay', time: 0, count: 0,
      player: { x: 0, y: 0, dx: 0 },
      bounds: { width: WORLD.width, height: WORLD.height },
      bullets: Array.from({ length: GAME.maxBullets }, () => ({ active: false, x: 0, y: 0 })),
    };
    this.clip = null;
    this.stop();
    this.resetRecording();
    let raw;
    try {
      this.storage = storage ?? globalThis.localStorage;
      raw = this.storage.getItem(REPLAY.storageKey);
    } catch { this.onStorageError(); }
    try {
      const clip = JSON.parse(raw || 'null');
      if (validClip(clip)) this.clip = clip;
    } catch { /* 损坏或不兼容的回放不参与播放。 */ }
  }

  resetRecording() {
    this.writeIndex = 0;
    this.sampleCount = 0;
    this.lastSampleTime = -Infinity;
  }

  capture(game, force = false) {
    if (!force && game.time - this.lastSampleTime < 1 / REPLAY.sampleRate - 1e-8) return;
    const replace = this.sampleCount > 0 && Math.abs(game.time - this.lastSampleTime) < 1e-8;
    const index = replace ? (this.writeIndex + CAPACITY - 1) % CAPACITY : this.writeIndex;
    const offset = index * STRIDE;
    const data = this.samples;
    data[offset] = game.time;
    data[offset + 1] = game.bounds.width;
    data[offset + 2] = game.bounds.height;
    data[offset + 3] = game.player.x;
    data[offset + 4] = game.player.y;
    data[offset + 5] = game.player.dx;
    for (let i = 0; i < GAME.maxBullets; i++) {
      const bullet = game.bullets[i];
      const slot = offset + 6 + i * 3;
      data[slot] = bullet.active ? bullet.id : 0;
      data[slot + 1] = bullet.x;
      data[slot + 2] = bullet.y;
    }
    if (!replace) {
      this.writeIndex = (this.writeIndex + 1) % CAPACITY;
      this.sampleCount = Math.min(CAPACITY, this.sampleCount + 1);
    }
    this.lastSampleTime = game.time;
  }

  finishRecording(game) {
    if (game.time <= REPLAY.duration + 1e-8) return false;
    this.capture(game, true);
    const startTime = game.time - REPLAY.duration;
    const offsets = [];
    for (let i = 0; i < this.sampleCount; i++) offsets.push(((this.writeIndex - this.sampleCount + i + CAPACITY) % CAPACITY) * STRIDE);
    let first = 0;
    while (first + 1 < offsets.length && this.samples[offsets[first + 1]] <= startTime) first++;
    const frames = offsets.slice(first).map(offset => {
      const bullets = [];
      for (let i = 0; i < GAME.maxBullets; i++) {
        const slot = offset + 6 + i * 3;
        if (this.samples[slot]) bullets.push(i, this.samples[slot], round(this.samples[slot + 1]), round(this.samples[slot + 2]));
      }
      return {
        time: this.samples[offset], width: this.samples[offset + 1], height: this.samples[offset + 2],
        player: [round(this.samples[offset + 3]), round(this.samples[offset + 4]), round(this.samples[offset + 5])], bullets,
      };
    });
    const clip = { format: 1, mode: game.mode, startTime, endTime: game.time, frames };
    if (!validClip(clip)) return false;
    this.clip = clip;
    this.stop();
    try { this.storage?.setItem(REPLAY.storageKey, JSON.stringify(clip)); }
    catch { this.onStorageError(); }
    return true;
  }

  stop() {
    this.playing = false;
    this.idleTime = 0;
    this.elapsed = 0;
    this.frameIndex = 0;
  }

  advance(dt) {
    if (!this.clip) return;
    this.idleTime += dt;
    if (!this.playing) {
      if (this.idleTime + 1e-8 < REPLAY.interval) return;
      this.idleTime -= REPLAY.interval;
      this.playing = true;
      this.elapsed = 0;
      this.frameIndex = 0;
    } else this.elapsed += dt;
    if (this.elapsed + 1e-8 >= REPLAY.duration) { this.playing = false; return; }
    const time = this.clip.startTime + this.elapsed;
    const frames = this.clip.frames;
    while (this.frameIndex + 1 < frames.length && frames[this.frameIndex + 1].time <= time) this.frameIndex++;
    const current = frames[this.frameIndex];
    const next = frames[Math.min(this.frameIndex + 1, frames.length - 1)];
    const blend = next.time > current.time ? (time - current.time) / (next.time - current.time) : 0;
    this.model.time = time;
    this.model.bounds.width = current.width;
    this.model.bounds.height = current.height;
    this.model.player.x = current.player[0] + (next.player[0] - current.player[0]) * blend;
    this.model.player.y = current.player[1] + (next.player[1] - current.player[1]) * blend;
    this.model.player.dx = current.player[2] + (next.player[2] - current.player[2]) * blend;
    this.nextBullets.fill(0);
    for (let i = 0; i < next.bullets.length; i += 4) {
      const offset = next.bullets[i] * 3;
      this.nextBullets[offset] = next.bullets[i + 1];
      this.nextBullets[offset + 1] = next.bullets[i + 2];
      this.nextBullets[offset + 2] = next.bullets[i + 3];
    }
    for (const bullet of this.model.bullets) bullet.active = false;
    this.model.count = current.bullets.length / 4;
    for (let i = 0; i < current.bullets.length; i += 4) {
      const index = current.bullets[i];
      const bullet = this.model.bullets[index];
      const offset = index * 3;
      const sameBullet = this.nextBullets[offset] === current.bullets[i + 1];
      bullet.active = true;
      bullet.x = current.bullets[i + 2] + (sameBullet ? (this.nextBullets[offset + 1] - current.bullets[i + 2]) * blend : 0);
      bullet.y = current.bullets[i + 3] + (sameBullet ? (this.nextBullets[offset + 2] - current.bullets[i + 3]) * blend : 0);
    }
  }
}
