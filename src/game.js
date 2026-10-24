import { WORLD,PLAYER,WORDS,LETTERS,UNDO,SHELLS,ENEMIES,LEVELS,BOSSES,SUPPLIES,REVIEW,CHOICES } from './config.js';
import { letterShotCount } from './letter-patterns.js';
import { Vocabulary } from './vocabulary.js';
import { WordBlanks } from './word-blanks.js';
import { captureAttempt } from './recap.js';
import { createRandom,between,shuffle } from './random.js';
import { Projectiles } from './projectiles.js';
import { sweptHit,sweptOverlap } from './collision.js';
import { VOCABULARY } from './vocabulary-data.js';
const entriesById=new Map(VOCABULARY.map(entry=>[entry.id,entry]));
const wordWidth=entry=>Math.min(WORLD.width-2*(WORDS.planeWingMargin+24),Math.max(240,entry.word.length*WORDS.cellWidth+40));
export class Game {
  constructor(storage,audio){
    this.storage=storage;this.audio=audio;this.state='preparing';this.words=[];this.enemies=[];this.enemyQueue=[];this.supplies=[];this.supplyQueue=[];this.collections=[];this.victoryRemaining=null;this.records=[];this.boss=null;this.projectiles=new Projectiles();this.player={x:PLAYER.x,y:WORLD.height*PLAYER.yRatio,protection:0};this.input=null;this.level=storage.progress?.selected||1;this.roster=[];this.remaining=LEVELS.durationSeconds;this.elapsed=0;this.ammo=0;this.score=0;this.correct=0;this.wrong=0;this.missed=0;this.hits=0;this.nextId=0;this.result=null;this.ammoFlashUntil=0;this.collected={heart:0,star:0,shell:0};this.displayCollected={...this.collected};this.reviewRemaining=0;this.playWidth=WORLD.width;this.playLeft=0;this.playRight=WORLD.width;
  }
  setPlayWidth(availableWidth){
    const width=Math.max(WORLD.width,Math.min(availableWidth,WORLD.width*WORLD.playWidthScale));if(this.playWidth===width)return;
    this.playWidth=width;this.playLeft=(WORLD.width-width)/2;this.playRight=WORLD.width-this.playLeft;
    const clamp=(x,margin)=>Math.max(this.playLeft+margin,Math.min(this.playRight-margin,x));
    this.player.x=clamp(this.player.x,PLAYER.width/2+16);
    for(const word of this.words)word.x=clamp(word.x,word.width/2+24);
    if(this.boss){this.boss.x=clamp(this.boss.x,Math.max(...this.boss.faces.map(face=>face.width))/2+24);for(const face of this.boss.faces)face.x=this.boss.x;}
    for(const enemy of [...this.enemies,...this.enemyQueue])enemy.x=clamp(enemy.x,60);
    for(const crate of [...this.supplies,...this.supplyQueue]){crate.x=clamp(crate.x,SUPPLIES.width/2);if(crate.auto)crate.originX=clamp(crate.originX,SUPPLIES.width/2);}
  }
  resetAccount(){
    this.input?.clear();this.audio.stop();this.projectiles.clear();
    Object.assign(this,{state:'menu',words:[],enemies:[],enemyQueue:[],supplies:[],supplyQueue:[],collections:[],victoryRemaining:null,questionBag:[],choiceModes:[],records:[],boss:null,roster:[],result:null,level:this.storage.progress.selected,remaining:LEVELS.durationSeconds,elapsed:0,ammo:0,score:0,correct:0,wrong:0,missed:0,hits:0,reviewRemaining:0});
    this.collected={heart:0,star:0,shell:0};this.displayCollected={...this.collected};Object.assign(this.player,{x:PLAYER.x,y:WORLD.height*PLAYER.yRatio,protection:0});
  }
  prepareLevel(level,seed=Date.now(),{retry=false,wordIds=null,sessionId=null}={}){
    if(!this.storage.account)throw new Error('Account required');
    const current=this.storage.currentLevel();let saved=retry?(this.storage.levelState.sessions[sessionId]||current):(current?.level===level&&current.status!=='completed'?current:null);
    if(saved?.level!==level||saved?.accountId!==this.storage.account.id||saved?.libraryId!==this.storage.libraryId)saved=null;
    const ids=retry&&wordIds?wordIds:saved?.wordIds,valid=Array.isArray(ids)&&ids.length===LEVELS.wordCount&&new Set(ids).size===LEVELS.wordCount&&ids.every(id=>entriesById.get(id)?.libraryId===this.storage.libraryId);
    if(!valid)saved=null;
    this.level=level;this.libraryId=this.storage.libraryId;this.seed=saved?.seed??seed;this.random=createRandom(this.seed);this.questionRandom=createRandom(this.seed^0x43484F49);this.questionBag=[];this.choiceModes=[];this.wordBlanks=new WordBlanks(createRandom(this.seed^0x424C414E));
    this.roster=valid?ids.map(id=>entriesById.get(id)):new Vocabulary(createRandom(this.seed),this.storage).select(LEVELS.wordCount);
    this.vocabulary=new Vocabulary(this.random,this.storage,this.roster);this.sessionId=saved?.id||globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random();
    this.storage.saveLevel({...saved,id:this.sessionId,accountId:this.storage.account.id,libraryId:this.libraryId,level,seed:this.seed,wordIds:this.roster.map(entry=>entry.id),status:'prepared',createdAt:saved?.createdAt||Date.now(),runCount:saved?.runCount||0});
    this.state='preview';this.storage.selectLevel(level);return this.roster;
  }
  start(seed){
    if(!this.roster.length)this.prepareLevel(this.level,seed??Date.now());
    this.input?.clear();this.state='playing';this.wordBlanks=new WordBlanks(createRandom(this.seed^0x424C414E));this.questionBag=[];this.choiceModes=[];this.questionRandom=createRandom(this.seed^0x43484F49);this.vocabulary.bag=[];this.words=[];this.enemies=[];this.enemyQueue=[];this.supplies=[];this.supplyQueue=[];this.collections=[];this.victoryRemaining=null;this.records=[];this.boss=null;this.projectiles.clear();Object.assign(this.player,{x:PLAYER.x,y:WORLD.height*PLAYER.yRatio,protection:0});
    this.remaining=LEVELS.durationSeconds;this.elapsed=0;this.nextSpawn=WORDS.firstSpawnSeconds;this.nextSupply=SUPPLIES.intervalSeconds;this.miniSpawned=false;this.finalSpawned=false;this.nextShot=0;this.undoReady=0;this.shellReady=0;this.ammo=SHELLS.initialAmmo;this.score=0;this.correct=0;this.wrong=0;this.missed=0;this.hits=0;this.ammoFlashUntil=0;this.result=null;this.lastTick=11;this.collected={heart:0,star:0,shell:0};this.displayCollected={...this.collected};this.runId=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random();this.storage.startLevel(this.sessionId,this.runId);
  }
  pause(){if(this.state!=='playing')return;this.state='paused';this.input?.clear();this.audio.stop();}
  resume(){if(this.state!=='paused')return;this.input?.clear();this.state='playing';}
  target(allowVerifying=false){return [...this.words,...(this.boss?.activeWord?[this.boss.activeWord]:[])].filter(word=>(word.state==='falling'||allowVerifying&&word.state==='verifying')&&word.y<this.player.y-38&&Math.abs(this.player.x-word.x)<=(word.width+(word.boss||word.kind==='choice'?0:WORDS.planeWingMargin*2))/2).sort((a,b)=>(b.y+(b.kind==='choice'?CHOICES.height:WORDS.cardHeight+(b.boss?0:WORDS.planeBottomMargin)))-(a.y+(a.kind==='choice'?CHOICES.height:WORDS.cardHeight+(a.boss?0:WORDS.planeBottomMargin)))||a.id-b.id)[0]||null;}
  selectBlank(index){const word=this.target();if(!word||word.kind==='choice'||this.elapsed<word.inputLockedUntil||index>=word.blanks.length)return;word.cursor=index;word.manual=true;word.blockedSegment=-1;this.clearWordShots(word);}
  clearWordShots(word){for(const p of this.projectiles.all)if(p.targetId===word.id&&p.type==='letter')p.active=false;}
  makeWord(entry,x,y,boss=false){
    const {blanks,mode,unit}=this.wordBlanks.select(entry.word),count=blanks.length,particles=blanks.reduce((sum,index)=>sum+letterShotCount(entry.word[index]),0),minimum=particles*LETTERS.fireIntervalSeconds+count*WORDS.inputLockSeconds+1/LETTERS.speedHeightsPerSecond+WORDS.thoughtSeconds+WORDS.moveAllowanceSeconds+WORDS.retryAllowanceSeconds+WORDS.verifySeconds,duration=Math.max(between(WORDS.fallDurationSeconds,this.random),minimum);
    return {id:++this.nextId,entry,x,y,previousY:y,width:wordWidth(entry),speed:boss?0:(WORLD.height*WORDS.dangerYRatio-y)/duration,blanks,blankMode:mode,blankUnit:unit,cursor:0,letters:blanks.map(()=>({letter:'',count:0})),state:'falling',stateUntil:0,inputLockedUntil:0,blockedSegment:-1,editSegment:-1,manual:false,rewarded:false,recorded:false,boss};
  }
  makeChoice(entry,x,y){
    if(!this.choiceModes.length)this.choiceModes=shuffle(['word-to-meaning','meaning-to-word'],this.questionRandom);
    const meaningParts=new Set(entry.meaning.split(/[；;、]/).map(value=>value.trim()));
    const mode=this.choiceModes.pop(),field=mode==='word-to-meaning'?'meaning':'word',seen=new Set([entry[field]]),candidates=shuffle([...this.vocabulary.library.entries],this.questionRandom),options=[{entryId:entry.id,text:entry[field],correct:true,hits:0}];
    for(const item of candidates){if(item.id===entry.id||seen.has(item[field])||item.word===entry.word||item.meaning===entry.meaning||item.meaning.split(/[；;、]/).some(value=>meaningParts.has(value.trim())))continue;seen.add(item[field]);options.push({entryId:item.id,text:item[field],correct:false,hits:0});if(options.length===CHOICES.optionCount)break;}
    if(options.length!==CHOICES.optionCount)throw new Error('Insufficient distinct choice options');
    return {id:++this.nextId,kind:'choice',mode,entry,x,y,previousY:y,width:CHOICES.width,height:CHOICES.height,speed:(WORLD.height*WORDS.dangerYRatio-y)/between(WORDS.fallDurationSeconds,this.random),options:shuffle(options,this.questionRandom),selectedOption:null,blanks:[],letters:[],cursor:0,state:'falling',stateUntil:0,inputLockedUntil:0,rewarded:false,recorded:false,boss:false};
  }
  spawnWord(){
    if(this.boss||this.words.filter(word=>word.state!=='success').length>=WORDS.maxEditable||this.words.length+this.enemies.length>=WORDS.maxThreats)return false;
    if(this.words.some(word=>word.state==='falling'&&(WORLD.height*WORDS.dangerYRatio-word.y)/word.speed<WORDS.urgentSeconds))return false;
    const choice=this.vocabulary.next(new Set(this.words.map(word=>word.entry.id)));if(!choice)return false;
    if(!this.questionBag.length)this.questionBag=shuffle(Array.from({length:CHOICES.batchSize},(_,i)=>i<CHOICES.batchSize*CHOICES.ratio?'choice':'spelling'),this.questionRandom);
    const isChoice=this.questionBag.at(-1)==='choice',width=isChoice?CHOICES.width:wordWidth(choice.entry),margin=width/2+24;
    let x=null;for(let i=0;i<WORDS.candidateAttempts;i++){const candidate=this.playLeft+margin+this.random()*(this.playWidth-2*margin);if(this.words.every(word=>Math.abs(word.y-WORDS.spawnY)>Math.max(180,word.kind==='choice'?CHOICES.height+CHOICES.carrier.heightPadding:180,isChoice?CHOICES.height:180)||Math.abs(word.x-candidate)>(word.width+width)/2+30)){x=candidate;break;}}
    if(x===null)return false;const word=isChoice?this.makeChoice(choice.entry,x,WORDS.spawnY):this.makeWord(choice.entry,x,WORDS.spawnY),available=LEVELS.durationSeconds-this.elapsed;if((WORLD.height*WORDS.dangerYRatio-word.y)/word.speed>available){if(isChoice)this.choiceModes.push(word.mode);return false;}this.words.push(word);this.questionBag.pop();choice.commit();return true;
  }
  spawnBoss(final){
    const faces=[],used=new Set();for(let i=0;i<(final?BOSSES.finalFaces:BOSSES.miniFaces);i++){const choice=this.vocabulary.next(used);if(!choice)break;used.add(choice.entry.id);faces.push(this.makeWord(choice.entry,480,BOSSES.centerY,true));choice.commit();}
    this.boss={final,faces,activeWord:faces[0],started:this.elapsed,deadline:this.elapsed+BOSSES.durationSeconds,turnUntil:0,turn:0,x:480,y:BOSSES.centerY};
  }
  enemiesFrom(word,count){for(let i=0;i<count;i++)this.enemyQueue.push({entry:word.entry,x:Math.max(this.playLeft+60,Math.min(this.playRight-60,word.x+(i-(count-1)/2)*100)),y:Math.min(760,word.y+90)});}
  releaseEnemies(){while(this.enemyQueue.length&&this.enemies.length<ENEMIES.maxActive){const item=this.enemyQueue.shift();this.enemies.push({id:++this.nextId,x:item.x,y:item.y,previousY:item.y,speed:(WORLD.height+70-item.y)/ENEMIES.fallDurationSeconds,nextShot:this.elapsed+ENEMIES.firstShotDelaySeconds,dead:false,answer:item.entry.word,meaning:item.entry.meaning,labelUntil:this.elapsed+2});}}
  endBossFace(word){word.state='removed';this.clearWordShots(word);if(!this.boss)return;this.boss.activeWord=null;this.boss.turn++;this.boss.turnUntil=this.elapsed+BOSSES.turnSeconds;if(this.boss.faces.every(face=>face.recorded))this.completeBoss();}
  completeBoss(){
    const boss=this.boss;if(!boss)return;const defeated=boss.faces.every(face=>face.resultKind==='correct');this.boss=null;if(!defeated)return;
    this.dropCrates(boss.final?BOSSES.finalCrates:BOSSES.miniCrates,boss.x,boss.y);
    if(!boss.final)return;
    for(const word of this.words){if(word.state==='success')this.reward(word);else this.recordWord(word,'incomplete');word.state='removed';}
    this.words=[];this.enemies=[];this.enemyQueue=[];this.projectiles.clear();this.input?.clear();this.player.protection=0;this.victoryRemaining=BOSSES.victorySeconds;this.remaining=this.victoryRemaining;this.lastTick=Math.ceil(this.remaining)+1;
  }
  dropCrates(count,x,y,burst=true){
    for(let i=0;i<count;i++){const offset=i-(count-1)/2;this.supplyQueue.push({id:++this.nextId,x:Math.max(this.playLeft+SUPPLIES.width/2,Math.min(this.playRight-SUPPLIES.width/2,x+offset*SUPPLIES.burstSpacing)),y:y+Math.abs(offset)*8,previousY:y+Math.abs(offset)*8,age:0,burst,velocityX:offset*SUPPLIES.burstSpeed,dead:false});}
    this.releaseCrates();
  }
  dropRewardCrates(x,y){
    for(let i=0;i<SUPPLIES.answerCrates;i++){
      const originX=Math.max(this.playLeft+SUPPLIES.width/2,Math.min(this.playRight-SUPPLIES.width/2,x+(i-(SUPPLIES.answerCrates-1)/2)*SUPPLIES.burstSpacing)),originY=y+16;
      this.supplyQueue.push({id:++this.nextId,auto:true,type:['heart','star','shell'][Math.floor(this.random()*3)],x:originX,y:originY,originX,originY,age:0,phase:this.random()*Math.PI*2,swayAmplitude:between(SUPPLIES.rewardSwayAmplitude,this.random),swaySpeed:between(SUPPLIES.rewardSwaySpeed,this.random),flightDuration:0,credited:false,dead:false});
    }
    this.releaseCrates();
  }
  updateRewardCrate(crate,dt){
    crate.age+=dt;
    const swayAge=Math.min(crate.age,SUPPLIES.rewardSwaySeconds),motion=this.storage.settings.reducedMotion?0:1;
    if(!crate.flightDuration){
      crate.x=crate.originX+(Math.sin(crate.phase+swayAge*crate.swaySpeed)-Math.sin(crate.phase))*crate.swayAmplitude*motion;
      crate.y=crate.originY+(Math.cos(crate.phase+swayAge*crate.swaySpeed)-Math.cos(crate.phase))*crate.swayAmplitude*.55*motion;
      if(crate.age<SUPPLIES.rewardSwaySeconds)return;
      const target=this.collectionTarget?.(crate.type)||{x:WORLD.width-40,y:40},distance=Math.hypot(target.x-crate.x,target.y-crate.y);
      crate.flightDuration=Math.max(SUPPLIES.rewardFlightSeconds[0],Math.min(SUPPLIES.rewardFlightSeconds[1],distance/SUPPLIES.rewardFlightSpeed));
    }
    if(crate.age-SUPPLIES.rewardSwaySeconds>=crate.flightDuration)this.creditRewardCrate(crate);
  }
  creditRewardCrate(crate){if(!crate.auto||crate.credited)return;crate.credited=true;crate.dead=true;this.collected[crate.type]++;this.displayCollected[crate.type]++;}
  releaseCrates(){while(this.supplyQueue.length&&this.supplies.length<SUPPLIES.maxActive)this.supplies.push(this.supplyQueue.shift());}
  expireBoss(allowVictory=true){if(!this.boss)return;for(const face of this.boss.faces){if(face.recorded)continue;if(face.state==='success')this.reward(face);else{this.recordWord(face,'incomplete');this.enemiesFrom(face,2);}face.state='removed';}if(allowVictory)this.completeBoss();else this.boss=null;}
  shellTarget(projectile=null){
    const x=projectile?.x??this.player.x,y=projectile?.y??this.player.y,reserved=new Set(this.projectiles.pools.shell.filter(item=>item.active&&item!==projectile).map(item=>item.targetId));
    return this.enemies.filter(enemy=>!enemy.dead&&enemy.y>=-ENEMIES.height/2&&enemy.y<=WORLD.height+ENEMIES.height/2).sort((a,b)=>Number(reserved.has(a.id))-Number(reserved.has(b.id))||Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)||a.id-b.id)[0]||null;
  }
  aimShell(projectile,enemy){
    const dx=enemy.x-projectile.x,dy=enemy.y-projectile.y,distance=Math.hypot(dx,dy),arc=Math.max(SHELLS.arcRange[0],Math.min(SHELLS.arcRange[1],distance*SHELLS.arcDistanceFraction)),side=dx<0?-1:1;
    projectile.targetId=enemy.id;projectile.originX=projectile.x;projectile.originY=projectile.y;projectile.flightAge=0;
    projectile.flightDuration=Math.max(SHELLS.flightSeconds[0],Math.min(SHELLS.flightSeconds[1],distance/(SHELLS.speedHeightsPerSecond*WORLD.height)));
    projectile.controlX=Math.max(this.playLeft+16,Math.min(this.playRight-16,(projectile.x+enemy.x)/2-dy/(distance||1)*arc*side));
    projectile.controlY=Math.max(16,Math.min(WORLD.height-16,(projectile.y+enemy.y)/2+dx/(distance||1)*arc*side));
  }
  updateShell(projectile,dt){
    let enemy=this.enemies.find(item=>item.id===projectile.targetId&&!item.dead&&item.y>=-ENEMIES.height/2&&item.y<=WORLD.height+ENEMIES.height/2);
    if(!enemy){enemy=this.shellTarget(projectile);if(!enemy){projectile.active=false;return;}this.aimShell(projectile,enemy);}
    projectile.flightAge+=dt;const t=Math.min(1,projectile.flightAge/projectile.flightDuration),rest=1-t;
    // 终点跟随锁定敌机更新；重新锁定从当前位置起弧，不跳转弹体。
    projectile.x=rest*rest*projectile.originX+2*rest*t*projectile.controlX+t*t*enemy.x;
    projectile.y=rest*rest*projectile.originY+2*rest*t*projectile.controlY+t*t*enemy.y;
    projectile.trailClock+=dt;if(projectile.trailClock>=SHELLS.trailIntervalSeconds){projectile.trailClock%=SHELLS.trailIntervalSeconds;const point=projectile.trail[projectile.trailCursor];point.x=projectile.x;point.y=projectile.y;projectile.trailCursor=(projectile.trailCursor+1)%SHELLS.trailPoints;projectile.trailCount=Math.min(SHELLS.trailPoints,projectile.trailCount+1);}
    if(t>=1||sweptOverlap(projectile.previousX-enemy.x,projectile.previousY-enemy.previousY,projectile.x-enemy.x,projectile.y-enemy.y,ENEMIES.width/2,ENEMIES.height/2)){projectile.active=false;enemy.dead=true;this.score+=ENEMIES.killScore;this.audio.play('kill');}
  }
  shoot(type,letter='',segment=0){
    if(type==='letter'&&this.elapsed<this.nextShot)return false;
    const enemy=type==='shell'?this.shellTarget():null;if(type==='shell'&&!enemy)return false;
    const target=this.target(type==='undo');if(type==='shell'&&(this.ammo<=0||this.elapsed<this.shellReady)){if(this.ammo<=0)this.ammoFlashUntil=this.elapsed+.5;return false;}
    if(type==='undo'&&(this.elapsed<this.undoReady||target?.kind==='choice'))return false;
    if(this.victoryRemaining!==null)return false;
    if(type==='letter'&&target?.kind==='choice'){if(target.state!=='falling')return false;}
    if(type==='letter'&&target&&target.kind!=='choice'){const cell=target.letters[target.cursor];if(!cell||this.elapsed<target.inputLockedUntil||target.blockedSegment===segment)return false;const expected=target.entry.word[target.blanks[target.cursor]],typed=expected===expected.toUpperCase()?letter.toUpperCase():letter.toLowerCase();
      const complete=cell.letter&&cell.count>=letterShotCount(cell.letter);
      if(complete&&!target.manual)return false;
      // 同格同字母复用当前输入段，重复按键不能让仍在飞行的同字母弹失效。
      if(cell.letter!==typed||(complete&&target.manual)){cell.count=0;this.clearWordShots(target);cell.letter=typed;target.editSegment=segment;}
      target.manual=false;letter=typed;segment=target.editSegment;
    }
    const speed=(type==='shell'?SHELLS.speedHeightsPerSecond:LETTERS.speedHeightsPerSecond)*WORLD.height,p=this.projectiles.spawn(type,{x:this.player.x,y:this.player.y-38,speed:-speed,targetId:enemy?.id||target?.id||0,index:target?.cursor??-1,segment,letter});if(!p)return false;
    if(type==='shell'){this.aimShell(p,enemy);this.ammo--;this.shellReady=this.elapsed+SHELLS.cooldownSeconds;this.audio.play('shell');}else if(type==='undo'){this.undoReady=this.elapsed+UNDO.cooldownSeconds;this.audio.play('undo');}else this.audio.play('shot');return true;
  }
  eraseLast(word){
    if(!word||word.kind==='choice'||!['falling','verifying'].includes(word.state))return;
    let index=word.letters.length-1;while(index>=0&&!word.letters[index].count)index--;if(index<0)return;
    word.letters[index]={letter:'',count:0};word.cursor=index;word.state='falling';word.stateUntil=0;word.inputLockedUntil=0;word.manual=false;word.editSegment=-1;word.blockedSegment=this.input.segment;this.input.letters=[];this.clearWordShots(word);this.audio.play('undo');
  }
  receive(word,p){
    if(word.kind==='choice'){
      if(p.type!=='letter'||word.state!=='falling')return;
      const left=word.x-word.width/2;if(p.x<left||p.x>left+word.width)return;const index=Math.min(CHOICES.optionCount-1,Math.floor((p.x-left)/(word.width/CHOICES.optionCount)));
      const option=word.options[index];option.hits=Math.min(CHOICES.hitsToSelect,option.hits+1);
      if(option.hits===CHOICES.hitsToSelect){this.nextShot=Math.max(this.nextShot,this.elapsed+CHOICES.firePauseSeconds);word.selectedOption=index;word.state='verifying';word.stateUntil=this.elapsed+WORDS.verifySeconds;this.clearWordShots(word);}
      return;
    }
    if(p.type==='undo'){this.eraseLast(word);return;}
    if(this.elapsed<word.inputLockedUntil||p.index!==word.cursor||p.segment===word.blockedSegment||p.segment!==word.editSegment)return;
    const cell=word.letters[word.cursor];if(cell.letter!==p.letter||cell.count>=letterShotCount(cell.letter))return;cell.count++;
    if(cell.count>=letterShotCount(cell.letter)){
      this.audio.play('letter');cell.filledAt=this.elapsed;word.inputLockedUntil=this.elapsed+WORDS.inputLockSeconds;word.blockedSegment=-1;this.clearWordShots(word);
      const next=word.letters.findIndex(item=>!item.letter||item.count<letterShotCount(item.letter));
      if(next<0){word.state='verifying';word.stateUntil=word.inputLockedUntil+WORDS.verifySeconds;}else word.cursor=next;
    }
  }
  answer(word){if(word.kind==='choice')return word.selectedOption===null?'未选择':word.options[word.selectedOption].text;const chars=[...word.entry.word];word.blanks.forEach((index,i)=>{const cell=word.letters[i];chars[index]=cell.letter?(cell.count>=letterShotCount(cell.letter)?cell.letter:cell.letter+'…'):'_';});return chars.join('');}
  recordWord(word,kind){
    if(word.recorded)return;word.recorded=true;word.resultKind=kind;const answer=this.answer(word);this.records.push({id:this.runId+':'+word.id,runId:this.runId,accountId:this.storage.account.id,libraryId:this.libraryId,sessionId:this.sessionId,wordId:word.entry.id,word:word.entry.word,meaning:word.entry.meaning,example:word.entry.example,answer,kind,presentation:kind==='correct'?null:captureAttempt(word,this.boss?.final),boss:word.boss,questionType:word.kind||'spelling',choiceMode:word.mode||null,level:this.level,time:Date.now()});
    if(kind==='correct')this.correct++;else if(kind==='wrong')this.wrong++;else this.missed++;
  }
  reward(word){if(word.rewarded)return;word.rewarded=true;this.recordWord(word,'correct');this.ammo+=WORDS.successAmmo;this.score+=WORDS.successScore;if(!word.boss)this.dropRewardCrates(word.x,word.y);this.audio.play('success');}
  hurt(){if(this.player.protection>0||this.state!=='playing')return;this.hits++;this.player.protection=PLAYER.invulnerableSeconds;this.audio.play('hurt');}
  collect(crate){if(crate.dead||crate.auto)return;crate.dead=true;const type=['heart','star','shell'][Math.floor(this.random()*3)];this.collected[type]++;if(this.collections.length<SUPPLIES.maxActive)this.collections.push({id:crate.id,type,x:crate.x,y:crate.y,age:0});else this.displayCollected[type]++;this.audio.play('success');}
  update(dt){
    if(this.state!=='playing')return;
    const collecting=this.victoryRemaining!==null;
    if(!collecting&&this.remaining<=dt+1e-8){this.elapsed=LEVELS.durationSeconds;this.remaining=0;if(this.boss)this.expireBoss();if(this.victoryRemaining===null)this.finish();return;}
    const previousPlayerX=this.player.x,previousPlayerY=this.player.y;this.elapsed+=dt;
    if(collecting){this.victoryRemaining=Math.max(0,this.victoryRemaining-dt);this.remaining=this.victoryRemaining;}else this.remaining=LEVELS.durationSeconds-this.elapsed;
    this.player.protection=Math.max(0,this.player.protection-dt);
    const axis=this.input.axis,vertical=collecting?(this.input.verticalAxis||0):0,diagonal=Math.hypot(axis,vertical)||1,speed=PLAYER.moveSpeedWidthsPerSecond*WORLD.width;
    this.player.x=Math.max(this.playLeft+PLAYER.width/2+16,Math.min(this.playRight-PLAYER.width/2-16,this.player.x+axis/diagonal*speed*dt));
    if(collecting)this.player.y=Math.max(PLAYER.height/2+16,Math.min(WORLD.height-PLAYER.height/2-16,this.player.y+vertical/diagonal*speed*dt));
    if(!collecting&&!this.miniSpawned&&this.elapsed>=BOSSES.miniAt){this.miniSpawned=true;this.spawnBoss(false);}if(!collecting&&!this.finalSpawned&&this.elapsed>=BOSSES.finalAt){this.finalSpawned=true;this.spawnBoss(true);}
    if(this.boss&&this.elapsed>=this.boss.deadline){this.expireBoss();if(this.victoryRemaining!==null)return;}
    if(this.boss){const age=this.elapsed-this.boss.started;const margin=Math.max(...this.boss.faces.map(face=>face.width))/2+24;this.boss.x=Math.max(this.playLeft+margin,Math.min(this.playRight-margin,480+Math.sin(age*BOSSES.xAngularSpeed)*BOSSES.xRange));this.boss.y=BOSSES.centerY+Math.sin(age*BOSSES.yAngularSpeed)*BOSSES.yRange;
      if(!this.boss.activeWord&&this.elapsed>=this.boss.turnUntil)this.boss.activeWord=this.boss.faces.find(face=>!face.recorded)||null;
      const word=this.boss.activeWord;if(word){word.previousY=word.y;word.x=this.boss.x;word.y=this.boss.y;}
    }
    const seconds=Math.ceil(this.remaining);if(seconds<=10&&seconds!==this.lastTick){this.lastTick=seconds;this.audio.play('tick');}
    const actions=this.input.consume();if(!collecting){if(actions.selection!==null&&actions.selection!==undefined)this.selectBlank(actions.selection);const shellFired=actions.shell&&this.shoot('shell');if(actions.undo)this.shoot('undo');if(actions.erase)this.eraseLast(this.target(true));
    if(this.input.letter&&this.elapsed>=this.nextShot&&!actions.undo&&!actions.erase&&!shellFired){this.shoot('letter',this.input.letter,this.input.segment);this.nextShot=Math.max(this.nextShot+LETTERS.fireIntervalSeconds,this.elapsed+.020001);}if(!this.input.letter)this.nextShot=Math.max(this.nextShot,this.elapsed);}
    if(!collecting&&!this.boss&&this.elapsed>=this.nextSpawn){let made=0;for(let i=0;i<WORDS.spawnCount;i++){if(!this.spawnWord())break;made++;}this.nextSpawn=this.elapsed+(made?between(WORDS.spawnIntervalSeconds,this.random):WORDS.capacityRetrySeconds);}
    if(!collecting&&this.elapsed>=this.nextSupply){this.dropCrates(1,this.playLeft+70+this.random()*(this.playWidth-140),-SUPPLIES.height/2,false);this.nextSupply+=SUPPLIES.intervalSeconds;}
    for(const word of this.words){word.previousY=word.y;if(word.state==='falling')word.y+=word.speed*dt;}
    for(const enemy of this.enemies){enemy.previousY=enemy.y;enemy.y+=enemy.speed*dt;}
    for(const crate of this.supplies){if(crate.auto){this.updateRewardCrate(crate,dt);continue;}const previousX=crate.x;crate.previousY=crate.y;crate.age+=dt;const burst=crate.burst?Math.max(0,1-crate.age/SUPPLIES.burstSeconds):0;crate.x=Math.max(this.playLeft+SUPPLIES.width/2,Math.min(this.playRight-SUPPLIES.width/2,crate.x+crate.velocityX*burst*dt));crate.y+=(WORLD.height/SUPPLIES.fallSeconds-SUPPLIES.burstRiseSpeed*burst)*dt;if(!crate.dead&&sweptOverlap(previousX-previousPlayerX,crate.previousY-previousPlayerY,crate.x-this.player.x,crate.y-this.player.y,(SUPPLIES.width+PLAYER.width)/2,(SUPPLIES.height+PLAYER.height)/2))this.collect(crate);}
    for(const item of this.collections){item.age+=dt;if(item.age>=SUPPLIES.flightSeconds&&!item.done){item.done=true;this.displayCollected[item.type]++;}}this.collections=this.collections.filter(item=>!item.done);
    const targets=[...this.words,...(this.boss?.activeWord?[this.boss.activeWord]:[])],contacts=[];
    for(const p of this.projectiles.all){if(!p.active)continue;p.previousX=p.x;p.previousY=p.y;p.age+=dt;if(p.type==='shell'){this.updateShell(p,dt);continue;}p.y+=p.speed*dt;let collision=null;
      const consider=(type,object,x,previous,y,width,height)=>{const t=sweptHit(p,x,previous,y,width,height);if(t!==null&&(!collision||t<collision.t))collision={t,p,type,object};};
      if(p.type==='enemy')consider('player',this.player,this.player.x,this.player.y,this.player.y,PLAYER.width,PLAYER.height);
      else{
        for(const enemy of this.enemies)if(!enemy.dead)consider('enemy',enemy,enemy.x,enemy.previousY,enemy.y,ENEMIES.width,ENEMIES.height);
        for(const word of targets)if(word.state==='falling'||p.type==='undo'&&word.kind!=='choice'&&word.state==='verifying'){const choice=word.kind==='choice',height=choice?CHOICES.height:WORDS.cardHeight+(word.boss?0:WORDS.planeTopMargin+WORDS.planeBottomMargin),offset=choice?CHOICES.height/2:(WORDS.cardHeight+(word.boss?0:WORDS.planeBottomMargin-WORDS.planeTopMargin))/2;consider('word',word,word.x,word.previousY+offset,word.y+offset,word.width+(choice||word.boss?0:WORDS.planeWingMargin*2),height);}
      }
      if(collision)contacts.push(collision);else if(p.age>(p.type==='enemy'?ENEMIES.bulletLifetimeSeconds:LETTERS.lifetimeSeconds)||p.y<0||p.y>WORLD.height+40)p.active=false;
    }
    contacts.sort((a,b)=>a.t-b.t);for(const hit of contacts){const {p,object}=hit;if(!p.active)continue;p.active=false;if(hit.type==='player')this.hurt();else if(hit.type==='word'&&(object.state==='falling'||p.type==='undo'&&object.state==='verifying')&&(object.kind==='choice'||object.id===p.targetId))this.receive(object,p);}
    for(const word of targets){
      if(!word.boss&&word.state==='falling'&&word.y>=WORLD.height*WORDS.dangerYRatio){word.state='removed';this.recordWord(word,'incomplete');this.hurt();}
      if(word.state==='verifying'&&this.elapsed>=word.stateUntil){if(word.kind==='choice'?word.options[word.selectedOption]?.correct:this.answer(word)===word.entry.word){word.state='success';word.stateUntil=this.elapsed+WORDS.successSeconds;}else{this.recordWord(word,'wrong');this.enemiesFrom(word,word.kind==='choice'?CHOICES.failureEnemies:word.boss?2:1);this.audio.play('wrong');if(word.boss)this.endBossFace(word);else word.state='removed';}}
      if(word.state==='success'&&this.elapsed>=word.stateUntil){this.reward(word);if(word.boss)this.endBossFace(word);else word.state='removed';if(this.victoryRemaining!==null)break;}
    }
    for(const enemy of this.enemies){if(enemy.dead)continue;if(Math.abs(enemy.x-this.player.x)<(ENEMIES.width+PLAYER.width)/2&&Math.abs(enemy.y-this.player.y)<(ENEMIES.height+PLAYER.height)/2){enemy.dead=true;this.hurt();}else if(enemy.y>WORLD.height+70)enemy.dead=true;else if(this.elapsed>=enemy.nextShot){this.projectiles.spawn('enemy',{x:enemy.x,y:enemy.y+40,speed:ENEMIES.bulletSpeedHeightsPerSecond*WORLD.height});enemy.nextShot=this.elapsed+ENEMIES.shotIntervalSeconds;}}
    this.words=this.words.filter(word=>word.state!=='removed');this.enemies=this.enemies.filter(enemy=>!enemy.dead);this.supplies=this.supplies.filter(crate=>!crate.dead&&(crate.auto||crate.y<WORLD.height+60));this.releaseEnemies();this.releaseCrates();
    if(collecting&&this.victoryRemaining<=1e-8){this.victoryRemaining=0;this.remaining=0;this.finish('boss-defeated');}
  }
  finish(reason='timeout'){
    if(!['playing','paused'].includes(this.state))return;
    for(const word of this.words){if(word.state==='success')this.reward(word);else if(!word.recorded)this.recordWord(word,'incomplete');}this.expireBoss(false);this.releaseEnemies();
    for(const crate of [...this.supplies,...this.supplyQueue])this.creditRewardCrate(crate);
    this.supplies=this.supplies.filter(crate=>!crate.auto);this.supplyQueue=this.supplyQueue.filter(crate=>!crate.auto);
    this.input?.clear();this.projectiles.clear();this.audio.stop();this.displayCollected={...this.collected};this.collections=[];
    const total=this.records.length,mistakes=this.records.filter(row=>row.kind!=='correct');this.result={id:this.runId,accountId:this.storage.account.id,libraryId:this.libraryId,sessionId:this.sessionId,roster:this.roster.map(entry=>entry.id),outcome:'won',recapPending:true,reason,level:this.level,time:Date.now(),score:this.score,ammo:this.ammo,elapsed:this.elapsed,correct:this.correct,wrong:this.wrong,incomplete:this.missed,total,uniqueWords:new Set(this.records.map(row=>row.wordId)).size,rosterCount:this.roster.length,accuracy:total?this.correct/total:null,collected:{...this.collected},records:[...this.records],mistakes};
    this.words=[];this.enemies=[];this.enemyQueue=[];this.supplies=[];this.supplyQueue=[];
    this.reviewRemaining=new Set(mistakes.map(row=>row.wordId)).size*REVIEW.secondsPerWord;this.state=this.reviewRemaining?'review':'recap';this.storage.saveReview(this.result,this.reviewRemaining);this.savePromise=this.storage.saveSession(this.result);
  }
  completeRecap(){if(this.state!=='recap'||!this.result)return;this.result.recapPending=false;this.storage.saveReview(this.result,0);this.state='won';}
  restoreReview(saved){if(saved.result.accountId!==this.storage.account.id||saved.result.libraryId!==this.storage.libraryId)throw new Error('Review vocabulary mismatch');this.libraryId=this.storage.libraryId;this.victoryRemaining=null;this.result=saved.result;this.result.recapPending=true;this.level=this.result.level;this.elapsed=this.result.elapsed;this.remaining=this.result.reason==='boss-defeated'?0:Math.max(0,LEVELS.durationSeconds-this.elapsed);this.score=this.result.score;this.ammo=this.result.ammo||0;this.correct=this.result.correct;this.wrong=this.result.wrong;this.missed=this.result.incomplete;this.records=this.result.records;this.collected={...this.result.collected};this.displayCollected={...this.collected};this.reviewRemaining=saved.remaining;this.state=this.reviewRemaining>0?'review':'recap';this.lastReviewSecond=Math.ceil(this.reviewRemaining);}
  updateReview(dt){if(this.state!=='review')return;this.reviewRemaining=Math.max(0,this.reviewRemaining-dt);const second=Math.ceil(this.reviewRemaining);if(second!==this.lastReviewSecond){this.lastReviewSecond=second;this.storage.saveReview(this.result,this.reviewRemaining);}if(!this.reviewRemaining){this.state='recap';this.storage.saveReview(this.result,0);}}
}
