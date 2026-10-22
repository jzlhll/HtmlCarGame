import { WORLD,PLAYER,WORDS,LETTERS,UNDO,SHELLS,ENEMIES,LEVELS,BOSSES,SUPPLIES,REVIEW,CHOICES } from './config.js';
import { LETTER_POINTS } from './letter-patterns.js';
import { Vocabulary } from './vocabulary.js';
import { createRandom,between,shuffle } from './random.js';
import { Projectiles } from './projectiles.js';
import { sweptHit,sweptOverlap } from './collision.js';
import { VOCABULARY } from './vocabulary-data.js';
const entriesById=new Map(VOCABULARY.map(entry=>[entry.id,entry]));
export class Game {
  constructor(storage,audio){
    this.storage=storage;this.audio=audio;this.state='preparing';this.words=[];this.enemies=[];this.enemyQueue=[];this.supplies=[];this.supplyQueue=[];this.collections=[];this.victoryRemaining=null;this.records=[];this.boss=null;this.projectiles=new Projectiles();this.player={x:PLAYER.x,y:WORLD.height*PLAYER.yRatio,protection:0};this.input=null;this.level=storage.progress?.selected||1;this.roster=[];this.remaining=LEVELS.durationSeconds;this.elapsed=0;this.ammo=0;this.score=0;this.correct=0;this.wrong=0;this.missed=0;this.hits=0;this.nextId=0;this.result=null;this.ammoFlashUntil=0;this.collected={heart:0,star:0,shell:0};this.displayCollected={...this.collected};this.reviewRemaining=0;
  }
  resetAccount(){
    this.input?.clear();this.audio.stop();this.projectiles.clear();
    Object.assign(this,{state:'menu',words:[],enemies:[],enemyQueue:[],supplies:[],supplyQueue:[],collections:[],victoryRemaining:null,questionBag:[],choiceModes:[],records:[],boss:null,roster:[],result:null,level:this.storage.progress.selected,remaining:LEVELS.durationSeconds,elapsed:0,ammo:0,score:0,correct:0,wrong:0,missed:0,hits:0,reviewRemaining:0});
    this.collected={heart:0,star:0,shell:0};this.displayCollected={...this.collected};Object.assign(this.player,{x:PLAYER.x,y:WORLD.height*PLAYER.yRatio,protection:0});
  }
  prepareLevel(level,seed=Date.now(),{retry=false,wordIds=null,sessionId=null}={}){
    if(!this.storage.account)throw new Error('Account required');
    const current=this.storage.currentLevel();let saved=retry?(this.storage.levelState.sessions[sessionId]||current):(current?.level===level&&current.status!=='completed'?current:null);
    if(saved?.level!==level||(saved?.accountId&&saved.accountId!==this.storage.account.id))saved=null;
    const ids=retry&&wordIds?wordIds:saved?.wordIds,valid=Array.isArray(ids)&&ids.length===LEVELS.wordCount&&new Set(ids).size===LEVELS.wordCount&&ids.every(id=>entriesById.has(id));
    if(!valid)saved=null;
    this.level=level;this.seed=saved?.seed??seed;this.random=createRandom(this.seed);this.questionRandom=createRandom(this.seed^0x43484F49);this.questionBag=[];this.choiceModes=[];
    this.roster=valid?ids.map(id=>entriesById.get(id)):new Vocabulary(createRandom(this.seed),this.storage).select(LEVELS.wordCount);
    this.vocabulary=new Vocabulary(this.random,this.storage,this.roster);this.sessionId=saved?.id||globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random();
    this.storage.saveLevel({...saved,id:this.sessionId,level,seed:this.seed,wordIds:this.roster.map(entry=>entry.id),status:'prepared',createdAt:saved?.createdAt||Date.now(),runCount:saved?.runCount||0});
    this.state='preview';this.storage.selectLevel(level);return this.roster;
  }
  start(seed){
    if(!this.roster.length)this.prepareLevel(this.level,seed??Date.now());
    this.input?.clear();this.state='playing';this.questionBag=[];this.choiceModes=[];this.questionRandom=createRandom(this.seed^0x43484F49);this.vocabulary.bag=[];this.words=[];this.enemies=[];this.enemyQueue=[];this.supplies=[];this.supplyQueue=[];this.collections=[];this.victoryRemaining=null;this.records=[];this.boss=null;this.projectiles.clear();Object.assign(this.player,{x:PLAYER.x,y:WORLD.height*PLAYER.yRatio,protection:0});
    this.remaining=LEVELS.durationSeconds;this.elapsed=0;this.nextSpawn=WORDS.firstSpawnSeconds;this.nextSupply=SUPPLIES.intervalSeconds;this.miniSpawned=false;this.finalSpawned=false;this.nextShot=0;this.undoReady=0;this.shellReady=0;this.ammo=SHELLS.initialAmmo;this.score=0;this.correct=0;this.wrong=0;this.missed=0;this.hits=0;this.ammoFlashUntil=0;this.result=null;this.lastTick=11;this.collected={heart:0,star:0,shell:0};this.displayCollected={...this.collected};this.runId=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random();this.storage.startLevel(this.sessionId,this.runId);
  }
  pause(){if(this.state!=='playing')return;this.state='paused';this.input?.clear();this.audio.stop();}
  resume(){if(this.state!=='paused')return;this.input?.clear();this.state='playing';}
  target(allowVerifying=false){return [...this.words,...(this.boss?.activeWord?[this.boss.activeWord]:[])].filter(word=>(word.state==='falling'||allowVerifying&&word.state==='verifying')&&word.y<this.player.y-38&&Math.abs(this.player.x-word.x)<=(word.width+(word.boss||word.kind==='choice'?0:WORDS.planeWingMargin*2))/2).sort((a,b)=>(b.y+(b.kind==='choice'?CHOICES.height:WORDS.cardHeight+(b.boss?0:WORDS.planeBottomMargin)))-(a.y+(a.kind==='choice'?CHOICES.height:WORDS.cardHeight+(a.boss?0:WORDS.planeBottomMargin)))||a.id-b.id)[0]||null;}
  selectBlank(index){const word=this.target();if(!word||word.kind==='choice'||this.elapsed<word.inputLockedUntil||index>=word.blanks.length)return;word.cursor=index;word.manual=true;word.blockedSegment=-1;this.clearWordShots(word);}
  clearWordShots(word){for(const p of this.projectiles.all)if(p.targetId===word.id&&p.type==='letter')p.active=false;}
  makeWord(entry,x,y,boss=false){
    const maximum=Math.min(WORDS.blankCount[1],entry.word.length-1),count=entry.word.length<=4?1:WORDS.blankCount[0]+Math.floor(this.random()*(maximum-WORDS.blankCount[0]+1));
    const blanks=shuffle(Array.from({length:entry.word.length},(_,i)=>i),this.random).slice(0,count).sort((a,b)=>a-b),particles=blanks.reduce((sum,index)=>sum+LETTER_POINTS[entry.word[index]].length,0),minimum=particles*LETTERS.fireIntervalSeconds+count*WORDS.inputLockSeconds+1/LETTERS.speedHeightsPerSecond+WORDS.thoughtSeconds+WORDS.moveAllowanceSeconds+WORDS.retryAllowanceSeconds+WORDS.verifySeconds,duration=Math.max(between(WORDS.fallDurationSeconds,this.random),minimum);
    return {id:++this.nextId,entry,x,y,previousY:y,width:Math.max(240,entry.word.length*WORDS.cellWidth+40),speed:boss?0:(WORLD.height*WORDS.dangerYRatio-y)/duration,blanks,cursor:0,letters:blanks.map(()=>({letter:'',count:0})),state:'falling',stateUntil:0,inputLockedUntil:0,blockedSegment:-1,editSegment:-1,manual:false,rewarded:false,recorded:false,boss};
  }
  makeChoice(entry,x,y){
    if(!this.choiceModes.length)this.choiceModes=shuffle(['word-to-meaning','meaning-to-word'],this.questionRandom);
    const meaningParts=new Set(entry.meaning.split(/[；;、]/).map(value=>value.trim()));
    const mode=this.choiceModes.pop(),field=mode==='word-to-meaning'?'meaning':'word',seen=new Set([entry[field]]),candidates=shuffle([...VOCABULARY],this.questionRandom),options=[{entryId:entry.id,text:entry[field],correct:true,hits:0}];
    for(const item of candidates){if(item.id===entry.id||seen.has(item[field])||item.word===entry.word||item.meaning===entry.meaning||item.meaning.split(/[；;、]/).some(value=>meaningParts.has(value.trim())))continue;seen.add(item[field]);options.push({entryId:item.id,text:item[field],correct:false,hits:0});if(options.length===CHOICES.optionCount)break;}
    if(options.length!==CHOICES.optionCount)throw new Error('Insufficient distinct choice options');
    return {id:++this.nextId,kind:'choice',mode,entry,x,y,previousY:y,width:CHOICES.width,height:CHOICES.height,speed:(WORLD.height*WORDS.dangerYRatio-y)/between(WORDS.fallDurationSeconds,this.random),options:shuffle(options,this.questionRandom),selectedOption:null,blanks:[],letters:[],cursor:0,state:'falling',stateUntil:0,inputLockedUntil:0,rewarded:false,recorded:false,boss:false};
  }
  spawnWord(){
    if(this.boss||this.words.filter(word=>word.state!=='success').length>=WORDS.maxEditable||this.words.length+this.enemies.length>=WORDS.maxThreats)return false;
    if(this.words.some(word=>word.state==='falling'&&(WORLD.height*WORDS.dangerYRatio-word.y)/word.speed<WORDS.urgentSeconds))return false;
    const choice=this.vocabulary.next(new Set(this.words.map(word=>word.entry.id)));if(!choice)return false;
    if(!this.questionBag.length)this.questionBag=shuffle(Array.from({length:CHOICES.batchSize},(_,i)=>i<CHOICES.batchSize*CHOICES.ratio?'choice':'spelling'),this.questionRandom);
    const isChoice=this.questionBag.at(-1)==='choice',width=isChoice?CHOICES.width:Math.max(240,choice.entry.word.length*WORDS.cellWidth+40),margin=width/2+24;
    let x=null;for(let i=0;i<WORDS.candidateAttempts;i++){const candidate=margin+this.random()*(WORLD.width-2*margin);if(this.words.every(word=>Math.abs(word.y-WORDS.spawnY)>Math.max(180,word.kind==='choice'?CHOICES.height+CHOICES.carrier.heightPadding:180,isChoice?CHOICES.height:180)||Math.abs(word.x-candidate)>(word.width+width)/2+30)){x=candidate;break;}}
    if(x===null)return false;const word=isChoice?this.makeChoice(choice.entry,x,WORDS.spawnY):this.makeWord(choice.entry,x,WORDS.spawnY),available=LEVELS.durationSeconds-this.elapsed;if((WORLD.height*WORDS.dangerYRatio-word.y)/word.speed>available){if(isChoice)this.choiceModes.push(word.mode);return false;}this.words.push(word);this.questionBag.pop();choice.commit();return true;
  }
  spawnBoss(final){
    const faces=[],used=new Set();for(let i=0;i<(final?BOSSES.finalFaces:BOSSES.miniFaces);i++){const choice=this.vocabulary.next(used);if(!choice)break;used.add(choice.entry.id);faces.push(this.makeWord(choice.entry,480,BOSSES.centerY,true));choice.commit();}
    this.boss={final,faces,activeWord:faces[0],started:this.elapsed,deadline:this.elapsed+BOSSES.durationSeconds,turnUntil:0,turn:0,x:480,y:BOSSES.centerY};
  }
  enemiesFrom(word,count){for(let i=0;i<count;i++)this.enemyQueue.push({entry:word.entry,x:Math.max(60,Math.min(900,word.x+(i-(count-1)/2)*100)),y:Math.min(760,word.y+90)});}
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
    for(let i=0;i<count;i++){const offset=i-(count-1)/2;this.supplyQueue.push({id:++this.nextId,x:Math.max(SUPPLIES.width/2,Math.min(WORLD.width-SUPPLIES.width/2,x+offset*SUPPLIES.burstSpacing)),y:y+Math.abs(offset)*8,previousY:y+Math.abs(offset)*8,age:0,burst,velocityX:offset*SUPPLIES.burstSpeed,dead:false});}
    this.releaseCrates();
  }
  releaseCrates(){while(this.supplyQueue.length&&this.supplies.length<SUPPLIES.maxActive)this.supplies.push(this.supplyQueue.shift());}
  expireBoss(allowVictory=true){if(!this.boss)return;for(const face of this.boss.faces){if(face.recorded)continue;if(face.state==='success')this.reward(face);else{this.recordWord(face,'incomplete');this.enemiesFrom(face,2);}face.state='removed';}if(allowVictory)this.completeBoss();else this.boss=null;}
  shoot(type,letter='',segment=0){
    const target=this.target(type==='undo');if(type==='shell'&&(this.ammo<=0||this.elapsed<this.shellReady)){if(this.ammo<=0)this.ammoFlashUntil=this.elapsed+.5;return false;}
    if(type==='undo'&&(this.elapsed<this.undoReady||target?.kind==='choice'))return false;
    if(this.victoryRemaining!==null)return false;
    if(type==='letter'&&target?.kind==='choice'){if(target.state!=='falling')return false;}
    if(type==='letter'&&target&&target.kind!=='choice'){const cell=target.letters[target.cursor];if(!cell||this.elapsed<target.inputLockedUntil||target.blockedSegment===segment)return false;const expected=target.entry.word[target.blanks[target.cursor]],typed=expected===expected.toUpperCase()?letter.toUpperCase():letter.toLowerCase();
      const complete=cell.letter&&cell.count>=LETTER_POINTS[cell.letter].length;
      if(complete&&!target.manual)return false;
      // 同格同字母复用当前输入段，重复按键不能让仍在飞行的同字母弹失效。
      if(cell.letter!==typed||(complete&&target.manual)){cell.count=0;this.clearWordShots(target);cell.letter=typed;target.editSegment=segment;}
      target.manual=false;letter=typed;segment=target.editSegment;
    }
    const speed=(type==='shell'?SHELLS.speedHeightsPerSecond:LETTERS.speedHeightsPerSecond)*WORLD.height,p=this.projectiles.spawn(type,{x:this.player.x,y:this.player.y-38,speed:-speed,targetId:target?.id||0,index:target?.cursor??-1,segment,letter});if(!p)return false;
    if(type==='shell'){this.ammo--;this.shellReady=this.elapsed+SHELLS.cooldownSeconds;this.audio.play('shell');}else if(type==='undo'){this.undoReady=this.elapsed+UNDO.cooldownSeconds;this.audio.play('undo');}else this.audio.play('shot');return true;
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
      if(option.hits===CHOICES.hitsToSelect){word.selectedOption=index;word.state='verifying';word.stateUntil=this.elapsed+WORDS.verifySeconds;this.clearWordShots(word);}
      return;
    }
    if(p.type==='undo'){this.eraseLast(word);return;}
    if(this.elapsed<word.inputLockedUntil||p.index!==word.cursor||p.segment===word.blockedSegment||p.segment!==word.editSegment)return;
    const cell=word.letters[word.cursor];if(cell.letter!==p.letter||cell.count>=LETTER_POINTS[cell.letter].length)return;cell.count++;
    if(cell.count>=LETTER_POINTS[cell.letter].length){
      this.audio.play('letter');cell.filledAt=this.elapsed;word.inputLockedUntil=this.elapsed+WORDS.inputLockSeconds;word.blockedSegment=-1;this.clearWordShots(word);
      const next=word.letters.findIndex(item=>!item.letter||item.count<LETTER_POINTS[item.letter].length);
      if(next<0){word.state='verifying';word.stateUntil=word.inputLockedUntil+WORDS.verifySeconds;}else word.cursor=next;
    }
  }
  answer(word){if(word.kind==='choice')return word.selectedOption===null?'未选择':word.options[word.selectedOption].text;const chars=[...word.entry.word];word.blanks.forEach((index,i)=>{const cell=word.letters[i];chars[index]=cell.letter?(cell.count>=LETTER_POINTS[cell.letter].length?cell.letter:cell.letter+'…'):'_';});return chars.join('');}
  recordWord(word,kind){
    if(word.recorded)return;word.recorded=true;word.resultKind=kind;const answer=this.answer(word);this.records.push({id:this.runId+':'+word.id,runId:this.runId,accountId:this.storage.account.id,sessionId:this.sessionId,wordId:word.entry.id,word:word.entry.word,meaning:word.entry.meaning,answer,kind,boss:word.boss,questionType:word.kind||'spelling',choiceMode:word.mode||null,level:this.level,time:Date.now()});
    if(kind==='correct')this.correct++;else if(kind==='wrong')this.wrong++;else this.missed++;
  }
  reward(word){if(word.rewarded)return;word.rewarded=true;this.recordWord(word,'correct');this.ammo+=WORDS.successAmmo;this.score+=WORDS.successScore;if(word.kind==='choice')this.dropCrates(CHOICES.successCrates,word.x,word.y);this.audio.play('success');}
  hurt(){if(this.player.protection>0||this.state!=='playing')return;this.hits++;this.player.protection=PLAYER.invulnerableSeconds;this.audio.play('hurt');}
  collect(crate){if(crate.dead)return;crate.dead=true;const type=['heart','star','shell'][Math.floor(this.random()*3)];this.collected[type]++;if(this.collections.length<SUPPLIES.maxActive)this.collections.push({id:crate.id,type,x:crate.x,y:crate.y,age:0});else this.displayCollected[type]++;this.audio.play('success');}
  update(dt){
    if(this.state!=='playing')return;
    const collecting=this.victoryRemaining!==null;
    if(!collecting&&this.remaining<=dt+1e-8){this.elapsed=LEVELS.durationSeconds;this.remaining=0;if(this.boss)this.expireBoss();if(this.victoryRemaining===null)this.finish();return;}
    const previousPlayerX=this.player.x,previousPlayerY=this.player.y;this.elapsed+=dt;
    if(collecting){this.victoryRemaining=Math.max(0,this.victoryRemaining-dt);this.remaining=this.victoryRemaining;}else this.remaining=LEVELS.durationSeconds-this.elapsed;
    this.player.protection=Math.max(0,this.player.protection-dt);
    const axis=this.input.axis,vertical=collecting?(this.input.verticalAxis||0):0,diagonal=Math.hypot(axis,vertical)||1,speed=PLAYER.moveSpeedWidthsPerSecond*WORLD.width;
    this.player.x=Math.max(PLAYER.width/2+16,Math.min(WORLD.width-PLAYER.width/2-16,this.player.x+axis/diagonal*speed*dt));
    if(collecting)this.player.y=Math.max(PLAYER.height/2+16,Math.min(WORLD.height-PLAYER.height/2-16,this.player.y+vertical/diagonal*speed*dt));
    if(!collecting&&!this.miniSpawned&&this.elapsed>=BOSSES.miniAt){this.miniSpawned=true;this.spawnBoss(false);}if(!collecting&&!this.finalSpawned&&this.elapsed>=BOSSES.finalAt){this.finalSpawned=true;this.spawnBoss(true);}
    if(this.boss&&this.elapsed>=this.boss.deadline){this.expireBoss();if(this.victoryRemaining!==null)return;}
    if(this.boss){const age=this.elapsed-this.boss.started;const margin=Math.max(...this.boss.faces.map(face=>face.width))/2+24;this.boss.x=Math.max(margin,Math.min(WORLD.width-margin,480+Math.sin(age*.32)*BOSSES.xRange));this.boss.y=BOSSES.centerY+Math.sin(age*.45)*BOSSES.yRange;
      if(!this.boss.activeWord&&this.elapsed>=this.boss.turnUntil)this.boss.activeWord=this.boss.faces.find(face=>!face.recorded)||null;
      const word=this.boss.activeWord;if(word){word.previousY=word.y;word.x=this.boss.x;word.y=this.boss.y;}
    }
    const seconds=Math.ceil(this.remaining);if(seconds<=10&&seconds!==this.lastTick){this.lastTick=seconds;this.audio.play('tick');}
    const actions=this.input.consume();if(!collecting){if(actions.selection!==null&&actions.selection!==undefined)this.selectBlank(actions.selection);if(actions.shell)this.shoot('shell');if(actions.undo)this.shoot('undo');if(actions.erase)this.eraseLast(this.target(true));
    if(this.input.letter&&this.elapsed>=this.nextShot&&!actions.undo&&!actions.erase&&!actions.shell){this.shoot('letter',this.input.letter,this.input.segment);this.nextShot=Math.max(this.nextShot+LETTERS.fireIntervalSeconds,this.elapsed+.020001);}if(!this.input.letter)this.nextShot=this.elapsed;}
    if(!collecting&&!this.boss&&this.elapsed>=this.nextSpawn){let made=0;for(let i=0;i<WORDS.spawnCount;i++){if(!this.spawnWord())break;made++;}this.nextSpawn=this.elapsed+(made?between(WORDS.spawnIntervalSeconds,this.random):WORDS.capacityRetrySeconds);}
    if(!collecting&&this.elapsed>=this.nextSupply){this.dropCrates(1,70+this.random()*(WORLD.width-140),-SUPPLIES.height/2,false);this.nextSupply+=SUPPLIES.intervalSeconds;}
    for(const word of this.words){word.previousY=word.y;if(word.state==='falling')word.y+=word.speed*dt;}
    for(const enemy of this.enemies){enemy.previousY=enemy.y;enemy.y+=enemy.speed*dt;}
    for(const crate of this.supplies){const previousX=crate.x;crate.previousY=crate.y;crate.age+=dt;const burst=crate.burst?Math.max(0,1-crate.age/SUPPLIES.burstSeconds):0;crate.x=Math.max(SUPPLIES.width/2,Math.min(WORLD.width-SUPPLIES.width/2,crate.x+crate.velocityX*burst*dt));crate.y+=(WORLD.height/SUPPLIES.fallSeconds-SUPPLIES.burstRiseSpeed*burst)*dt;if(!crate.dead&&sweptOverlap(previousX-previousPlayerX,crate.previousY-previousPlayerY,crate.x-this.player.x,crate.y-this.player.y,(SUPPLIES.width+PLAYER.width)/2,(SUPPLIES.height+PLAYER.height)/2))this.collect(crate);}
    for(const item of this.collections){item.age+=dt;if(item.age>=SUPPLIES.flightSeconds&&!item.done){item.done=true;this.displayCollected[item.type]++;}}this.collections=this.collections.filter(item=>!item.done);
    const targets=[...this.words,...(this.boss?.activeWord?[this.boss.activeWord]:[])],contacts=[];
    for(const p of this.projectiles.all){if(!p.active)continue;p.previousY=p.y;p.y+=p.speed*dt;p.age+=dt;let collision=null;
      const consider=(type,object,x,previous,y,width,height)=>{const t=sweptHit(p,x,previous,y,width,height);if(t!==null&&(!collision||t<collision.t))collision={t,p,type,object};};
      if(p.type==='enemy')consider('player',this.player,this.player.x,this.player.y,this.player.y,PLAYER.width,PLAYER.height);
      else{
        for(const enemy of this.enemies)if(!enemy.dead)consider('enemy',enemy,enemy.x,enemy.previousY,enemy.y,ENEMIES.width,ENEMIES.height);
        if(p.type!=='shell')for(const word of targets)if(word.state==='falling'||p.type==='undo'&&word.kind!=='choice'&&word.state==='verifying'){const choice=word.kind==='choice',height=choice?CHOICES.height:WORDS.cardHeight+(word.boss?0:WORDS.planeTopMargin+WORDS.planeBottomMargin),offset=choice?CHOICES.height/2:(WORDS.cardHeight+(word.boss?0:WORDS.planeBottomMargin-WORDS.planeTopMargin))/2;consider('word',word,word.x,word.previousY+offset,word.y+offset,word.width+(choice||word.boss?0:WORDS.planeWingMargin*2),height);}
      }
      if(collision)contacts.push(collision);else if(p.age>(p.type==='enemy'?ENEMIES.bulletLifetimeSeconds:LETTERS.lifetimeSeconds)||p.y<0||p.y>WORLD.height+40)p.active=false;
    }
    contacts.sort((a,b)=>a.t-b.t);for(const hit of contacts){const {p,object}=hit;if(!p.active)continue;p.active=false;if(hit.type==='player')this.hurt();else if(hit.type==='enemy'){if(!object.dead&&p.type==='shell'){object.dead=true;this.score+=ENEMIES.killScore;this.audio.play('kill');}}else if((object.state==='falling'||p.type==='undo'&&object.state==='verifying')&&(object.kind==='choice'||object.id===p.targetId))this.receive(object,p);}
    for(const word of targets){
      if(!word.boss&&word.state==='falling'&&word.y>=WORLD.height*WORDS.dangerYRatio){word.state='removed';this.recordWord(word,'incomplete');this.hurt();}
      if(word.state==='verifying'&&this.elapsed>=word.stateUntil){if(word.kind==='choice'?word.options[word.selectedOption]?.correct:this.answer(word)===word.entry.word){word.state='success';word.stateUntil=this.elapsed+WORDS.successSeconds;}else{this.recordWord(word,'wrong');this.enemiesFrom(word,word.kind==='choice'?CHOICES.failureEnemies:word.boss?2:1);this.audio.play('wrong');if(word.boss)this.endBossFace(word);else word.state='removed';}}
      if(word.state==='success'&&this.elapsed>=word.stateUntil){this.reward(word);if(word.boss)this.endBossFace(word);else word.state='removed';if(this.victoryRemaining!==null)break;}
    }
    for(const enemy of this.enemies){if(enemy.dead)continue;if(Math.abs(enemy.x-this.player.x)<(ENEMIES.width+PLAYER.width)/2&&Math.abs(enemy.y-this.player.y)<(ENEMIES.height+PLAYER.height)/2){enemy.dead=true;this.hurt();}else if(enemy.y>WORLD.height+70)enemy.dead=true;else if(this.elapsed>=enemy.nextShot){this.projectiles.spawn('enemy',{x:enemy.x,y:enemy.y+40,speed:ENEMIES.bulletSpeedHeightsPerSecond*WORLD.height});enemy.nextShot=this.elapsed+ENEMIES.shotIntervalSeconds;}}
    this.words=this.words.filter(word=>word.state!=='removed');this.enemies=this.enemies.filter(enemy=>!enemy.dead);this.supplies=this.supplies.filter(crate=>!crate.dead&&crate.y<WORLD.height+60);this.releaseEnemies();this.releaseCrates();
    if(collecting&&this.victoryRemaining<=1e-8){this.victoryRemaining=0;this.remaining=0;this.finish('boss-defeated');}
  }
  finish(reason='timeout'){
    if(!['playing','paused'].includes(this.state))return;
    for(const word of this.words){if(word.state==='success')this.reward(word);else if(!word.recorded)this.recordWord(word,'incomplete');}this.expireBoss(false);this.releaseEnemies();
    this.input?.clear();this.projectiles.clear();this.audio.stop();this.displayCollected={...this.collected};this.collections=[];
    const total=this.records.length,mistakes=this.records.filter(row=>row.kind!=='correct');this.result={id:this.runId,accountId:this.storage.account.id,sessionId:this.sessionId,roster:this.roster.map(entry=>entry.id),outcome:'won',reason,level:this.level,time:Date.now(),score:this.score,ammo:this.ammo,elapsed:this.elapsed,correct:this.correct,wrong:this.wrong,incomplete:this.missed,total,uniqueWords:new Set(this.records.map(row=>row.wordId)).size,rosterCount:this.roster.length,accuracy:total?this.correct/total:null,collected:{...this.collected},records:[...this.records],mistakes};
    this.reviewRemaining=new Set(mistakes.map(row=>row.wordId)).size*REVIEW.secondsPerWord;this.state=this.reviewRemaining?'review':'won';this.storage.saveReview(this.result,this.reviewRemaining);this.savePromise=this.storage.saveSession(this.result);
  }
  restoreReview(saved){this.victoryRemaining=null;this.result=saved.result;this.level=this.result.level;this.elapsed=this.result.elapsed;this.remaining=this.result.reason==='boss-defeated'?0:Math.max(0,LEVELS.durationSeconds-this.elapsed);this.score=this.result.score;this.ammo=this.result.ammo||0;this.correct=this.result.correct;this.wrong=this.result.wrong;this.missed=this.result.incomplete;this.records=this.result.records;this.collected={...this.result.collected};this.displayCollected={...this.collected};this.reviewRemaining=saved.remaining;this.state='review';this.lastReviewSecond=Math.ceil(this.reviewRemaining);}
  updateReview(dt){if(this.state!=='review')return;this.reviewRemaining=Math.max(0,this.reviewRemaining-dt);const second=Math.ceil(this.reviewRemaining);if(second!==this.lastReviewSecond){this.lastReviewSecond=second;this.storage.saveReview(this.result,this.reviewRemaining);}if(!this.reviewRemaining){this.state='won';this.storage.saveReview(this.result,0);}}
}
