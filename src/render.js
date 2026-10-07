import * as THREE from 'three';
import { AIRCRAFT, CAMERA, SCENERY } from './config.js';
import { AirportView } from './airport-view.js';
import { CockpitView } from './cockpit-view.js';
import { createAircraft } from './models.js';

export class GameRenderer {
  constructor(container) {
    this.container = container;
    this.onInvalidate = () => {};
    this.dirty = true;
    this.contextLost = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CAMERA.pixelRatioLimit));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '客机、机场和驾驶舱的三维场景');
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENERY.colors.skyHorizon);
    this.scene.fog = new THREE.Fog(SCENERY.colors.skyHorizon, SCENERY.fogNear, SCENERY.fogFar);
    this.scene.add(new THREE.HemisphereLight(0xdcebf4, 0x6b7c69, 2.4));
    const sun = new THREE.DirectionalLight(0xfff1d4, 3.1);
    sun.position.set(-65, 100, -45); sun.castShadow = true;
    sun.shadow.mapSize.set(SCENERY.shadowSize, SCENERY.shadowSize);
    sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(CAMERA.exterior.fov, 1, CAMERA.near, CAMERA.far);
    this.eyeOffset = new THREE.Vector3();
    this.scene.add(this.camera);
    this.scene.add(new AirportView());
    this.aircraft = createAircraft();
    this.scene.add(this.aircraft);
    this.cockpit = new CockpitView();
    this.camera.add(this.cockpit);
    const skyGeometry = new THREE.SphereGeometry(4800, 24, 12);
    const colors = [];
    const vertex = skyGeometry.getAttribute('position');
    const horizon = new THREE.Color(SCENERY.colors.skyHorizon), zenith = new THREE.Color(SCENERY.colors.skyTop);
    const color = new THREE.Color();
    for (let i = 0; i < vertex.count; i++) {
      const mix = Math.max(0, Math.min(1, vertex.getY(i) / 3000));
      color.copy(horizon).lerp(zenith, mix);
      colors.push(color.r, color.g, color.b);
    }
    skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.sky = new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    this.scene.add(this.sky);
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
      this.onContextLost?.();
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.onContextRestored?.();
      this.invalidate();
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.renderer.setSize(width, height);
    this.camera.updateProjectionMatrix();
    this.cockpit.resize(this.camera.aspect, CAMERA.cockpitFov);
    this.invalidate();
  }

  invalidate() {
    this.dirty = true;
    this.onInvalidate();
  }

  draw(game) {
    if (!this.dirty || this.contextLost) return;
    const { position, pitch, bank, heading } = game.aircraft;
    this.aircraft.position.set(position.x, position.y, position.z);
    this.aircraft.rotation.set(pitch, -heading, -bank, 'YXZ');
    const inside = game.view === 'COCKPIT';
    this.aircraft.visible = !inside;
    this.cockpit.visible = inside;
    if (inside) {
      this.camera.fov = CAMERA.cockpitFov;
      this.eyeOffset.set(AIRCRAFT.eye.x, AIRCRAFT.eye.y, AIRCRAFT.eye.z).applyEuler(this.aircraft.rotation);
      this.camera.position.set(position.x, position.y, position.z).add(this.eyeOffset);
      this.camera.rotation.copy(this.aircraft.rotation);
    } else {
      this.camera.fov = CAMERA.exterior.fov;
      this.camera.position.set(...CAMERA.exterior.position);
      this.camera.lookAt(...CAMERA.exterior.target);
    }
    this.camera.updateProjectionMatrix();
    this.cockpit.resize(this.camera.aspect, CAMERA.cockpitFov);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
  }
}
