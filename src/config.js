// 玩法时间使用有效游玩秒数，空间以 960×1080 为基准，横向范围受可视宽度约束。
export const WORLD = { width: 960, height: 1080, step: 1 / 120, maxFrameSeconds: 0.25, playWidthScale: 1.25 };
export const MODEL_GEOMETRY = { sphere: { segments: 48, rows: 24 }, aircraftSphere: { segments: 24, rows: 12 } };
export const RENDERING = {
  defaultQuality: 'high', generationBatchMilliseconds: 4,
  qualities: {
    high: { label: '高', maxPixelRatio: 2, maxPixels: 4500000, menuFPS: 60 },
    standard: { label: '标准', maxPixelRatio: 1.5, maxPixels: 3686400, menuFPS: 30 },
    economy: { label: '省电', maxPixelRatio: 1, maxPixels: 2073600, menuFPS: 30 }
  }
};
export const levelMode = (level,touchMode=false,firstMode='combat') => touchMode?'assembly':level%2===1?firstMode:firstMode==='combat'?'assembly':'combat';
export const ASSEMBLY = { stageSeconds: [180,90], maxChecks: 3, maxChunkLength: 5 };
export const LEVELS = { durationSeconds: 270, libraryExtraSeconds: {primary:0,intermediate:15,cet4:30,cet6:45}, spawnReferenceDurationSeconds: 300, wordCount: 12 };
export const BOSSES = { durationSeconds: 60, miniFaces: 3, finalFaces: 4, turnSeconds: 0.6, xRange: 275, yRange: 45.5, xAngularSpeed: 0.16, yAngularSpeed: 0.45, centerY: 350, miniCrates: 3, finalCrates: 5, victorySeconds: 5 };
export const BOSS_VISUALS = {
  segments: 24, rows: 16, tubeSides: 10, tubeSteps: 24, tentacleSway: 0.055, tentacleSpeed: 1.7,
  mini: { scale: 0.95, yOffset: -10, headScale: 1, tentacleLength: 1, skin: 0x873ad1, light: 0xba7cf2, dark: 0x502175, cheek: 0xec78c7, horn: 0xffd6a0 },
  final: { scale: 1.18, yOffset: -20, headScale: 1.09, tentacleLength: 1.08, skin: 0x6526a5, light: 0x9b5ce2, dark: 0x341344, cheek: 0xe562b1, horn: 0xffbd83 },
  eyes: 0xffe695, iris: 0x70e3af, pupil: 0x21132f, tooth: 0xfff3df, tongue: 0xf184b8, glint: 0xffffff
};
export const SUPPLIES = { intervalSeconds: 120, fallSeconds: 22, maxActive: 16, width: 62, height: 62, flightSeconds: 0.75, answerCrates: 2, rewardSwaySeconds: 2, rewardFlightSpeed: 520, rewardFlightSeconds: [0.65,3.2], rewardSwayAmplitude: [12,25], rewardSwaySpeed: [0.7,1.3], rewardArcHeight: 60, burstSeconds: 0.8, burstSpacing: 64, burstSpeed: 70, burstRiseSpeed: 90, spritePadding: 32, spriteMinPixelRatio: 2, shadow: [[0,4,6,'#191000a0'],[0,0,8,'#ffce6747']] };
export const CHOICES = { ratio: 0.3, batchSize: 10, optionCount: 3, hitsToSelect: 20, firePauseSeconds: 0.75, width: 720, height: 200, successCrates: SUPPLIES.answerCrates, failureEnemies: 2, carrier: { widthPadding: 48, heightPadding: 70, depth: 38, palette: [0x2b4357,0x577887,0xc2ced1,0x82d8e0] } };
export const REVIEW = { secondsPerWord: 10 };
export const RECAP = { imageWidth: 480, imageHeight: 240, modelPadding: 1.18 };
export const LEARNING = { pageSize: 100 };
export const HOME = { words: [{word:'airplane',meaning:'飞机'},{word:'planet',meaning:'行星'},{word:'galaxy',meaning:'银河'}], blanks: 2, driftAmplitude: 6, driftSpeed: 0.8, pitchAmplitude: 0.016, rollAmplitude: 0.024, shipXRatio: 0.12, shipYRatio: 0.71, previewXRatio: 0.86, previewMobileXRatio: 0.78, wordYRatio: 0.65, previewYRatio: 0.46, previewSidePixels: 160, previewMobileSidePixels: 105, previewScales: {enemy:1.6,mini:0.6,final:0.72}, largeBodyMinRadius: 60, largeBodyMaxWidthFraction: 0.42, largeBodyCenterGap: 16, exhaustSeconds: 4.5, exhaustDistance: 64, exhaustOpacity: 0.16 };
export const PLAYER = { x: 480, yRatio: 0.88, moveSpeedWidthsPerSecond: 0.65, invulnerableSeconds: 1.5, width: 52, height: 64 };
export const WORDS = { firstSpawnSeconds: 3, spawnCount: 1, spawnIntervalSeconds: [10,14], capacityRetrySeconds: 1, maxEditable: 2, maxThreats: 3, fallDurationSeconds: [60,76], dangerYRatio: 0.80, blankMinCount: 2, blankMaxFraction: 0.5, verifySeconds: 0.5, inputLockSeconds: 0.75, successSeconds: 1, successAmmo: 2, successScore: 100, candidateAttempts: 8, cellWidth: 48, cardHeight: 112, planeWingMargin: 35, planeTopMargin: 18, planeBottomMargin: 22, spawnY: 110, thoughtSeconds: 8, moveAllowanceSeconds: 4, retryAllowanceSeconds: 6, urgentSeconds: 10 };
export const LETTERS = { shotCountRatio: 0.7, shotCountMultiple: 2, fireIntervalSeconds: 0.06, speedHeightsPerSecond: 1.3, lifetimeSeconds: 2, poolSize: 64 };
export const UNDO = { cooldownSeconds: 0.25, poolSize: 4 };
export const SHELLS = { initialAmmo: 0, cooldownSeconds: 0.4, speedHeightsPerSecond: 1, poolSize: 8, flightSeconds: [0.35,1.6], arcRange: [90,180], arcDistanceFraction: 0.35, trailPoints: 12, trailIntervalSeconds: 0.035 };
export const ENEMIES = { maxActive: 16, fallDurationSeconds: 18, firstShotDelaySeconds: 2, shotIntervalSeconds: 3, warningSeconds: 0.6, bulletSpeedHeightsPerSecond: 0.18, bulletLifetimeSeconds: 8, bulletPoolSize: 64, killScore: 20, width: 84, height: 76 };
export const VOCAB = { maxWordLength: 24, usePreviewPool: true };
export const WORD_CARDS = { compactExampleCount: 2, denseExampleCount: 4, compactTextLength: 180, denseTextLength: 280, compactMeaningLength: 18 };
export const BACKGROUND = {
  seed: 73129, stars: 1200, glowStars: 240, largeGlows: 60, starTravel: 2400,
  starSizeScale: 1.45, starPalette: [0xffdf93,0x80b8ff,0xe8ae65,0x9e4557],
  starSpeedRange: [4,16], speedScale: 0.7, spawnIntervalSeconds: 15,
  planetBaseSpeed: 30, modelGap: 24, maxModelWidthFraction: 0.72, maxModelHeightFraction: 0.6,
  sunHaloScale: 1.3, galaxySourceRadius: 440,
  // 半径是为游戏压缩的视觉比例；银河使用同一队列，但不代表物理尺寸关系。
  models: [
    { kind: 'mercury', radius: 42, texture: 0 }, { kind: 'venus', radius: 61, texture: 1 },
    { kind: 'earth', radius: 64, texture: 2 }, { kind: 'mars', radius: 49, texture: 3 },
    { kind: 'jupiter', radius: 91, texture: 4 }, { kind: 'saturn', radius: 82, texture: 5 },
    { kind: 'uranus', radius: 70, texture: 6 }, { kind: 'neptune', radius: 68, texture: 7 },
    { kind: 'pluto', radius: 36, texture: 8 }, { kind: 'galaxy', radius: 400, texture: null },
    { kind: 'moon', radius: 22, texture: 9 }, { kind: 'sun', radius: 180, texture: 10 },
    { kind: 'big-dipper', radius: 195, texture: null }, { kind: 'sagittarius', radius: 175, texture: null },
    { kind: 'orion', radius: 180, texture: null }, { kind: 'cassiopeia', radius: 195, texture: null },
    { kind: 'scorpius', radius: 195, texture: null }
  ],
  // 星位为便于辨认的平面示意；不模拟真实天球坐标和恒星距离。
  constellations: [
    { kind: 'big-dipper', stars: [[-.95,.25,1],[-.64,.47,.9],[-.28,.36,1],[.06,.12,.85],[.63,.28,1],[.74,-.3,.9],[.17,-.42,.95]], links: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
    { kind: 'sagittarius', stars: [[-.9,.04,.9],[-.48,.28,1],[-.2,.7,.85],[.22,.42,.9],[.3,-.18,1],[.7,-.36,.85],[.91,.1,.9],[-.35,-.42,1]], links: [[0,1],[0,7],[1,2],[2,3],[3,1],[1,7],[7,4],[4,3],[3,6],[6,5],[5,4]] },
    { kind: 'orion', stars: [[-.54,.74,1.1],[.46,.66,.95],[0,.96,.7],[-.2,.04,.85],[0,0,.9],[.2,-.04,.85],[-.49,-.8,.95],[.48,-.86,1.1],[.02,-.28,.6],[.04,-.45,.65]], links: [[0,2],[2,1],[0,3],[1,5],[3,4],[4,5],[3,6],[5,7],[6,7],[4,8],[8,9]] },
    { kind: 'cassiopeia', stars: [[-.94,.4,1],[-.5,-.38,.95],[-.05,.16,1.05],[.44,-.32,1],[.9,.54,.9]], links: [[0,1],[1,2],[2,3],[3,4]] },
    { kind: 'scorpius', stars: [[-.8,.68,.8],[-.56,.88,.8],[-.32,.72,.8],[-.5,.4,1],[-.3,.13,1.2],[-.13,-.13,.85],[.02,-.48,.8],[.28,-.76,.85],[.62,-.8,.85],[.84,-.57,.9],[.76,-.29,.85],[.55,-.22,.8]], links: [[0,3],[1,3],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]] }
  ],
  constellationColor: 0xc9e3ff, constellationLineColor: 0x7daddb,
  constellationStarSize: 23, constellationStarOpacity: 0.95, constellationLineOpacity: 0.44,
  textureWidth: 512, textureHeight: 256, galaxyStars: 6000,
  maskOpacity: 0.52, menuMaskOpacity: 0.28
};
export const AUDIO = { masterVolume: 0.35, maxShotsPerSecond: 8, speechRate: 0.75, speechPitch: 1.08, speechVolume: 0.85 };
export const SCORES = { limit: 10 };
// 只压缩普通出题时间，两个 Boss 各保留完整作答时段。
export function combatTiming(libraryId){
  const extra=LEVELS.libraryExtraSeconds[libraryId];if(!Number.isFinite(extra))throw new Error('Unknown combat timing library: '+libraryId);
  const durationSeconds=LEVELS.durationSeconds+extra,ordinarySeconds=durationSeconds-BOSSES.durationSeconds*2,scale=ordinarySeconds/(LEVELS.spawnReferenceDurationSeconds-BOSSES.durationSeconds*2);
  return {durationSeconds,miniAt:ordinarySeconds/2,finalAt:durationSeconds-BOSSES.durationSeconds,spawnIntervalSeconds:WORDS.spawnIntervalSeconds.map(seconds=>seconds*scale)};
}
export function validateConfig() {
  const positive = value => Number.isFinite(value) && value > 0;
  for(const {segments,rows} of Object.values(MODEL_GEOMETRY))if(!Number.isInteger(segments)||segments<3||!Number.isInteger(rows)||rows<2||(segments+1)*(rows+1)>65536)throw new Error('Invalid sphere geometry configuration');
  if(!Object.hasOwn(RENDERING.qualities,RENDERING.defaultQuality)||!positive(RENDERING.generationBatchMilliseconds))throw new Error('Invalid rendering defaults');
  for(const quality of Object.values(RENDERING.qualities))if(!positive(quality.maxPixelRatio)||!positive(quality.menuFPS)||(quality.maxPixels!==null&&!positive(quality.maxPixels)))throw new Error('Invalid rendering quality configuration');
  for(const value of [BOSSES.xRange,BOSSES.yRange,BOSSES.xAngularSpeed,BOSSES.yAngularSpeed])if(!positive(value))throw new Error('Invalid boss movement configuration');
  if(ASSEMBLY.stageSeconds.length!==2||!ASSEMBLY.stageSeconds.every(positive)||!Number.isInteger(ASSEMBLY.maxChecks)||ASSEMBLY.maxChecks<1)throw new Error('Invalid assembly stage configuration');
  for(const id of Object.keys(LEVELS.libraryExtraSeconds)){const timing=combatTiming(id);if(!positive(timing.miniAt)||timing.miniAt+BOSSES.durationSeconds>=timing.finalAt||!timing.spawnIntervalSeconds.every(positive))throw new Error('Invalid combat timing configuration');}
  if (!Number.isInteger(LEVELS.wordCount)||LEVELS.wordCount<Math.max(BOSSES.miniFaces,BOSSES.finalFaces)) throw new Error('Invalid level vocabulary count');
  if(!positive(WORLD.playWidthScale)||WORLD.playWidthScale<1||!positive(LETTERS.shotCountRatio)||LETTERS.shotCountRatio>1||!Number.isInteger(LETTERS.shotCountMultiple)||LETTERS.shotCountMultiple<1)throw new Error('Invalid playfield or letter shot configuration');
  if (!positive(LETTERS.fireIntervalSeconds) || LETTERS.fireIntervalSeconds <= 0.02) throw new Error('Letter interval must exceed 0.02 seconds');
  for (const values of [WORDS.spawnIntervalSeconds, WORDS.fallDurationSeconds]) if (!values.every(positive) || values[0] > values[1]) throw new Error('Invalid interval range');
  for (const value of [WORDS.spawnCount, WORDS.maxEditable, WORDS.maxThreats, ENEMIES.maxActive, LETTERS.poolSize, SHELLS.poolSize]) if (!Number.isInteger(value) || value <= 0) throw new Error('Invalid entity capacity');
  for (const value of [WORLD.step, LEVELS.durationSeconds, LETTERS.speedHeightsPerSecond, LETTERS.lifetimeSeconds, WORDS.verifySeconds, WORDS.inputLockSeconds, WORDS.successSeconds, UNDO.cooldownSeconds, ENEMIES.bulletLifetimeSeconds, SHELLS.cooldownSeconds, ENEMIES.shotIntervalSeconds, ENEMIES.firstShotDelaySeconds]) if (!positive(value)) throw new Error('Invalid timing configuration');
  if (!positive(BACKGROUND.starSizeScale)||BACKGROUND.starPalette.length!==4||!BACKGROUND.starPalette.every(color=>Number.isInteger(color)&&color>=0&&color<=0xffffff)) throw new Error('Invalid star appearance configuration');
  if (!positive(BACKGROUND.spawnIntervalSeconds) || !positive(BACKGROUND.planetBaseSpeed) || !positive(BACKGROUND.speedScale) || Math.round(BACKGROUND.planetBaseSpeed*BACKGROUND.speedScale)<1 || BACKGROUND.models.length<3) throw new Error('Invalid background scheduling configuration');
  if (new Set(BACKGROUND.models.map(model=>model.kind)).size!==BACKGROUND.models.length || !BACKGROUND.models.every(model=>positive(model.radius))) throw new Error('Invalid background model definitions');
  for (const fraction of [BACKGROUND.maxModelWidthFraction,BACKGROUND.maxModelHeightFraction]) if (!positive(fraction)||fraction>1) throw new Error('Invalid background viewport limit');
  if (!positive(BACKGROUND.sunHaloScale)||BACKGROUND.sunHaloScale<1||!positive(BACKGROUND.galaxySourceRadius)) throw new Error('Invalid background visual scale');
  const constellationKinds=new Set();
  for(const chart of BACKGROUND.constellations){
    if(constellationKinds.has(chart.kind)||!BACKGROUND.models.some(model=>model.kind===chart.kind&&model.texture===null)||chart.stars.length<2||!chart.stars.every(star=>star.length===3&&star.every(Number.isFinite)&&Math.hypot(star[0],star[1])<=1.2&&positive(star[2]))||!chart.links.length||!chart.links.every(link=>link.length===2&&link[0]!==link[1]&&link.every(index=>Number.isInteger(index)&&index>=0&&index<chart.stars.length)))throw new Error('Invalid constellation definition');
    constellationKinds.add(chart.kind);
  }
  if(!positive(BACKGROUND.constellationStarSize)||![BACKGROUND.constellationStarOpacity,BACKGROUND.constellationLineOpacity].every(value=>positive(value)&&value<=1))throw new Error('Invalid constellation appearance');
  if(![...SHELLS.flightSeconds,...SHELLS.arcRange,SHELLS.arcDistanceFraction,SHELLS.trailIntervalSeconds].every(positive)||SHELLS.flightSeconds[0]>SHELLS.flightSeconds[1]||SHELLS.arcRange[0]>SHELLS.arcRange[1]||!Number.isInteger(SHELLS.trailPoints)||SHELLS.trailPoints<1)throw new Error('Invalid homing shell configuration');
  if(!Number.isInteger(CHOICES.batchSize)||CHOICES.batchSize<1||!positive(CHOICES.ratio)||CHOICES.ratio>=1||!Number.isInteger(CHOICES.ratio*CHOICES.batchSize)||CHOICES.optionCount!==3||!Number.isInteger(CHOICES.hitsToSelect)||CHOICES.hitsToSelect<1||!positive(CHOICES.firePauseSeconds)||!positive(CHOICES.width)||CHOICES.width>WORLD.width-48||!positive(CHOICES.height))throw new Error('Invalid choice question configuration');
  for(const value of [SUPPLIES.intervalSeconds,SUPPLIES.burstSeconds,SUPPLIES.rewardSwaySeconds,SUPPLIES.rewardFlightSpeed,...SUPPLIES.rewardFlightSeconds,...SUPPLIES.rewardSwayAmplitude,...SUPPLIES.rewardSwaySpeed,BOSSES.victorySeconds])if(!positive(value))throw new Error('Invalid reward timing');
  for(const value of [SUPPLIES.maxActive,CHOICES.successCrates,CHOICES.failureEnemies,BOSSES.miniCrates,BOSSES.finalCrates])if(!Number.isInteger(value)||value<1)throw new Error('Invalid reward capacity');
  if(SUPPLIES.rewardFlightSeconds[0]>SUPPLIES.rewardFlightSeconds[1])throw new Error('Invalid reward flight range');
  if(!Number.isInteger(WORDS.blankMinCount)||WORDS.blankMinCount<2||WORDS.blankMaxFraction<=0||WORDS.blankMaxFraction>.5)throw new Error('Invalid blank selection configuration');
  if(![RECAP.imageWidth,RECAP.imageHeight].every(value=>Number.isInteger(value)&&value>0)||!positive(RECAP.modelPadding)||RECAP.modelPadding<1)throw new Error('Invalid recap image configuration');
  if(SUPPLIES.maxActive<BOSSES.finalCrates)throw new Error('Reward pool cannot hold final boss crates');
  if (!Number.isInteger(VOCAB.maxWordLength)||VOCAB.maxWordLength<2) throw new Error('Invalid vocabulary word length');
  if (WORDS.maxEditable > WORDS.maxThreats ) throw new Error('Entity capacity exceeds total capacity');
}
