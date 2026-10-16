import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDSCAPE, JOURNEY, SCENERY } from './config.js';
import { mountainIndices, sampleMountain, smoothRange, terrainNoise } from './terrain.js';
import { createTerrainDetail, createTerrainMaterial } from './terrain-material.js';

// 只消费世界山面；细节切换、岩纹和树冠不改变逻辑地形或悬空岩体。
export class MountainView extends THREE.Group {
  constructor(world) {
    super();
    this.world = world;
    this.settings = LANDSCAPE.terrain;
    this.detail = createTerrainDetail();
    this.material = createTerrainMaterial(this.detail);
    this.textures = [this.detail];
    this.surfaces = []; this.forest = [];
    this.makeTreeResources();
    for (const surface of world.mountainSurfaces) this.addMountain(surface);
    for (const solid of world.solids) this.addRock(solid);
  }

  makeTreeResources() {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.025, 0.045, 0.65, 5); trunk.translate(0, 0.325, 0);
    const trunkColors = new Float32Array(trunk.attributes.position.count * 3);
    for (let i = 0; i < trunkColors.length; i += 3) trunkColors.set([0.3, 0.24, 0.15], i);
    trunk.setAttribute('color', new THREE.Float32BufferAttribute(trunkColors, 3)); parts.push(trunk.toNonIndexed()); trunk.dispose();
    for (const [x, y, z, width, height] of [[0, 0.73, 0, 0.27, 0.31], [-0.18, 0.6, 0.04, 0.24, 0.25], [0.16, 0.58, -0.08, 0.25, 0.26], [0.02, 0.55, 0.17, 0.23, 0.24]]) {
      const crown = new THREE.IcosahedronGeometry(1, 1), positions = crown.attributes.position, colors = [];
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
        const shape = 1 + 0.08 * Math.sin(px * 17 + pz * 13 + py * 9);
        positions.setXYZ(i, x + px * width * shape, y + py * height * shape, z + pz * width * shape);
        const light = 0.76 + (py + 1) * 0.16; colors.push(light, light, light * 0.94);
      }
      crown.computeVertexNormals(); crown.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); parts.push(crown);
    }
    this.treeGeometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
    this.treeMaterial = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1});
    // 远景交叉树片共享一张树冠纹理，保留透空轮廓而不逐棵绘制枝叶。
    const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    let seed = LANDSCAPE.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    ctx.fillStyle = '#6c6352'; ctx.fillRect(124, 102, 8, 149);
    for (let i = 0; i < 1600; i++) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random());
      const x = 128 + Math.cos(angle) * radius * 100, y = 96 + Math.sin(angle) * radius * 89;
      const shade = Math.round(135 + random() * 72 + (1 - y / size) * 33);
      ctx.fillStyle = `rgb(${shade},${shade},${Math.round(shade * 0.9)})`;
      ctx.beginPath(); ctx.ellipse(x, y, 3 + random() * 9, 3 + random() * 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    this.textures.push(texture);
    const a = new THREE.PlaneGeometry(0.78, 1.05); a.translate(0, 0.525, 0);
    const b = a.clone(); b.rotateY(Math.PI / 2);
    this.treeSpriteGeometry = mergeGeometries([a, b]); a.dispose(); b.dispose();
    this.treeSpriteMaterial = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide, alphaTest: 0.55, fog: true});
  }

  addMountain(surface) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(surface.positions, 3));
    geometry.setIndex(mountainIndices(surface.n)); geometry.computeVertexNormals();
    const settings = this.settings, positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const colors = [], biomes = [], vegetation = new Float32Array(positions.count);
    const rock = new THREE.Color(settings.rockColor), soil = new THREE.Color(settings.soilColor), green = new THREE.Color(settings.lowColor);
    const red = new THREE.Color(settings.danxiaColor), snow = new THREE.Color(settings.snowColor), ground = new THREE.Color(SCENERY.colors.ground), color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), slope = normals.getY(i);
      const patch = terrainNoise(x * 0.0025, z * 0.0025, surface.seed);
      const cover = smoothRange(...settings.vegetationSlope, slope) * (1 - smoothRange(settings.treeLine - settings.treeTransition, settings.treeLine, y));
      const relief = y - this.world.baseHeightAt(x, z), edge = smoothRange(0, 24, relief);
      const plants = cover * (0.48 + patch * 0.52);
      vegetation[i] = plants * smoothRange(0.35, 0.65, slope);
      color.copy(surface.kind === 'danxia' ? red : rock).lerp(soil, smoothRange(0.55, 0.9, slope) * 0.28).lerp(green, plants);
      color.multiplyScalar(0.84 + terrainNoise(x * 0.008, z * 0.008, surface.seed + 2) * 0.28);
      const snowCover = smoothRange(settings.snowHeight, settings.snowHeight + settings.snowTransition, y) * smoothRange(0.2, 0.7, slope);
      color.lerp(snow, snowCover);
      color.lerp(ground, 1 - edge);
      // 静态山谷遮蔽在建图时计算，避免每帧为整条航线重绘巨大阴影贴图。
      let occlusion = 0;
      for (const distance of [70, 200, 550]) {
        const [sx, sy, sz] = settings.sunDirection;
        if (sampleMountain(surface, x + sx / sy * distance, z + sz / sy * distance) > y + distance + 2) { occlusion = 0.8; break; }
      }
      colors.push(color.r, color.g, color.b); biomes.push(plants, surface.kind === 'danxia' ? 1 : 0, occlusion, edge);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('biome', new THREE.Float32BufferAttribute(biomes, 4));
    const meshes = [geometry, this.reduceGeometry(geometry, surface.n, 2), this.reduceGeometry(geometry, surface.n, 4)].map(item => {
      item.computeBoundingSphere(); const mesh = new THREE.Mesh(item, this.material); mesh.receiveShadow = true; this.add(mesh); return mesh;
    });
    const bounds = new THREE.Box3(new THREE.Vector3(surface.minX, surface.minY, surface.minZ), new THREE.Vector3(surface.maxX, surface.maxY, surface.maxZ));
    this.surfaces.push({meshes, bounds, level: -1});
    this.plantMountain(surface, vegetation);
  }

  reduceGeometry(source, n, step) {
    const geometry = new THREE.BufferGeometry();
    // 顶点和法线共享，仅切换索引；远山不重新生成轮廓或分配缓冲区。
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(mountainIndices(n, step)); return geometry;
  }

  plantMountain(surface, vegetation) {
    const spacing = this.settings.forestSpacing, chunks = new Map(), selected = [], n = surface.n;
    let seed = surface.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    let count = 0;
    for (let z = surface.minZ + spacing / 2; z < surface.maxZ; z += spacing) for (let x = surface.minX + spacing / 2; x < surface.maxX; x += spacing) {
      const px = x + (random() - 0.5) * spacing * 0.85, pz = z + (random() - 0.5) * spacing * 0.85;
      const gx = Math.round((px - surface.minX) / surface.dx), gz = Math.round((pz - surface.minZ) / surface.dz);
      const cover = vegetation[gz * (n + 1) + gx];
      const y = sampleMountain(surface, px, pz);
      if (random() > cover * 0.88 || y < this.world.baseHeightAt(px, pz) + 3 || this.world.heightAt(px, pz) > y + 1) continue;
      const tree = {x: px, y: y - 0.3, z: pz, scale: this.settings.treeHeight[0] + random() * (this.settings.treeHeight[1] - this.settings.treeHeight[0]), yaw: random() * Math.PI * 2, color: this.settings.canopyColors[Math.floor(random() * this.settings.canopyColors.length)]};
      count++;
      if (selected.length < this.settings.maxTrees) selected.push(tree);
      else { const replace = Math.floor(random() * count); if (replace < selected.length) selected[replace] = tree; }
    }
    for (const tree of selected) {
      const key = `${Math.floor(tree.x / this.settings.forestCell)},${Math.floor(tree.z / this.settings.forestCell)}`;
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key).push(tree);
    }
    for (const trees of chunks.values()) this.addForestChunk(trees);
  }

  addForestChunk(trees) {
    if (!trees.length) return;
    const near = new THREE.InstancedMesh(this.treeGeometry, this.treeMaterial, trees.length);
    const far = new THREE.InstancedMesh(this.treeSpriteGeometry, this.treeSpriteMaterial, trees.length);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    trees.forEach((tree, i) => {
      dummy.position.set(tree.x, tree.y, tree.z); dummy.rotation.y = tree.yaw; dummy.scale.setScalar(tree.scale); dummy.updateMatrix();
      near.setMatrixAt(i, dummy.matrix); far.setMatrixAt(i, dummy.matrix);
      color.setHex(tree.color); near.setColorAt(i, color); far.setColorAt(i, color);
    });
    near.computeBoundingBox(); near.computeBoundingSphere(); far.computeBoundingSphere();
    this.add(near, far); this.forest.push({near, far, bounds: near.boundingBox, close: false});
  }

  addRock(solid) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(solid.positions, 3)); geometry.computeVertexNormals();
    const cap = ['张家界石柱', '空中圆形山', '斜伸岩柱'].includes(solid.name), colors = [], biomes = [], color = new THREE.Color();
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const top = cap && geometry.attributes.normal.getY(i) > 0.65;
      color.setHex(top ? JOURNEY.rockColors.cap : solid.color);
      colors.push(color.r, color.g, color.b); biomes.push(top ? 0.95 : 0, 0, 0, 1);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('biome', new THREE.Float32BufferAttribute(biomes, 4));
    const mesh = new THREE.Mesh(geometry, this.material); mesh.receiveShadow = true; this.add(mesh);
    if (!cap) return;
    const trees = [], {x, z, top, radius, lean, floor} = solid.cap;
    for (let i = 0; i < Math.min(70, Math.round(radius * 0.22)); i++) {
      const angle = i * 2.399963, r = Math.sqrt((i + 0.5) / Math.min(70, Math.round(radius * 0.22))) * radius * 0.6;
      trees.push({x: x + lean + Math.cos(angle) * r, y: floor + top - 0.2, z: z + Math.sin(angle) * r,
        scale: 12 + (i % 7) * 1.4, yaw: angle, color: this.settings.canopyColors[i % this.settings.canopyColors.length]});
    }
    this.addForestChunk(trees);
  }

  update(camera) {
    const settings = this.settings;
    for (const item of this.surfaces) {
      const distance = item.bounds.distanceToPoint(camera.position);
      let level = distance > settings.lodDistances[1] ? 2 : distance > settings.lodDistances[0] ? 1 : 0;
      if (item.level >= 0 && level !== item.level) {
        const boundary = settings.lodDistances[Math.min(level, item.level)];
        if (Math.abs(distance - boundary) < settings.lodHysteresis) level = item.level;
      }
      item.meshes.forEach((mesh, i) => { mesh.visible = i === level; }); item.level = level;
    }
    for (const item of this.forest) {
      const distance = item.bounds.distanceToPoint(camera.position);
      if (item.close ? distance > settings.treeNear + 100 : distance < settings.treeNear - 100) item.close = !item.close;
      item.near.visible = item.close && distance < settings.treeFar;
      item.far.visible = !item.close && distance < settings.treeFar;
    }
  }
}
