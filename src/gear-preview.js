import * as THREE from 'three';
import { AIRCRAFT, FLIGHT, GEAR_PREVIEW } from './config.js';

// 复用真实世界与飞机，以独立裁剪视口观察机轮和地面间距。
export class GearPreview {
  constructor(element, scene, aircraft, cockpit, materials) {
    this.element = element; this.scene = scene; this.aircraft = aircraft;
    this.cockpit = cockpit; this.materials = materials;
    this.camera = new THREE.PerspectiveCamera(GEAR_PREVIEW.fov, 1, GEAR_PREVIEW.near, GEAR_PREVIEW.far);
    this.offset = new THREE.Vector3(); this.target = new THREE.Vector3(); this.size = new THREE.Vector2();
  }

  draw(renderer, game, pose, refreshBounds) {
    const visible = !this.element.parentElement.hidden;
    if (!visible) { this.visible = false; return; }
    if (!this.visible || refreshBounds) {
      this.bounds = this.element.getBoundingClientRect();
      this.camera.aspect = this.bounds.width / Math.max(1, this.bounds.height); this.camera.updateProjectionMatrix();
    }
    this.visible = true;
    const bounds = this.bounds;
    if (!bounds.width || !bounds.height) return;
    const height = Math.min(FLIGHT.gearPreviewHeight, game.flight.altitude()), settings = GEAR_PREVIEW;
    this.offset.set(settings.side, settings.height, settings.distance).applyEuler(this.aircraft.rotation);
    this.camera.position.copy(pose.position).add(this.offset);
    this.target.set(0, 0.5 - Math.min(settings.targetDropLimit, height * settings.targetDrop), AIRCRAFT.mainWheelZ).applyEuler(this.aircraft.rotation).add(pose.position);
    this.camera.lookAt(this.target);
    const aircraftVisible = this.aircraft.visible, cockpitVisible = this.cockpit.visible;
    const opacity = this.materials.values().next().value.opacity;
    const size = renderer.getSize(this.size);
    const matrixWorldAutoUpdate = this.scene.matrixWorldAutoUpdate;
    try {
      this.aircraft.visible = true; this.cockpit.visible = false;
      for (const material of this.materials) material.opacity = 1;
      renderer.setViewport(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
      renderer.setScissor(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
      // 主视口已更新同一姿态的世界矩阵，脚部小窗直接复用。
      this.scene.matrixWorldAutoUpdate = false;
      renderer.setScissorTest(true); renderer.render(this.scene, this.camera);
    } finally {
      this.scene.matrixWorldAutoUpdate = matrixWorldAutoUpdate;
      this.aircraft.visible = aircraftVisible; this.cockpit.visible = cockpitVisible;
      for (const material of this.materials) material.opacity = opacity;
      renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
    }
  }
}
