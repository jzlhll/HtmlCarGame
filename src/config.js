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
  near: 0.1,
  far: 6000,
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
  groundSize: 8000,
  fogNear: 650,
  fogFar: 4200,
  shadowSize: 2048,
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

export const CONTROLS = {
  Space: { action: 'space' },
  ArrowLeft: { action: 'left', held: true },
  ArrowRight: { action: 'right', held: true },
  ArrowUp: { action: 'up', held: true },
  ArrowDown: { action: 'down', held: true },
};

export const STARTUP_STEPS = [
  { key: 'L', english: 'Light', label: '灯光' },
  { key: 'D', english: 'Door', label: '舱门' },
  { key: 'H', english: 'Harness', label: '安全带' },
  { key: 'A', english: 'Avionics', label: '飞行仪表' },
  { key: 'F', english: 'Fire', label: '发动机' },
  { key: 'W', english: 'Wing Flaps', label: '襟翼' },
  { key: 'R', english: 'Release', label: '松刹车' },
];
