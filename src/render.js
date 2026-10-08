import * as THREE from 'three';
import { AIRCRAFT, CAMERA, SCENERY, ENGINE_VIBRATION, GAME } from './config.js';
import { AirportView } from './airport-view.js';
import { CockpitView } from './cockpit-view.js';
import { createAircraft } from './models.js';
import { CameraSequence } from './camera-sequence.js';
import { LandscapeView } from './landscape-view.js';
import { AircraftPreview } from './aircraft-preview.js';

export class GameRenderer {
  constructor(container) {
    this.container = container;
    this.onInvalidate = () => {};
    this.dirty = true;
    this.contextLost = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CAMERA.pixelRatioLimit));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.shadowMatrix = new THREE.Matrix4();
    this.introDisplaySeconds = 0;
    this.displayPose = { position: new THREE.Vector3(), pitch: 0, bank: 0, heading: 0 };
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
    this.camera = new THREE.PerspectiveCamera(CAMERA.exterior.fov, 1, CAMERA.exteriorNear, CAMERA.far);
    this.eyeOffset = new THREE.Vector3();
    this.sequence = new CameraSequence();
    this.scene.add(this.camera);
    this.scene.add(new AirportView());
    this.scene.add(new LandscapeView());
    this.aircraft = createAircraft();
    this.scene.add(this.aircraft);
    this.aircraftMaterials = new Set();
    this.aircraft.traverse(mesh => {
      if (mesh.isMesh) this.aircraftMaterials.add(mesh.material);
    });
    this.preview = new AircraftPreview(document.getElementById("attitude-preview-view"));
    this.cockpit = new CockpitView();
    this.camera.add(this.cockpit);
    // 淡出仍写入深度，使用多采样覆盖代替混合排序；无多采样时退回透明度散列。
    const context = this.renderer.getContext();
    const sampleCoverage = context.getParameter(context.SAMPLES) > 1;
    for (const material of [...this.aircraftMaterials, ...this.cockpit.materials]) {
      material.alphaToCoverage = sampleCoverage;
      material.alphaHash = !sampleCoverage;
    }
    const skyGeometry = new THREE.SphereGeometry(SCENERY.skyRadius, 24, 12);
    const colors = [];
    const vertex = skyGeometry.getAttribute('position');
    const horizon = new THREE.Color(SCENERY.colors.skyHorizon), zenith = new THREE.Color(SCENERY.colors.skyTop);
    const color = new THREE.Color();
    for (let i = 0; i < vertex.count; i++) {
      const mix = Math.max(0, Math.min(1, vertex.getY(i) / (SCENERY.skyRadius * 0.7)));
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
      this.renderer.shadowMap.needsUpdate = true;
      this.onContextRestored?.();
      this.invalidate();
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.previewBoundsDirty = true;
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

  draw(game, renderRemainder = 0) {
    if (!this.dirty || this.contextLost) return;
    const flying = ['TAKEOFF_ROLL', 'INITIAL_CLIMB'].includes(game.phase);
    const pose = this.displayPose;
    if (this.poseRun !== game.runId || (!game.paused && !['COMPLETE', 'RESULT'].includes(game.phase))) {
      const current = game.aircraft, previous = game.flight.previous;
      const mix = flying ? Math.min(1, renderRemainder / GAME.fixedStep) : 1;
      for (const axis of ['x', 'y', 'z']) pose.position[axis] = THREE.MathUtils.lerp(previous.position[axis], current.position[axis], mix);
      for (const angle of ['pitch', 'bank', 'heading']) pose[angle] = THREE.MathUtils.lerp(previous[angle], current[angle], mix);
      this.poseRun = game.runId;
    }
    const { position, pitch, bank, heading } = pose;
    this.aircraft.position.set(position.x, position.y, position.z);
    this.aircraft.rotation.set(pitch, -heading, -bank, 'YXZ');
    this.aircraft.userData.navigationLights.visible = game.aircraft.systems.lights;
    for (const flap of this.aircraft.userData.flaps) flap.rotation.x = game.aircraft.systems.flapsPosition * AIRCRAFT.flapAngle;
    for (const leg of this.aircraft.userData.gearLegs) {
      const progress = game.aircraft.systems.gearPosition;
      leg.position.x = leg.userData.baseX * (0.5 + progress * 0.5);
      leg.position.y = (1 - progress) * AIRCRAFT.gearRetractHeight;
    }
    const inside = game.view === 'COCKPIT';
    const intro = game.phase === 'INTRO';
    if (!intro) this.introDisplaySeconds = 0;
    else if (!game.paused) this.introDisplaySeconds = Math.min(CAMERA.introSeconds, game.introSeconds + renderRemainder);
    const progress = intro ? this.sequence.apply(this.camera, this.introDisplaySeconds) : 0;
    this.camera.near = inside ? CAMERA.cockpitNear : THREE.MathUtils.lerp(CAMERA.exteriorNear, CAMERA.cockpitNear, THREE.MathUtils.smoothstep(progress, ...CAMERA.cockpitFade));
    const shellOpacity = inside ? 0 : intro ? 1 - THREE.MathUtils.smoothstep(progress, ...CAMERA.exteriorFade) : 1;
    const cockpitOpacity = inside ? 1 : intro ? THREE.MathUtils.smoothstep(progress, ...CAMERA.cockpitFade) : 0;
    this.aircraft.visible = shellOpacity > 0;
    for (const material of this.aircraftMaterials) material.opacity = shellOpacity;
    // 镜头移动不会改变静止场景的阴影；仅机体或机壳状态改变时重算。
    this.aircraft.updateMatrix();
    const configuration = `${game.aircraft.systems.gearPosition}:${game.aircraft.systems.flapsPosition}`;
    if ((this.aircraft.visible && (!this.shadowMatrix.equals(this.aircraft.matrix) || this.shadowConfiguration !== configuration)) || this.shadowOpacity !== shellOpacity) {
      this.shadowConfiguration = configuration;
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowMatrix.copy(this.aircraft.matrix);
      this.shadowOpacity = shellOpacity;
    }
    this.cockpit.setOpacity(cockpitOpacity);
    this.cockpit.setSystems(game.aircraft.systems);
    if (inside) {
      this.camera.fov = CAMERA.cockpitFov;
      this.eyeOffset.set(AIRCRAFT.eye.x, AIRCRAFT.eye.y, AIRCRAFT.eye.z).applyEuler(this.aircraft.rotation);
      this.camera.position.set(position.x, position.y, position.z).add(this.eyeOffset);
      this.camera.rotation.copy(this.aircraft.rotation);
      this.camera.rotateX(-CAMERA.cockpitLookDown);
      if (game.aircraft.systems.engine !== 'OFF') {
        const vibration = ENGINE_VIBRATION;
        const time = game.systems.engineElapsed;
        const starting = game.aircraft.systems.engine === 'STARTING';
        const fade = THREE.MathUtils.smoothstep(time, 0, vibration.fadeInSeconds);
        const settling = starting ? 1 - game.aircraft.systems.engineProgress : 0;
        const angle = THREE.MathUtils.lerp(vibration.idleAngle, vibration.startingAngle, settling) * fade;
        const offset = THREE.MathUtils.lerp(vibration.idleOffset, vibration.startingOffset, settling) * fade;
        const wave = Math.sin(time * Math.PI * 2 * vibration.frequencies[0]);
        const crossWave = Math.sin(time * Math.PI * 2 * vibration.frequencies[1]);
        this.camera.rotateX(wave * angle);
        this.camera.rotateZ(crossWave * angle * 0.55);
        this.camera.position.x += crossWave * offset;
        this.camera.position.y += wave * offset;
      }
    } else if (!intro) {
      this.camera.fov = CAMERA.exterior.fov;
      this.camera.position.set(...CAMERA.exterior.position);
      this.camera.lookAt(...CAMERA.exterior.target);
    }
    this.camera.updateProjectionMatrix();
    this.cockpit.resize(this.camera.aspect, this.camera.fov);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    if (inside) this.preview.draw(this.renderer, game, pose, this.previewBoundsDirty || this.previousView !== game.view);
    this.previewBoundsDirty = false;
    this.previousView = game.view;
    this.dirty = false;
  }
}
