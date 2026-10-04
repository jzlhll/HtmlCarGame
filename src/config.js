export const VEHICLES = [
  null,
  {name:'自行车', length:1, width:.55, min:15, max:30, playerMax:65, lateral:6.6, color:0xf6cf57},
  {name:'三轮车', length:1.55, width:.85, min:50, max:70, playerMax:75, lateral:6.3, color:0x62b59a},
  {name:'小汽车', length:2, width:1, min:50, max:80, playerMax:90, lateral:6.15, color:0x68b6d7},
  {name:'卡车', length:2.5, width:1.25, min:40, max:60, playerMax:90, lateral:5.1, color:0xe3945e},
  {name:'加长卡车', length:3, width:1.25, min:35, max:50, playerMax:90, lateral:4.5, color:0xb597d5},
  {name:'坦克', length:2.5, width:1.875, min:20, max:40, playerMax:90, lateral:4.35, color:0x829b83},
];
// 统一放大实体车身，渲染和碰撞共用尺寸；最宽坦克仍能通过 3.6 米车道。
export const VEHICLE_LENGTH_SCALE=2.4;
export const VEHICLE_WIDTH_SCALE=1.6;
for(const vehicle of VEHICLES.slice(1)){vehicle.length*=VEHICLE_LENGTH_SCALE;vehicle.width*=VEHICLE_WIDTH_SCALE;}
export const TRAFFIC_COLORS=[
  null,
  [0xf6cf57,0x76bcb3,0xe88073,0x91a5dc,0xebdcc5,0x7fa970],
  [0x62b59a,0x4c93be,0xdca54b,0xc86b55,0xb7bdd0,0x8fa95f],
  [0x68b6d7,0xc75650,0xe5d6ae,0x73964a,0x8c77b5,0x596b79],
  [0xe3945e,0x5e9aaf,0xb6564e,0xd4caa9,0x7a9764,0x8d80a9],
  [0xb597d5,0x658fab,0xc5a653,0x8fa788,0xc67962,0xbdc6cb],
  [0x829b83,0x667e58,0xa79770,0x788a98,0x746f60,0x9faaa1],
];
export const SIDE_REAR_FRACTION=.5;
export const AUTO_ACCELERATION=6;
export const XP = [0,1,2,6,18,54,216];
// 每级升级使用下一车型的积分值，满级不再累积升级积分。
export const UPGRADE_POINTS = XP.map((_,rank)=>rank===0?0:(XP[rank+1]??0));
export const ONCOMING_SPEED_SCALE=.8;
export const TRAFFIC_WEIGHTS={lower:.1,higher:.3,higherMax:.35,higherStep:.01,stepDistance:2000};
export const TRAFFIC_SPAWN_AHEAD={min:200,max:240};
export const SEASONS = ['春','夏','秋','冬'];
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
