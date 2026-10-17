import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AIRCRAFT, SURFACE_APPEARANCE } from './config.js';
import { fuselageSection } from './model-geometry.js';
import { surfaceTexture, modelGeometry } from './surface-assets.js';

function fuselageGeometry() { return modelGeometry('fuselage'); }

function addMesh(parent, geometry, material, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// 同一可动部件内按材质合并，减少窗户、风扇叶片与轮毂的独立绘制。
function batchAircraft(group) {
  const animated = new Set([...group.userData.flaps, ...group.userData.gearLegs]);
  const sourceGeometries = new Set();
  group.traverse(object => { if (object.isMesh) sourceGeometries.add(object.geometry); });
  group.updateMatrixWorld(true);
  for (const root of [group, ...animated]) {
    const buckets = new Map(), inverse = root.matrixWorld.clone().invert();
    const visit = object => {
      for (const child of object.children) {
        if (animated.has(child) || child === group.userData.navigationLights) continue;
        if (child.isMesh) {
          if (!buckets.has(child.material)) buckets.set(child.material, []);
          buckets.get(child.material).push(child);
        }
        visit(child);
      }
    };
    visit(root);
    for (const [material, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => {
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        // 带纹理的材质保留UV，合批后蒙皮接缝与表面凹凸继续对齐。
        const textured = material.map || material.bumpMap || material.roughnessMap;
        for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal' && !(textured && name === 'uv')) geometry.deleteAttribute(name);
        geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
        return geometry;
      });
      const mesh = new THREE.Mesh(mergeGeometries(parts), material);
      mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
      for (const original of meshes) original.removeFromParent();
      parts.forEach(geometry => geometry.dispose());
    }
  }
  const liveGeometries = new Set();
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (object.isMesh) liveGeometries.add(object.geometry);
    object.matrixAutoUpdate = object === group || animated.has(object);
  });
  for (const geometry of sourceGeometries) if (!liveGeometries.has(geometry) && !geometry.userData.sharedAsset) geometry.dispose();
}

export function createAircraft() {
  const group = new THREE.Group();
  group.userData.flaps = [];
  group.userData.gearLegs = [];
  const detail = surfaceTexture('paint-detail');
  const white = new THREE.MeshStandardMaterial({ color: 0xe5e9e6, roughness: 0.62, metalness: 0.12, roughnessMap: detail, bumpMap: detail, bumpScale: SURFACE_APPEARANCE.paintBump });
  const wing = new THREE.MeshStandardMaterial({ color: 0xd0d8d7, roughness: 0.72, roughnessMap: detail, bumpMap: detail, bumpScale: SURFACE_APPEARANCE.paintBump });
  group.userData.skinMaterials = [white, wing];
  const teal = new THREE.MeshStandardMaterial({ color: 0x244f60, roughness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc4ad71, metalness: 0.3, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x172f3b, metalness: 0.55, roughness: 0.14, envMapIntensity: 1.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x252c2e, roughness: 0.95, bumpMap: surfaceTexture('rubber-detail'), bumpScale: SURFACE_APPEARANCE.rubberBump });
  const metal = new THREE.MeshStandardMaterial({ color: 0x92a3a7, metalness: 0.82, roughness: 0.5, roughnessMap: surfaceTexture('metal-detail'), bumpMap: surfaceTexture('metal-detail'), bumpScale: SURFACE_APPEARANCE.metalBump });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263b45, roughness: 0.85 });
  addMesh(group, fuselageGeometry(), white, [0, AIRCRAFT.bodyHeight, 0]);
  const stripeGeometry = new THREE.BoxGeometry(0.025, 0.22, 25);
  for (const side of [-1, 1]) {
    addMesh(group, stripeGeometry, teal, [side * 1.98, 3.72, -0.7]);
    const windowGeometry = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 18; i++) {
      const z = -9.8 + i * 1.15, {radius, rise} = fuselageSection(z);
      const angle = Math.asin((4.43 - AIRCRAFT.bodyHeight - rise) / radius);
      const skinX = Math.cos(angle) * radius;
      const window = addMesh(group, windowGeometry, glass, [side * (skinX + 0.008), 4.43, z], [0, 0, side * angle]);
      window.scale.set(0.03, 0.23, 0.18);
      const frame = addMesh(group, modelGeometry('window-trim'), white, [side * (skinX + 0.015), 4.43, z], [0, 0, side * angle]);
      frame.scale.set(0.025, 0.245, 0.195);
    }
    SURFACE_APPEARANCE.doorPositions.forEach((z, index) => addMesh(group, modelGeometry(`door-${side}-${index}`), wing));
    addMesh(group, modelGeometry(`main-wing-${side}`), wing, [0, 3.05, 0]);
    addMesh(group, modelGeometry(`wing-leading-${side}`), metal, [0, 3.05, 0]);
    const flap = new THREE.Group();
    flap.position.set(side * 7, 2.94, 3.7);
    addMesh(flap, new THREE.BoxGeometry(6.4, 0.13, 1.2), wing, [0, 0, 0.5]);
    group.add(flap);
    group.userData.flaps.push(flap);
    addMesh(group, modelGeometry(`tailplane-${side}`), wing, [0, 4.65, 12.3]);
    addMesh(group, new THREE.BoxGeometry(0.16, 1.2, 1.8), teal, [side * 17.4, 3.5, 6.2], [0, 0, side * -0.18]);
    const engine = new THREE.Group();
    group.add(engine);
    engine.position.set(side * 6.15, 2.05, -0.3);
    addMesh(engine, modelGeometry('engine-shell'), white);
    addMesh(engine, modelGeometry('engine-duct'), dark);
    addMesh(engine, modelGeometry('engine-exhaust'), metal);
    addMesh(engine, new THREE.TorusGeometry(0.965, 0.055, 8, SURFACE_APPEARANCE.engineSegments), metal, [0, 0, -1.98]);
    addMesh(engine, new THREE.CircleGeometry(0.83, SURFACE_APPEARANCE.engineSegments), dark, [0, 0, -1.28], [0, Math.PI, 0]);
    addMesh(engine, modelGeometry('engine-fan'), metal);
    const spinner = addMesh(engine, new THREE.SphereGeometry(0.24, 20, 12), metal, [0, 0, -1.72]);
    spinner.scale.z = 1.6;
    addMesh(group, new THREE.BoxGeometry(0.4, 1.1, 1.7), wing, [side * 6.15, 3.05, 0.1]);
  }
  const fin = new THREE.Shape();
  fin.moveTo(11.5, 0); fin.lineTo(15.5, 6.2); fin.lineTo(18.6, 6.6); fin.lineTo(18.4, 0); fin.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: 0.26, bevelEnabled: false });
  finGeometry.rotateY(-Math.PI / 2);
  addMesh(group, finGeometry, teal, [0.13, 4.6, 0]);
  addMesh(group, new THREE.BoxGeometry(0.28, 0.45, 2.3), gold, [0, 9.1, 17]);
  for (const side of [-1, 1]) {
    const positions = [], indices = [], rows = 16, columns = 16;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows, z = -17.35 + t * 2.5;
      const {radius: skinRadius, rise} = fuselageSection(z), radius = skinRadius + 0.035;
      for (let column = 0; column <= columns; column++) {
        const angle = 0.8 - t * 0.2 + column / columns * (0.71 + t * 0.2);
        positions.push(side * Math.cos(angle) * radius, AIRCRAFT.bodyHeight + rise + Math.sin(angle) * radius, z);
      }
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + columns + 1;
      if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
      else indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    addMesh(group, geometry, glass);
  }
  const tireGeometry = modelGeometry('tire');
  const hubGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12);
  for (const [x, z] of [[0, AIRCRAFT.noseWheelZ], [-AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ], [AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0, z);
    leg.userData.baseX = x;
    group.add(leg);
    group.userData.gearLegs.push(leg);
    addMesh(leg, new THREE.CylinderGeometry(0.1, 0.14, 1.6, 8), metal, [0, 1.55, 0]);
    addMesh(leg, new THREE.CylinderGeometry(0.055, 0.055, 0.8, 8), metal, [0, 1.2, 0.16], [0.45, 0, 0]);
    addMesh(leg, new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), metal, [0, 0.95, -0.13], [-0.7, 0, 0]);
    for (const offset of [-0.23, 0.23]) {
      addMesh(leg, tireGeometry, rubber, [offset, 0.48, 0], [0, 0, Math.PI / 2]);
      addMesh(leg, hubGeometry, metal, [offset, 0.48, 0], [0, 0, Math.PI / 2]);
      const cap=addMesh(leg,new THREE.TorusGeometry(0.15,0.025,6,20),dark,[offset+Math.sign(offset)*0.17,0.48,0],[0,Math.PI/2,0]);
      for (let bolt=0;bolt<6;bolt++) addMesh(leg,new THREE.SphereGeometry(0.025,6,4),metal,
        [cap.position.x,0.48+Math.cos(bolt/6*Math.PI*2)*0.105,Math.sin(bolt/6*Math.PI*2)*0.105]);
    }
  }
  const navigationLights = new THREE.Group();
  const lightGeometry = new THREE.SphereGeometry(AIRCRAFT.navigationLightRadius, 8, 6);
  for (const light of AIRCRAFT.navigationLights) {
    const marker = new THREE.Mesh(lightGeometry, new THREE.MeshBasicMaterial({ color: light.color, toneMapped: false }));
    marker.position.set(...light.position);
    navigationLights.add(marker);
  }
  navigationLights.visible = false;
  group.add(navigationLights);
  group.userData.navigationLights = navigationLights;
  group.scale.set(AIRCRAFT.wingspan / 35, 1, AIRCRAFT.length / 38);
  batchAircraft(group);
  return group;
}
