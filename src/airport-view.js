import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RUNWAY, SCENERY } from './config.js';

export class AirportView extends THREE.Group {
  constructor(route, destination = false) {
    super();
    this.position.y = destination ? route.destination.elevation : 0;
    const runway = destination ? {...RUNWAY, ...route.destination, startOffset: route.destination.threshold} : RUNWAY;
    const offset = destination ? route.destination.threshold - RUNWAY.startOffset : 0;
    const colors = SCENERY.colors;
    // 地表与标线按固定层级偏移深度，避免远处毫米级间距失去精度而闪烁。
    const surface = (color, layer, roughness = 1) => new THREE.MeshStandardMaterial({
      color, roughness, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer,
    });
    const pavement = surface(colors.runway, SCENERY.surfaceLayers.pavement);
    const shoulder = surface(colors.runwayShoulder, SCENERY.surfaceLayers.shoulder);
    const marking = surface(colors.marking, SCENERY.surfaceLayers.marking, 0.9);
    const building = new THREE.MeshStandardMaterial({ color: colors.terminal, roughness: 0.85 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x697f86, roughness: 0.75 });
    const glass = new THREE.MeshStandardMaterial({ color: colors.glass, roughness: 0.4 });
    const slab = (width, length, y, z, material, x = 0) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      this.add(mesh);
      return mesh;
    };
    const box = (size, position, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(position[0] + (destination ? 280 : 0), position[1], position[2] + offset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.add(mesh);
      return mesh;
    };
    const center = runway.startOffset - runway.length / 2;
    slab(runway.width + 12, runway.length + 30, -0.015, center, shoulder);
    slab(runway.width, runway.length, 0, center, pavement);
    if (destination) {
      const apron = route.destination.apron;
      slab(apron.width, apron.length, 0.005, apron.z, shoulder, apron.x);
      const park = route.destination.park;
      const ring = new THREE.Mesh(new THREE.RingGeometry(park.radius - 3, park.radius, 80), new THREE.MeshBasicMaterial({color: 0xf4d979, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4}));
      ring.rotation.x = -Math.PI / 2; ring.position.set(park.x, 0.04, park.z); this.add(ring);
      const label = document.createElement('canvas'); label.width = 512; label.height = 128;
      const context = label.getContext('2d'); context.fillStyle = '#f4d979'; context.font = 'bold 66px sans-serif'; context.textAlign = 'center'; context.fillText(`${route.destinationEnglish} ★`, 256, 88);
      const texture = new THREE.CanvasTexture(label); texture.colorSpace = THREE.SRGBColorSpace;
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(100, 25), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false}));
      marker.rotation.x = -Math.PI / 2; marker.position.set(park.x, 0.06, park.z); this.add(marker);
    } else {
      slab(210, 700, 0.005, -140, shoulder, 180);
      slab(140, 24, 0.01, -85, pavement, 85);
    }
    for (const side of [-1, 1]) slab(0.35, runway.length - 20, 0.015, center, marking, side * (runway.width / 2 - 1.8));
    const dashCount = Math.floor(runway.length / (runway.stripeLength + runway.stripeGap));
    const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, runway.stripeLength), marking, dashCount);
    const dummy = new THREE.Object3D();
    dummy.rotation.x = -Math.PI / 2;
    for (let i = 0; i < dashCount; i++) {
      dummy.position.set(0, 0.02, runway.startOffset - 120 - i * (runway.stripeLength + runway.stripeGap));
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    }
    dashes.computeBoundingSphere();
    this.add(dashes);
    for (const end of [runway.startOffset - 18, runway.startOffset - runway.length + 18]) {
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) slab(1.6, 26, 0.022, end, marking, side * (6 + i * 3.2));
    }
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) slab(3, 28, 0.021, -230 - i * 180 + offset, marking, side * 19);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f0eee0';
    context.font = 'bold 190px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(runway.designator, 128, 128);
    const numberTexture = new THREE.CanvasTexture(canvas);
    numberTexture.colorSpace = THREE.SRGBColorSpace;
    slab(13, 16, 0.025, 35 + offset, new THREE.MeshStandardMaterial({ map: numberTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -SCENERY.surfaceLayers.marking, polygonOffsetUnits: -SCENERY.surfaceLayers.marking }));
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xd8b97e, roughness: 0.6 });
    const lightGeometry = new THREE.CylinderGeometry(0.22, 0.32, 0.5, 8);
    const lights = new THREE.InstancedMesh(lightGeometry, lightMaterial, 120);
    dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < 60; i++) {
      for (let side = 0; side < 2; side++) {
        dummy.position.set((side ? 1 : -1) * (runway.width / 2 + 2), 0.25, runway.startOffset - 20 - i * 50);
        dummy.updateMatrix(); lights.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    }
    lights.computeBoundingSphere(); this.add(lights);
    box([120, 12, 28], [215, 6, 140], building);
    box([124, 1.4, 32], [215, 12.2, 140], roof);
    box([118, 5.5, 0.2], [215, 7.2, 125.8], glass);
    for (let i = 0; i < 3; i++) {
      box([42, 13, 45], [200 + i * 55, 6.5, 10], building);
      box([44, 1.8, 48], [200 + i * 55, 13, 10], roof);
      box([30, 9, 0.3], [200 + i * 55, 4.5, -12.6], glass);
    }
    box([9, 30, 9], [135, 15, -210], building);
    box([18, 7, 16], [135, 32, -210], glass);
    box([21, 1, 19], [135, 36, -210], roof);
    const trunk = new THREE.MeshStandardMaterial({ color: 0x6c7565, roughness: 1 });
    const crown = new THREE.MeshStandardMaterial({ color: 0x627f70, roughness: 1 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.8, 5, 5), trunk, 80);
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(4.5, 11, 7), crown, 80);
    for (let i = 0; i < 80; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (350 + Math.sin(i * 2.1) * 90), z = 250 - Math.floor(i / 2) * 105 + offset;
      dummy.position.set(x, 2.5, z); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 8; dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.computeBoundingSphere(); crowns.computeBoundingSphere();
    this.add(trunks, crowns);
    this.batchSurfaces();
  }

  // 同材质不透明标线共用一次绘制，保留地表深度偏移和透明跑道编号的排序。
  batchSurfaces() {
    const batches = new Map();
    for (const mesh of this.children) {
      if (!mesh.isMesh || mesh.isInstancedMesh || mesh.geometry.type !== 'PlaneGeometry' || mesh.material.transparent) continue;
      if (!batches.has(mesh.material)) batches.set(mesh.material, []);
      batches.get(mesh.material).push(mesh);
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const combined = new THREE.Mesh(mergeGeometries(geometries), material);
      combined.receiveShadow = true; this.add(combined);
      for (const mesh of meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
      geometries.forEach(geometry => geometry.dispose());
    }
  }
}
