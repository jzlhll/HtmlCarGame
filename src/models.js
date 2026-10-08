import * as THREE from 'three';
import { AIRCRAFT } from './config.js';

function fuselageGeometry() {
  const rings = [[-19, 0.04, 0.1], [-18.2, 0.75, 0.05], [-16, 1.7, 0], [-12, 2, 0],
    [9, 2, 0], [13.5, 1.5, 0.3], [17, 0.6, 0.7], [19, 0.03, 1]];
  const segments = 24, positions = [], indices = [];
  for (const [z, radius, rise] of rings) {
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius + rise, z);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const a = ring * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function wingGeometry(points, thickness) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, z) : shape.moveTo(x, z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function addMesh(parent, geometry, material, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createAircraft() {
  const group = new THREE.Group();
  group.userData.flaps = [];
  group.userData.gearLegs = [];
  const white = new THREE.MeshStandardMaterial({ color: 0xe5e9e6, roughness: 0.48 });
  const wing = new THREE.MeshStandardMaterial({ color: 0xd0d8d7, roughness: 0.65 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x244f60, roughness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc4ad71, metalness: 0.3, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2c4e61, metalness: 0.35, roughness: 0.22 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x252c2e, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x92a3a7, metalness: 0.65, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263b45, roughness: 0.85 });
  addMesh(group, fuselageGeometry(), white, [0, AIRCRAFT.bodyHeight, 0]);
  const stripeGeometry = new THREE.BoxGeometry(0.025, 0.22, 25);
  for (const side of [-1, 1]) {
    addMesh(group, stripeGeometry, teal, [side * 1.98, 3.72, -0.7]);
    const windowGeometry = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 18; i++) {
      const window = addMesh(group, windowGeometry, glass, [side * 1.935, 4.43, -9.8 + i * 1.15]);
      window.scale.set(0.065, 0.23, 0.18);
    }
    const mainWing = wingGeometry([[0, -3], [4, -2.3], [17.5, 5.5], [17.5, 7.2], [5.5, 3], [0, 4.8]]
      .map(([x, z]) => [x * side, z]), 0.3);
    addMesh(group, mainWing, wing, [0, 3.05, 0]);
    const flap = new THREE.Group();
    flap.position.set(side * 7, 2.94, 3.7);
    addMesh(flap, new THREE.BoxGeometry(6.4, 0.13, 1.2), wing, [0, 0, 0.5]);
    group.add(flap);
    group.userData.flaps.push(flap);
    addMesh(group, wingGeometry([[0, 0], [6.2, 3.1], [6.2, 4.2], [0, 3]]
      .map(([x, z]) => [x * side, z]), 0.16), wing, [0, 4.65, 12.3]);
    addMesh(group, new THREE.BoxGeometry(0.16, 1.2, 1.8), teal, [side * 17.4, 3.5, 6.2], [0, 0, side * -0.18]);
    const engine = new THREE.Group();
    group.add(engine);
    engine.position.set(side * 6.15, 2.05, -0.3);
    addMesh(engine, new THREE.CylinderGeometry(1.08, 0.92, 3.9, 24), white, [0, 0, 0], [Math.PI / 2, 0, 0]);
    addMesh(engine, new THREE.TorusGeometry(1.02, 0.11, 8, 24), metal, [0, 0, -1.98]);
    addMesh(engine, new THREE.CircleGeometry(0.94, 24), dark, [0, 0, -1.99], [0, Math.PI, 0]);
    for (let blade = 0; blade < 10; blade++) {
      addMesh(engine, new THREE.BoxGeometry(0.1, 1.45, 0.04), metal, [0, 0, -2], [0, 0, blade * Math.PI / 10]);
    }
    addMesh(engine, new THREE.SphereGeometry(0.22, 12, 8), metal, [0, 0, -2.08]);
    addMesh(group, new THREE.BoxGeometry(0.4, 1.1, 1.7), wing, [side * 6.15, 3.05, 0.1]);
  }
  const fin = new THREE.Shape();
  fin.moveTo(11.5, 0); fin.lineTo(15.5, 6.2); fin.lineTo(18.6, 6.6); fin.lineTo(18.4, 0); fin.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: 0.26, bevelEnabled: false });
  finGeometry.rotateY(-Math.PI / 2);
  addMesh(group, finGeometry, teal, [0.13, 4.6, 0]);
  addMesh(group, new THREE.BoxGeometry(0.28, 0.45, 2.3), gold, [0, 9.1, 17]);
  for (const side of [-1, 1]) {
    const positions = [], indices = [];
    for (let row = 0; row < 3; row++) {
      const z = -17.35 + row * 1.25;
      const radius = (z < -16 ? 0.75 + (z + 18.2) / 2.2 * 0.95 : 1.7 + (z + 16) / 4 * 0.3) + 0.035;
      for (let column = 0; column <= 5; column++) {
        const angle = 0.8 - row * 0.1 + column / 5 * (0.71 + row * 0.1);
        positions.push(side * Math.cos(angle) * radius, AIRCRAFT.bodyHeight + Math.sin(angle) * radius, z);
      }
    }
    for (let row = 0; row < 2; row++) for (let column = 0; column < 5; column++) {
      const a = row * 6 + column, b = a + 6;
      if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
      else indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    addMesh(group, geometry, glass);
  }
  const tireGeometry = new THREE.CylinderGeometry(0.48, 0.48, 0.3, 16);
  const hubGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12);
  for (const [x, z] of [[0, AIRCRAFT.noseWheelZ], [-AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ], [AIRCRAFT.mainWheelX, AIRCRAFT.mainWheelZ]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0, z);
    leg.userData.baseX = x;
    group.add(leg);
    group.userData.gearLegs.push(leg);
    addMesh(leg, new THREE.CylinderGeometry(0.1, 0.14, 1.6, 8), metal, [0, 1.55, 0]);
    for (const offset of [-0.23, 0.23]) {
      addMesh(leg, tireGeometry, rubber, [offset, 0.48, 0], [0, 0, Math.PI / 2]);
      addMesh(leg, hubGeometry, metal, [offset, 0.48, 0], [0, 0, Math.PI / 2]);
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
  return group;
}
