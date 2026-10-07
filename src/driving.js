import { NITRO } from './config.js';

// 单局连续氮气、按住喷气与停喷回落；由有效行驶时间推进，暂停时冻结。
export class Nitro {
  constructor(){this.tanks=0;this.boost=0;this.recovery=0;this.recoverySpeed=0;}
  // boost 不是独立燃料，而是按当前 tanks 重算的本步可用喷气秒数；同时以 boost>0 充当"喷气中"标志。
  // 真实气量只看 tanks，boost 每次喷气步都会被 release 重新赋值，不要在外部累加或直接修改。
  charge(amount){
    if(amount<=0)return;
    this.tanks=Math.min(NITRO.capacity,this.tanks+amount);
  }
  release(){
    if(this.tanks<=0)return false;
    this.boost=this.tanks*NITRO.boostSeconds;
    this.recovery=0;return true;
  }
  advance(dt,speed,held){
    if(held&&this.release()){
      const used=Math.min(dt,this.boost);
      this.tanks=Math.max(0,this.tanks-used/NITRO.boostSeconds);
      if(this.tanks<1e-8)this.tanks=0;
      // 最后一小段气量仍驱动本步，耗尽后下一步进入回落。
      return used;
    }
    if(this.boost>0){this.boost=0;this.recovery=NITRO.recoverySeconds;this.recoverySpeed=speed;}
    this.recovery=Math.max(0,this.recovery-dt);
    if(this.recovery<1e-8)this.recovery=0;
    return 0;
  }
  limit(normal){
    const boosted=NITRO.maxSpeed;
    if(this.boost>0)return boosted;
    if(this.recovery>0)return normal+Math.max(0,Math.min(this.recoverySpeed,boosted)-normal)*this.recovery/NITRO.recoverySeconds;
    return normal;
  }
  stop(){this.boost=0;this.recovery=0;}
}
