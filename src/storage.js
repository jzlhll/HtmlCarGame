import { SEASONS, MAX_RANK, RULES_VERSION, CAR_COLORS, DEFAULT_CAR_COLOR } from './config.js';
const KEY='htmlCarGame.save.v1';
const COLOR_KEY='htmlCarGame.color.v1';
const SCHEMA_VERSION=2;
const defaults=()=>({schemaVersion:SCHEMA_VERSION,rulesVersion:RULES_VERSION,updatedAt:null,leaderboard:[]});
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const validRun=r=>r&&typeof r.runId==='string'&&r.runId.length<100&&number(r.runSeed)&&SEASONS.includes(r.startSeason)&&r.rulesVersion===RULES_VERSION&&typeof r.endedAt==='string'&&Number.isFinite(Date.parse(r.endedAt))&&['death','quit'].includes(r.endReason)&&number(r.distanceMeters)&&number(r.activeSeconds)&&Number.isInteger(r.highestRank)&&r.highestRank>=1&&r.highestRank<=MAX_RANK&&Array.isArray(r.eatenByType)&&r.eatenByType.length===MAX_RANK&&r.eatenByType.every(v=>number(v)&&Number.isInteger(v))&&(r.deathCause===null||typeof r.deathCause==='string');
const order=(a,b)=>b.score-a.score||b.distanceMeters-a.distanceMeters||Date.parse(a.endedAt)-Date.parse(b.endedAt);
export class SaveStore {
  constructor(){this.data=defaults();this.warning='';this.blocked=false;this.load();}
  load(){
    try {
      const raw=localStorage.getItem(KEY);
      if(!raw){this.data=defaults();this.warning='';this.blocked=false;return;}
      const data=JSON.parse(raw);
      // 已知结构的旧规则成绩不混排；原子重写，新版本或未知结构继续保护原档。
      if((data.schemaVersion===1||data.schemaVersion===SCHEMA_VERSION)&&Number.isInteger(data.rulesVersion)&&data.rulesVersion>=1&&data.rulesVersion<RULES_VERSION){
        this.data=defaults();this.warning='';this.blocked=false;this.write();return;
      }
      if(data.schemaVersion!==SCHEMA_VERSION||data.rulesVersion!==RULES_VERSION||!Array.isArray(data.leaderboard)||data.leaderboard.length>10||!data.leaderboard.every(validRun)) throw new Error('Invalid save');
      for(const r of data.leaderboard)r.score=Math.floor(r.distanceMeters);
      data.leaderboard.sort(order);
      this.data={...defaults(),updatedAt:data.updatedAt||null,leaderboard:data.leaderboard};this.warning='';this.blocked=false;
    }catch{
      this.blocked=true;
      this.warning='本机记录暂时无法读取，本次仍可游玩。需要时可重置本游戏记录。';
    }
  }
  write(){
    if(this.blocked)return false;
    try{this.data.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(this.data));this.warning='';return true;}
    catch{this.warning='浏览器未能保存记录，本次成绩暂留在当前页面。';return false;}
  }
  record(run){
    if(this.lastRunId===run.runId||this.data.leaderboard.some(r=>r.runId===run.runId))return;
    this.lastRunId=run.runId;
    this.data.leaderboard=[...this.data.leaderboard,run].sort(order).slice(0,10);
    this.write();
  }
  reset(){
    this.data=defaults();
    try{localStorage.removeItem(KEY);localStorage.setItem(KEY,JSON.stringify(this.data));this.blocked=false;this.warning='';return true;}
    catch{this.blocked=true;this.warning='记录未能重置，浏览器存储仍不可用；可以继续游玩。';return false;}
  }
  // 座驾颜色单独存放，不进入排行榜存档校验；读取失败时回落默认绿色。
  getColor(){
    try{const id=localStorage.getItem(COLOR_KEY);return CAR_COLORS.some(c=>c.id===id)?id:DEFAULT_CAR_COLOR;}
    catch{return DEFAULT_CAR_COLOR;}
  }
  setColor(id){
    if(!CAR_COLORS.some(c=>c.id===id))return false;
    try{localStorage.setItem(COLOR_KEY,id);return true;}
    catch{return false;}
  }
  static get key(){return KEY;}
}
