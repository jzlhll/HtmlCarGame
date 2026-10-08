import * as THREE from 'three';
import { COCKPIT } from './config.js';

// 驾驶舱几何位于飞行员眼位前方，与主相机共享同一个世界视图。
export class CockpitView extends THREE.Group {
  constructor() {
    super();
    const dark = new THREE.MeshStandardMaterial({ color: COCKPIT.color, roughness: 0.95 });
    const trim = new THREE.MeshStandardMaterial({ color: COCKPIT.trimColor, roughness: 0.7, metalness: 0.18 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x101a20, roughness: 0.45 });
    const makeBox = (material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.add(mesh);
      return mesh;
    };
    this.panel = makeBox(dark);
    this.coaming = makeBox(trim);
    this.centerPost = makeBox(trim);
    this.topFrame = makeBox(dark);
    this.sideFrames = [makeBox(trim), makeBox(trim)];
    this.screens = Array.from({ length: 5 }, () => makeBox(screen));
    this.bolts = [];
    for (let i = 0; i < 8; i++) this.bolts.push(makeBox(trim));
    this.materials = [dark, trim, screen];
    this.backlight = trim;
    this.screenMaterial = screen;
    this.visible = false;
  }

  setSystems(systems) {
    this.backlight.emissive.setHex(systems.lights ? 0xb3a269 : 0x000000);
    this.backlight.emissiveIntensity = systems.lights ? 0.08 : 0;
    this.screenMaterial.emissive.setHex(systems.avionics ? 0x255d65 : 0x000000);
    this.screenMaterial.emissiveIntensity = systems.avionics ? 0.35 : 0;
  }

  setOpacity(opacity) {
    this.visible = opacity > 0;
    for (const material of this.materials) material.opacity = opacity;
  }

  resize(aspect, fov) {
    if (aspect === this.lastAspect && fov === this.lastFov) return;
    this.lastAspect = aspect;
    this.lastFov = fov;
    const slope = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const distance = COCKPIT.dashboardDistance;
    const halfHeight = slope * distance;
    const halfWidth = halfHeight * aspect;
    const top = halfHeight * (1 - 2 * COCKPIT.panelTop);
    this.panel.position.set(0, top - halfHeight * 0.55, -distance);
    this.panel.scale.set(halfWidth * 2.35, halfHeight * 1.1, 0.32);
    this.coaming.position.set(0, top + 0.015, -distance);
    this.coaming.scale.set(halfWidth * 2.4, 0.055, 0.52);
    const frameHeight = slope * COCKPIT.frameDistance;
    this.centerPost.position.set(0, frameHeight * 0.26, -COCKPIT.frameDistance);
    this.centerPost.scale.set(COCKPIT.frameWidth, frameHeight * 1.55, 0.11);
    this.topFrame.position.set(0, frameHeight * 1.02, -COCKPIT.frameDistance);
    this.topFrame.scale.set(frameHeight * aspect * 2.4, 0.12, 0.2);
    this.sideFrames.forEach((mesh, index) => {
      mesh.position.set((index ? 1 : -1) * frameHeight * aspect * 0.97, frameHeight * 0.2, -COCKPIT.frameDistance);
      mesh.scale.set(0.1, frameHeight * 1.7, 0.15);
      mesh.rotation.z = (index ? 1 : -1) * -0.11;
    });
    this.screens.forEach((mesh, index) => {
      mesh.position.set((index - 2) * halfWidth * 0.35, top - halfHeight * 0.28, -distance + 0.17);
      mesh.scale.set(halfWidth * 0.32, halfHeight * 0.36, 0.015);
    });
    this.bolts.forEach((mesh, index) => {
      mesh.position.set((index / 7 * 2 - 1) * halfWidth * 0.94, top - 0.025, -distance + 0.27);
      mesh.scale.set(0.012, 0.012, 0.012);
    });
  }
}
