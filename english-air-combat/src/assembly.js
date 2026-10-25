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

export class AssemblyRound {
  constructor(roster,seed,onRecord){
    this.roster=roster;this.random=createRandom(seed^0x41535345);this.onRecord=onRecord;this.roundIndex=-1;this.done=false;this.version=0;
    const count=ASSEMBLY.roundsPerStage*ASSEMBLY.stageSeconds.length,spellingCount=ASSEMBLY.stageWordCounts[0],omitted=roster.length-ASSEMBLY.stageWordCounts[1],spellingOrder=shuffle([...roster],this.random),linkingOrder=shuffle([...roster],this.random);
    if(spellingCount*ASSEMBLY.roundsPerStage!==roster.length||omitted<0||omitted*ASSEMBLY.roundsPerStage>roster.length||new Set(roster.map(entry=>entry.id)).size!==roster.length)throw new Error('Invalid assembly roster coverage');
    // 拼接两轮各六词且互不重复；连线两轮各九词，轮空的三词必在另一轮出现。
    this.rounds=Array.from({length:count},(_,index)=>{
      const stage=Math.floor(index/ASSEMBLY.roundsPerStage),part=index%ASSEMBLY.roundsPerStage,excluded=new Set(linkingOrder.slice(part*omitted,(part+1)*omitted).map(entry=>entry.id)),entries=stage===0?spellingOrder.slice(part*spellingCount,(part+1)*spellingCount):roster.filter(entry=>!excluded.has(entry.id));
      return {entries,meanings:shuffle([...entries],this.random),fragments:shuffle(entries.flatMap(entry=>splitWord(entry.word).map((text,part)=>({id:entry.id+':'+part,text}))),this.random),meteors:shuffle(entries.flatMap(entry=>[{id:'en:'+entry.id,entryId:entry.id,side:'en',text:entry.word},{id:'zh:'+entry.id,entryId:entry.id,side:'zh',text:entry.meaning}]),this.random)};
    });
    this.beginStage();
  }
  beginStage(){
    this.roundIndex++;this.stage=Math.floor(this.roundIndex/ASSEMBLY.roundsPerStage)+1;this.remaining=ASSEMBLY.stageSeconds[this.stage-1];this.attempts=0;this.pending=null;this.assignments=new Map();this.solved=new Set();this.finishedRecords=new Set();this.removedFragments=new Set();this.removedMeteors=new Set();
    Object.assign(this,this.rounds[this.roundIndex]);this.version++;
  }
  get allAssigned(){return this.assignments.size+this.solved.size===this.entries.length&&(this.stage===2?!this.pending:this.used.size+this.removedFragments.size===this.fragments.length);}
  get checksLeft(){return ASSEMBLY.maxChecks-this.attempts;}
  get used(){return new Set([...this.assignments.values()].flat());}
  fragment(id){
    if(this.done||this.stage!==1||!this.pending||this.solved.has(this.pending)||!this.fragments.some(item=>item.id===id)||this.removedFragments.has(id))return;
    const parts=this.assignments.get(this.pending)||[],index=parts.indexOf(id);
    if(index>=0)parts.splice(index,1);else{if(this.used.has(id))return;parts.push(id);}
    if(parts.length)this.assignments.set(this.pending,parts);else this.assignments.delete(this.pending);
    this.version++;
  }
  meaning(id){
    if(this.done||this.stage!==1||this.solved.has(id)||!this.entries.some(item=>item.id===id))return;
    this.pending=id;this.version++;
  }
  clear(){
    if(this.done)return;
    if(this.stage===1){if(!this.pending||!this.assignments.has(this.pending))return;this.assignments.delete(this.pending);}else this.pending=null;
    this.version++;
  }
  meteor(id){
    if(this.done||this.stage!==2)return;const item=this.meteors.find(item=>item.id===id);if(!item||this.removedMeteors.has(id))return;
    const paired=[...this.assignments].find(([key,value])=>key===id||value[0]===id);
    if(paired){this.assignments.delete(paired[0]);this.pending=null;this.version++;return;}
    if(this.pending===id)this.pending=null;
    else if(!this.pending||this.meteors.find(other=>other.id===this.pending).side===item.side)this.pending=id;
    else{const other=this.meteors.find(other=>other.id===this.pending),english=item.side==='en'?item:other,chinese=item.side==='zh'?item:other;this.assignments.set(english.id,[chinese.id]);this.pending=null;}
    this.version++;
  }
  answer(id){
    if(this.stage===1)return (this.assignments.get(id)||[]).map(key=>this.fragments.find(item=>item.id===key).text).join('');
    const linked=this.assignments.get('en:'+id)?.[0];return linked?this.meteors.find(item=>item.id===linked).text:'';
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
  close(){if(this.done)return;for(const entry of this.entries)if(!this.finishedRecords.has(entry.id))this.record(entry,'incomplete',this.answer(entry.id));this.done=true;this.version++;}
  update(dt){if(this.done)return;this.remaining=Math.max(0,this.remaining-dt);if(this.remaining<=1e-8)this.advance();}
}
