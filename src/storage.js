import { AUDIO, SCORES, RENDERING } from './config.js';
import { LearningDB } from './learning-db.js';
import { DEFAULT_VOCABULARY_ID, getVocabulary } from './vocabulary-data.js';
import { TEST_ACCOUNTS,validateAccountName,randomAccountName,newAccountId } from './accounts.js';
const PREFIX='english-air-combat:';
const defaultSettings=()=>({volume:AUDIO.masterVolume,reducedMotion:false,renderQuality:RENDERING.defaultQuality});
export class Storage {
  constructor(debug=false,preferredAccount=null){
    this.debug=debug;this.available=true;this.warning='';this.account=null;this.prefix=null;this.profileCache=new Map();this.accountSettings=new Map();this.accountLibraries=new Map();this.wordMaps=new Map();this.libraryId=DEFAULT_VOCABULARY_ID;this.accountPrefix=null;this.pendingSave=Promise.resolve();
    this.settings={volume:AUDIO.masterVolume,reducedMotion:false,renderQuality:RENDERING.defaultQuality};this.scores=[];this.learning={};this.progress={selected:1,unlocked:1};this.review=null;this.pendingRun=null;this.levelState={currentId:null,sessions:{}};this.savedRuns=new Set();this.attemptRows=[];this.database=null;this.databaseAvailable=false;
    this.cleanup=debug?Promise.resolve():this.discardLegacyData();
    const registry=this.readAt(PREFIX,debug?'debug-accounts':'accounts',null);
    this.accounts=debug?TEST_ACCOUNTS.map(account=>({...account})):[];
    if(!debug&&Array.isArray(registry?.accounts))for(const account of registry.accounts){
      if(!account||!/^pilot-[a-z0-9-]+$/.test(account.id)||this.accounts.some(item=>item.id===account.id))continue;
      try{this.accounts.push({...account,name:validateAccountName(account.name,this.accounts)});}catch{this.warning='部分账号信息损坏，已保留其他可用账号';}
    }
    const requested=debug?this.accounts.find(account=>account.name===String(preferredAccount||'').toUpperCase())?.id:null;
    this.lastAccountId=debug?(requested||'test01'):this.accounts.find(account=>account.id===registry?.lastId)?.id||this.accounts[0]?.id||null;
  }
  readAt(prefix,key,fallback){try{const raw=localStorage.getItem(prefix+key);if(!raw)return fallback;const data=JSON.parse(raw);if(data.version!==1){this.warning='存档格式不兼容，本页使用内存记录';this.available=false;return fallback;}return data.value??fallback;}catch{this.available=false;this.warning='本地存储不可用，账号与词池仅保留在本页';return fallback;}}
  writeAt(prefix,key,value){if(!this.available)return false;try{localStorage.setItem(prefix+key,JSON.stringify({version:1,value}));return true;}catch{this.available=false;this.warning='保存失败，账号与词池仅保留在本页';return false;}}
  read(key,fallback){return this.prefix?this.readAt(this.prefix,key,fallback):fallback;}
  write(key,value){return this.prefix?this.writeAt(this.prefix,key,value):false;}
  async discardLegacyData(){
    try{
      for(const key of ['settings','scores','progress','learning','review','pending-run','level-state'])localStorage.removeItem(PREFIX+key);
      const registry=this.readAt(PREFIX,'accounts',null);
      if(Array.isArray(registry?.accounts)&&registry.accounts.some(account=>account?.id==='legacy'))this.writeAt(PREFIX,'accounts',{...registry,accounts:registry.accounts.filter(account=>account?.id!=='legacy'),lastId:registry.lastId==='legacy'?null:registry.lastId});
    }catch(error){this.warning='旧版本地存档未能清理，请允许浏览器本地存储后刷新';console.warn('Legacy local storage cleanup failed',error);}
    if(!await LearningDB.discardLegacy())this.warning='旧版学习缓存暂时无法清理，请关闭其他游戏页面后刷新';
  }
  saveAccounts(){this.writeAt(PREFIX,this.debug?'debug-accounts':'accounts',this.debug?{lastId:this.lastAccountId}:{accounts:this.accounts,lastId:this.lastAccountId});}
  refreshAccounts(){
    if(this.debug||!this.available)return;const registry=this.readAt(PREFIX,'accounts',null);if(!Array.isArray(registry?.accounts))return;
    const accounts=[];for(const row of registry.accounts){if(!row||!/^pilot-[a-z0-9-]+$/.test(row.id)||accounts.some(item=>item.id===row.id))continue;try{const name=validateAccountName(row.name,accounts),old=this.accounts.find(item=>item.id===row.id);if(old){Object.assign(old,row,{name});accounts.push(old);}else accounts.push({...row,name});}catch{this.warning='部分账号信息损坏，已保留其他可用账号';}}this.accounts=accounts;
  }
  randomAccountName(){this.refreshAccounts();return randomAccountName(this.accounts);}
  createAccount(value){if(this.debug)throw new Error('调试模式固定使用 TEST01–TEST09');this.refreshAccounts();const name=validateAccountName(value,this.accounts);let id=newAccountId();while(this.accounts.some(account=>account.id===id))id=newAccountId();const account={id,name,createdAt:Date.now()};this.accounts.push(account);this.saveAccounts();return account;}
  get library(){return getVocabulary(this.libraryId);}
  get canonical(){if(!this.wordMaps.has(this.libraryId))this.wordMaps.set(this.libraryId,new Map(this.library.entries.map(entry=>[entry.id,entry])));return this.wordMaps.get(this.libraryId);}
  profileKey(){return this.account.id+'/'+this.libraryId;}
  async finishPending(){await this.pendingSave;await this.database?.pending.catch(()=>{});this.cacheProfile();this.database?.db?.close();this.database=null;this.databaseAvailable=false;}
  cacheProfile(){
    if(!this.account)return;
    this.accountSettings.set(this.account.id,{...this.settings});this.accountLibraries.set(this.account.id,this.libraryId);
    this.profileCache.set(this.profileKey(),{scores:this.scores,learning:this.learning,progress:this.progress,review:this.review,pendingRun:this.pendingRun,levelState:this.levelState,savedRuns:this.savedRuns,attemptRows:this.attemptRows});
  }
  assertContext(value){
    if(!this.account)throw new Error('Account required');
    if(value?.accountId!==this.account.id||value?.libraryId!==this.libraryId)throw new Error('Learning account or library changed before save');
  }
  assertResult(result){
    this.assertContext(result);if(!result.id||!Array.isArray(result.records))throw new Error('Learning result required');
    const canonical=this.canonical;
    for(const record of result.records){this.assertContext(record);if(!record.id||!canonical.has(record.wordId)||!['correct','wrong','incomplete'].includes(record.kind)||!Number.isFinite(record.time))throw new Error('Learning record does not belong to current library');}
    for(const record of result.mistakes||[]){this.assertContext(record);if(!canonical.has(record.wordId))throw new Error('Review word does not belong to current library');}
  }
  async login(id){
    this.refreshAccounts();const account=this.accounts.find(item=>item.id===id);if(!account)throw new Error('账号不存在');
    await this.finishPending();if(this.available)this.warning='';this.pendingSave=Promise.resolve();
    this.account=account;this.accountPrefix=this.debug?PREFIX+'debug:'+account.id+':':PREFIX+'account:'+account.id+':';
    const requested=this.accountLibraries.get(id)||this.readAt(this.accountPrefix,'active-library',DEFAULT_VOCABULARY_ID);
    try{this.libraryId=getVocabulary(requested).id;}catch{this.libraryId=DEFAULT_VOCABULARY_ID;}
    Object.assign(this.settings,defaultSettings(),this.accountSettings.get(id)||this.readAt(this.accountPrefix,'settings',{}));
    this.settings.volume=Number.isFinite(this.settings.volume)?Math.max(0,Math.min(1,this.settings.volume)):AUDIO.masterVolume;this.settings.reducedMotion=this.settings.reducedMotion===true;if(!Object.hasOwn(RENDERING.qualities,this.settings.renderQuality))this.settings.renderQuality=RENDERING.defaultQuality;
    await this.loadLibrary();this.lastAccountId=id;this.saveAccounts();
  }
  async switchLibrary(id){
    if(!this.account)throw new Error('Account required');
    const library=getVocabulary(id);if(id===this.libraryId)return library;if(this.review?.remaining>0)throw new Error('请先完成当前词库的复习');
    await this.finishPending();this.libraryId=id;this.pendingSave=Promise.resolve();if(this.available)this.warning='';await this.loadLibrary();return this.library;
  }
  async loadLibrary(){
    this.prefix=this.accountPrefix+'library:'+this.libraryId+':';this.accountLibraries.set(this.account.id,this.libraryId);
    this.writeAt(this.accountPrefix,'active-library',this.libraryId);
    const cached=this.profileCache.get(this.profileKey()),canonical=this.canonical;
    this.scores=cached?.scores||this.read('scores',[]);if(!Array.isArray(this.scores))this.scores=[];this.scores=this.scores.filter(row=>row&&row.accountId===this.account.id&&row.libraryId===this.libraryId&&Number.isFinite(row.score));
    this.learning=cached?.learning||this.read('learning',{});if(!this.learning||Array.isArray(this.learning)||typeof this.learning!=='object')this.learning={};
    for(const [wordId,row] of Object.entries(this.learning)){if(!canonical.has(wordId)||!row||row.accountId!==this.account.id||row.libraryId!==this.libraryId||!Number.isFinite(row.correct)||!Number.isFinite(row.wrong))delete this.learning[wordId];else{row.incomplete=Number.isFinite(row.incomplete)?row.incomplete:0;Object.assign(row,{accountId:this.account.id,libraryId:this.libraryId,word:canonical.get(wordId).word,meaning:canonical.get(wordId).meaning,example:canonical.get(wordId).example});}}
    this.progress=cached?.progress||this.read('progress',{selected:1,unlocked:1});if(!this.progress||!Number.isInteger(this.progress.selected)||this.progress.selected<1||!Number.isInteger(this.progress.unlocked)||this.progress.unlocked<this.progress.selected)this.progress={selected:1,unlocked:1};
    this.review=cached?cached.review:this.read('review',null);try{this.assertResult(this.review?.result);if(!Array.isArray(this.review.result.mistakes)||!Number.isFinite(this.review.result.elapsed)||!Number.isFinite(this.review.remaining)||(this.review.remaining<0||this.review.remaining===0&&!this.review.result.recapPending))this.review=null;}catch{this.review=null;}
    this.pendingRun=cached?cached.pendingRun:this.read('pending-run',null);try{if(this.pendingRun){this.assertResult(this.pendingRun.result);if(!Array.isArray(this.pendingRun.rows)||this.pendingRun.rows.some(row=>!canonical.has(row.id)||row.accountId!==this.account.id||row.libraryId!==this.libraryId))this.pendingRun=null;}}catch{this.pendingRun=null;}
    this.levelState=cached?.levelState||this.read('level-state',{currentId:null,sessions:{}});if(!this.levelState||!this.levelState.sessions||typeof this.levelState.sessions!=='object'||Array.isArray(this.levelState.sessions))this.levelState={currentId:null,sessions:{}};
    for(const [id,session] of Object.entries(this.levelState.sessions))if(session?.accountId!==this.account.id||session?.libraryId!==this.libraryId||!Array.isArray(session.wordIds)||session.wordIds.some(wordId=>!canonical.has(wordId)))delete this.levelState.sessions[id];
    this.savedRuns=cached?.savedRuns||new Set(this.scores.map(row=>row.id));this.attemptRows=cached?.attemptRows||[];this.database=new LearningDB(this.account.id,this.libraryId);this.databaseAvailable=false;
    await this.initializeLearning();
  }
  async initializeLearning(){
    const canonical=this.canonical;
    try{const rows=await this.database.open();this.databaseAvailable=true;this.learning={};for(const row of rows)if(canonical.has(row.id))this.learning[row.id]={...row,word:canonical.get(row.id).word,meaning:canonical.get(row.id).meaning,example:canonical.get(row.id).example};
      if(this.pendingRun){const result=this.pendingRun.result;this.assertResult(result);await this.database.save(result,this.pendingRun.rows);for(const row of await this.database.words())if(canonical.has(row.id))this.learning[row.id]={...row,word:canonical.get(row.id).word,meaning:canonical.get(row.id).meaning,example:canonical.get(row.id).example};this.savedRuns.add(result.id);this.pendingRun=null;this.write('pending-run',null);}
    }catch(error){this.warning='当前账号与词库的学习数据库不可用，暂存本页记录';console.warn('Learning database unavailable',error);}
  }
  saveSettings(values){Object.assign(this.settings,values);if(this.account){this.accountSettings.set(this.account.id,{...this.settings});this.writeAt(this.accountPrefix,'settings',this.settings);}}
  selectLevel(level){this.progress.selected=Math.max(1,Math.min(this.progress.unlocked,level));this.write('progress',this.progress);}
  currentLevel(){const session=this.levelState.sessions[this.levelState.currentId];return this.account&&session&&session.accountId===this.account.id&&session.libraryId===this.libraryId?session:null;}
  saveLevel(session){this.assertContext(session);if(!Array.isArray(session.wordIds)||session.wordIds.some(id=>!this.canonical.has(id)))throw new Error('Session word does not belong to current library');const value={...session,wordIds:[...session.wordIds],updatedAt:Date.now()};this.levelState.sessions[value.id]=value;this.levelState.currentId=value.id;this.write('level-state',this.levelState);return value;}
  startLevel(id,runId){const session=this.levelState.sessions[id];if(session)this.saveLevel({...session,status:'playing',runCount:(session.runCount||0)+1,lastRunId:runId});}
  saveReview(result,remaining){if(result)this.assertResult(result);this.review=remaining>0||result?.recapPending?{result,remaining}:null;this.write('review',this.review);}
  saveSession(result){
    this.assertResult(result);if(this.savedRuns.has(result.id))return this.pendingSave;this.savedRuns.add(result.id);
    const canonical=this.canonical,touched=new Set();for(const record of result.records){const old=this.learning[record.wordId]||{id:record.wordId,correct:0,wrong:0,incomplete:0};old.id=record.wordId;old[record.kind]++;Object.assign(old,{accountId:this.account.id,libraryId:this.libraryId,word:canonical.get(record.wordId).word,meaning:canonical.get(record.wordId).meaning,example:canonical.get(record.wordId).example,last:record.time});this.learning[record.wordId]=old;touched.add(record.wordId);}
    this.attemptRows.push(...result.records);const rows=[...touched].map(id=>({...this.learning[id]}));
    const session=this.levelState.sessions[result.sessionId];if(session&&session.lastRunId===result.id)this.saveLevel({...session,status:'completed'});
    this.progress.unlocked=Math.max(this.progress.unlocked,result.level+1);this.progress.selected=result.level+1;this.write('progress',this.progress);
    this.scores.push({...result,records:undefined});this.scores.sort((a,b)=>b.score-a.score);this.scores.length=Math.min(SCORES.limit,this.scores.length);this.write('scores',this.scores);
    this.pendingRun={result,rows};this.write('pending-run',this.pendingRun);
    if(!this.databaseAvailable){this.write('learning',this.learning);return this.pendingSave;}
    this.pendingSave=this.database.save(result,rows).then(saved=>{for(const row of saved||[])this.learning[row.id]={...row,word:canonical.get(row.id).word,meaning:canonical.get(row.id).meaning,example:canonical.get(row.id).example};if(this.pendingRun?.result.id===result.id){this.pendingRun=null;this.write('pending-run',null);}}).catch(error=>{this.warning='本局学习记录尚未写入数据库，下次登录会重试';console.warn('Learning session save failed',error);});return this.pendingSave;
  }
  async resetLearning(){
    if(!this.account)throw new Error('Account required');await this.pendingSave;await this.database?.pending.catch(()=>{});
    if(!this.databaseAvailable&&typeof indexedDB!=='undefined'){await this.database.open();this.databaseAvailable=true;}
    try{localStorage.removeItem(this.prefix+'learning');localStorage.removeItem(this.prefix+'pending-run');}catch{this.available=false;this.warning='本地存储不可用，重置仅在本页生效';}if(this.databaseAvailable)await this.database.clear();
    this.learning={};this.attemptRows=[];this.pendingRun=null;
  }
  listWords(){return Object.entries(this.learning).map(([id,row])=>({id,...row,incomplete:row.incomplete||0})).filter(row=>row.word).sort((a,b)=>(b.wrong+b.incomplete)-(a.wrong+a.incomplete)||b.last-a.last||a.word.localeCompare(b.word));}
  async attemptPage(wordId,page,pageSize){if(!this.canonical.has(wordId))throw new Error('Word does not belong to current library');if(this.databaseAvailable)return this.database.attemptPage(wordId,page,pageSize);const rows=this.attemptRows.filter(row=>row.wordId===wordId).sort((a,b)=>b.time-a.time),current=Math.max(0,Math.min(Math.max(0,Math.ceil(rows.length/pageSize)-1),page));return {rows:rows.slice(current*pageSize,(current+1)*pageSize),total:rows.length,page:current};}
  async attempts(wordId){if(!this.canonical.has(wordId))throw new Error('Word does not belong to current library');if(this.databaseAvailable)return this.database.attempts(wordId);return this.attemptRows.filter(row=>row.wordId===wordId).sort((a,b)=>b.time-a.time);}
}
