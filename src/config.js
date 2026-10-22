import { arcPoint, prepareRoutePath } from './route-path.js';
export { isWithinRunway } from './runway-layout.js';

export const GAME = {
  fixedStep: 1 / 120,
  maxFrameSeconds: 0.05,
  scenePrepareLimitSeconds: 8, browserPrepareLimitSeconds:4,
  packageLimitMb: 50,
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

// 显示范围独立于地形、碰撞及模板配置，调视距不重建世界。
export const VIEW_DISTANCE = {scale:.7};

export const WORLD_BOUNDARY = {
  halfWidth: 22000, front: 6500, back: -235000, width: 3500,
  height: 6000, crossSegments: 16, alongStep: 300,
  name: '航道高山', reason: '偏离航道太远，撞上高山。',
};

export const TREE_CONTACT = {
  cell:512,unitHeight:1.065,
  windowSeconds:3,treeDamage:5,birdDamage:20,treeSpeedRetention:.95,
};
export const TREE_HEIGHTS = {
  recipe:3,seed:491637,scale:5200,detailScale:2600,
  flat:[30,10000].map(v=>v/WORLD_HEIGHT.displayScale),
  heightKnots:[30,3000,5000,7500,10000].map(v=>v/WORLD_HEIGHT.displayScale),
  // 平地场按75%、8.33%、8.33%、8.33%标定，周期模板单独校准，保留连续变化。
  noiseKnots:[0.01380061,0.60596216,0.65843283,0.72068537,0.9570068],
  periodicNoiseKnots:[0.29881081,0.71159942,0.74850373,0.77368679,0.82476388],
  shrubMax:500/WORLD_HEIGHT.displayScale,poplarMin:6000/WORLD_HEIGHT.displayScale,
  mountain:[100,1500].map(v=>v/WORLD_HEIGHT.displayScale),
  mountainFloor:[200,1000].map(v=>v/WORLD_HEIGHT.displayScale),
};
export const TREE_MODELS = {
  recipe:7,seed:643179,nearDetail:1,farDetail:0,branchSegments:8,
  leaflets:[32,40,48,28,36,32],midLeafCards:3,leafAlphaCutoff:.32,leafLightFill:.22,
  chunkSize:1200,visibleDistance:12000,fadeStart:10000,leafMinPixels:3,blurDistance:[12000,22000],farCrownGroups:[4,4,4,6,4,3],
  species:[
    {id:'poplar',name:'杨树',height:[500,10000],width:[.18,.27],radius:.58,tall:true,color:0x8ba75d},
    {id:'banyan',name:'榕树',height:[500,6000],width:[1.3,1.9],radius:.78,tall:false,color:0x6b9657},
    {id:'willow',name:'柳树',height:[500,6000],width:[.9,1.35],radius:.62,tall:false,color:0x9eb66b},
    {id:'pine',name:'松树',height:[500,6000],width:[.4,.6],radius:.56,tall:false,color:0x769c76},
    {id:'ginkgo',name:'银杏',height:[500,6000],width:[.85,1.25],radius:.70,tall:false,color:0xb7b34f},
    {id:'shrub',name:'灌木',height:[30,500],width:[1.6,2.8],radius:.59,tall:false,color:0x86a457},
  ],
};

export const FOLIAGE_TEXTURE = {recipe:3,seed:715391,size:1024,tiles:2,source:'foliage-source-v1'};
export const ROCK_SURFACE = {recipe:1,bandScale:.025,fractureStrength:.24,materialDistances:[10000,22000],fineFade:[6000,10000],coarseFade:[16000,22000],blurDistance:[12000,23000]};
export const FACADE_SURFACE = {recipe:1,seed:851627,frameShade:.72,glassRoughness:.34,stoneRoughness:.86,farFilter:5,blurDistance:[10000,22000]};

export const SCENERY_DETAIL = {recipe:1,roofSegments:6,roundSegments:24,sphereRings:14,archSegments:16,detailDistance:7000};

export const REGION_BLEND = {
  length: 6000, width: 12000, seed: 952731,
  approachClearance: 13000, airportHalfWidth: 750,
  treeArea: 260000, treeNear: 450, treeFar: 9500,
};

export const HARBOR = {
  x: -3000, z: -9000 * WORLD_TRAVEL.horizontalScale / 2,
  containerColors: [0x7c9b9b,0xa45039,0xc7ab60,0x6f8471,0x446c7d,0xb8b6a3,0x8d5f4c],
};

export const COUNTRYSIDE = {
  cacheRecipe: 10, treeNear: 450, treeFar: 9500,
  fieldSpacing: 420, fieldDepth: 310, roadWidth: 28, treeArea: 300000,
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
  far: 36000*VIEW_DISTANCE.scale,
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
  fogNear: 12000,
  fogFar: LOOP_WORLD.radius*VIEW_DISTANCE.scale,
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

// 气流仅按实际在空中的时间调度，速度作用与T／S及固定阻力独立叠加。
export const AIR_CURRENTS = {
  intervalSeconds:70, gustSeconds:12, turbulenceSeconds:10, rampSeconds:1,
  turbulenceChance:.15, tailwindRatio:.5, headwindRatio:-.6, correctionRatio:.5,
  sideYawRate:3*Math.PI/180, turbulentYawRate:32*Math.PI/180,
  turbulentPitchRate:6*Math.PI/180, sideBank:5*Math.PI/180, turbulentBank:65*Math.PI/180,
};

// 轻量屏幕气流痕迹与合成风声共用节奏，不参与资源缓存或飞行受力。
export const WIND_EFFECTS = {pulseHz:1.1,travelSeconds:1.35,waves:3,tracesPerWave:10,opacity:.72};

export const REGIONAL_WATER = {
  recipe:1, riverSamples:96, islandSamples:40, lakeSubdivisions:3, waterSubdivisions:3,
  shoreWidth:45, waterElevation:.075, landElevation:.11, depthDistance:850,
  riverColors:[0x769b87,0x355e61],lakeColors:[0x8aab93,0x3c6972],
  bankColor:0x9caa82,islandColor:0x708652,
  waveScale:[.019,.027],waveRate:[.8,.53],waveNormal:.045,
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
  recipe: 12, seed: 798431, width: 2800, length: 4000, height: 5376 / WORLD_HEIGHT.displayScale,
  highBand: [7800,8500].map(v=>v/WORLD_HEIGHT.displayScale),
  thinBand: [5800,6500].map(v=>v/WORLD_HEIGHT.displayScale), thinDensity: .36,
  startZ: -11000, spacing: 14500, lateralSpread: 3500, alongJitter: 1000, headingSpread: .25, windKmh: 100,
  wrapMinX: -29000, wrapMaxX: 29000, variants: 6, puffs: 22, meshGrid: [40,32,40], blend: .14,
  shape: {warp:.075,warpScale:3.1,billowScale:5.5,detailScale:15,erosion:.28},
  // 600 km/h下计入4倍位移，雾远端至少留4秒行程，前方2秒的物体仍有约一半对比度。
  whiteVisibility: Math.max(SCENERY.fogFar*.1,worldHorizontalSpeed(FLIGHT.maxSpeed/3.6)*4),
  thinVisibility: Math.max(SCENERY.fogFar*.15,worldHorizontalSpeed(FLIGHT.maxSpeed/3.6)*6), stormVisibilityRatio: .5,
  flashInterval: [8,16], flashSeconds: .22, strikeChance: .025, maxClouds: 128,
};

export const WHITE_CLOUD_SCALE = {width:.7,height:.9};

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
    endZ: -14000 * WORLD_TRAVEL.horizontalScale / 2, startZ: 6000, width: 36000,
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
    vegetationSlope: [0.22, 0.62], forestSpacing: 180, maxTrees: 150,
    treeNear: 350, treeFar: 6200, forestCell: 640,
    canopyColors: [0x344c28, 0x465c2e, 0x536437, 0x2d4829],
    sunDirection: [-0.5, 0.8, -0.35], ambientStrength: 1.05, sunStrength: 2.7,
    rockSides: 28, rockRings: 17,
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
  spatialCellSize:1800,spatialMaxCells:16,instanceCellSize:600,instanceSplitCount:256,
  detailBudget:{terrainGeometry:1,terrainMaterial:1},
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

// 四关共用深圳起点与前段路线；距离和海拔均为游戏化预设。
export const NORTHERN_ARC = {startZ:-200000,radius:260000,angle:Math.PI/4};
const xianEntry=arcPoint(NORTHERN_ARC,-NORTHERN_ARC.startZ+NORTHERN_ARC.radius*NORTHERN_ARC.angle);
const xianCenter={x:xianEntry.x-Math.SQRT1_2*ROUTE.destination.length/2,z:xianEntry.z-Math.SQRT1_2*ROUTE.destination.length/2};

export const LEVELS = [
  { id: 1, destinationName: '广州', destinationEnglish: 'Guangzhou', deadline: 300, cruiseSpeed: 370.4, approachDistance: 7000 * WORLD_TRAVEL.horizontalScale, threshold: -78500 },
  { id: 2, destinationName: '长沙', destinationEnglish: 'Changsha', deadline: 480, cruiseSpeed: 416.7, approachDistance: 6000 * WORLD_TRAVEL.horizontalScale, threshold: -158000 },
  { id: 3, destinationName: '武汉', destinationEnglish: 'Wuhan', deadline: 600, cruiseSpeed: 453.74, approachDistance: 7000 * WORLD_TRAVEL.horizontalScale, threshold: -206000 },
  { id: 4, destinationName: '西安', destinationEnglish: "Xi'an", deadline: 1080, cruiseSpeed: 500, approachDistance: 7000 * WORLD_TRAVEL.horizontalScale, threshold: xianCenter.z+ROUTE.destination.length/2, x:xianCenter.x, arc:NORTHERN_ARC },
];

// 城市按真实旅游资源选材，位置与尺度服从压缩航线及机场净空。
export const TOURISM = {
  recipe: 1, promptSeconds: 3, visitHalfDepth: 2400, visitHalfWidth: 18000,
  columns: 8, rows: 12, spacing: 1200, plaza: [2400, 2400],
  cities: [
    {id:'shenzhen',name:'深圳',english:'Shenzhen',level:1,x:10500,z:-10000,kind:'sail',landmark:'深圳湾春茧',second:'大鹏所城',theme:'fort'},
    {id:'dongguan',name:'东莞',english:'Dongguan',level:1,x:10500,z:-26000,kind:'garden',landmark:'可园',second:'虎门威远炮台',theme:'fort'},
    {id:'zhaoqing',name:'肇庆',english:'Zhaoqing',level:1,x:-10500,z:-56000,kind:'cliff',landmark:'七星岩',second:'星湖牌坊',theme:'gate'},
    {id:'shaoguan',name:'韶关',english:'Shaoguan',level:2,x:-10500,z:-75000,kind:'temple',landmark:'南华禅寺',second:'风采楼',theme:'gate'},
    {id:'chenzhou',name:'郴州',english:'Chenzhou',level:2,x:10500,z:-83000,kind:'cliff',landmark:'高椅岭',second:'东江湖码头',theme:'marina'},
    {id:'zhangjiajie',name:'张家界',english:'Zhangjiajie',level:2,x:-10500,z:-103000,kind:'arch',landmark:'天门山天门洞',second:'土家吊脚楼',theme:'stilt'},
    {id:'hengyang',name:'衡阳',english:'Hengyang',level:2,x:10500,z:-106000,kind:'temple',landmark:'南岳大庙',second:'衡山祝融殿',theme:'pagoda'},
    {id:'yueyang',name:'岳阳',english:'Yueyang',level:3,x:10500,z:-152000,kind:'pagoda',landmark:'岳阳楼',second:'洞庭湖帆船港',theme:'marina'},
    {id:'chibi',name:'赤壁',english:'Chibi',level:3,x:-10500,z:-169000,kind:'fort',landmark:'赤壁古战场',second:'拜风台',theme:'temple'},
    {id:'xianning',name:'咸宁',english:'Xianning',level:3,x:10500,z:-181000,kind:'spring',landmark:'咸宁温泉园',second:'九宫山山庄',theme:'stilt'},
    {id:'wuhan',name:'武汉',english:'Wuhan',level:3,x:-10500,z:-190000,kind:'bridge',landmark:'武汉长江大桥',second:'湖北省博物馆',theme:'museum'},
    {id:'xinyang',name:'信阳',english:'Xinyang',level:4,arcProgress:0.035,side:1,columns:10,rows:14,kind:'terrace',landmark:'鸡公山',theme:'lake-garden',second:'南湾湖',extra:'tea',third:'信阳茶园'},
    {id:'zhumadian',name:'驻马店',english:'Zhumadian',level:4,arcProgress:0.095,side:-1,columns:10,rows:14,kind:'peaks',landmark:'嵖岈山',theme:'temple',second:'南海禅寺',extra:'gate',third:'天中山牌坊'},
    {id:'nanyang',name:'南阳',english:'Nanyang',level:4,arcProgress:0.155,side:1,columns:10,rows:14,kind:'temple',landmark:'武侯祠',theme:'academy',second:'内乡县衙',extra:'museum',third:'汉画馆'},
    {id:'pingdingshan',plaza:[2600,2400],name:'平顶山',english:'Pingdingshan',level:4,arcProgress:0.215,side:-1,columns:10,rows:14,kind:'buddha',landmark:'中原大佛',theme:'peaks',second:'尧山',extra:'temple',third:'香山寺'},
    {id:'xuchang',name:'许昌',english:'Xuchang',level:4,arcProgress:0.275,side:1,columns:10,rows:14,kind:'fort',landmark:'曹魏古城',theme:'palace',second:'春秋楼',extra:'pagoda',third:'文峰塔'},
    {id:'kaifeng',name:'开封',english:'Kaifeng',level:4,arcProgress:0.335,side:-1,columns:10,rows:14,kind:'song-garden',landmark:'清明上河园',theme:'palace',second:'龙亭',extra:'brick-pagoda',third:'开封铁塔'},
    {id:'zhengzhou',name:'郑州',english:'Zhengzhou',level:4,arcProgress:0.395,side:1,columns:10,rows:14,kind:'museum',landmark:'河南博物院',theme:'sail',second:'千玺广场',extra:'terrace',third:'黄河文化公园'},
    {id:'dengfeng',name:'登封',english:'Dengfeng',level:4,arcProgress:0.455,side:-1,columns:10,rows:14,kind:'pagoda-forest',landmark:'少林寺塔林',theme:'temple',second:'少林寺',extra:'academy',third:'嵩阳书院'},
    {id:'jiaozuo',name:'焦作',english:'Jiaozuo',level:4,arcProgress:0.515,side:1,columns:10,rows:14,kind:'canyon',landmark:'云台山红石峡',theme:'temple',second:'青天河寺院',extra:'terrace',third:'神农山'},
    {id:'luoyang',name:'洛阳',english:'Luoyang',level:4,arcProgress:0.575,side:-1,columns:10,rows:14,kind:'grotto',landmark:'龙门石窟',theme:'palace',second:'应天门',extra:'temple',third:'白马寺'},
    {id:'sanmenxia',name:'三门峡',english:'Sanmenxia',level:4,arcProgress:0.635,side:1,columns:10,rows:14,kind:'dam',landmark:'黄河大坝',theme:'gate',second:'函谷关',extra:'museum',third:'虢国博物馆'},
    {id:'huayin',name:'华阴',english:'Huayin',level:4,arcProgress:0.695,side:-1,columns:10,rows:14,kind:'peaks',landmark:'华山',theme:'temple',second:'西岳庙',extra:'fort',third:'华阴古城'},
    {id:'weinan',name:'渭南',english:'Weinan',level:4,arcProgress:0.755,side:1,columns:10,rows:14,kind:'village',landmark:'党家村',theme:'pagoda',second:'慧照寺塔',extra:'gate',third:'渭南鼓楼'},
    {id:'lintong',name:'临潼',english:'Lintong',level:4,arcProgress:0.815,side:-1,columns:10,rows:14,kind:'terracotta',landmark:'兵马俑',theme:'palace',second:'华清宫',extra:'terrace',third:'骊山'},
    {id:'xian',name:'西安',english:"Xi'an",level:4,arcProgress:0.925,side:1,columns:10,rows:14,kind:'brick-pagoda',landmark:'大雁塔',theme:'city-wall',second:'西安城墙',extra:'palace',third:'大明宫'},
  ],
  visits: [
    {id:'guangzhou',name:'广州',english:'Guangzhou',level:1,z:-47000},
    {id:'changsha',name:'长沙',english:'Changsha',level:2,z:-130000},
  ],
};

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
  island: { x: 370, z: clusterZ('island'), width: 760, length: 9000, riverWidth: 3200, riverLength: 31000, statueHeight: 170 },
  changsha: { id:'changsha-east', x: 4520, z: clusterZ('island') - 800, columns: 3, rows: 21,
    spacing: 1200, corridors: [-1800, -600, 600, 1800], plaza: [1050, 900], name: '五一广场' },
  changshaWest: { id:'changsha-west', x:-3780, z:clusterZ('island')-800, columns:3, rows:21,
    spacing:1200,corridors:[-600,600],plaza:[900,600],name:'湘江西岸城区' },
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
  const destination = { ...ROUTE.destination, x:level.x??ROUTE.destination.x, threshold: level.threshold, elevation,
    apron: { ...ROUTE.destination.apron, x:(level.x??0)+ROUTE.destination.apron.x, z: level.threshold - ROUTE.apronOffset } };
  const sectors = JOURNEY.sectors.filter(item => item.level <= level.id);
  if (level.id === 1) sectors.push({ z: clusterZ('village'), english: 'Village', chinese: '村庄', kind: 'village' });
  sectors.push({ z: level.threshold, english: `${level.destinationEnglish} airport`, chinese: `${level.destinationName}机场`, kind: 'airport' });
  const cities=TOURISM.cities.filter(city=>city.level<=level.id).map(city=>{
    if(city.arcProgress===undefined)return {...city,columns:city.columns??TOURISM.columns,rows:city.rows??TOURISM.rows,spacing:TOURISM.spacing};
    const distance=-level.arc.startZ+level.arc.radius*level.arc.angle*city.arcProgress,visit=arcPoint(level.arc,distance),district=arcPoint(level.arc,distance,city.side*10500);
    return {...city,x:district.x,z:district.z,visitX:visit.x,visitZ:visit.z,distance,spacing:TOURISM.spacing};
  });
  const arcEnd=level.arc?arcPoint(level.arc,-level.arc.startZ+level.arc.radius*level.arc.angle):null;
  if(arcEnd){destination.approachHeading=arcEnd.heading;destination.entry={x:arcEnd.x,z:arcEnd.z};}
  return prepareRoutePath({ ...ROUTE, ...level, elevation, destination, sectors,cellSize:LOOP_WORLD.tileSize,
    boundary:level.arc?{...WORLD_BOUNDARY,centerX:-43000,halfWidth:69000,back:-415000}:WORLD_BOUNDARY,
    cities,
    cityVisits: [...cities,...TOURISM.visits.filter(city=>city.level<=level.id)].sort((a,b)=>(a.distance??-a.z)-(b.distance??-b.z)),
    transitions: JOURNEY.transitions.zones.filter(zone => zone.level <= level.id && (!zone.lastLevel || level.id <= zone.lastLevel) && zone.z > level.threshold + zone.length / 2),
    cruiseHeight: 550, mountains: [...LANDSCAPE.mountains, ...(level.id >= 2 ? JOURNEY.danxia : [])],
    encounters: ROUTE.encounters.map((spec, index) => ({ ...spec, at: spec.at * (level.deadline / 200) + index * ROUTE.encounterExtraGapSeconds })) });
}

export const AUDIO = {
  masterGain: 0.6, smoothingSeconds: 0.045, attackSeconds: 0.006, gainFloor: 0.0001,
  limiterThreshold: -18, limiterRatio: 4, maxShots: 8, noiseSeconds: 2, noiseQ: 0.6,
  engineGain: 0.075, harmonicGain: 0.0175, fanGain: 0.049, idleLevel: 0.32, startLevel: 0.8,
  engineIdleHz: 48, engineStartHz: 22, engineStartSweep: 36, enginePowerSweep: 86, engineHarmonic: 2.03,
  fanIdleHz: 420, fanPowerSweep: 1900,
  windGain: 0.0375, windIdleHz: 650, windSpeedSweep: 1100, speedCap: 2, groundWindScale: 0.45,
  gust: {gain:.14,lowHz:380,sweepHz:1450,baseLevel:.12,turbulenceScale:1.15},
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
