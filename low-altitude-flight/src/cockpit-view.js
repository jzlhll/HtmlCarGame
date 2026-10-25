import * as THREE from 'three';
import { COCKPIT, SURFACE_APPEARANCE } from './config.js';
import { WindshieldDamage } from './windshield-damage.js';
import { surfaceTexture, modelGeometry } from './surface-assets.js';

// 驾驶舱几何位于飞行员眼位前方，与主相机共享同一个世界视图。
export class CockpitView extends THREE.Group {
  constructor() {
    super();
    const panelDetail = surfaceTexture('panel-detail');
    const dark = new THREE.MeshStandardMaterial({ color: COCKPIT.color, roughness: 0.96, envMapIntensity: 0.15, roughnessMap: panelDetail, bumpMap: panelDetail, bumpScale: SURFACE_APPEARANCE.panelBump });
    const trim = new THREE.MeshStandardMaterial({ color: COCKPIT.trimColor, roughness: 0.8, metalness: 0.25, envMapIntensity: 0.3, roughnessMap: surfaceTexture('metal-detail') });
    const geometry = modelGeometry('cockpit-box'), parts = [];
    const makeBox = (material) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      parts.push(mesh);
      return mesh;
    };
    // 仅保留顶框和侧框；底部仪表与按键使用独立界面，不再叠加整块三维底座。
    this.topFrame = makeBox(dark);
    this.sideFrames = [makeBox(trim), makeBox(trim)];
    this.materials = [dark, trim];
    this.batches = this.materials.map(material => {
      const items = parts.filter(mesh => mesh.material === material);
      const mesh = new THREE.InstancedMesh(geometry, material, items.length);
      mesh.frustumCulled = false; this.add(mesh);
      return {mesh, items};
    });
    this.backlight = trim;
    this.glass=new WindshieldDamage(); this.add(this.glass);
    this.visible = false;
  }

  setSystems(systems) {
    if (this.lights === systems.lights) return;
    this.lights = systems.lights;
    this.backlight.emissive.setHex(systems.lights ? 0xb3a269 : 0x000000);
    this.backlight.emissiveIntensity = systems.lights ? 0.08 : 0;
  }

  setOpacity(opacity) {
    if (this.opacity === opacity) return;
    this.opacity = opacity;
    this.visible = opacity > 0;
    for (const material of this.materials) material.opacity = opacity;
  }

  resize(aspect, fov) {
    if (aspect === this.lastAspect && fov === this.lastFov) return;
    this.lastAspect = aspect;
    this.lastFov = fov;
    this.glass.resize(aspect,fov);
    const slope = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const frameHeight = slope * COCKPIT.frameDistance;
    this.topFrame.position.set(0, frameHeight * 1.02, -COCKPIT.frameDistance);
    this.topFrame.scale.set(frameHeight * aspect * 2.4, 0.12, 0.2);
    this.sideFrames.forEach((mesh, index) => {
      mesh.position.set((index ? 1 : -1) * frameHeight * aspect * 0.97, frameHeight * 0.2, -COCKPIT.frameDistance);
      mesh.scale.set(0.1, frameHeight * 1.7, 0.15);
      mesh.rotation.z = (index ? 1 : -1) * -0.11;
    });
    for (const {mesh, items} of this.batches) {
      items.forEach((part, index) => { part.updateMatrix(); mesh.setMatrixAt(index, part.matrix); });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
