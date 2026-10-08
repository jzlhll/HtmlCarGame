export const GAME = {
  fixedStep: 1 / 120,
  maxFrameSeconds: 0.05,
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
  flapAngle: 20 * Math.PI / 180,
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
};

export const COCKPIT = {
  panelTop: 0.75,
  frameDistance: 2,
  frameWidth: 0.065,
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
  { key: 'D', code: 'KeyD', english: 'Door', label: '舱门锁定', shortLabel: '舱门', system: 'door', kind: 'prepare' },
  { key: 'H', code: 'KeyH', english: 'Harness', label: '安全带', system: 'harness', kind: 'prepare' },
  { key: 'A', code: 'KeyA', english: 'Avionics', label: '飞行仪表', system: 'avionics', kind: 'prepare' },
  { key: 'W', code: 'KeyW', english: 'Wing flaps', label: '起飞襟翼', shortLabel: '襟翼', system: 'flaps', kind: 'prepare' },
  { key: 'F', code: 'KeyF', english: 'Fire', label: '发动机启动', shortLabel: '发动机', system: 'engine', kind: 'engine' },
  { key: 'R', code: 'KeyR', english: 'Release', label: '松驻车刹车', shortLabel: '松刹车', system: 'parkingBrake', kind: 'release' },
];

export const FLIGHT = {
  knotsPerMps: 1 / 0.514444,
  rotationSpeed: 145 * 0.514444,
  rollTargetSeconds: 20,
  recommendedPitch: [8, 12],
  warningSpeed: 130 * 0.514444,
  warningSpeedClear: 140 * 0.514444,
  climbMinSpeed: 180 * 0.514444,
  climbMaxSpeed: 220 * 0.514444,
  gearHeight: 30,
  flapsHeight: 200,
  completionHeight: 500,
  completionHoldSeconds: 3,
  completionFeedbackSeconds: 1.5,
  throttleRate: 0.28,
  throttleTap: 0.05,
  pitchTap: Math.PI / 180,
  pitchRate: 3 * Math.PI / 180,
  groundMaxPitch: 18 * Math.PI / 180,
  minPitch: -25 * Math.PI / 180,
  maxPitch: 30 * Math.PI / 180,
  maxBank: 45 * Math.PI / 180,
  successBank: 10 * Math.PI / 180,
  bankResponse: 1.8,
  liftOffFlapsPosition: 0.95,
  groundTurnRate: 0.32,
  groundTurnSpeed: 12,
  gravity: 9.81,
  stopSpeed: 0.1,
  contactTolerance: 0.05,
  gearSeconds: 2.5,
  flapsSeconds: 2,
};

export const TAKEOFF_CONTROLS = [
  { key: 'T', english: 'Throttle', label: '增加油门', action: 'throttle' },
  { key: 'S', english: 'Slow', label: '减速／轮刹', action: 'slow' },
  { key: '← →', english: 'Steer', label: '保持方向', action: 'steer' },
  { key: '↑', english: 'Rotate', label: '抬头起飞', action: 'rotate' },
];

export const CLIMB_CONTROLS = [
  { key: 'T / S', english: 'Throttle', label: '调整油门', action: 'throttle' },
  { key: '↑ ↓', english: 'Pitch', label: '调整俯仰', action: 'pitch' },
  { key: '← →', english: 'Turn', label: '保持平翼', action: 'turn' },
  { key: 'G', english: 'Gear', label: '收起落架', action: 'gear' },
  { key: 'W', english: 'Wing flaps', label: '收襟翼', action: 'flaps' },
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
  seed: 3827,
  city: {
    center: [0, -8600], columns: 29, rows: 28, spacing: 240, roadWidth: 22,
    minWidth: 52, maxWidth: 115, minHeight: 28, maxHeight: 240,
    landmarkClearance: 210, riverClearance: 100,
    colors: [0x708b91, 0x9bafac, 0x607e87, 0xb4b5a3, 0x8d9da1],
    roofColor: 0x4e6870, roadColor: 0x7c8983, parkColor: 0x78987b,
  },
  river: {
    width: 430, bankWidth: 510, samples: 220, waterColor: 0x4095a8, bankColor: 0xb6b99b,
    points: [[-20000, -8000], [-12000, -6900], [-6500, -7400], [-3500, -6200], [-1000, -5300], [1700, -5700], [5000, -7000], [10000, -5900], [20000, -8000]],
    tributary: [[-1000, -5300], [-1700, -8000], [-900, -11000], [-1900, -15000], [-3600, -19500]],
    bridges: [-2500, 2200], bridgeLength: 1000, bridgeWidth: 34, bridgeHeight: 12, pylonHeight: 95,
  },
  landmarks: [
    { kind: 'canton', name: '广州塔', position: [-1250, -6500], height: 600, radius: 48, color: 0xd9ded3 },
    { kind: 'bamboo', name: '深圳春笋', position: [1150, -7300], height: 420, radius: 67, color: 0x6696a5 },
    { kind: 'twist', name: '上海中心', position: [2350, -9500], height: 632, radius: 78, color: 0x79a4b0 },
    { kind: 'gateway', name: '上海环球金融中心', position: [-2250, -9300], height: 492, radius: 58, color: 0x7597a3 },
  ],
  towers: { segments: 32, levels: 24, struts: 18, strutRadius: 1.4, ringRadius: 1.5, frameColor: 0xd7dfd9 },
  mountains: [
    { position: [-6800, -9900], height: 820, radius: [3200, 2500] },
    { position: [6900, -11000], height: 1000, radius: [3300, 3000] },
    { position: [-10500, -14200], height: 1800, radius: [4200, 4000] },
    { position: [-5000, -15600], height: 2300, radius: [3800, 3800] },
    { position: [600, -17700], height: 2800, radius: [4700, 4200] },
    { position: [6500, -16800], height: 2400, radius: [4300, 3900] },
    { position: [12000, -15000], height: 1700, radius: [4000, 4000] },
    { position: [-14500, -22500], height: 2900, radius: [5500, 5000] },
    { position: [-7300, -23000], height: 3300, radius: [5200, 5200] },
    { position: [1400, -25000], height: 3700, radius: [6000, 5500] },
    { position: [9500, -23000], height: 3200, radius: [5600, 5200] },
    { position: [16000, -22000], height: 2600, radius: [5400, 5000] },
  ],
  terrain: { segments: 13, rings: 5, snowLine: 0.76, lowColor: 0x5d8577, highColor: 0x829696, snowColor: 0xd7dfd8 },
};

// 固定虚构客机的点质量气动预设；不是某一真实机型的性能数据，也不提供重量设置。
export const AERODYNAMICS = {
  mass: 52000, wingArea: 122.6, seaLevelDensity: 1.225, densityScaleHeight: 8500,
  maxThrust: 275000, engineResponseSeconds: 0.8, thrustSpeedScale: 360,
  liftAtZero: 0.22, liftSlope: 5.2, flapsLift: 0.38,
  parasiteDrag: 0.025, inducedDrag: 0.045, flapsDrag: 0.04, gearDrag: 0.02,
  criticalAlpha: 14 * Math.PI / 180, flapsCriticalBonus: 2 * Math.PI / 180,
  postStallDecay: 6 * Math.PI / 180, postStallLiftFraction: 0.12, stallDrag: 1.1,
  stallEntrySeconds: 0.2, stallRecoverySeconds: 0.8, stallRecoveryMargin: 3 * Math.PI / 180,
  pitchWarning: 15 * Math.PI / 180, pitchWarningClear: 13 * Math.PI / 180,
  pitchLowWarning: -10 * Math.PI / 180, pitchLowClear: -7 * Math.PI / 180,
  groundWarningHeight: 120, descentWarningAngle: -6 * Math.PI / 180,
  overspeedWarning: 250 * 0.514444, overspeedClear: 240 * 0.514444,
  warningRecoverySeconds: 0.8, alphaWarningMargin: 2 * Math.PI / 180,
  controlReferenceSpeed: 60, minimumControl: 0.15, stallControl: 0.45,
  maxRollRate: 25 * Math.PI / 180, rollingFriction: 0.022, brakeFriction: 0.65, tireFriction: 0.7,
};

export const AIRCRAFT_PREVIEW = {
  fov: 32, camera: [-34, 18, 44], target: [0, 3, 0], background: 0x18333e,
  groundColor: 0x274753, gridColor: 0x55717a, gridSize: 160, gridDivisions: 8, gridHeight: -7,
};
