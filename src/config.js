export const GAME = {
  fixedStep: 1 / 120,
  maxFrameSeconds: 0.05,
  scenePrepareLimitSeconds: 12,
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
  length: 3000,
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
  warmupSize: 64,
};

export const COCKPIT = {
  panelTop: 0.75,
  frameDistance: 2,
  dashboardDistance: 2.2,
  color: 0x18262d,
  trimColor: 0x34454d,
};

export const SCENERY = {
  groundSize: 80000,
  skyRadius: 32000,
  fogNear: 6000,
  fogFar: 32000,
  shadowSize: 2048,
  surfaceLayers: { shoulder: 1, pavement: 2, marking: 3 },
  colors: {
    ground: 0x899e86,
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
  engineStartSeconds: 3,
  engineIdlePercent: 27,
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
  { key: 'W', code: 'KeyW', english: 'Wing brake', label: '关闭机翼减速板', shortLabel: '机翼减速板', readyState: 'OFF', pendingState: 'ON', system: 'flaps', kind: 'prepare' },
  { key: 'F', code: 'KeyF', english: 'Fire', label: '发动机启动', shortLabel: '发动机', system: 'engine', kind: 'engine' },
  { key: 'R', code: 'KeyR', english: 'Release', label: '松驻车刹车', shortLabel: '松刹车', system: 'parkingBrake', kind: 'release' },
];

export const FLIGHT = {
  knotsPerMps: 1 / 0.514444,
  rotationSpeed: 145 * 0.514444,
  rollTargetSeconds: 20,
  recommendedPitch: [8, 12],
  climbMinSpeed: 180 * 0.514444,
  climbMaxSpeed: 220 * 0.514444,
  gearHeight: 30,
  gearPreviewHeight: 200,
  completionHeight: 500,
  completionHoldSeconds: 3,
  completionFeedbackSeconds: 1.5,
  speedRate: 145 * 0.514444 / 20,
  speedBrakeRate: 6,
  speedModeRatio: 10,
  speedTapSeconds: 0.7,
  pitchTap: Math.PI / 180,
  pitchRate: 3 * Math.PI / 180,
  groundMaxPitch: 18 * Math.PI / 180,
  minPitch: -65 * Math.PI / 180,
  maxPitch: 35 * Math.PI / 180,
  maxBank: 60 * Math.PI / 180,
  successBank: 10 * Math.PI / 180,
  bankResponse: 4.2,
  takeoffBrakePosition: 0.01,
  groundTurnRate: 0.65,
  groundTurnSpeed: 12,
  gravity: 9.81,
  stopSpeed: 0.1,
  contactTolerance: 0.05,
  gearSeconds: 2.5,
  flapsSeconds: 2,
};

export const TAKEOFF_CONTROLS = [
  { key: 'T', english: 'Thrust', label: '提速', action: 'throttle' },
  { key: 'S', english: 'Slow', label: '减速', action: 'slow' },
  { key: '← →', english: 'Steer', label: '保持方向', action: 'steer' },
  { key: '↑', english: 'Rotate', label: '抬头起飞', action: 'rotate' },
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
  ArrowUp: { action: 'up', held: true, press: true },
  ArrowDown: { action: 'down', held: true, press: true },
};

// 地标采用轮廓化比例，集中于虚构河湾城市，不对应真实城市间的地理位置。
export const LANDSCAPE = {
  staticBatchCell: 640,
  seed: 3827,
  city: {
    center: [0, -9700], columns: 18, rows: 8, spacing: 150, roadWidth: 22,
    minWidth: 52, maxWidth: 115, minHeight: 28, maxHeight: 240,
    landmarkClearance: 210, riverClearance: 100,
    colors: [0x708b91, 0x9bafac, 0x607e87, 0xb4b5a3, 0x8d9da1],
    roofColor: 0x4e6870, roadColor: 0x7c8983, parkColor: 0x78987b,
  },
  river: {
    width: 430, bankWidth: 510, samples: 220, waterColor: 0x4095a8, bankColor: 0xb6b99b,
    points: [[-18000, -6100], [-7000, -5700], [-2200, -5500], [0, -5750], [2500, -6100], [7000, -5900], [18000, -6400]],
    tributary: [[-700, -5550], [-600, -6500], [-900, -7400], [-1700, -8200]],
    bridges: [-2500, 2200], bridgeLength: 1000, bridgeWidth: 34, bridgeHeight: 12, pylonHeight: 95,
  },
  landmarks: [
    { kind: 'canton', name: '广州塔', position: [-450, -9200], height: 600, radius: 48, color: 0xd9ded3 },
    { kind: 'bamboo', name: '深圳春笋', position: [500, -9550], height: 420, radius: 67, color: 0x6696a5 },
    { kind: 'twist', name: '上海中心', position: [900, -10000], height: 632, radius: 78, color: 0x79a4b0 },
    { kind: 'gateway', name: '上海环球金融中心', position: [-950, -9950], height: 492, radius: 58, color: 0x7597a3 },
  ],
  towers: { segments: 32, levels: 24, struts: 18, strutRadius: 1.4, ringRadius: 1.5, frameColor: 0xd7dfd9 },
  mountains: [
    { position: [0, -3700], height: 240, radius: [650, 700] },
    { position: [-1050, -3800], height: 1100, radius: [650, 950] },
    { position: [1400, -4400], height: 1700, radius: [850, 1100] },
    { position: [-4600, -7500], height: 12000, radius: [2100, 2200] },
    { position: [4700, -8800], height: 7800, radius: [2100, 2400] },
    { position: [-1800, -5700], height: 1900, radius: [850, 1000] },
    { position: [1900, -6100], height: 2200, radius: [900, 1100] },
  ],
  terrain: {
    segments: 64, lodDistances: [6000, 14000], lodHysteresis: 350,
    lowColor: 0x48623a, highColor: 0x77786d, snowColor: 0xdce3e0,
    snowHeight: 6200, snowTransition: 1100, treeLine: 2400, treeTransition: 900,
    rockScale: 0.008, detailScale: 0.13, bumpStrength: 1.1, textureSize: 256,
    rockColor: 0x888477, soilColor: 0x827657, danxiaColor: 0xa45f42,
    vegetationSlope: [0.22, 0.62], forestSpacing: 20, maxTrees: 2100,
    treeHeight: [16, 30], treeNear: 1700, treeFar: 6200, forestCell: 640,
    canopyColors: [0x344c28, 0x465c2e, 0x536437, 0x2d4829],
    sunDirection: [-0.5, 0.8, -0.35], ambientStrength: 1.35, sunStrength: 3.0,
    rockSides: 14, rockRings: 9, resourceBudgetMb: 50,
  },
};

// 固定虚构客机的点质量气动预设；不是某一真实机型的性能数据，也不提供重量设置。
export const AERODYNAMICS = {
  mass: 52000, wingArea: 122.6, seaLevelDensity: 1.225, densityScaleHeight: 8500,
  landingGroundLift: 0.2, landingGroundDrag: 0.08,
  maxThrust: 275000, engineResponseSeconds: 0.8, thrustSpeedScale: 360,
  liftAtZero: 0.6, liftSlope: 5.2, wingBrakeLiftLoss: 0.1,
  parasiteDrag: 0.025, inducedDrag: 0.045, wingBrakeDrag: 0.04, gearDrag: 0.02,
  criticalAlpha: 14 * Math.PI / 180,
  postStallDecay: 6 * Math.PI / 180, postStallLiftFraction: 0.12, stallDrag: 1.1,
  stallEntrySeconds: 0.2, stallRecoverySeconds: 0.8, stallRecoveryMargin: 3 * Math.PI / 180,
  pitchWarning: 15 * Math.PI / 180, pitchWarningClear: 13 * Math.PI / 180,
  pitchLowWarning: -10 * Math.PI / 180, pitchLowClear: -7 * Math.PI / 180,
  groundWarningHeight: 120, descentWarningAngle: -6 * Math.PI / 180,
  overspeedWarning: 250 * 0.514444, overspeedClear: 240 * 0.514444,
  warningRecoverySeconds: 0.8, alphaWarningMargin: 2 * Math.PI / 180,
  safeSpeedFactor: 1.2, speedWarningClear: 1.05, stallPitchRate: 6 * Math.PI / 180,
  lowSpeedPowerStart: 0.75, highSpeedDrag: 0.4,
  controlReferenceSpeed: 60, minimumControl: 0.15, stallControl: 0.45,
  maxRollRate: 60 * Math.PI / 180, rollingFriction: 0.022, brakeFriction: 0.65, tireFriction: 0.7,
};

export const GEAR_PREVIEW = {
  fov: 88, near: 0.1, far: 1800, distance: 8,
  side: -6, height: 2.2, targetDrop: 0.5, targetDropLimit: 5.5,
};

export const AIRCRAFT_PREVIEW = {
  fov: 32, camera: [-34, 18, 44], target: [0, 3, 0], background: 0x18333e,
  groundColor: 0x274753, gridColor: 0x55717a, gridSize: 160, gridDivisions: 8, gridHeight: -7,
};

// 通用航程规则；每关通过 createRoute 生成独立配置，不修改共享对象。
export const ROUTE = {
  courseDeviation: 900, contactLifetime: 40, sweepStep: 0.5, touchdownOffset: 350,
  taxiSpeed: 20 * 0.514444, approachSpeed: 170 * 0.514444,
  glideSlope: 4 * Math.PI / 180,
  sampleSeconds: 0.25, mapHalfWidth: 3500, collisionCell: 512, bodyRadius: 1.7,
  ceiling: 10000, ceilingClear: 9800, ceilingRecovery: 2, faultPower: 0.25,
  radarRange: 2600, radarLead: 10, radarDanger: 100, radarVertical: 100, radarHorizon: 12,
  parkingOffset: 1350, parkedSpeed: 2, parkHold: 1,
  landingMaxSpeed: 190 * 0.514444, landingMaxSink: 6, landingMaxBank: 8 * Math.PI / 180,
  landingMinPitch: -3 * Math.PI / 180, landingMaxPitch: 10 * Math.PI / 180,
  landingMaxHeading: 12 * Math.PI / 180, gearMaxSpeed: 220 * 0.514444,
  destination: { x: 0, length: 3000, width: 120,
    park: { x: 60, radius: 125 },
    apron: { x: 80, width: 420, length: 850 } },
  waterfall: { x: 450, z: -5650, width: 160, height: 300, depth: 100,
    bonusRadius: 240, clearanceMin: 20, clearanceMax: 650 },
  encounters: [
    { at: 6, kind: 'geese', course: 'head-on', offset: 0, height: 0, speed: 23 },
    { at: 22, kind: 'aircraft', course: 'head-on', offset: 12, height: 0, speed: 115 },
    { at: 38, kind: 'aircraft', course: 'crossing', offset: 0, height: 0, speed: 100 },
    { at: 55, kind: 'geese', course: 'head-on', offset: -22, height: 0, speed: 25 },
    { at: 72, kind: 'aircraft', course: 'diagonal', offset: -18, height: 10, speed: 110 },
    { at: 92, kind: 'aircraft', course: 'same-way', offset: 0, height: -5, speed: 76 },
  ],
  birdCount: 17, birdSpacing: 12, birdVerticalSpacing: 8, birdScale: 2.5, birdRadius: 2.5, birdHeight: 1.9,
  trafficScale: 2, trafficRadius: 20, trafficHeight: 8,
  contactMarkerRange: 2600, contactMarkerNear: 80, birdFlapRate: 7, birdFlapAngle: 0.65,
};

// 三关共用深圳起点与前段路线；距离和海拔均为游戏化预设。
export const LEVELS = [
  { id: 1, destinationName: '广州', destinationEnglish: 'Guangzhou', deadline: 200, cruiseKnots: 200, approachDistance: 7000, threshold: -13200 },
  { id: 2, destinationName: '长沙', destinationEnglish: 'Changsha', deadline: 225, cruiseKnots: 225, approachDistance: 6000, threshold: -17500 },
  { id: 3, destinationName: '武汉', destinationEnglish: 'Wuhan', deadline: 255, cruiseKnots: 245, approachDistance: 7000, threshold: -22400 },
];

export const JOURNEY = {
  elevationProfile: [[0, 0], [3000, 0], [13200, 300], [14400, 550], [16600, 550], [17000, 650], [20500, 650], [22400, 1000]],
  sectors: [
    { z: -3200, english: 'Mountain valley', chinese: '近山峡谷', kind: 'mountain', level: 1 },
    { z: -5600, english: 'River falls', chinese: '河流瀑布', kind: 'river', level: 1 },
    { z: -7800, english: 'Farmland', chinese: '田野', kind: 'field', level: 1 },
    { z: -9700, english: 'Guangzhou city', chinese: '广州城市群', kind: 'city', level: 1 },
    { z: -11800, english: 'Danxia mountains', chinese: '丹霞山', kind: 'danxia', level: 2 },
    { z: -13700, english: 'Zhangjiajie', chinese: '张家界与空中瀑布', kind: 'pillars', level: 2 },
    { z: -15500, english: 'Orange isle', chinese: '橘子洲头', kind: 'island', level: 2 },
    { z: -18750, english: 'Dongting lake', chinese: '洞庭湖', kind: 'lake', level: 3 },
    { z: -21400, english: 'Yellow crane tower', chinese: '黄鹤楼', kind: 'pagoda', level: 3 },
  ],
  danxia: [
    { position: [-800, -11600], height: 1000, radius: [520, 700], kind: 'danxia' },
    { position: [950, -12000], height: 1350, radius: [620, 800], kind: 'danxia' },
    { position: [-1600, -12700], height: 1750, radius: [700, 900], kind: 'danxia' },
    { position: [1800, -12900], height: 1500, radius: [650, 750], kind: 'danxia' },
  ],
  rockColors: { danxia: 0x975949, danxiaBand: 0xd59a71, pillars: 0x697d72, cap: 0x637d56 },
  pillars: { seed: 2387410263, count: 24, startZ: -12800, spacing: 130, minHeight: 650, heightRange: 700, minRadius: 55, radiusRange: 60 },
  skyRock: { x: 0, z: -13750, bottom: 850, top: 1120, radius: 260, color: 0x6b7b70 },
  slantedRock: { x: -880, z: -14150, bottom: 0, top: 850, radius: 180, lean: 300, color: 0x748375 },
  skyFalls: [
    { id: 'sky-falls', x: 0, z: -13390, bottom: 0, top: 1100, width: 190, passable: true },
    { id: 'side-falls', x: -540, z: -13920, bottom: 0, top: 760, width: 150, passable: true },
  ],
  island: { x: 370, z: -15500, width: 480, length: 1500, riverWidth: 1800, riverLength: 2200, statueHeight: 170 },
  lake: { x: 0, z: -18750, width: 6500, length: 3500, elevation: 650 },
  pagoda: { x: 185, z: -21400, height: 720, width: 150, levels: 7, eaves: 1.5 },
  groundSegments: 180,
};

// 共用海拔剖面是地面、碰撞高度和机场标高的唯一来源。
export function terrainElevation(z, endDistance = Infinity) {
  const distance = Math.max(0, Math.min(endDistance, -z)), profile = JOURNEY.elevationProfile;
  for (let i = 1; i < profile.length; i++) {
    if (distance <= profile[i][0]) {
      const [start, low] = profile[i - 1], [end, high] = profile[i];
      return low + (high - low) * (distance - start) / (end - start);
    }
  }
  return profile.at(-1)[1];
}

export function createRoute(levelId = 1) {
  const level = LEVELS.find(item => item.id === Number(levelId)) || LEVELS[0];
  const elevation = terrainElevation(level.threshold);
  const destination = { ...ROUTE.destination, threshold: level.threshold, elevation,
    park: { ...ROUTE.destination.park, z: level.threshold - ROUTE.parkingOffset },
    apron: { ...ROUTE.destination.apron, z: level.threshold - ROUTE.parkingOffset } };
  const sectors = JOURNEY.sectors.filter(item => item.level <= level.id);
  if (level.id === 1) sectors.push({ z: -11400, english: 'Village', chinese: '村庄', kind: 'village' });
  sectors.push({ z: level.threshold, english: `${level.destinationEnglish} airport`, chinese: `${level.destinationName}机场`, kind: 'airport' });
  return { ...ROUTE, ...level, elevation, destination, sectors, cruiseSpeed: level.cruiseKnots / FLIGHT.knotsPerMps,
    cruiseHeight: 550, mountains: [...LANDSCAPE.mountains, ...(level.id >= 2 ? JOURNEY.danxia : [])],
    encounters: ROUTE.encounters.map(spec => ({ ...spec, at: spec.at * (level.deadline / 200) })) };
}

export const AUDIO = {
  masterGain: 0.6, smoothingSeconds: 0.045, attackSeconds: 0.006, gainFloor: 0.0001,
  limiterThreshold: -18, limiterRatio: 4, maxShots: 8, noiseSeconds: 2, noiseQ: 0.6,
  engineGain: 0.15, harmonicGain: 0.035, fanGain: 0.2, idleLevel: 0.32, startLevel: 0.8,
  engineIdleHz: 48, engineStartHz: 22, engineStartSweep: 36, enginePowerSweep: 86, engineHarmonic: 2.03,
  fanIdleHz: 420, fanPowerSweep: 1900,
  windGain: 0.075, windIdleHz: 650, windSpeedSweep: 1100, speedCap: 2, groundWindScale: 0.45,
  wheelGain: 0.16, wheelIdleHz: 160, wheelSpeedSweep: 850, wheelRoughness: 0.22, wheelBumpRate: 32, brakeGainScale: 1.35,
  motorGain: 0.045, motorHz: 185, flapsMotorOffset: 80,
  alarmGain: 0.09, alarmHigh: 880, alarmLow: 660, alarmPeriod: 0.8, alarmPulse: 0.16,
  voiceDuck: 0.55,
  cues: {
    countdown: { type: 'sine', frequency: 650, endFrequency: 500, seconds: 0.07, gain: 0.08 },
    switchOn: { type: 'triangle', frequency: 1300, endFrequency: 480, seconds: 0.07, gain: 0.12 },
    switchOff: { type: 'triangle', frequency: 700, endFrequency: 240, seconds: 0.08, gain: 0.1 },
    latch: { type: 'triangle', frequency: 240, endFrequency: 65, seconds: 0.16, gain: 0.2 },
    start: { type: 'sine', frequency: 160, endFrequency: 55, seconds: 0.25, gain: 0.16 },
    confirm: { type: 'sine', frequency: 540, endFrequency: 810, seconds: 0.13, gain: 0.09 },
  },
  voice: {
    preferredNames: ['Samantha', 'Karen', 'Moira', 'Serena'], rate: 1, pitch: 1, volume: 0.7, maxSeconds: 2.5,
    prepared: { L: 'Light', D: 'Door closed', H: 'Harness secured', A: 'Avionics', W: 'Wing brake closed' },
    unprepared: { L: 'Light off', D: 'Door open', H: 'Harness released', A: 'Avionics off', W: 'Wing brake open' },
    events: {
      'engine-start': 'Fire', 'engine-ready': 'Engines ready', 'engine-stop': 'Engines off',
      released: 'Brakes released', 'brake-set': 'Parking brake', 'rotation-ready': 'Rotate', liftoff: 'Positive climb',
      'gear-start': 'Gear moving', 'flaps-start': 'Wing brake moving', 'gear-up': 'Gear up', 'gear-down': 'Gear down',
      'flaps-up': 'Wing brake closed', 'flaps-down': 'Wing brake open', 'low-speed': 'Airspeed low', overspeed: 'Airspeed high',
      'pitch-high': 'Lower nose', 'pitch-low': 'Raise nose', stall: 'Stall', 'stall-recovered': 'Stall recovered',
      ceiling: 'Altitude limit', 'fault-recovered': 'Power restored', traffic: 'Traffic', approach: 'Approach',
      landed: 'Touchdown', waterfall: 'Congratulations',
    },
  },
};

export const FLIGHT_PHASES = ['TAKEOFF_ROLL', 'INITIAL_CLIMB', 'CRUISE', 'APPROACH', 'LANDING_ROLL', 'TAXI'];
