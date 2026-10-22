import { WeatherView } from './weather-view.js';
import * as THREE from 'three';
import { AIRCRAFT, CAMERA, DESTRUCTION, SCENERY, ENGINE_VIBRATION, GAME, FLIGHT_PHASES, LANDSCAPE, SURFACE_APPEARANCE } from './config.js';
import { AirportView } from './airport-view.js';
import { AirportTrafficView } from './airport-traffic-view.js';
import { CockpitView } from './cockpit-view.js';
import { createAircraft } from './models.js';
import { CameraSequence } from './camera-sequence.js';
import { LandscapeView } from './landscape-view.js';
import { AircraftPreview } from './aircraft-preview.js';
import { GearPreview } from './gear-preview.js';
import { ImpactEffects } from './impact-effects.js';
import { TrafficView } from './traffic-view.js';
import { TrafficIndicators } from './traffic-indicators.js';
import { surfaceTexture } from './surface-assets.js';
import { GenerationQueue } from './generation-queue.js';
import { prepareSceneResources, initializeTextureTransfer } from './scene-preparation.js';

export class GameRenderer {
  constructor(container, world) {
    this.container=container;this.onInvalidate=()=>{};this.dirty=true;this.contextLost=false;
    this.objectQueue=new GenerationQueue(this.build(container,world),{urgent:true,name:'scene-objects'});
  }

  *build(container,world) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    initializeTextureTransfer(this.renderer);yield {task:'renderer'};
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.shadowMatrix = new THREE.Matrix4();
    this.viewportSize = new THREE.Vector2();
    this.introDisplaySeconds = 0;
    this.displayPose = { position: new THREE.Vector3(), pitch: 0, bank: 0, heading: 0 };
    this.renderer.domElement.setAttribute('aria-label', '客机、机场和驾驶舱的三维场景');
    this.renderer.domElement.style.visibility='hidden';container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENERY.colors.skyHorizon);
    this.scene.fog = new THREE.Fog(SCENERY.colors.skyHorizon, SCENERY.fogNear, SCENERY.fogFar);
    this.scene.add(new THREE.HemisphereLight(0xdcebf4, 0x5c6650, LANDSCAPE.terrain.ambientStrength));
    const sun = new THREE.DirectionalLight(0xfff1d4, LANDSCAPE.terrain.sunStrength);
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
    const airports=[];for(const destination of [false,true]){const airport=new AirportView(world.route,destination);airports.push(airport);yield* world.trees.addMatrices(airport.treeMatrices,airport.treeCount);yield {task:'airport'};}
    this.scene.add(...airports);this.airports=airports;
    this.landscape = new LandscapeView(world); this.scene.add(this.landscape);
    yield {task:'landscape'};
    this.impactEffects = new ImpactEffects(); this.scene.add(this.impactEffects);
    this.impactOffset = new THREE.Vector3(); this.impactTarget = new THREE.Vector3();
    this.traffic = new TrafficView(world.route);yield* this.traffic.build();this.scene.add(this.traffic);
    this.trafficIndicators = new TrafficIndicators(document.getElementById('traffic-indicators'));
    yield {task:'traffic'};
    this.aircraft = createAircraft();
    this.scene.add(this.aircraft);
    this.airportTraffic = new AirportTrafficView(world.route, this.aircraft); this.scene.add(this.airportTraffic);
    this.aircraftMaterials = new Set();
    this.aircraft.traverse(mesh => {
      if (mesh.isMesh) this.aircraftMaterials.add(mesh.material);
    });
    yield {task:'aircraft'};
    this.preview = new AircraftPreview(document.getElementById("attitude-preview-view"),world.route);
    yield {task:'preview'};
    this.cockpit = new CockpitView();
    this.camera.add(this.cockpit);
    yield {task:'cockpit'};
    this.gearPreview = new GearPreview(document.getElementById('gear-preview-view'), this.scene, this.aircraft, this.cockpit, this.aircraftMaterials);
    // 粗糙地面和森林沿用半球光；只给有反射需求的表面采样共享环境。
    this.surfaceMaterials = new Set();
    const reflectiveMaterials = new Set(), environment = surfaceTexture('environment');
    for (const scene of [this.scene, this.preview.scene]) scene.traverse(object => {
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        this.surfaceMaterials.add(material);
        if (material.isMeshStandardMaterial && material.roughness < SURFACE_APPEARANCE.reflectionMaxRoughness) reflectiveMaterials.add(material);
      }
    });
    for (const material of reflectiveMaterials) {
      material.envMap = environment;
      material.envMapIntensity *= SURFACE_APPEARANCE.environmentIntensity;
    }
    this.aircraftColors = new Map([...this.aircraftMaterials].filter(material=>material.color).map(material=>[material,material.color.clone()]));
    this.charColor = new THREE.Color(DESTRUCTION.charColor);
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
    this.weatherView=new WeatherView(world);this.scene.add(this.weatherView);this.weatherView.installSky(this.sky);yield* this.weatherView.build();
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
      this.surfaceUploadCancellation?.abort();
      this.onContextLost?.();
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;initializeTextureTransfer(this.renderer);
      this.renderer.shadowMap.needsUpdate = true;
      this.onContextRestored?.();
      this.invalidate();
    });
    // 静态地景只切换可见性与纹理偏移，不随每帧场景遍历重复计算变换矩阵。
    for (const root of [...airports, this.landscape]) {
      root.updateMatrixWorld(true);
      root.traverse(object => { object.matrixAutoUpdate = false; object.matrixWorldAutoUpdate = false; });
    }
    this.resizeObserver = new ResizeObserver(entries => {
      if (entries.some(entry=>entry.target===container)) this.resize();
      else { this.previewBoundsDirty=true; this.invalidate(); }
    });
    this.resizeObserver.observe(container);
    this.resizeObserver.observe(this.preview.element);
    this.resizeObserver.observe(this.gearPreview.element);
    const pixelRatioChanged=()=>{
      this.pixelRatioQuery?.removeEventListener('change',pixelRatioChanged);
      this.pixelRatioQuery=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);
      this.pixelRatioQuery.addEventListener('change',pixelRatioChanged,{once:true});
      this.resize();
    };
    pixelRatioChanged();
  }

  *prepareSurfaceTexture(previous, next) {
    // 完成前继续使用旧纹理；上下文丢失后重传未提交纹理，不保留失效的上传进度。
    try {
      while (true) {
        const cancellation=new AbortController(); this.surfaceUploadCancellation=cancellation;
        next.source.dataReady=false; this.renderer.initTexture(next); yield 'boundary';
        const source=new THREE.DataTexture(),region=new THREE.Box2(),destination=new THREE.Vector2();
        upload: for (const [level,image] of next.mipmaps.entries()) {
          source.image=image;
          for (let row=0;row<image.height;row+=32) {
            if (cancellation.signal.aborted) break upload;
            const height=Math.min(32,image.height-row);
            region.min.set(0,row);region.max.set(image.width,row+height);
            destination.set(0,next.flipY?image.height-row-height:row);
            this.renderer.copyTextureToTexture(source,next,region,destination,0,level);yield;
          }
        }
        if (cancellation.signal.aborted) {next.dispose();next.needsUpdate=true;continue;}
        next.source.dataReady=true;this.replaceSurfaceTexture(previous,next);this.invalidate();return;
      }
    } finally {this.surfaceUploadCancellation=undefined;}
  }

  replaceSurfaceTexture(previous, next) {
    for (const material of this.surfaceMaterials) {
      for (const key of Object.keys(material)) if (material[key] === previous) material[key] = next;
      if (material.userData.detailTexture === previous) material.userData.detailTexture = next;
      for (const uniform of material.userData.landUniforms || []) if (uniform.value === previous) uniform.value = next;
    }
    for (let i=0; i<this.landscape.textures.length; i++) if (this.landscape.textures[i] === previous) this.landscape.textures[i] = next;
    previous.dispose();
  }

  // 先完成全场景材质、纹理和几何的首次提交，开场运镜不再承担冷启动开销。
  async prepare() {
    this.objectQueue.resume();const objectPreparation=await this.objectQueue.done;
    const transitionPreparation=await this.landscape.prepare();
    for(const airport of this.airports)this.landscape.loopView.installHorizon(airport);
    this.landscape.loopView.update(this.camera.position,0);
    // 分批加入的地景同样登记共享贴图替换与反射，然后统一预热。
    const environment=surfaceTexture('environment');
    this.scene.traverse(object=>{
      for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
        if(this.surfaceMaterials.has(material))continue;
        this.surfaceMaterials.add(material);
        if(material.isMeshStandardMaterial&&material.roughness<SURFACE_APPEARANCE.reflectionMaxRoughness){material.envMap=environment;material.envMapIntensity*=SURFACE_APPEARANCE.environmentIntensity;}
      }
    });
    const gpuPreparation=await prepareSceneResources(this.renderer,[{scene:this.scene,camera:this.camera},{scene:this.preview.scene,camera:this.preview.camera}],this.landscape.textures);
    return {objectPreparation,transitionPreparation,...gpuPreparation};
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.previewBoundsDirty = true;
    const ratio=Math.min(window.devicePixelRatio||1,CAMERA.pixelRatioLimit),size=this.renderer.getSize(this.viewportSize);
    // CSS保持逻辑尺寸；只在尺寸或DPR变化时重建绘制缓冲，避免重复分配。
    if(size.x!==width||size.y!==height||this.renderer.getPixelRatio()!==ratio)this.renderer.setDrawingBufferSize(width,height,ratio);
    if(this.camera.aspect!==width/height){this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
    this.camera.userData.detailViewportHeight=this.renderer.domElement.height;
    this.cockpit.resize(this.camera.aspect, CAMERA.cockpitFov);
    this.invalidate();
  }

  invalidate() {
    this.dirty = true;
    this.onInvalidate();
  }

  draw(game, renderRemainder = 0) {
    if (!this.dirty || this.contextLost) return;
    const flying = FLIGHT_PHASES.includes(game.phase), destroyed=Boolean(game.destruction);
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
    this.camera.far=game.weather.kind==='clear'?CAMERA.far:Math.min(CAMERA.far,game.weather.visibility*1.15);
    const intro = game.phase === 'INTRO' && !game.landingDebug;
    if (!intro) this.introDisplaySeconds = 0;
    else if (!game.paused) this.introDisplaySeconds = Math.min(CAMERA.introSeconds, game.introSeconds + renderRemainder);
    const progress = intro ? this.sequence.apply(this.camera, this.introDisplaySeconds) : 0;
    this.camera.near = inside ? CAMERA.cockpitNear : THREE.MathUtils.lerp(CAMERA.exteriorNear, CAMERA.cockpitNear, THREE.MathUtils.smoothstep(progress, ...CAMERA.cockpitFade));
    const shellOpacity = inside ? 0 : intro ? 1 - THREE.MathUtils.smoothstep(progress, ...CAMERA.exteriorFade) : 1;
    const cockpitOpacity = inside ? 1 : intro ? THREE.MathUtils.smoothstep(progress, ...CAMERA.cockpitFade) : 0;
    this.aircraft.visible = shellOpacity > 0;
    for (const material of this.aircraftMaterials) material.opacity = shellOpacity;
    for (const [material,color] of this.aircraftColors) material.color.copy(color).lerp(this.charColor,destroyed?Math.min(0.88,game.completionElapsed*2):0);
    // 镜头移动不会改变静止场景的阴影；仅机体或机壳状态改变时重算。
    this.aircraft.updateMatrix();
    const configuration = `${game.aircraft.systems.gearPosition}:${game.aircraft.systems.flapsPosition}:${destroyed}`;
    if ((this.aircraft.visible && (!this.shadowMatrix.equals(this.aircraft.matrix) || this.shadowConfiguration !== configuration)) || this.shadowOpacity !== shellOpacity) {
      this.shadowConfiguration = configuration;
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowMatrix.copy(this.aircraft.matrix);
      this.shadowOpacity = shellOpacity;
    }
    this.cockpit.setOpacity(cockpitOpacity);
    this.cockpit.setSystems(game.aircraft.systems);
    this.cockpit.glass.update(game);
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
    } else if (destroyed) {
      this.camera.fov=CAMERA.exterior.fov;
      this.impactOffset.set(...DESTRUCTION.camera).applyAxisAngle(THREE.Object3D.DEFAULT_UP,-game.destruction.heading);
      this.impactTarget.set(game.destruction.position.x,game.destruction.position.y+AIRCRAFT.bodyHeight,game.destruction.position.z);
      this.camera.position.copy(this.impactTarget).add(this.impactOffset);
      const shake=DESTRUCTION.cameraShake*Math.max(0,1-game.completionElapsed/0.7);
      this.camera.position.x+=Math.sin(game.completionElapsed*85)*shake;
      this.camera.position.y+=Math.sin(game.completionElapsed*63)*shake;
      this.camera.lookAt(this.impactTarget);
    } else if (!intro) {
      this.camera.fov = CAMERA.exterior.fov;
      this.camera.position.set(...CAMERA.exterior.position);
      this.camera.lookAt(...CAMERA.exterior.target);
    }
    const birdTime=game.activeSeconds-game.birdImpactAt;
    if(inside&&birdTime>=0&&birdTime<DESTRUCTION.birdShakeSeconds)this.camera.rotateZ(Math.sin(birdTime*75)*DESTRUCTION.birdShakeAngle*(1-birdTime/DESTRUCTION.birdShakeSeconds));
    if (this.projectionNear !== this.camera.near || this.projectionFar !== this.camera.far || this.projectionFov !== this.camera.fov || this.projectionAspect !== this.camera.aspect) {
      this.camera.updateProjectionMatrix();
      this.projectionNear = this.camera.near;this.projectionFar=this.camera.far; this.projectionFov = this.camera.fov; this.projectionAspect = this.camera.aspect;
    }
    this.cockpit.resize(this.camera.aspect, this.camera.fov);
    this.weatherView.update(game,this.scene);
    this.sky.position.copy(this.camera.position);
    this.landscape.update(game.activeSeconds, this.camera, pose.position);
    this.traffic.update(game, flying ? Math.min(1, renderRemainder / GAME.fixedStep) : 1);
    this.impactEffects.update(game,this.camera,this.renderer.domElement.height);
    if(this.airportTraffic.update(game))this.renderer.shadowMap.needsUpdate=true;
    this.renderer.render(this.scene, this.camera);if(this.renderer.domElement.style.visibility)this.renderer.domElement.style.visibility='';
    this.trafficIndicators.update(game, this.camera, this.traffic.models, pose);
    const gearVisible = !this.gearPreview.element.parentElement.hidden;
    if (this.previousGearVisible !== gearVisible) this.previewBoundsDirty = true;
    this.previousGearVisible = gearVisible;
    if (inside) this.preview.draw(this.renderer, game, pose, this.previewBoundsDirty || this.previousView !== game.view, this.traffic.models);
    this.gearPreview.draw(this.renderer, game, pose, this.previewBoundsDirty || this.previousView !== game.view);
    this.previewBoundsDirty = false;
    this.previousView = game.view;
    this.dirty = false;
  }
}
