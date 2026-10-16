import { LANDSCAPE } from './config.js';

export const smoothRange = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

function hash(x, z, seed) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function terrainNoise(x, z, seed = LANDSCAPE.seed) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smoothRange(0, 1, x - ix), v = smoothRange(0, 1, z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v * (1 - u) + (d - b) * u * v;
}

export function mountainSeed(mountain) {
  return (LANDSCAPE.seed ^ Math.imul(Math.round(mountain.position[0]), 73856093) ^ Math.imul(Math.round(mountain.position[1]), 19349663)) >>> 0;
}

// 山脊、支脉与侵蚀纹理共享固定种子；固定高度网格同时用于近景和碰撞。
export function createMountainSurface(mountain, baseHeightAt) {
  const n = LANDSCAPE.terrain.segments, stride = n + 1, seed = mountainSeed(mountain);
  const heights = new Float32Array(stride * stride), positions = new Float32Array(stride * stride * 3);
  let peak = 0;
  for (let row = 0; row <= n; row++) for (let column = 0; column <= n; column++) {
    const u = column / n * 2 - 1, v = row / n * 2 - 1;
    const angle = Math.atan2(v, u), edge = 0.87 + 0.07 * Math.sin(angle * 5 + seed % 17) + 0.04 * Math.sin(angle * 9 + 1.3);
    const radius = Math.hypot(u, v) / edge;
    const noise = terrainNoise(u * 3.3 + 7, v * 3.3 + 11, seed);
    const ridge = 1 - Math.abs(terrainNoise(u * 3.5 + noise, v * 3.5 - noise, seed + 1) * 2 - 1);
    const fine = terrainNoise(u * 11, v * 11, seed + 2) - 0.5;
    let height = 0;
    if (radius < 1) {
      if (mountain.kind === 'danxia') {
        const wall = smoothRange(0, 0.25, 1 - radius);
        const terrace = 0.86 + 0.1 * smoothRange(0.25, 0.75, noise) + 0.04 * ridge;
        height = wall * terrace + fine * 0.008 * wall;
      } else {
        const envelope = (1 - radius * radius) ** 1.8;
        const spine = 0.79 + 0.1 * ridge + 0.1 * noise + fine * 0.018;
        const gullies = 0.97 + 0.03 * Math.sin(angle * 7 + radius * 4 + noise * 5);
        height = envelope * spine * gullies;
      }
    }
    const index = row * stride + column;
    heights[index] = height; peak = Math.max(peak, height);
  }
  const minX = mountain.position[0] - mountain.radius[0], minZ = mountain.position[1] - mountain.radius[1];
  const dx = mountain.radius[0] * 2 / n, dz = mountain.radius[1] * 2 / n;
  let minY = Infinity, maxY = -Infinity;
  for (let row = 0; row <= n; row++) for (let column = 0; column <= n; column++) {
    const index = row * stride + column, x = minX + column * dx, z = minZ + row * dz;
    const y = baseHeightAt(x, z) + heights[index] / peak * mountain.height;
    heights[index] = y; positions.set([x, y, z], index * 3);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { ...mountain, seed, n, heights, positions, dx, dz, minX, minZ, minY, maxY,
    maxX: minX + mountain.radius[0] * 2, maxZ: minZ + mountain.radius[1] * 2 };
}

// 直接定位同一网格三角形，增加画面精度不会让查高遍历更多山面。
export function sampleMountain(surface, x, z) {
  if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) return -Infinity;
  const gx = (x - surface.minX) / surface.dx, gz = (z - surface.minZ) / surface.dz;
  const column = Math.min(surface.n - 1, Math.floor(gx)), row = Math.min(surface.n - 1, Math.floor(gz));
  const u = gx - column, v = gz - row, i = row * (surface.n + 1) + column, h = surface.heights;
  if (u + v <= 1) return h[i] * (1 - u - v) + h[i + 1] * u + h[i + surface.n + 1] * v;
  return h[i + 1] * (1 - v) + h[i + surface.n + 1] * (1 - u) + h[i + surface.n + 2] * (u + v - 1);
}

export function mountainIndices(n, step = 1) {
  const indices = [];
  for (let row = 0; row < n; row += step) for (let column = 0; column < n; column += step) {
    const a = row * (n + 1) + column, b = a + step, c = a + (n + 1) * step, d = c + step;
    indices.push(a, c, b, b, c, d);
  }
  return indices;
}
