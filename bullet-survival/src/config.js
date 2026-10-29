export const APP_VERSION = 'v1.0.0';
export const WORLD = { width: 120, height: 100, playerRadius: 0.7, bulletRadius: 0.56, playerSpeed: 32 };
export const GAME = { goal: 20, step: 1 / 120, maxBullets: 480, maxFrame: 0.1, countdown: 4, expandDuration: 2.5, collapseDuration: 2 };
export const MODES = {
  practice: { label: '练习', rate: 5, acceleration: 0.3, speed: 15, maxRate: 22, maxSpeed: 25 },
  normal: { label: '标准', rate: 9, acceleration: 0.7, speed: 19, maxRate: 38, maxSpeed: 34 },
  expert: { label: '极限', rate: 15, acceleration: 1.1, speed: 24, maxRate: 55, maxSpeed: 43 },
};
export const STORAGE_KEY = 'bullet-survival:settings:v1';
export const REPLAY = { duration: 5, interval: 10, sampleRate: 30, storageKey: 'bullet-survival:replay:v1' };
