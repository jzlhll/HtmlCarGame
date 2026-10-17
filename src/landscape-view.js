import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDSCAPE, SCENERY, JOURNEY } from './config.js';
import { MountainView } from './mountain-view.js';
import { batchStaticMeshes } from './static-batch.js';

// 沿压缩航线绘制地景；建筑和山体直接读取逻辑共用数据。
export class LandscapeView extends THREE.Group {
  constructor(world) {
    super();
    let seed = LANDSCAPE.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    this.random = random;
    this.world = world;
    this.route = world.route;
    this.frameSegments = [];
    this.addGround();
    this.addRiver();
    this.addCity();
    this.addLandmarks();
    this.addFarmland();
    this.addWaterfall();
    this.addRegionalViews();
    batchStaticMeshes(this);
    this.mountains = new MountainView(world); this.add(this.mountains);
    this.textures = this.mountains.textures;
  }

  addGround() {
    const half = SCENERY.groundSize / 2, coordinates = new Set([25000, -55000, this.route.destination.threshold]);
    for (let i = 0; i <= JOURNEY.groundSegments; i++) coordinates.add(25000 - i / JOURNEY.groundSegments * SCENERY.groundSize);
    for (const [distance] of JOURNEY.elevationProfile) coordinates.add(-distance);
    const rows = [...coordinates].sort((a, b) => b - a), positions = [], indices = [];
    rows.forEach((z, row) => {
      for (const x of [-half, half]) positions.push(x, this.world.baseHeightAt(x, z) - 0.04, z);
      if (row) { const a = (row - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: SCENERY.colors.ground, roughness: 1}));
    ground.receiveShadow = true; this.add(ground);
  }

  addRegionalViews() {
    if (this.route.id < 2) return;
    const oval = (x, z, width, length, y, color) => {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({color, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));
      mesh.rotation.x = -Math.PI / 2; mesh.scale.set(width / 2, length / 2, 1); mesh.position.set(x, y, z); this.add(mesh); return mesh;
    };
    const island = JOURNEY.island, floor = this.world.baseHeightAt(island.x, island.z);
    oval(island.x, island.z, island.riverWidth, island.riverLength, floor + 0.06, 0x438f9b);
    oval(island.x, island.z, island.width + 50, island.length + 80, floor + 0.08, 0xc4bd91);
    oval(island.x, island.z, island.width, island.length, floor + 0.1, 0x708f60);
    const stone = new THREE.MeshStandardMaterial({color: 0xa1a394, roughness: 1, flatShading: true});
    const darkStone = new THREE.MeshStandardMaterial({color: 0x737d75, roughness: 1, flatShading: true});
    const face = (size, offset, material = stone) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(island.x + offset[0], floor + offset[1], island.z + offset[2]); this.add(mesh);
    };
    // 用石质面部、眉眼、侧分发块和长基座表现青年头像的轮廓。
    face([18, 38, 34], [0, 103, 76]);
    face([54, 6, 11], [0, 64, 82]);
    face([27, 5, 7], [-28, 125, 73], darkStone); face([27, 5, 7], [28, 125, 73], darkStone);
    face([34, 13, 19], [-31, 135, 66]); face([34, 13, 19], [31, 135, 66]);
    face([27, 40, 34], [-76, 92, 0]); face([27, 40, 34], [76, 92, 0]);
    for (let i = 0; i < 6; i++) {
      const hair = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), darkStone);
      hair.scale.set(40, 35, 48); hair.position.set(island.x - 68 + i * 25, floor + 149 + Math.sin(i * 0.7) * 12, island.z - 12);
      this.add(hair);
    }
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(10, 32, 6), new THREE.MeshStandardMaterial({color: 0x496e50}), 40);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const z = island.z + (i - 20) * 32, x = island.x + (i % 2 ? -1 : 1) * 140;
      dummy.position.set(x, floor + 16, z); dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix);
    }
    trees.computeBoundingSphere(); this.add(trees);
    if (this.route.id < 3) return;
    const lake = JOURNEY.lake;
    oval(lake.x, lake.z, lake.width + 180, lake.length + 140, lake.elevation + 0.025, 0xb2b79c);
    oval(lake.x, lake.z, lake.width, lake.length, lake.elevation + 0.07, 0x3c94a9);
    for (const [x, z, width, length] of [[-1500, -17900, 500, 800], [2100, -18800, 650, 1100], [-2200, -19700, 400, 500]]) {
      oval(x, z, width, length, lake.elevation + 0.12, 0x789468);
    }
    this.addPagoda();
  }

  addPagoda() {
    const tower = JOURNEY.pagoda, floor = this.world.baseHeightAt(tower.x, tower.z);
    const wall = new THREE.MeshStandardMaterial({color: 0xd3b77d, roughness: 0.85});
    const red = new THREE.MeshStandardMaterial({color: 0x964d38, roughness: 0.85});
    const gold = new THREE.MeshStandardMaterial({color: 0xc99a40, roughness: 0.7, side: THREE.DoubleSide});
    const box = (x, y, z, width, height, depth, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(tower.x + x, floor + y, tower.z + z); this.add(mesh);
    };
    for (let i = 0; i < tower.levels; i++) {
      const y = tower.height * i / tower.levels, height = tower.height / tower.levels, width = tower.width * (1 - i * 0.07);
      box(0, y + height * 0.43, 0, width, height * 0.86, width, wall);
      const roofWidth = width * tower.eaves;
      box(0, y + height * 0.83, 0, roofWidth * 0.94, height * 0.02, roofWidth * 0.94, gold);
      const half = roofWidth / 2, rim = [[half, 0.96, half], [0, 0.84, half], [-half, 0.96, half], [-half, 0.84, 0], [-half, 0.96, -half], [0, 0.84, -half], [half, 0.96, -half], [half, 0.84, 0]];
      const positions = [];
      for (let edge = 0; edge < rim.length; edge++) {
        for (const [x, rise, z] of [[0, 1, 0], rim[(edge + 1) % rim.length], rim[edge]]) positions.push(tower.x + x, floor + y + height * rise, tower.z + z);
      }
      const roof = new THREE.BufferGeometry(); roof.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); roof.computeVertexNormals(); this.add(new THREE.Mesh(roof, gold));
      for (const x of [-width * 0.48, width * 0.48]) for (const z of [-width * 0.48, width * 0.48]) box(x, y + height * 0.5, z, 8, height * 0.8, 8, red);
      for (const x of [-width * 0.25, width * 0.25]) box(x, y + height * 0.4, width / 2 + 0.1, width * 0.12, height * 0.35, 0.2, red);
    }
    const finial = new THREE.Mesh(new THREE.ConeGeometry(8, 45, 8), gold);
    finial.position.set(tower.x, floor + tower.height + 22.5, tower.z); this.add(finial);
  }

  surface(geometry, color, layer, y = 0) {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + this.world.baseHeightAt(position.getX(i), position.getZ(i)));
    geometry.computeVertexNormals();
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
            new THREE.Vector3(x + side * river.bridgeWidth * 0.4, this.world.baseHeightAt(x, point.z + z) + river.pylonHeight, point.z + z),
            new THREE.Vector3(x + side * river.bridgeWidth * 0.4, this.world.baseHeightAt(x, point.z + end) + river.bridgeHeight + 2, point.z + end), 1.8,
          ]);
        }
      }
    }
    for (const geometry of bridgeGeometries) {
      const position = geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + this.world.baseHeightAt(position.getX(i), position.getZ(i)));
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
    const sites = this.world.buildings.filter(site => site.name !== '瀑布岩壁');
    const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65 }), sites.length);
    const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: city.roofColor, roughness: 0.9}), sites.length);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    sites.forEach((site, index) => {
      dummy.position.set(site.x, this.world.baseHeightAt(site.x, site.z) + site.height / 2, site.z); dummy.scale.set(site.width, site.height, site.depth); dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix); buildings.setColorAt(index, color.setHex(site.color));
      dummy.position.y = this.world.baseHeightAt(site.x, site.z) + site.height + 2; dummy.scale.y = 4; dummy.updateMatrix(); roofs.setMatrixAt(index, dummy.matrix);
    });
    buildings.computeBoundingSphere(); roofs.computeBoundingSphere(); this.add(buildings, roofs);
  }

  addLandmarks() {
    const detail = LANDSCAPE.towers;
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    for (const tower of LANDSCAPE.landmarks) {
      const group = new THREE.Group(); group.name = tower.name;
      group.position.set(tower.position[0], this.world.baseHeightAt(...tower.position), tower.position[1]); this.add(group);
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

  addFarmland() {
    const count = 80, dummy = new THREE.Object3D(), color = new THREE.Color();
    const fields = new THREE.InstancedMesh(new THREE.PlaneGeometry(160, 190), new THREE.MeshStandardMaterial({roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1}), count);
    for (let i = 0; i < count; i++) {
      const x = (i % 10 - 4.5) * 180, z = -7200 - Math.floor(i / 10) * 210;
      dummy.position.set(x, this.world.baseHeightAt(x, z) + 0.012, z);
      const slope = (this.world.baseHeightAt(x, z + 1) - this.world.baseHeightAt(x, z - 1)) / 2;
      dummy.rotation.x = -Math.PI / 2 - Math.atan(slope); dummy.updateMatrix(); fields.setMatrixAt(i, dummy.matrix);
      fields.setColorAt(i, color.setHex([0x9eae62, 0x739c63, 0xc5b676, 0x557c53][i % 4]));
    }
    fields.computeBoundingSphere(); this.add(fields);
  }

  addWaterfall() {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 128;
    const context = canvas.getContext('2d'); context.fillStyle = '#9ddce4'; context.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 36; i++) { context.fillStyle = i % 2 ? '#e5f4ef' : '#70bdd0'; context.fillRect(i * 7 % 32, i * 19 % 128, 2, 16); }
    this.fallTexture = new THREE.CanvasTexture(canvas); this.fallTexture.colorSpace = THREE.SRGBColorSpace;
    this.fallTexture.wrapS = this.fallTexture.wrapT = THREE.RepeatWrapping; this.fallTexture.repeat.set(3, 4);
    for (const fall of this.world.waterfalls) {
      const height = fall.top - fall.bottom, z = fall.z + (fall.passable ? 0 : fall.depth + 0.3);
      const material = new THREE.MeshBasicMaterial({map: this.fallTexture, side: THREE.DoubleSide, transparent: fall.passable, opacity: fall.passable ? 0.72 : 1, depthWrite: !fall.passable});
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(fall.width, height), material);
      mesh.position.set(fall.x, (fall.top + fall.bottom) / 2, z); this.add(mesh);
      if (fall.source) {
        const positions = [], indices = [];
        for (let row = 0; row <= 10; row++) {
          const t = row / 10, x = THREE.MathUtils.lerp(fall.source.x, fall.x, t), y = THREE.MathUtils.lerp(fall.source.y, fall.top, t * t), z = THREE.MathUtils.lerp(fall.source.z, fall.z, t);
          for (const side of [-1, 1]) positions.push(x + side * fall.width * (0.35 + 0.15 * t), y, z);
          if (row) { const a = (row - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const stream = new THREE.BufferGeometry(); stream.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); stream.setIndex(indices); stream.computeVertexNormals(); this.add(new THREE.Mesh(stream, new THREE.MeshBasicMaterial({color: 0xa5dee2, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false})));
      }
      if (!fall.passable) {
        const rock = new THREE.Mesh(new THREE.BoxGeometry(fall.width, height, fall.depth), new THREE.MeshStandardMaterial({color: 0x638477, roughness: 1}));
        rock.position.set(fall.x, fall.bottom + height / 2, fall.z + fall.depth / 2); this.add(rock);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(fall.width * 0.8, 32), new THREE.MeshStandardMaterial({color: LANDSCAPE.river.waterColor}));
        pool.rotation.x = -Math.PI / 2; pool.position.set(fall.x, fall.bottom + 0.08, z + 80); this.add(pool);
      }
      const foam = new THREE.Mesh(new THREE.TorusGeometry(fall.width * 0.48, 6, 5, 24), new THREE.MeshBasicMaterial({color: 0xe3f3ee}));
      foam.rotation.x = Math.PI / 2; foam.position.set(fall.x, fall.bottom + 2, z + 20); this.add(foam);
    }
  }

  update(seconds, camera) { this.fallTexture.offset.y = -seconds * 0.7; this.mountains.update(camera); }
}
