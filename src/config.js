export { isWithinRunway } from './runway-layout.js';

export const GAME = {
  fixedStep: 1 / 120,
  maxFrameSeconds: 0.05,
  scenePrepareLimitSeconds: 8,
  packageLimitMb: 25,
};

// 空速与受力保持原单位；世界水平位移倍率与景点纵深分别配置。
export const WORLD_TRAVEL = {
  horizontalScale: 4, regionScale: 5,
  centers: { fields: -24000, city: -44800, village: -64000, danxia: -75500,
    pillars: -96000, island: -132000, lake: -155000, pagoda: -179000 },
  clusters: { valley: -3800, river: -5600, fields: -7800, city: -9700, village: -11400,
    danxia: -12250, pillars: -13700, island: -15500, lake: -18750, pagoda: -21400 },
};

export function clusterZ(group, z = WORLD_TRAVEL.clusters[group]) {
  const center=WORLD_TRAVEL.centers[group];
  if(center!==undefined)return center+(z-WORLD_TRAVEL.clusters[group])*WORLD_TRAVEL.regionScale;
  return z + WORLD_TRAVEL.clusters[group] * (WORLD_TRAVEL.horizontalScale - 1);
}

export function worldHorizontalSpeed(velocity) { return velocity * WORLD_TRAVEL.horizontalScale; }

// 世界几何使用米，界面高度按游戏化比例显示；水平距离与速度不参与该换算。
export const WORLD_HEIGHT = { objectMax: 4000, flightMax: 1980, displayScale: 5 };
export function displayHeight(height) { return height * WORLD_HEIGHT.displayScale; }

export const LOOP_WORLD = {
  recipeVersion: 6, seed: 631879, tileSize: 12000, segments: 192, variants: 4,
  poolRadius: 3, edgeBlend: 900, horizonSeconds: 40, referenceSpeed: 600,
  radius: 600 / 3.6 * 40 * WORLD_TRAVEL.horizontalScale,
  seaSize: 160000, seaLevel: -0.16, reliefMax: 4000,
};

export const WORLD_BOUNDARY = {
  halfWidth: 22000, front: 6500, back: -235000, width: 3500,
  height: 6000, crossSegments: 16, alongStep: 300,
  name: '航道高山', reason: '偏离航道太远，撞上高山。',
};

export const TREE_CONTACT = {
  cell:512,tallRatio:.3,tallHeight:[5000,10000].map(v=>v/WORLD_HEIGHT.displayScale),unitHeight:1.065,
  windowSeconds:3,treeDamage:5,birdDamage:20,treeSpeedRetention:.95,
};
export const TREE_MODELS = {
  recipe:1,seed:643179,nearDetail:1,farDetail:0,branchSegments:8,
  species:[
    {id:'poplar',name:'杨树',height:[800,4800],width:[.18,.27],radius:.58,tall:true,color:0x8ba75d},
    {id:'banyan',name:'榕树',height:[700,2700],width:[1.3,1.9],radius:.78,tall:false,color:0x6b9657},
    {id:'willow',name:'柳树',height:[400,2400],width:[.9,1.35],radius:.62,tall:false,color:0x9eb66b},
    {id:'pine',name:'松树',height:[650,4500],width:[.4,.6],radius:.56,tall:true,color:0x769c76},
    {id:'ginkgo',name:'银杏',height:[600,3500],width:[.85,1.25],radius:.70,tall:false,color:0xb7b34f},
    {id:'shrub',name:'灌木',height:[30,220],width:[1.6,2.8],radius:.59,tall:false,color:0x86a457},
  ],
};

export const REGION_BLEND = {
  length: 6000, width: 12000, seed: 952731,
  approachClearance: 13000, airportHalfWidth: 750,
  treeArea: 100000, treeNear: 1300, treeFar: 15000,
};

export const HARBOR = {
  x: -3000, z: -9000 * WORLD_TRAVEL.horizontalScale / 2,
  containerColors: [0x7c9b9b,0xa45039,0xc7ab60,0x6f8471,0x446c7d,0xb8b6a3,0x8d5f4c],
};

export const COUNTRYSIDE = {
  cacheRecipe: 7, treeNear: 1800, treeFar: 10500,
  fieldSpacing: 420, fieldDepth: 310, roadWidth: 28, treeArea: 110000,
  fieldColors: [0x74784b,0x8d8850,0x6e7a45,0x9b8b62,0x536748,0x8b795c,0xa19b6b,0x657751],
  treeColors: [0x334b2d,0x41562f,0x4c6037,0x2d442d],
};

export const SURFACE_APPEARANCE = {
  seed: 72419, generatorVersion: 5, generationSliceMs: 4, idleTimeoutMs: 50, cacheOpenTimeoutMs: 300,
  detailTextureSize: 2048, generatedTextureBudgetMb: 128,
  detailTextures: ['paint-detail', 'asphalt-color', 'asphalt-detail', 'grass-color', 'concrete-color', 'facade-color', 'facade-detail', 'terrain-detail', 'panel-detail', 'metal-detail', 'rubber-detail'],
  textureSize: 512, panelSize: 256, metalSize: 128,
  environmentSize: [256, 128], environmentIntensity: 0.35, reflectionMaxRoughness: 0.85,
  doorPositions: [-11.8, 11.3], doorWidth: 1.05, doorHeight: 2.05, doorBorder: 0.025,
  windowTrimSegments: 16,
  aircraftSegments: 80, fuselageStepMetres: 0.45, engineSegments: 64, fanBlades: 32,
  wingSpanSegments: 32, wingChordSegments: 20,
  wheelSegments: 48, wheelTubeSegments: 16,
  cockpitSegments: 2, cockpitRadius: 0.035,
  asphaltTileMetres: 6, asphaltBump: 0.018, concreteTileMetres: 8, grassTileMetres: 64,
  airportTreeLodMetres: 2200, airportTreeLodHysteresis: 0.12,
  groundBump: 0.025, facadeBump: 0.06, rubberBump: 0.002,
  paintBump: 0.006, panelBump: 0.0003, metalBump: 0.002,
};

export const AIRCRAFT = {
  length: 38,
  wingspan: 35,
  bodyHeight: 3.8,
  eye: { x: -0.65, y: 5.05, z: -13.6 },
  initialPosition: { x: 0, y: 0, z: 0 },
  navigationLightRadius: 0.11,
  mainWheelX: 2.7,
  mainWheelZ: 3.3,
  noseWheelZ: -12.2,
  gearRetractHeight: 2.1,
  flapAngle: -35 * Math.PI / 180,
  bodyContactPoints: [[0, 1.8, -12], [0, 1.8, 9], [0, 3.9, 17], [-17.5, 2.75, 6.3], [17.5, 2.75, 6.3]],
  navigationLights: [
    { position: [-17.5, 3.65, 6.3], color: 0xff6557 },
    { position: [17.5, 3.65, 6.3], color: 0x76e3a5 },
    { position: [0, 9.1, 18.4], color: 0xfff5db },
  ],
};

export const RUNWAY = {
  length: 4500,
  headings: [0,Math.PI/4,Math.PI/2,Math.PI*3/4],
  width: 60,
  startOffset: 100,
  designator: '36',
  stripeLength: 24,
  stripeGap: 30,
};

export const CAMERA = {
  exterior: { position: [-49, 23, -47], target: [0, 3.5, 0], fov: 48 },
  cockpitFov: 52,
  cockpitLookDown: 5 * Math.PI / 180,
  introSeconds: 4,
  exteriorFade: [0.72, 0.82],
  cockpitFade: [0.82, 1],
  exteriorNear: 1,
  cockpitNear: 0.25,
  far: 36000,
  pixelRatioLimit: 1.5,
  warmupSize: 64, warmupBatchObjects: 4,
};

export const COCKPIT = {
  frameDistance: 2,
  color: 0x18262d,
  trimColor: 0x34454d,
};

export const SCENERY = {
  groundSize: 80000,
  skyRadius: 32000,
  fogNear: 6000,
  fogFar: LOOP_WORLD.radius,
  shadowSize: 2048,
  surfaceLayers: { shoulder: 1, pavement: 2, marking: 3 },
  colors: {
    ground: 0x68755b,
    runway: 0x566269,
    runwayShoulder: 0x74807e,
    marking: 0xf0eee0,
    terminal: 0xd6d8ca,
    glass: 0x577d8b,
    skyTop: 0x4d94bd,
    skyHorizon: 0xb7d4df,
  },
};

export const SYSTEMS = {
  engineStartSeconds: 1.5,
  promptSeconds: 2.5,
};

export const ENGINE_VIBRATION = {
  startingAngle: 0.0022,
  idleAngle: 0.00065,
  startingOffset: 0.008,
  idleOffset: 0.003,
  frequencies: [11, 17],
  fadeInSeconds: 0.3,
};

export const STARTUP_STEPS = [
  { key: 'L', code: 'KeyL', english: 'Light', label: '灯光', system: 'lights', kind: 'prepare' },
  { key: 'D', code: 'KeyD', english: 'Door', label: '舱门锁定', shortLabel: '舱门', readyState: 'Closed', pendingState: 'Open', system: 'door', kind: 'prepare' },
  { key: 'H', code: 'KeyH', english: 'Harness', label: '安全带', system: 'harness', kind: 'prepare' },
  { key: 'A', code: 'KeyA', english: 'Avionics', label: '飞行仪表', system: 'avionics', kind: 'prepare' },
  { key: 'W', code: 'KeyW', english: 'Wing brake', label: '关闭机翼减速板', shortLabel: '机翼减速板', readyState: 'Closed', pendingState: 'Open', system: 'flaps', kind: 'prepare' },
  { key: 'E', code: 'KeyE', english: 'Engine', label: '发动机启动', shortLabel: '发动机', system: 'engine', kind: 'engine' },
  { key: 'R', code: 'KeyR', english: 'Release', label: '松驻车刹车', shortLabel: '松刹车', system: 'parkingBrake', kind: 'release' },
];

// 速度状态、阈值与遭遇配置统一为km/h；坐标积分在边界换算为m/s。
export const FLIGHT = {
  kmhPerMps: 3.6,
  rotationSpeed: 250,
  maxSpeed: 600,
  recommendedPitch: [8, 12],
  climbMinSpeed: 333.36,
  climbMaxSpeed: 407.44,
  gearHeight: 30 / WORLD_HEIGHT.displayScale,
  gearPreviewHeight: 200 / WORLD_HEIGHT.displayScale,
  gearWarningHeight: 200 / WORLD_HEIGHT.displayScale, gearWarningClearHeight: 250 / WORLD_HEIGHT.displayScale, gearWarningPulseSeconds: 0.5,
  completionHeight: 500 / WORLD_HEIGHT.displayScale,
  completionHoldSeconds: 3,
  completionFeedbackSeconds: 1.5,
  // 起步T为18倍，空中T为15倍，S及接地后T为10倍；阻力另行叠加。
  speedRate: 268.54 / 3.6 / 20 / 10,
  speedBrakeRate: 0.6,
  speedMultiplier: 10,
  takeoffSpeedMultiplier: 18,
  airSpeedMultiplier: 15,
  stallSpeed: 150, stallRecoverySpeed: 165,
  stallMinSink: 27, stallMaxSink: 216,
  verticalResponse: 2.5,
  speedTapKmh: 10,
  speedDecayRate: 5, // 始终生效的自然减速，单位为km/h每秒。
  pitchTap: 0.2 * Math.PI / 180,
  pitchRepeat: 1.2 * Math.PI / 180,
  pitchRate: 3 * Math.PI / 180,
  pitchReleaseTravel: 0.2 * Math.PI / 180,
  ceilingPitchRate: 2 * Math.PI / 180,
  ceilingResetHeight: 20 / WORLD_HEIGHT.displayScale,
  groundMaxPitch: 18 * Math.PI / 180,
  minPitch: -65 * Math.PI / 180,
  maxPitch: 35 * Math.PI / 180,
  maxBank: 60 * Math.PI / 180,
  successBank: 10 * Math.PI / 180,
  bankResponse: 4.2,
  airTurnMultiplier: WORLD_TRAVEL.horizontalScale,
  maxAirTurnRate: 45 * Math.PI / 180,
  takeoffPitch: Math.PI / 180,
  groundTurnRate: 0.65,
  groundTurnSpeed: 43.2,
  gravity: 9.81,
  stopSpeed: 0.36,
  contactTolerance: 0.05,
  gearSeconds: 0.5,
  wingBrakeDeceleration: 10, // 打开W时每秒额外减少的km/h。
};

export const LANDING_DEBUG = {
  speed: 400, runwaySeconds: 30, countdownSeconds: 3,
  runwayHeight: 180 / WORLD_HEIGHT.displayScale, lateralOffset: -300,
};

export const DESTRUCTION = {
  seconds: 2.8, seed: 82417, fireCount: 88, smokeCount: 52, sparkCount: 96, debrisCount: 24,
  gravity: 9.81, fireColor: 0xff8c25, smokeColor: 0x302c2a, sparkColor: 0xffd47b,
  camera: [49, 23, 45], cameraShake: 0.5, charColor: 0x302a27,
  birdShakeSeconds: 0.35, birdShakeAngle: 0.008,
  glass: {seed: 53721, distance: 1.7, spokes: 15, rings: 4, flashSeconds: 0.3, failureSeconds: .9,
    lineColor: 0xe3f5fc, edgeColor: 0x344952, facetColor: 0xc7e8f2, opacity: 0.82},
};

export const TAKEOFF_CONTROLS = [
  { key: 'T', english: 'Thrust', label: '提速', action: 'throttle' },
  { key: 'S', english: 'Slow', label: '减速', action: 'slow' },
  { key: '← →', english: 'Steer', label: '保持方向', action: 'steer' },
  { key: '↑ ↓', english: 'Pitch', label: '俯仰', action: 'rotate' },
  { key: 'W', english: 'Wing brake', label: '机翼减速板', action: 'flaps' },
];

export const CLIMB_CONTROLS = [
  { key: 'T / S', english: 'Thrust / slow', label: '提速／减速', action: 'throttle' },
  { key: '↑ ↓', english: 'Pitch', label: '调整俯仰', action: 'pitch' },
  { key: '← →', english: 'Turn', label: '保持平翼', action: 'turn' },
  { key: 'G', english: 'Gear', label: '收起落架', action: 'gear' },
  { key: 'W', english: 'Wing brake', label: '机翼减速板', action: 'flaps' },
];

export const CONTROLS = {
  ...Object.fromEntries(STARTUP_STEPS.map(step => [step.code, { action: step.key }])),
  KeyT: { action: 'T', held: true, press: true },
  KeyS: { action: 'S', held: true, press: true },
  KeyG: { action: 'G' },
  Space: { action: 'space' },
  ArrowLeft: { action: 'left', held: true },
  ArrowRight: { action: 'right', held: true },
  ArrowUp: { action: 'up', held: true, press: true, repeat: true },
  ArrowDown: { action: 'down', held: true, press: true, repeat: true },
};

// 地标采用轮廓化比例，集中于虚构河湾城市，不对应真实城市间的地理位置。
export const WEATHER = {
  recipe: 11, seed: 798431, width: 2800, length: 4000, height: 5376 / WORLD_HEIGHT.displayScale,
  highBand: [7800,8500].map(v=>v/WORLD_HEIGHT.displayScale),
  thinBand: [5800,6500].map(v=>v/WORLD_HEIGHT.displayScale), thinDensity: .36,
  startZ: -11000, spacing: 14500, lateralSpread: 3500, alongJitter: 1000, headingSpread: .25, windKmh: 100,
  wrapMinX: -29000, wrapMaxX: 29000, variants: 6, puffs: 22, meshGrid: [40,32,40], blend: .14,
  // 600 km/h下计入4倍位移，雾远端至少留4秒行程，前方2秒的物体仍有约一半对比度。
  whiteVisibility: Math.max(SCENERY.fogFar*.1,worldHorizontalSpeed(FLIGHT.maxSpeed/3.6)*4),
  thinVisibility: Math.max(SCENERY.fogFar*.15,worldHorizontalSpeed(FLIGHT.maxSpeed/3.6)*6), stormVisibilityRatio: .5,
  flashInterval: [8,16], flashSeconds: .22, strikeChance: .025, maxClouds: 128,
};

export const WEATHER_MOTION = { periodSeconds:15 };

export const WORLD_VARIATION = { cityJitter: 220 };

export const CITY_STREETS = {
  recipe: 3, seed: 814379, widths: [36,96,360], primaryEvery: 3, alleyInset: 150, alleyRoadGap: 12,
  elevation: .6, chunkSize: 3600, carFar: 6500,
  carSpacing: [360,220,160], carDensity: [.18,.38,.42],
  carColors: [0xd6dbd7,0x334d5a,0x8b3c32,0xc4aa71,0x6c848d,0x3e474d,0xb6bab2],
};

export const LANDSCAPE = {
  staticBatchCell: 640,
  seed: 3827,
  city: {
    center: [0, clusterZ('city')], columns: 8, rows: 28, loopRows: 8, layoutRecipe: 4, chunkSize: 1680, spacing: 1200, roadWidth: 70,
    passageWingSpans: 3, passageWidth: 500, corridors: [-3600, -2400, 2400, 3600],
    profiles: [
      {id: 'slender', width: [280, 400], depth: [300, 430], height: [2100, 3000]},
      {id: 'broad', width: [620, 698], depth: [620, 698], height: [1600, 2750]},
      {id: 'midrise', width: [480, 680], depth: [470, 680], height: [350, 1050]},
      {id: 'lowrise', width: [500, 698], depth: [500, 698], height: [60, 300]},
    ],
    landmarkClearance: 1000, riverClearance: 100,
    facade: {tileMetres: [36,72], windowCells: [8,16], detailFootprint: [.18,.65], filterSpread: 3,
      farRoughness: .78, roughness: .62, metalness: .12, clearcoat: .16, clearcoatRoughness: .46,
      roofThickness: 2, parapetThickness: 3, parapetHeight: 3},
    colors: [0x708b91, 0x9bafac, 0x607e87, 0xb4b5a3, 0x8d9da1],
    roofColor: 0x4e6870, roadColor: 0x7c8983, parkColor: 0x777c70,
  },
  river: {
    width: 430, bankWidth: 510, samples: 220, waterColor: 0x4095a8, bankColor: 0xb6b99b,
    points: [[-18000, clusterZ('river', -6100)], [-7000, clusterZ('river', -5700)], [-2200, clusterZ('river', -5500)], [0, clusterZ('river', -5750)], [2500, clusterZ('river', -6100)], [7000, clusterZ('river', -5900)], [18000, clusterZ('river', -6400)]],
    tributary: [[-700, clusterZ('river', -5550)], [-600, clusterZ('river', -6500)], [-900, clusterZ('river', -7400)], [-1700, clusterZ('river', -8200)]],
    bridges: [-2500, 2200], bridgeLength: 1000, bridgeWidth: 34, bridgeHeight: 12, pylonHeight: 95,
  },
  landmarks: [
    { kind: 'canton', name: '广州塔', position: [0, clusterZ('city', -9200)], height: 3600, radius: 140, color: 0xd9ded3 },
    { kind: 'bamboo', name: '深圳春笋', position: [500, clusterZ('city', -9550)], height: 2800, radius: 240, color: 0x8ca6ae },
    { kind: 'twist', name: '上海中心', position: [900, clusterZ('city', -10000)], height: 3900, radius: 270, color: 0x9cb2ba },
    { kind: 'gateway', name: '上海环球金融中心', position: [-950, clusterZ('city', -9950)], height: 3200, radius: 250, color: 0x9aaeb5 },
  ],
  towers: { segments: 64, levels: 48, struts: 28, strutRadius: 1.4, ringRadius: 1.5, frameColor: 0xd7dfd9 },
  mountains: [],
  coast: {
    seaLevel: -.12, seabed: -4, shoreBlend: 600, shoreGrid: 150, alongGrid: 250, airportGrid: 100,
    endZ: -14000 * WORLD_TRAVEL.horizontalScale / 2, startZ: 6000, width: 12000,
    shoreline: [[6000,2400],[2000,1800],[0,1600],[-4000,1100],[-6500,0],[-9000,-2000],[-11500,-6500],[-14000,-41000]].map(([z,x])=>[z<0?z*WORLD_TRAVEL.horizontalScale/2:z,x]),
    airport: {x:115,z:RUNWAY.startOffset-RUNWAY.length/2,halfWidth:RUNWAY.length/2+400,halfLength:RUNWAY.length/2+400,edge:80},
    causeway: {minX:450,maxX:1900,minZ:-560,maxZ:-240,edge:50},
    deepColor:0x287b98,shallowColor:0x58a2ad,waterSegments:[64,96],
    waveScale:[.035,.021],waveRate:[1.1,.75],waveNormal:.045,
    highway: {startZ:2000,endZ:-12000*WORLD_TRAVEL.horizontalScale/2,step:160,waterOffset:100,width:AIRCRAFT.wingspan*4+20,height:12,thickness:1.4,
      airportClearance:240,airportBlend:1600,
      railWidth:.55,railHeight:1,pierWidth:7,pierLength:5,dashLength:6,dashSpacing:18,
      asphaltColor:0x526166,concreteColor:0xb9bcb0,markingColor:0xe6e4cb},
  },
  terrain: {
    segments: 128, lodDistances: [6000, 14000], lodHysteresis: 350,
    lowColor: 0x48623a, highColor: 0x77786d, snowColor: 0xdce3e0,
    snowHeight: 6200, snowTransition: 1100, treeLine: 2400, treeTransition: 900,
    rockScale: 0.008, detailScale: 0.13, bumpStrength: 1.1, textureSize: 512,
    rockColor: 0x888477, soilColor: 0x827657, danxiaColor: 0xa45f42,
    vegetationSlope: [0.22, 0.62], forestSpacing: 80, maxTrees: 420,
    treeNear: 1700, treeFar: 6200, forestCell: 640,
    canopyColors: [0x344c28, 0x465c2e, 0x536437, 0x2d4829],
    sunDirection: [-0.5, 0.8, -0.35], ambientStrength: 1.05, sunStrength: 2.7,
    rockSides: 28, rockRings: 17, resourceBudgetMb: GAME.packageLimitMb,
  },
};

// 保留动力反馈、转向和危险提示参数；不再用迎角受力抵消玩家俯仰或改变空速。
export const AERODYNAMICS = {
  mass: 52000, engineResponseSeconds: 0.8,
  pitchLowWarning: -10 * Math.PI / 180,
  groundWarningHeight: 120 / WORLD_HEIGHT.displayScale, descentWarningAngle: -6 * Math.PI / 180,
  warningRecoverySeconds: 0.8,
  maxRollRate: 60 * Math.PI / 180, tireFriction: 0.7,
};

export const GEAR_PREVIEW = {
  fov: 88, near: 0.1, far: 1800, distance: 8,
  side: -6, height: 2.2, targetDrop: 0.5, targetDropLimit: 5.5,
};

export const AIRCRAFT_PREVIEW = {
  fov: 32, camera: [-34, 18, 44], target: [0, 3, 0], background: 0x18333e,
  traffic: { radius: 42, ownScale: 1.6, symbolScale: 1.35, camera: [-52,74,74], fov: 42,
    aircraftColor: 0x9edcf1, geeseColor: 0xffd77b, dangerColor: 0xe54832, ownColor: 0xa7e4bc,
    arrowSize: 2, minimumPath: 8, maximumPath: 32 },
  landingColors: { safe: 0x63cd7e, caution: 0xe8a00f, danger: 0xd92619 },
  groundColor: 0x274753, gridColor: 0x55717a, gridSize: 160, gridDivisions: 8, gridHeight: -7,
};

// 目的地停放实体只生成布局和状态，模型在准备阶段复用共享资源。
export const AIRPORT_TRAFFIC = {
  seed: 930172, planes: 4, trucks: 8, entryClearance: 700, endClearance: 300,
  laneFraction: 0.3, lateralJitter: 0.14, headingJitter: 0.38,
  truckSize: {width: 4, height: 4, length: 10}, truckSpeedRetention: 0.9,
  truckLaunch: {side: 19, up: 14, forward: 16, speedTransfer: 1.15, gravity: 9.81, rollRate: 4.4, yawRate: 2.3},
};

// 通用航程规则；每关通过 createRoute 生成独立配置，不修改共享对象。
export const ROUTE = {
  courseDeviation: 900, contactLifetime: 40, sweepStep: 0.5, touchdownOffset: 350 * WORLD_TRAVEL.horizontalScale,
  taxiSpeed: 37.04, approachSpeed: 140, approachSpeedRange: [60, 180],
  glideSlope: 4 * Math.PI / 180,
  sampleSeconds: 0.25, mapHalfWidth: 3500, collisionCell: 512, bodyRadius: 1.7,
  ceiling: WORLD_HEIGHT.flightMax,
  radarRange: 2600 * WORLD_TRAVEL.horizontalScale, radarLead: 10, radarDanger: 100, radarVertical: 100, radarHorizon: 12,
  apronOffset: 1350, parkedSpeed: 7.2, parkHold: 1,
  landingMinSpeed: 60, landingMaxSpeed: 180,
  landingMinPitch: -3 * Math.PI / 180, landingMaxPitch: 3 * Math.PI / 180,
  landingDangerHeight: 30 / WORLD_HEIGHT.displayScale, landingDangerFactor: 1.5, landingGuideHeight: 200 / WORLD_HEIGHT.displayScale,
  landingSettleSeconds: 1.2, landingSettleResponse: 6, landingSettleRate: 180 * Math.PI / 180,
  gearMaxSpeed: 407.44,
  destination: { x: 0, length: 9000, width: 240, headings: RUNWAY.headings,
    apron: { x: 600, width: 420, length: 850 } },
  encounterExtraGapSeconds: 30,
  finalApproachHeight: 200 / WORLD_HEIGHT.displayScale, finalApproachDistance: 2500,
  encounters: [
    { at: 6, kind: 'geese', course: 'head-on', offset: 0, height: 0, speed: 82.8 },
    { at: 22, kind: 'aircraft', course: 'head-on', offset: 12, height: 0, speed: 414 },
    { at: 38, kind: 'aircraft', course: 'crossing', offset: 0, height: 0, speed: 360 },
    { at: 55, kind: 'geese', course: 'head-on', offset: -22, height: 0, speed: 90 },
    { at: 72, kind: 'aircraft', course: 'diagonal', offset: -18, height: 10, speed: 396 },
    { at: 92, kind: 'aircraft', course: 'same-way', offset: 0, height: -5, speed: 273.6 },
  ],
  birdStrikeSpeedRatio: 0.8, birdThrustLockHits: 2,
  birdCount: 17, birdSpacing: 12, birdVerticalSpacing: 8, birdScale: 2.5, birdRadius: 2.5, birdHeight: 1.9,
  trafficScale: 2, trafficRadius: 20, trafficHeight: 8,
  rearApproachHalfAngle: 30 * Math.PI / 180,
  contactMarkerRange: 2600 * WORLD_TRAVEL.horizontalScale, contactMarkerNear: 80, birdFlapRate: 7, birdFlapAngle: 0.65,
};

// 三关共用深圳起点与前段路线；距离和海拔均为游戏化预设。
export const LEVELS = [
  { id: 1, destinationName: '广州', destinationEnglish: 'Guangzhou', deadline: 300, cruiseSpeed: 370.4, approachDistance: 7000 * WORLD_TRAVEL.horizontalScale, threshold: -78500 },
  { id: 2, destinationName: '长沙', destinationEnglish: 'Changsha', deadline: 480, cruiseSpeed: 416.7, approachDistance: 6000 * WORLD_TRAVEL.horizontalScale, threshold: -158000 },
  { id: 3, destinationName: '武汉', destinationEnglish: 'Wuhan', deadline: 600, cruiseSpeed: 453.74, approachDistance: 7000 * WORLD_TRAVEL.horizontalScale, threshold: -206000 },
];

export const JOURNEY = {
  sectors: [
    { z: -3200 * WORLD_TRAVEL.horizontalScale, english: 'Coastal expressway', chinese: '沿江高速', kind: 'coast', level: 1 },
    { z: -5600 * WORLD_TRAVEL.horizontalScale, english: 'Pearl river estuary', chinese: '珠江河口', kind: 'river', level: 1 },
    { z: clusterZ('fields'), english: 'Farmland', chinese: '田野', kind: 'field', level: 1 },
    { z: clusterZ('city'), english: 'Guangzhou city', chinese: '广州城市群', kind: 'city', level: 1 },
    { z: clusterZ('danxia'), english: 'Danxia mountains', chinese: '丹霞山', kind: 'danxia', level: 2 },
    { z: clusterZ('pillars'), english: 'Zhangjiajie', chinese: '张家界与空中瀑布', kind: 'pillars', level: 2 },
    { z: clusterZ('island'), english: 'Orange isle', chinese: '橘子洲头', kind: 'island', level: 2 },
    { z: clusterZ('island') - 800, english: 'Wuyi square', chinese: '五一广场', kind: 'city', level: 2 },
    { z: clusterZ('lake'), english: 'Dongting lake', chinese: '洞庭湖', kind: 'lake', level: 3 },
    { z: clusterZ('pagoda'), english: 'Yellow crane tower', chinese: '黄鹤楼', kind: 'pagoda', level: 3 },
  ],
  danxia: [
    { position: [0, clusterZ('danxia', -11600)], sourcePosition: [-800, -11600], height: 2450, radius: [440, 4250], kind: 'danxia' },
    { position: [2200, clusterZ('danxia', -12000)], sourcePosition: [950, -12000], height: 2300, radius: [800, 5000], kind: 'danxia' },
    { position: [-2600, clusterZ('danxia', -12700)], sourcePosition: [-1600, -12700], height: 3900, radius: [850, 5500], kind: 'danxia' },
    { position: [3300, clusterZ('danxia', -13600)], sourcePosition: [1800, -12900], height: 2600, radius: [750, 5000], kind: 'danxia' },
  ],
  courseBuildings: [
    {level: 3, x: 0, z: -165000, width: 240, depth: 220, height: 2900, color: 0x829b9e, name: '航道高楼'},
  ],
  rockColors: { danxia: 0x975949, danxiaBand: 0xd59a71, pillars: 0xc7aa72, cap: 0x49672f },
  pillarSurface: { light: 0xe3c68e, weathered: 0x92723e, capLight: 0x708c45,
    patchScale: 0.007, heightScale: 0.0015, streakScale: 0.027, streakDrift: 0.0012,
    lightBlend: 0.38, weathering: 0.48, weatherThreshold: [0.45,0.8], strataStrength: 0.55 },
  pillars: { seed: 2387410263, count: 24, depthScale: 1.65, startZ: clusterZ('pillars', -12800), spacing: 2200, minHeight: 2100, heightRange: 1900, heightBias: 3, minRadius: 450, radiusRange: 200,
    shapeVariation: 0.12, crownInset: 0.73,
    forms: [
      { width: 1, depth: 0.9, cutDepth: 0.55, cuts: 1 },
      { width: 0.85, depth: 1, cutDepth: 0.68, cuts: 2 },
      { width: 0.85, depth: 0.9, cutDepth: 0.48, cuts: 3 },
      { width: 1, depth: 1, cutDepth: 0.86, cuts: 1 },
    ] },
  skyRock: { x: 0, z: clusterZ('pillars', -13750), bottom: 850, top: 2600, radius: 620, color: 0xc0a374 },
  slantedRock: { x: -880, z: clusterZ('pillars', -14150), bottom: 0, top: 2400, radius: 440, lean: 300, color: 0xc3a36a },
  skyFalls: [
    { id: 'sky-falls', x: 0, z: clusterZ('pillars', -13390), bottom: 0, top: 1100, width: 190, passable: true },
    { id: 'side-falls', x: -540, z: clusterZ('pillars', -13920), bottom: 0, top: 760, width: 150, passable: true },
  ],
  island: { x: 370, z: clusterZ('island'), width: 480, length: 7500, riverWidth: 1800, riverLength: 11000, statueHeight: 170 },
  changsha: { x: 2250, z: clusterZ('island') - 800, columns: 5, rows: 21,
    spacing: 1200, corridors: [-1800, -600, 600, 1800], plaza: [1050, 900], name: '五一广场' },
  pagodaRidge: { height: 1150, radius: [2600, 10000], satellites: 12 },
  lake: { x: 0, z: clusterZ('lake'), width: 6500, length: 17500, elevation: 0 },
  pagoda: { x: 185, z: clusterZ('pagoda'), height: 2650, width: 720, levels: 5, eaves: 1.5 },
  transitions: {
    seed: 409361, segments: 48, hills: 4, hillHeight: [48, 180], hillRadius: [400, 700],
    corridor: 260, meadowWidth: 6500, meadowSegments: [48, 16],
    meadowColor: 0x90a778, bankColor: 0xa8b48c, waterColor: 0x538f98,
    streamWidth: 38, streamBankWidth: 68, streamSamples: 160,
    zones: [
      {id:'departure-meadow',hills:0,z:-9800,length:1600,level:1},
      {id:'estuary-stream',hills:0,z:-20000,length:1400,level:1},
      {id:'city-entry',hills:0,z:-27000,length:1000,level:1},
      {id:'guangzhou-meadow',hills:0,z:-66000,length:900,level:1,lastLevel:1},
      {id:'danxia-entry',z:-65000,length:1600,level:2},
      {id:'pillar-entry',z:-89000,length:1400,level:2},
      {id:'island-entry',z:-119000,length:1200,level:2},
      {id:'changsha-exit',z:-147000,length:1400,level:2},
      {id:'lake-entry',z:-145800,length:1000,level:3},
      {id:'pagoda-entry',z:-165000,length:1000,level:3},
      {id:'wuhan-approach',z:-193000,length:1000,level:3},
    ],
  },
  groundSegments: 180,
};

// 所有机场与航线基准地面均为零海拔，起伏仅来自实际山体和地景。
export function terrainElevation() { return 0; }

export function createRoute(levelId = 1) {
  const level = LEVELS.find(item => item.id === Number(levelId)) || LEVELS[0];
  const elevation = terrainElevation(level.threshold);
  const destination = { ...ROUTE.destination, threshold: level.threshold, elevation,
    apron: { ...ROUTE.destination.apron, z: level.threshold - ROUTE.apronOffset } };
  const sectors = JOURNEY.sectors.filter(item => item.level <= level.id);
  if (level.id === 1) sectors.push({ z: clusterZ('village'), english: 'Village', chinese: '村庄', kind: 'village' });
  sectors.push({ z: level.threshold, english: `${level.destinationEnglish} airport`, chinese: `${level.destinationName}机场`, kind: 'airport' });
  return { ...ROUTE, ...level, elevation, destination, sectors,
    transitions: JOURNEY.transitions.zones.filter(zone => zone.level <= level.id && (!zone.lastLevel || level.id <= zone.lastLevel) && zone.z > level.threshold + zone.length / 2),
    cruiseHeight: 550, mountains: [...LANDSCAPE.mountains, ...(level.id >= 2 ? JOURNEY.danxia : [])],
    encounters: ROUTE.encounters.map((spec, index) => ({ ...spec, at: spec.at * (level.deadline / 200) + index * ROUTE.encounterExtraGapSeconds })) };
}

export const AUDIO = {
  masterGain: 0.6, smoothingSeconds: 0.045, attackSeconds: 0.006, gainFloor: 0.0001,
  limiterThreshold: -18, limiterRatio: 4, maxShots: 8, noiseSeconds: 2, noiseQ: 0.6,
  engineGain: 0.075, harmonicGain: 0.0175, fanGain: 0.049, idleLevel: 0.32, startLevel: 0.8,
  engineIdleHz: 48, engineStartHz: 22, engineStartSweep: 36, enginePowerSweep: 86, engineHarmonic: 2.03,
  fanIdleHz: 420, fanPowerSweep: 1900,
  windGain: 0.0375, windIdleHz: 650, windSpeedSweep: 1100, speedCap: 2, groundWindScale: 0.45,
  wheelGain: 0.16, wheelIdleHz: 160, wheelSpeedSweep: 850, wheelRoughness: 0.22, wheelBumpRate: 32, brakeGainScale: 1.35,
  motorGain: 0.045, motorHz: 185,
  alarmGain: 0.09, alarmHigh: 880, alarmLow: 660, alarmPeriod: 0.8, alarmPulse: 0.16,
  voiceDuck: 0.55,
  cabinChime: {
    firstSeconds: [18, 28], intervalSeconds: [45, 75], noteGapSeconds: 0.38,
    notes: [
      {type: 'sine', frequency: 784, endFrequency: 784, seconds: 0.65, gain: 0.065},
      {type: 'sine', frequency: 587.33, endFrequency: 587.33, seconds: 0.85, gain: 0.06},
    ],
  },
  lightningAlarm: {seconds: 3, lowHz: 430, highHz: 920, rate: 2.6, gain: .075},
  thunder: {seconds: 1.5, gain: .075, frequency: 360, endFrequency: 55},
  explosion: {seconds: 1.5, gain: 0.65, frequency: 1700, endFrequency: 85},
  birdImpact: {seconds: 0.16, gain: 0.18, frequency: 1100, endFrequency: 180},
  glassImpact: {seconds: 0.24, gain: 0.12, frequency: 5600, endFrequency: 1700},
  cues: {
    countdown: { type: 'sine', frequency: 650, endFrequency: 500, seconds: 0.07, gain: 0.08 },
    switchOn: { type: 'triangle', frequency: 1300, endFrequency: 480, seconds: 0.07, gain: 0.12 },
    switchOff: { type: 'triangle', frequency: 700, endFrequency: 240, seconds: 0.08, gain: 0.1 },
    latch: { type: 'triangle', frequency: 240, endFrequency: 65, seconds: 0.16, gain: 0.2 },
    start: { type: 'sine', frequency: 160, endFrequency: 55, seconds: 0.25, gain: 0.16 },
    explosion: {type: 'sine', frequency: 95, endFrequency: 24, seconds: 0.7, gain: 0.3},
    confirm: { type: 'sine', frequency: 540, endFrequency: 810, seconds: 0.13, gain: 0.09 },
  },
  voice: {
    welcome: 'Welcome aboard',
    preferredNames: ['Samantha', 'Karen', 'Moira', 'Serena', 'Tessa', 'Victoria', 'Sonia', 'Susan', 'Aria', 'Jenny', 'Zira', 'Female'],
    rate: 1, pitch: 1, volume: 0.7, maxSeconds: 2.5, voiceRetrySeconds: 0.5, startTimeoutSeconds: 3,
    prepared: { L: 'Light', D: 'Door closed', H: 'Harness secured', A: 'Avionics', W: 'Wing brake closed' },
    unprepared: { L: 'Light off', D: 'Door open', H: 'Harness released', A: 'Avionics off', W: 'Wing brake open' },
    events: {
      'engine-start': 'Engine', 'engine-ready': 'Engines ready', 'engine-stop': 'Engines off',
      released: 'Cleared for takeoff', 'brake-set': 'Parking brake', liftoff: 'Airborne. Positive climb',
      'gear-start': 'Gear moving', 'gear-up': 'Gear up', 'gear-down': 'Gear down',
      'flaps-up': 'Wing brake closed', 'flaps-down': 'Wing brake open',
      'pitch-low': 'Raise nose', stall: 'Stall', 'stall-recovered': 'Stall recovered',
      ceiling: 'Altitude limit', 'fault-recovered': 'Power restored', traffic: 'Traffic',
      'climb-complete': 'Climb complete',
      'bird-strike': 'Bird strike. Window damaged', 'gear-warning': 'Landing gear. Press G', landed: 'Touchdown. Apply brakes', waterfall: 'Congratulations',
    },
  },
};

export const FLIGHT_PHASES = ['TAKEOFF_ROLL', 'INITIAL_CLIMB', 'CRUISE', 'APPROACH', 'LANDING_ROLL', 'TAXI'];
