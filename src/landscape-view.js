import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDSCAPE, SCENERY } from './config.js';

// 机场前方的固定河湾城市与群山；只负责地景，不推进玩法或新增地形碰撞。
export class LandscapeView extends THREE.Group {
  constructor() {
    super();
    let seed = LANDSCAPE.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    this.random = random;
    this.frameSegments = [];
    this.addRiver();
    this.addCity();
    this.addLandmarks();
    this.addMountains();
  }

  surface(geometry, color, layer, y = 0) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, polygonOffset: true,
      polygonOffsetFactor: -layer, polygonOffsetUnits: -layer });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    this.add(mesh);
    return mesh;
  }

  ribbon(points, width) {
    const positions = [], indices = [];
    for (let i = 0; i < points.length; i++) {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const dx = next.x - previous.x, dz = next.z - previous.z, length = Math.hypot(dx, dz);
      for (const side of [-1, 1]) positions.push(points[i].x - side * dz / length * width / 2, 0, points[i].z + side * dx / length * width / 2);
      if (i > 0) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }

  addRiver() {
    const river = LANDSCAPE.river;
    this.riverPaths = [river.points, river.tributary].map((coordinates, index) => {
      const curve = new THREE.CatmullRomCurve3(coordinates.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const points = curve.getPoints(river.samples);
      const scale = index ? 0.65 : 1;
      this.surface(this.ribbon(points, river.bankWidth * scale), river.bankColor, SCENERY.surfaceLayers.shoulder, 0.02);
      this.surface(this.ribbon(points, river.width * scale), river.waterColor, SCENERY.surfaceLayers.pavement, 0.05);
      return points;
    });
    const bridgeGeometries = [];
    for (const x of river.bridges) {
      const point = this.riverPaths[0].reduce((best, item) => Math.abs(item.x - x) < Math.abs(best.x - x) ? item : best);
      const deck = new THREE.BoxGeometry(river.bridgeWidth, 4, river.bridgeLength);
      deck.translate(x, river.bridgeHeight, point.z); bridgeGeometries.push(deck);
      for (const z of [-river.width * 0.6, river.width * 0.6]) {
        for (const side of [-1, 1]) {
          const pole = new THREE.BoxGeometry(7, river.pylonHeight, 7);
          pole.translate(x + side * river.bridgeWidth * 0.4, river.pylonHeight / 2, point.z + z);
          bridgeGeometries.push(pole);
          for (const end of [-river.bridgeLength * 0.45, 0, river.bridgeLength * 0.45]) this.frameSegments.push([
            new THREE.Vector3(x + side * river.bridgeWidth * 0.4, river.pylonHeight, point.z + z),
            new THREE.Vector3(x + side * river.bridgeWidth * 0.4, river.bridgeHeight + 2, point.z + end), 1.8,
          ]);
        }
      }
    }
    const bridge = new THREE.Mesh(mergeGeometries(bridgeGeometries), new THREE.MeshStandardMaterial({color: 0xc1bda4, roughness: 0.8}));
    this.add(bridge); bridgeGeometries.forEach(geometry => geometry.dispose());
  }

  addCity() {
    const city = LANDSCAPE.city, random = this.random;
    const width = city.columns * city.spacing, length = city.rows * city.spacing;
    const cityGround = new THREE.PlaneGeometry(width, length); cityGround.rotateX(-Math.PI / 2);
    cityGround.translate(...[city.center[0], 0, city.center[1]]);
    this.surface(cityGround, city.parkColor, 0.5, 0.005);
    const roadGeometries = [];
    for (let x = 0; x <= city.columns; x++) {
      const geometry = new THREE.PlaneGeometry(city.roadWidth, length); geometry.rotateX(-Math.PI / 2);
      geometry.translate(city.center[0] - width / 2 + x * city.spacing, 0, city.center[1]); roadGeometries.push(geometry);
    }
    for (let z = 0; z <= city.rows; z++) {
      const geometry = new THREE.PlaneGeometry(width, city.roadWidth); geometry.rotateX(-Math.PI / 2);
      geometry.translate(city.center[0], 0, city.center[1] - length / 2 + z * city.spacing); roadGeometries.push(geometry);
    }
    this.surface(mergeGeometries(roadGeometries), city.roadColor, SCENERY.surfaceLayers.shoulder, 0.015);
    roadGeometries.forEach(geometry => geometry.dispose());
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#7e9a9e'; context.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 24; row++) for (let column = 0; column < 8; column++) {
      context.fillStyle = random() > 0.8 ? '#d5d3ab' : random() > 0.4 ? '#3f6677' : '#a4bbc0';
      context.fillRect(column * 16 + 3, row * 10 + 3, 10, 6);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const sites = [];
    for (let row = 0; row < city.rows; row++) for (let column = 0; column < city.columns; column++) {
      const x = city.center[0] + (column - (city.columns - 1) / 2) * city.spacing;
      const z = city.center[1] + (row - (city.rows - 1) / 2) * city.spacing;
      const nearWater = this.riverPaths.some(points => points.some(point => Math.hypot(point.x - x, point.z - z) < LANDSCAPE.river.bankWidth / 2 + city.riverClearance));
      if (nearWater || LANDSCAPE.landmarks.some(tower => Math.hypot(tower.position[0] - x, tower.position[1] - z) < city.landmarkClearance) || random() < 0.14) continue;
      const height = city.minHeight + random() ** 1.7 * (city.maxHeight - city.minHeight);
      sites.push({ x, z, height, width: city.minWidth + random() * (city.maxWidth - city.minWidth), depth: city.minWidth + random() * (city.maxWidth - city.minWidth), color: city.colors[Math.floor(random() * city.colors.length)] });
    }
    const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65 }), sites.length);
    const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: city.roofColor, roughness: 0.9}), sites.length);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    sites.forEach((site, index) => {
      dummy.position.set(site.x, site.height / 2, site.z); dummy.scale.set(site.width, site.height, site.depth); dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix); buildings.setColorAt(index, color.setHex(site.color));
      dummy.position.y = site.height + 2; dummy.scale.y = 4; dummy.updateMatrix(); roofs.setMatrixAt(index, dummy.matrix);
    });
    buildings.computeBoundingSphere(); roofs.computeBoundingSphere(); this.add(buildings, roofs);
  }

  addLandmarks() {
    const detail = LANDSCAPE.towers;
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    for (const tower of LANDSCAPE.landmarks) {
      const group = new THREE.Group(); group.name = tower.name;
      group.position.set(tower.position[0], 0, tower.position[1]); this.add(group);
      const material = new THREE.MeshStandardMaterial({color: tower.color, metalness: 0.3, roughness: 0.5});
      const box = (x, y, z, width, height, depth) => {
        const mesh = new THREE.Mesh(boxGeometry, material); mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); group.add(mesh);
      };
      const frame = (a, b, radius = detail.strutRadius) => this.frameSegments.push([
        new THREE.Vector3(...a).add(group.position), new THREE.Vector3(...b).add(group.position), radius,
      ]);
      if (tower.kind === 'gateway') {
        const width = tower.radius * 2, holeBottom = tower.height * 0.82, holeTop = tower.height * 0.94;
        box(0, holeBottom / 2, 0, width, holeBottom, width * 0.48);
        for (const side of [-1, 1]) box(side * width * 0.42, (holeBottom + holeTop) / 2, 0, width * 0.16, holeTop - holeBottom, width * 0.48);
        box(0, (holeTop + tower.height) / 2, 0, width, tower.height - holeTop, width * 0.48);
        for (let i = 0; i < 4; i++) frame([-width / 2, tower.height * i / 4, -width * 0.25], [width / 2, tower.height * i / 4, -width * 0.25]);
        continue;
      }
      const top = tower.kind === 'canton' ? tower.height * 0.75 : tower.height;
      const point = (t, angle) => {
        const radius = tower.kind === 'canton' ? tower.radius * (0.36 + 2.4 * (t - 0.53) ** 2) : tower.kind === 'bamboo' ? tower.radius * (1 - t ** 2.5) + 1 : tower.radius * (1 - t * 0.5) * (1 + 0.12 * Math.cos(angle * 3));
        const twist = tower.kind === 'bamboo' ? 0 : t * Math.PI * 0.7;
        return [Math.cos(angle + twist) * radius, t * top, Math.sin(angle + twist) * radius];
      };
      if (tower.kind === 'canton') {
        const core = new THREE.Mesh(new THREE.CylinderGeometry(10, 15, top, 12), material); core.position.y = top / 2; group.add(core);
        const deck = new THREE.Mesh(new THREE.CylinderGeometry(35, 32, 24, 32), material); deck.position.y = top * 0.96; group.add(deck);
        frame([0, top, 0], [0, tower.height, 0], 3);
      } else {
        const positions = [], indices = [];
        for (let level = 0; level <= detail.levels; level++) for (let side = 0; side <= detail.segments; side++) positions.push(...point(level / detail.levels, side / detail.segments * Math.PI * 2));
        for (let level = 0; level < detail.levels; level++) for (let side = 0; side < detail.segments; side++) {
          const a = level * (detail.segments + 1) + side, b = a + detail.segments + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); group.add(new THREE.Mesh(geometry, material));
      }
      for (let level = 0; level < detail.levels; level++) {
        const t = level / detail.levels, next = (level + 1) / detail.levels;
        for (let side = 0; side < detail.struts; side++) {
          const angle = side / detail.struts * Math.PI * 2, adjacent = (side + 1) / detail.struts * Math.PI * 2;
          frame(point(t, angle), point(next, tower.kind === 'bamboo' ? adjacent : angle));
          frame(point(t, angle), point(t, adjacent), detail.ringRadius);
        }
      }
    }
    const segments = this.frameSegments, dummy = new THREE.Object3D(), direction = new THREE.Vector3(), center = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const frames = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshStandardMaterial({color: detail.frameColor, roughness: 0.7}), segments.length);
    segments.forEach(([a, b, radius], index) => {
      direction.subVectors(b, a); dummy.position.copy(center.addVectors(a, b).multiplyScalar(0.5));
      dummy.scale.set(radius, direction.length(), radius); dummy.quaternion.setFromUnitVectors(up, direction.normalize()); dummy.updateMatrix(); frames.setMatrixAt(index, dummy.matrix);
    });
    frames.computeBoundingSphere(); this.add(frames); this.frameSegments.length = 0;
  }

  addMountains() {
    const terrain = LANDSCAPE.terrain, positions = [], colors = [], random = this.random;
    const low = new THREE.Color(terrain.lowColor), high = new THREE.Color(terrain.highColor), snow = new THREE.Color(terrain.snowColor), color = new THREE.Color();
    for (const mountain of LANDSCAPE.mountains) {
      const rings = [];
      for (let ring = 0; ring <= terrain.rings; ring++) {
        const t = ring / terrain.rings, radius = 1 - t;
        const points = [];
        for (let side = 0; side < terrain.segments; side++) {
          const angle = side / terrain.segments * Math.PI * 2, jitter = 0.86 + random() * 0.25;
          points.push([mountain.position[0] + Math.cos(angle) * mountain.radius[0] * radius * jitter + t * 180,
            mountain.height * t ** 1.25 * (0.9 + random() * 0.15), mountain.position[1] + Math.sin(angle) * mountain.radius[1] * radius * jitter]);
        }
        rings.push(points);
      }
      const triangle = (a, b, c) => {
        const height = (a[1] + b[1] + c[1]) / (3 * mountain.height);
        color.copy(low).lerp(high, height);
        if (mountain.height > 1700 && height > terrain.snowLine) color.lerp(snow, 0.85);
        color.multiplyScalar(0.9 + random() * 0.18);
        for (const vertex of [a, b, c]) { positions.push(...vertex); colors.push(color.r, color.g, color.b); }
      };
      for (let ring = 0; ring < terrain.rings; ring++) for (let side = 0; side < terrain.segments; side++) {
        const next = (side + 1) % terrain.segments;
        triangle(rings[ring][side], rings[ring + 1][side], rings[ring][next]);
        triangle(rings[ring][next], rings[ring + 1][side], rings[ring + 1][next]);
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    this.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, flatShading: true})));
  }
}
