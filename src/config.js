export const VEHICLES = [
  null,
  {name:'自行车', length:1, width:.55, min:20, max:45, playerMax:90, lateral:6.6, color:0xf6cf57},
  {name:'三轮车', length:1.55, width:.85, min:55, max:85, playerMax:110, lateral:6.3, color:0x62b59a},
  {name:'小汽车', length:2, width:1, min:55, max:95, playerMax:125, lateral:6.15, color:0x68b6d7},
  {name:'卡车', length:3.75, width:1.25, min:45, max:75, playerMax:125, lateral:5.1, color:0xe3945e},
  {name:'坦克', length:2.5, width:1.875, min:25, max:55, playerMax:125, lateral:4.35, color:0x829b83},
];
export const MAX_RANK=VEHICLES.length-1;
export const RULES_VERSION=2;
// 统一放大实体车身，渲染和碰撞共用尺寸；最宽坦克仍能通过 3.6 米车道。
export const VEHICLE_LENGTH_SCALE=2.4;
export const VEHICLE_WIDTH_SCALE=1.6;
export const PLAYER_LATERAL_SCALE=1.1;
for(const vehicle of VEHICLES.slice(1)){vehicle.length*=VEHICLE_LENGTH_SCALE;vehicle.width*=VEHICLE_WIDTH_SCALE;vehicle.lateral*=PLAYER_LATERAL_SCALE;}
// 一级车采用摩托车造型，横向放大 53%（由 80% 降低 15% 后取整）；模型和碰撞共用宽度，长度不变。
export const BICYCLE_WIDTH_SCALE=1.53;
VEHICLES[1].width*=BICYCLE_WIDTH_SCALE;
export const BICYCLE_TIRE_WIDTH=.14; // 模型缩放前的轮胎宽度，路面接触使用缩放后的一半。
export const TRAFFIC_COLORS=[
  null,
  [0xf6cf57,0x76bcb3,0xe88073,0x91a5dc,0xebdcc5,0x7fa970],
  [0x62b59a,0x4c93be,0xdca54b,0xc86b55,0xb7bdd0,0x8fa95f],
  [0x68b6d7,0xc75650,0xe5d6ae,0x73964a,0x8c77b5,0x596b79],
  [0xe3945e,0x5e9aaf,0xb6564e,0xd4caa9,0x7a9764,0x8d80a9],
  [0x829b83,0x667e58,0xa79770,0x788a98,0x746f60,0x9faaa1],
];
export const VEHICLE_CONTACT={
  endCoreFraction:.6, // 车头与车尾中央 60% 的宽度为正面撞击区，其余端角允许擦过。
  sideOverlapFraction:.1, // 侧碰至少重叠较短车辆车长的 10%，避免单点擦角直接吞吃。
  separationGap:.025, // 擦角及已有重叠沿横向分离，留出此间隙，单位为米。
};
export const SIDE_BOUNCE={
  widthMultiplier:2, // 主弹开距离为各自车宽的两倍，与车道宽度无关。
  impactSeconds:.65, // 主弹开阶段，横向速度线性降低至收尾速度。
  settleSeconds:.85, // 收尾继续缓慢偏移至停止，总时长 1.5 秒；全程锁定左右控制。
  settleSpeedRatio:.12, // 收尾起始速度占初始弹开速度的比例，收尾路程额外计算。
};
// 总积分下降导致降级后的统一保护时间，暂停不消耗；不免疫道路障碍、截止墙和饥饿。
export const REAR_END_INVINCIBLE_SECONDS=2;
// 调试复活后保护两秒，包括截止墙和道路障碍；暂停不消耗。
export const DEBUG_REVIVE_SECONDS=2;
export const AUTO_ACCELERATION=6;
// 低速按上键优先进行普通加速，不消耗氮气；到达正常最高速度的 60% 后改为喷气。
export const MANUAL_ACCELERATION={maxRatio:.6,acceleration:35};
export const NITRO={
  capacity:2, // 气量以管为单位，最多存两管，允许消耗或补充半管等部分气量。
  eatCharge:.5, // 吞吃一辆车补充半管，与总容量及成长积分独立。
  eatSideSeconds:.4, // 同一方向连续侧移超过此时长吞吃，回气翻倍为一管；短按横移只得基础半管。
  speedMultiplier:1.66, // 喷气时正常上限提高 66%（63% 提升 5% 后取整），车型喷气上限按 km/h 四舍五入。
  boostAcceleration:70, // 喷气每秒额外提速，单位 km/h，低速同样有效。
  boostSeconds:3.5, // 每管可持续喷气的秒数，满两管可喷 7 秒，松开上箭头保留余量。
  recoverySeconds:.35, // 停喷后超出正常限速的速度平滑回落，可立即再次喷气。
};
export const XP = [0,1,2,6,18,54];
// 总积分达到下一车型价值就升级，最高封顶为坦克价值 54；rank 0 为占位车，无升级价值。
export const UPGRADE_POINTS = XP.map((_,rank)=>rank===0?0:(rank>=MAX_RANK?XP[MAX_RANK]:XP[rank+1]));
// 连续未吞吃达到此时间即扣分；总积分低于负两分死亡，负分吞吃直接累加。
export const HUNGER={intervalSeconds:10,bicycleDebtLimit:2};
// 饥饿、同级追尾和奶牛接触共用扣分量：前一级车型价值，自行车为 1。
export const POINT_LOSS=XP.map((_,rank)=>rank===0?0:XP[Math.max(1,rank-1)]);
// 各车型使用整数防御刻度，按武器类型计算有效伤害，避免三分之一伤害的浮点误差。
// 抗击打能力由伤害 / 满防御决定，不同车型的刻度不直接比较。
export const VEHICLE_DEFENSE=[null,
  {max:1,bullet:1,rocket:1},
  {max:2,bullet:1,rocket:2},
  {max:2,bullet:1,rocket:2},
  {max:15,bullet:3,rocket:5},
  {max:10,bullet:1,rocket:2},
];
// 武器只属于路边建筑，车辆不携带攻击系统。
export const FORTIFICATIONS={
  bunker:{interval:4,kind:'rocket',size:.44,height:3.1},
  tower:{interval:6,kind:'bullet',size:.36,height:5.4},
  spacing:120,range:260,offset:7,
};
export const PROJECTILES={bullet:{speed:75,radius:.12},rocket:{speed:55,radius:.32}};
// 路边建筑按玩家车型抽取开火概率，统一乘以 0.9。
export const COMBAT={unlockSeconds:75,tankChance:.8,chanceStep:.15,chanceMultiplier:.9,capacity:128,lifetime:8};
export const ONCOMING_SPEED_SCALE=1.44; // 对向巡航速度为基础区间的 144%，生成时按 km/h 四舍五入。
export const TRAFFIC_WEIGHTS={
  lower:.1,higher:.3,higherMax:.35,higherStep:.01,stepDistance:2000, // 后方车流的等级分布。
  // 前方以低一级为主要吞吃目标；距离增长只挤占同级比例，不削减可吞吃目标。
  ahead:{oneLower:.6,otherLower:.1,higher:.1,higherMax:.15},
};
export const TRAFFIC_SPAWN_AHEAD={min:160,max:240};
// 后方车流覆盖本车道；新车远离玩家投放，超过保留距离才回收，距离单位为米。
export const TRAFFIC_SPAWN_BEHIND={min:120,max:200,retainDistance:260,intervalSeconds:1};
// 后车接近到至少 45 米或六秒追赶距离内时提示，不为玩家减速或避让。
export const REAR_WARNING={minDistance:45,seconds:6,minClosingSpeed:.5};
export const TRAFFIC_DENSITY={
  scale:2,capacity:88,maxCapacity:160,
  growthSeconds:15,capacityPerStep:3, // 按本局有效运行时间每 15 秒增加 3 辆容量，最多 160 辆，暂停不计时。
  gapReductionPerStep:.02,minGapScale:.65, // 每档缩短初始系统车距的 2%，最低保留 65%；不缩短玩家生成安全距离。
};
// 生成时固定 0 或 1 的随机变道开关；启用车辆每隔 6–10 秒按 30%–55% 概率尝试。
export const TRAFFIC_LANE_CHANGE={enabledChance:.5,chanceMin:.3,chanceMax:.55,intervalMin:6,intervalMax:10};
// 危险车辆独立抽取，随机变道忽略目标空隙；普通车辆只在碰撞临近时主动避让。
export const TRAFFIC_DRIVING={dangerousChance:.15,avoidSeconds:3.5,minAvoidDistance:16,signalSeconds:1,changeSeconds:1.5};
// 跨轮静态查询缓存按轮数限制，远离当前窗口的内容可重新生成。
export const ROAD_CACHE={maxLaps:4};
export const ROAD_RENDER={sampleCapacity:160};
// 每轮三个额外弯组候选；成对曲线保持出口方向，截止墙前后仍留直道。
export const ROAD_CURVES={extraPairChance:.75,minAngle:12,maxAngle:22,minLength:240,maxLength:360,lengthStep:20,straightChance:.2,straightLength:60};
// 树木共用几何与实例批次，高度、冠幅及松树比例只在静态布局刷新时抽取。
export const TREE_SCENERY={capacity:150,coniferChance:.3,minHeight:4.8,maxHeight:7.2,minRadius:1.3,maxRadius:1.9};
export const ROAD_DIFFICULTY={
  afterSeconds:150,warningDistance:60,taperLength:400,bulletChanceIncrease:.1,
  // 玩家越过永久收窄过渡段后，同时提高建筑攻击与车流随机变道强度。
  fourLane:{bulletChanceIncrease:.25,rocketChanceIncrease:.2,laneChangeChanceIncrease:.25,laneChangeIntervalMin:4,laneChangeIntervalMax:7,dangerousChance:.25},
};
// 施工只关闭一个车道，区间长度为米；与永久收窄保持独立。
export const ROADWORKS={first:380,interval:400,chance:.5,minLength:30,maxLength:100,warningDistance:240,barrierWidth:3.4};
// 减速倍率仅用于泥巴和河道谷底；建筑道路间距为加长分叉预留平地区间。
export const ROAD_INFRASTRUCTURE={trainChance:.2,dipLength:20,slowMultiplier:.5,trainSpeed:22,trainLength:42,gapMin:1600,gapMax:2320};
// 跨度按公共道路里程计，副路另校验实际弧长；分离距离为中段路面边缘的空隙。
export const ROAD_FORKS={chance:.8,minSpan:880,maxSpan:1760,minLength:800,maxLength:2000,separationMin:40,separationMax:60,potholeSpacing:22,potholeChance:.7,weatherChance:.85,weatherIntervalMin:3,weatherIntervalMax:7};
// 同一车队共享低速目标和短投放净距，普通车流使用独立的生成净距。
export const SLOW_TRAFFIC={minCount:3,maxCount:7,minSpeed:10,maxSpeed:30,minGap:2.5,maxGap:4,firstSeconds:8,intervalMin:14,intervalMax:24,chance:.65};
// 横穿奶牛只在平地投放；结构缓冲额外覆盖队员错开与身体纵向范围。
export const COW_CROSSING={minCount:5,capacity:7,spacing:4.2,chance:.25,minInterval:14,intervalRange:10,minAhead:120,aheadRange:80,infrastructurePadding:20,stationJitter:2.4,dimensions:{width:3.3,length:1.5}};
// 程序化音效（Web Audio 实时合成，不加载音频文件）：总音量、环境声增益与衰减距离、提示音。
// range 为声源可闻距离（米），pan 为声像摆动幅度，玩家自身发动机与喷气音量刻意低于环境声。
export const AUDIO={
  master:.55,
  engine:{baseHz:44,speedHz:96,gain:.05,jetGain:.05,jetHz:1400},
  wind:{gain:.24,pan:.75},
  water:{gain:.22,range:70},
  train:{gain:.6,range:170,pan:.75},
  tank:{gain:.5,range:55,pan:.6},
  pass:{range:7,minSpeed:8,gain:.13},
  beep:{hz:880,gain:.05},
};
export const SEASONS = ['春','夏','秋','冬'];
export const WEATHER={duration:9,windDuration:6,windSpeed:.5,freezeSeconds:3,fogNear:10,fogFar:50};
// 白马按有效运行时间每分钟投放；保护总长 10 秒包含末尾 2 秒闪烁，回落另计。
export const WHITE_HORSE={
  intervalSeconds:60,speed:60,minAhead:20,maxAhead:35,
  visibleSeconds:6,blinkSeconds:2,length:3.8,width:1.3,
  rampSeconds:1,shieldSeconds:10,shieldBlinkSeconds:2,recoverySeconds:2,speedMultiplier:2,
};
export const LANE_WIDTH = 3.6;
export const laneD = (lane, direction = 1) => direction * (.4 + (lane + .5) * LANE_WIDTH);
export const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
export const lerp = (a,b,t) => a+(b-a)*t;
export const smooth = t => t*t*(3-2*t);
export function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6D2B79F5;
    let t = Math.imul(n ^ n >>> 15, 1 | n);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const approach = (value, target, delta) => value < target ? Math.min(target,value+delta) : Math.max(target,value-delta);
