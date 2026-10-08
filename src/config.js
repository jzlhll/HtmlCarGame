export const VEHICLES = [
  null,
  {name:'自行车', length:1, width:.55, min:20, max:45, playerMax:110, lateral:6.6, color:0xf6cf57},
  {name:'三轮车', length:1.55, width:.85, min:55, max:85, playerMax:130, lateral:6.3, color:0x62b59a},
  {name:'小汽车', length:2, width:1, min:55, max:95, playerMax:145, lateral:6.15, color:0x68b6d7},
  {name:'卡车', length:3.75, width:1.25, min:45, max:75, playerMax:145, lateral:5.1, color:0xe3945e},
  {name:'坦克', length:2.5, width:1.875, min:25, max:55, playerMax:145, lateral:4.35, color:0x829b83},
];
export const MAX_RANK=VEHICLES.length-1;
// 玩家座驾涂装：yellow/blue/green 为纯色，rainbow 使用渐变贴图；默认绿色。
export const CAR_COLORS=[
  {id:'yellow',name:'黄色',hex:0xf5cc58,css:'#f5cc58'},
  {id:'blue',name:'蓝色',hex:0x4f86d6,css:'#4f86d6'},
  {id:'green',name:'绿色',hex:0x3fae6a,css:'#3fae6a'},
  {id:'rainbow',name:'彩虹色',hex:'rainbow',css:'linear-gradient(135deg,#ff4d4d 0%,#ff9f2e 22%,#ffe14d 42%,#3ecf6a 60%,#2eb8ff 80%,#b05fff 100%)'},
];
export const DEFAULT_CAR_COLOR='green';
export const carColor=id=>CAR_COLORS.find(c=>c.id===id)??CAR_COLORS.find(c=>c.id===DEFAULT_CAR_COLOR);
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
// 答题或调试复活后保护两秒，包括截止墙和道路障碍；暂停不消耗。
export const DEBUG_REVIVE_SECONDS=2;
export const RESCUE_LIMIT=2; // 每局非答题致命事件可触发的答题复活次数。
export const REVIVE_CLEAR_AHEAD=50; // 原地复活时清理当前路线前方的车流距离(米)。
export const PLAYER_START_SPEED=57.5;
export const AUTO_ACCELERATION=20; // 松开刹车或加速键、解冻后自动提速，单位 km/h/秒。
// 上键普通加速到车型最高速后持续按住即可接续喷气，达到喷气上限仍消耗氮气。
export const MANUAL_ACCELERATION={acceleration:35};
// 触屏布局按实际可用窗口适配；窄桌面窗口也提供触屏操作入口。
export const MOBILE={compactWidth:600,stickDeadZone:.18,stickTravelRatio:.32};
export const CAMERA={fov:55,portraitMaxFov:90};
export const NITRO={
  capacity:2, // 气量以管为单位，最多存两管，允许消耗或补充半管等部分气量。
  eatCharge:.5, // 吞吃回气按车型计算:eatCharge×被吃车辆等级(自行车半管,每高一级加半管,封顶两管)。
  eatSideSeconds:.4, // 同一方向连续侧移超过此时长吞吃，回气翻倍为一管；短按横移只得基础半管。
  maxSpeed:215, // 各车型无惩罚时统一的喷气最高速度(km/h)。
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
// 各车型使用整数防御刻度：max 为满防御,lightning 为闪电的单次伤害;炮弹等新伤害源按 max 的比例计算。
// 抗击打能力由伤害 / 满防御决定，不同车型的刻度不直接比较。
export const VEHICLE_DEFENSE=[null,
  {max:1,lightning:1},
  {max:2,lightning:2},
  {max:2,lightning:2},
  {max:15,lightning:5},
  {max:10,lightning:2},
];
export const ONCOMING_SPEED_SCALE=1.44; // 对向巡航速度为基础区间的 144%，生成时按 km/h 四舍五入。
export const TRAFFIC_WEIGHTS={
  lower:.1,higher:.3,higherMax:.35,higherStep:.01,stepDistance:2000, // 后方车流的等级分布。
  // 前方以低一级为主要吞吃目标；距离增长只挤占同级比例，不削减可吞吃目标。
  ahead:{oneLower:.6,otherLower:.1,higher:.1,higherMax:.15},
};
export const TRAFFIC_SPAWN_AHEAD={min:160,max:240,safetySeconds:4,retainDistance:480};
// 升至三轮车或小汽车时，立即在当前路线前方投放同级与低一级各五辆。
export const UPGRADE_TRAFFIC={countPerRank:5,minAhead:80,maxAhead:150};
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
  afterSeconds:150,warningDistance:60,taperLength:400,
  // 玩家越过永久收窄过渡段后，提高车流随机变道与危险车强度。
  fourLane:{laneChangeChanceIncrease:.25,laneChangeIntervalMin:4,laneChangeIntervalMax:7,dangerousChance:.25},
};
// 施工只关闭一个车道，区间长度为米；与永久收窄保持独立。
export const ROADWORKS={first:380,interval:400,chance:.5,minLength:30,maxLength:100,warningDistance:240,barrierWidth:3.4};
// 减速倍率仅用于泥巴和河道谷底；建筑道路间距为加长分叉预留平地区间。
// 高架与低沉地形随机:高度/深度与坡长独立抽取,长坡高而平缓(顶峰较远),短坡高而陡(很快到顶);
// 最小坡长按 maxGrade 反推(|高度|×1.5÷最大坡度,smooth 曲线峰值坡度为高度×1.5÷坡长),坡度不会越界。
export const ROAD_INFRASTRUCTURE={
  trainLeadSeconds:2.5,trainHornLeadSeconds:.6,dipLength:20,slowMultiplier:.5,trainSpeed:22,trainLength:42,gapMin:800,gapMax:1160, // 间距由 1600–2320 缩半,起伏路段出现频率加倍;分叉只在较宽的间距区间(可用跨度≥minSpan)内安放。
  viaductHeightMin:14,viaductHeightMax:40, // 桥面高度抽取范围(米),原 14–20 大幅上调。
  viaductRampMin:120,viaductRampMax:400, // 引桥坡长抽取范围(米):400 米长坡配高桥即"高而缓",被坡度反推抬高后即"高而陡"。
  dipDepthMin:3,dipDepthMax:16, // 谷底深度抽取范围(米,向下),原固定 3。
  dipRampMin:40,dipRampMax:180, // 低沉坡长抽取范围(米)。
  maxGrade:.35, // 坡度上限(垂直/水平),约 19°,防止短坡组合出失真的悬崖。
};
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
  train:{
    gain:.6,range:240,pan:.75,
    // 按参考录音的撞缝分组：两对轮轴冲击及弱余振；各次依次为时间、重量、金属亮度。
    clatter:{
      period:1.315,hits:[[0,1,1],[.12,1.05,.2],[.29,.32,.08],[.43,.92,.9],[.55,1.08,.2],[.72,.3,.07]],
      // 共鸣依次为频率、强度、衰减秒数；低频车轮震动与宽频金属冲击分层。
      body:[[70,.65,.065],[117,.4,.045],[211,.7,.055],[258,.85,.04],[422,.5,.035],[516,.31,.025],[750,.26,.03]],
      metal:[[1141,.25,.02],[1627,.3,.02],[1813,.22,.035],[1969,.34,.04],[2033,.4,.045],[2086,.54,.05],[2156,.43,.045],[2237,.29,.035],[2320,.31,.04],[2391,.29,.035],[2438,.31,.03],[2531,.23,.03],[2639,.25,.035],[2719,.38,.045],[2836,.29,.035],[2906,.27,.03],[3079,.18,.025],[3258,.22,.025],[3422,.23,.025],[3492,.18,.02],[4721,.66,.012],[6151,.39,.008]],
      gain:.55,attack:.002,phaseStep:2.399963,bodyTail:.16,metalTail:.18,decayLimit:12,rateStart:.9,rateEnd:1.3,accelerateSeconds:5,
    },
    // 按鸣笛参考的谐波比例合成：440 Hz 基音，880 Hz 最突出，保留高频穿透感。
    horn:{loopSeconds:1,hz:441,harmonics:[0,.566,1,.427,.591,.473,.625,.581,.449,.42,.305,.26,.202,.168,.143],phases:[0,2.88,0,-1.051,-1.956,2.856,1.651,3,-.031,-2.671,-3.095,2.483,1.439,.491,-.354],gain:.48,pulses:[[0,2.8]],attack:.12,release:.24,rise:.01,fall:.025,vibrato:.0007,vibratoHz:4.3,dopplerScale:.25},
  },
  tank:{gain:.5,range:55,pan:.6},
  pass:{range:7,minSpeed:8,gain:.13},
  beep:{hz:880,gain:.05},
  graze:{intervalSeconds:.16}, // 擦角噪声的最小间隔，避免持续接触时密集叠加。
  // 警车警笛:低频单音按固定节奏往复脉冲,形成“嗯、嗯、嗯”的短促鸣响,每个脉冲带轻微下滑;
  // 按距离衰减并随警车所在侧偏置声像。救护车的高低双音不在此列。
  police:{hz:470,dropHz:110,pulseHz:3.1,gain:.4,range:170,pan:.7},
  // 天降炮弹:下落啸声从高频滑向低频,命中为低频爆响;落点在玩家附近,不做距离衰减。
  shell:{whistleHz:1300,whistleDropHz:320,gain:.3,boomGain:.6},
};
export const SEASONS = ['春','夏','秋','冬'];
// 非分叉路段天气按 intervalMin~intervalMax 秒随机投放,首次开场 firstMin~firstMax 秒;分叉路段使用 ROAD_FORKS 的天气字段。
export const WEATHER={duration:9,windDuration:6,windSpeed:.5,freezeSeconds:3,fogNear:10,fogFar:50,intervalMin:31,intervalMax:45,firstMin:12,firstMax:25};
// 白马按有效运行时间每分钟投放；保护总长 10 秒包含末尾 2 秒闪烁，回落另计。
export const WHITE_HORSE={
  intervalSeconds:60,speed:60,minAhead:20,maxAhead:35,
  visibleSeconds:6,blinkSeconds:2,length:3.8,width:1.3,
  rampSeconds:1,shieldSeconds:10,shieldBlinkSeconds:2,recoverySeconds:2,speedMultiplier:2,
};
// 警车追击:无敌警车随机出现,速度自由——只按前方距离窗口调节车速并极速避让车流。
// 追击期间每三秒在玩家当前路线、车道前方按两秒车程且至少四十米生成捕捞网，接触后进入答题。
export const POLICE={
  intervalMin:30,intervalMax:120, // 开局及撤离后随机等待 30~120 秒。
  spawnAheadMin:35,spawnAheadMax:55, // 生成在玩家前方 35~55 米。
  keepMin:15,keepMax:42, // 警车与玩家保持的前方距离窗口(米),保证始终在屏幕内且不太远。
  keepGain:.9, // 窗口内距离保持的力度:每偏差 1 米修正 0.9 km/h,使间距收敛到窗口中点。
  chaseRatio:1.5, // 间距小于 keepMin 时警车加速到玩家速度的该倍数拉开(速度自由,不拦截玩家)。
  closeRatio:.7, // 间距超过 keepMax 时警车减速到玩家速度的该比例,让玩家跟上来。
  dodgeSpeed:12,dodgeLookahead:26, // 极快避让车流:横向速度(米/秒)与前向观察距离(米)。
  netAheadMin:40, // 生成位置与玩家的最小沿路线距离(米)。
  netLeadSeconds:2, // 按生成时玩家车速预留的前方车程(秒)。
  netInterval:3, // 追击期间的撒网间隔(有效运行秒数)，不受警车距离限制。
  netSizeBase:3, // 渔网初始边长(米,原 10 缩到 1/3 取整),3×3。
  netSizeGrowth:.28, // 警车持续期间渔网边长每秒增长(米),增长力度常量。
  netSizeMax:16, // 渔网边长上限,保证仍可躲。
  netKeep:6, // 捕捞网生成后立即生效，存活时间(有效运行秒数)。
  quizMathSeconds:45,quizChineseSeconds:30,quizEnglishSeconds:30, // 题目显示后按真实时间倒计时，超时结束本局。
  catchSeconds:1.5, // 被抓动画时长:玩家缩小并被拉向警车。
  maxChaseSeconds:45, // 警车持续时长达到上限后自动撤离。
};
export const LANE_WIDTH = 3.6;
// 天降炮弹:开局 startSeconds 后按 intervalMin~intervalMax 秒随机投弹,落点取玩家前方并横向抖动;
// fallSeconds 为预警圈+下落时长(留给玩家躲避),areaSize 为爆炸区域基础边长(米,常量,后续可调),
// 炮击开始后每满 sizeGrowthSeconds 秒边长增大 sizeGrowthFactor 倍(复利,弹体携带生成时的尺寸)。
// 玩家被直接命中即死亡;坦克只损失 tankDamageFraction 满防御、卡车损失 truckDamageFraction(取整后经统一防御流程)。
export const SHELL={
  startSeconds:120,
  intervalMin:10,intervalMax:22,
  fallSeconds:2.5,
  areaSize:6, // 基础爆炸区域边长(米),由 7.5 缩小 25% 取整。
  sizeGrowthSeconds:30,sizeGrowthFactor:1.2, // 炮击开始后每 30 秒爆炸边长增大 20%。
  targetAheadMin:0,targetAheadMax:45,
  targetJitter:7,
  tankDamageFraction:1/3,truckDamageFraction:1/2,
};
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
// 启动早期应用 URL 测试参数(?fast=1 或 ?POLICE.intervalMin=3 等白名单字段),
// 仅服务 Agent/人工快速验证随机事件;不带参数或 Node 端导入时默认值原样生效。
import { applyTestOverrides } from './test-overrides.js';
applyTestOverrides({TRAFFIC_DENSITY,POLICE,WHITE_HORSE,COW_CROSSING,ROADWORKS,SLOW_TRAFFIC,HUNGER,WEATHER,ROAD_FORKS,ROAD_INFRASTRUCTURE,ROAD_DIFFICULTY,SHELL});
