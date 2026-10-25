import { ASSEMBLY } from './config.js';
import { createRandom,shuffle } from './random.js';

// 优先沿元音组边界分块，再合并为最多三段，避免长词被拆得过碎。
export function splitWord(word){
  if(word.length<=3)return [word];
  const nuclei=[...word.matchAll(/[aeiouy]+/gi)],cuts=[];
  for(let i=1;i<nuclei.length;i++){
    const previous=nuclei[i-1],current=nuclei[i],end=previous.index+previous[0].length;
    if(current.index===word.length-1&&current[0].toLowerCase()==='e')continue;
    const cut=end+Math.max(0,current.index-end-1);
    if(cut>=2&&word.length-cut>=2)cuts.push(cut);
  }
  let boundaries=[...new Set(cuts)];
  if(!boundaries.length){
    const count=word.length>=8?ASSEMBLY.maxParts:2;
    boundaries=Array.from({length:count-1},(_,index)=>Math.round(word.length*(index+1)/count));
  }else if(boundaries.length>=ASSEMBLY.maxParts){
    let best=[],cost=Infinity;
    for(let i=0;i<boundaries.length;i++)for(let j=i+1;j<boundaries.length;j++){
      const a=boundaries[i],b=boundaries[j];if(b-a<2)continue;
      const score=(a-word.length/3)**2+(b-a-word.length/3)**2+(word.length-b-word.length/3)**2;
      if(score<cost){best=[a,b];cost=score;}
    }
    boundaries=best.length?best:[boundaries[Math.floor(boundaries.length/2)]];
  }
  const parts=[];let start=0;
  for(const end of [...boundaries,word.length]){parts.push(word.slice(start,end));start=end;}
  return parts;
}

// 四轮内容与视觉随机流在开局准备，出场动画不扣答题时间。
export class AssemblyRound {
  constructor(roster,seed,onRecord){
    this.roster=roster;this.random=createRandom(seed^0x41535345);this.onRecord=onRecord;this.roundIndex=-1;this.done=false;this.version=0;
    const spellingCount=ASSEMBLY.stageWordCounts[0],order=shuffle([...roster],this.random),visualRandom=createRandom(seed^0x4e4f5641);
    if(spellingCount*ASSEMBLY.roundsPerStage!==roster.length||ASSEMBLY.stageWordCounts[1]!==roster.length||new Set(roster.map(entry=>entry.id)).size!==roster.length)throw new Error('Invalid assembly roster coverage');
    this.rounds=Array.from({length:ASSEMBLY.roundsPerStage*ASSEMBLY.stageSeconds.length},(_,index)=>{
      const stage=Math.floor(index/ASSEMBLY.roundsPerStage),entries=stage===0?order.slice(index*spellingCount,(index+1)*spellingCount):shuffle([...roster],this.random);
      return {entries,meanings:shuffle([...entries],this.random),fragments:shuffle(entries.flatMap(entry=>splitWord(entry.word).map((text,part)=>({id:entry.id+':'+part,text}))),this.random),
        enemies:shuffle([...entries],this.random).map((entry,index)=>({id:'en:'+entry.id,entryId:entry.id,text:entry.word,skin:index%3,phase:visualRandom()*Math.PI*2,period:ASSEMBLY.visuals.enemyPeriodSeconds[0]+visualRandom()*(ASSEMBLY.visuals.enemyPeriodSeconds[1]-ASSEMBLY.visuals.enemyPeriodSeconds[0])})),
        sceneSeed:Math.floor(visualRandom()*0x7fffffff),hue:Math.floor(visualRandom()*360)};
    });
    this.beginStage();
  }
  beginStage(){
    this.roundIndex++;this.stage=Math.floor(this.roundIndex/ASSEMBLY.roundsPerStage)+1;this.remaining=ASSEMBLY.stageSeconds[this.stage-1];this.introDuration=ASSEMBLY.introSeconds[this.stage-1];this.introRemaining=this.introDuration;this.time=0;this.attempts=0;this.pending=null;this.shot=null;
    this.assignments=new Map();this.solved=new Set();this.finishedRecords=new Set();this.removedFragments=new Set();this.removedMeteors=new Set();
    Object.assign(this,this.rounds[this.roundIndex]);this.enemyAges=new Map(this.enemies.map(enemy=>[enemy.id,0]));this.version++;
  }
  get allAssigned(){return !this.introRemaining&&!this.shot&&this.assignments.size+this.solved.size===this.entries.length&&(this.stage===2||this.used.size+this.removedFragments.size===this.fragments.length);}
  get checksLeft(){return ASSEMBLY.maxChecks-this.attempts;}
  get used(){return new Set([...this.assignments.values()].flat());}
  get ammunition(){const used=this.used;return this.meanings.find(entry=>!used.has('zh:'+entry.id)&&!this.removedMeteors.has('zh:'+entry.id));}
  fragment(id){
    if(this.done||this.introRemaining||this.stage!==1||!this.pending||this.solved.has(this.pending)||!this.fragments.some(item=>item.id===id)||this.removedFragments.has(id))return;
    const parts=this.assignments.get(this.pending)||[],index=parts.indexOf(id);
    if(index>=0)parts.splice(index,1);else{if(this.used.has(id))return;parts.push(id);}
    if(parts.length)this.assignments.set(this.pending,parts);else this.assignments.delete(this.pending);
    this.version++;
  }
  meaning(id){
    if(this.done||this.introRemaining||this.stage!==1||this.solved.has(id)||!this.entries.some(item=>item.id===id))return;
    this.pending=id;this.version++;
  }
  clear(){
    if(this.done||this.introRemaining||this.shot)return;
    if(this.stage===1){if(!this.pending||!this.assignments.has(this.pending))return;this.assignments.delete(this.pending);}else this.pending=null;
    this.version++;
  }
  enemy(id){
    if(this.done||this.introRemaining||this.stage!==2||this.shot||!this.enemies.some(item=>item.id===id)||this.removedMeteors.has(id))return;
    if(this.assignments.has(id)){this.assignments.delete(id);this.pending=null;}else this.pending=this.pending===id?null:id;
    this.version++;
  }
  fire(){
    if(this.done||this.introRemaining||this.stage!==2||this.shot||!this.pending||this.assignments.has(this.pending)||!this.ammunition)return false;
    this.shot={enemy:this.pending,meaning:this.ammunition,age:0};this.version++;return true;
  }
  drift(enemy){return Math.sin(enemy.phase+(this.enemyAges.get(enemy.id)||0)*Math.PI*2/enemy.period);}
  answer(id){
    if(this.stage===1)return (this.assignments.get(id)||[]).map(key=>this.fragments.find(item=>item.id===key).text).join('');
    const linked=this.assignments.get('en:'+id)?.[0];return linked?this.entries.find(entry=>'zh:'+entry.id===linked)?.meaning||'':'';
  }
  record(entry,kind,answer){this.onRecord(entry,kind,answer||'未作答',this.stage,this.attempts,this.roundIndex+1);}
  submit(){
    if(this.done||!this.allAssigned||!this.checksLeft)return null;
    this.attempts++;let correct=0;
    for(const entry of this.entries){
      if(this.solved.has(entry.id))continue;
      const answer=this.answer(entry.id),right=this.stage===1?this.entries.some(candidate=>candidate.word===answer&&candidate.meaning===entry.meaning):answer===entry.meaning;
      this.record(entry,right?'correct':'wrong',answer);
      if(right){this.solved.add(entry.id);this.finishedRecords.add(entry.id);correct++;
        if(this.stage===1){for(const id of this.assignments.get(entry.id))this.removedFragments.add(id);}else{this.removedMeteors.add('en:'+entry.id);this.removedMeteors.add(this.assignments.get('en:'+entry.id)[0]);}
      }
    }
    this.assignments.clear();this.pending=null;this.version++;
    const stage=this.stage,round=this.roundIndex+1,complete=this.solved.size===this.entries.length;
    if(complete||!this.checksLeft)this.advance(false);
    return {correct,stage,round,complete,advanced:round!==this.roundIndex+1||this.done};
  }
  advance(recordUnfinished=true){
    if(this.done)return;
    if(recordUnfinished)for(const entry of this.entries)if(!this.finishedRecords.has(entry.id))this.record(entry,'incomplete',this.answer(entry.id));
    if(this.roundIndex+1<this.rounds.length)this.beginStage();else{this.done=true;this.remaining=0;this.version++;}
  }
  close(){if(this.done)return;for(const entry of this.entries)if(!this.finishedRecords.has(entry.id))this.record(entry,'incomplete',this.answer(entry.id));this.shot=null;this.done=true;this.version++;}
  update(dt){
    if(this.done||!Number.isFinite(dt)||dt<=0)return 0;
    const intro=Math.min(dt,this.introRemaining);this.introRemaining=Math.max(0,this.introRemaining-intro);this.time+=intro;dt-=intro;
    if(intro&&this.introRemaining<1e-8){this.introRemaining=0;this.version++;}
    const active=Math.min(dt,this.remaining);this.time+=active;this.remaining=Math.max(0,this.remaining-active);
    if(this.stage===2){
      for(const enemy of this.enemies)if(!this.assignments.has(enemy.id)&&!this.removedMeteors.has(enemy.id))this.enemyAges.set(enemy.id,this.enemyAges.get(enemy.id)+active);
      if(this.shot){this.shot.age+=active;if(this.shot.age>=ASSEMBLY.visuals.flightSeconds){this.assignments.set(this.shot.enemy,['zh:'+this.shot.meaning.id]);this.shot=null;this.pending=null;this.version++;}}
    }
    if(this.remaining<=1e-8)this.advance();return active;
  }
}
