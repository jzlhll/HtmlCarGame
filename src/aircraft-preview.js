import * as THREE from 'three';
import { AIRCRAFT, AIRCRAFT_PREVIEW } from './config.js';
import { createAircraft } from './models.js';

// 同一渲染器中的独立机外姿态视口，固定跟随航向，突出俯仰和坡度。
export class AircraftPreview {
  constructor(element) {
    this.element = element;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(AIRCRAFT_PREVIEW.background);
    this.scene.add(new THREE.HemisphereLight(0xeaf4fa, 0x788a90, 3));
    const light = new THREE.DirectionalLight(0xfff2d9, 3); light.position.set(-20, 50, 40); this.scene.add(light);
    this.aircraft = createAircraft();
    this.aircraft.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = false; } });
    this.scene.add(this.aircraft);
    const grid = new THREE.GridHelper(AIRCRAFT_PREVIEW.gridSize, AIRCRAFT_PREVIEW.gridDivisions, AIRCRAFT_PREVIEW.gridColor, AIRCRAFT_PREVIEW.groundColor);
    grid.position.y = AIRCRAFT_PREVIEW.gridHeight; this.scene.add(grid);
    this.camera = new THREE.PerspectiveCamera(AIRCRAFT_PREVIEW.fov, 1, 1, 400);
    this.camera.position.set(...AIRCRAFT_PREVIEW.camera); this.camera.lookAt(...AIRCRAFT_PREVIEW.target);
    this.bounds = null;
    this.size = new THREE.Vector2();
  }

  draw(renderer, game, pose, refreshBounds) {
    if (refreshBounds || !this.bounds) {
      this.bounds = this.element.getBoundingClientRect();
      this.camera.aspect = this.bounds.width / Math.max(1, this.bounds.height); this.camera.updateProjectionMatrix();
    }
    const bounds = this.bounds;
    if (!bounds.width || !bounds.height) return;
    this.aircraft.rotation.set(pose.pitch, 0, -pose.bank, 'YXZ');
    this.aircraft.userData.navigationLights.visible = game.aircraft.systems.lights;
    for (const flap of this.aircraft.userData.flaps) flap.rotation.x = game.aircraft.systems.flapsPosition * AIRCRAFT.flapAngle;
    for (const leg of this.aircraft.userData.gearLegs) {
      const progress = game.aircraft.systems.gearPosition;
      leg.position.x = leg.userData.baseX * (0.5 + progress * 0.5); leg.position.y = (1 - progress) * AIRCRAFT.gearRetractHeight;
    }
    const size = renderer.getSize(this.size);
    renderer.setViewport(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
    renderer.setScissor(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
    renderer.setScissorTest(true); renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
  }
}
