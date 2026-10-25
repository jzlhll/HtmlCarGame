import { TREE_CONTACT } from './config.js';

// 树木和大雁各自按有效游戏时间合并三秒内的伤害，暂停不消耗窗口。
export class GlassIntegrity {
  constructor(aircraft) {this.aircraft=aircraft;this.lastTree=-Infinity;this.lastBird=-Infinity;}
  hit(kind,seconds) {
    if(this.aircraft.glassDamage>=100)return false;
    const key=kind==='tree'?'lastTree':'lastBird';
    if(seconds-this[key]<TREE_CONTACT.windowSeconds-1e-9)return false;
    this[key]=seconds;
    const loss=kind==='tree'?TREE_CONTACT.treeDamage:TREE_CONTACT.birdDamage;
    this.aircraft.glassDamage=Math.min(100,this.aircraft.glassDamage+loss);
    return true;
  }
}
