import { ASSEMBLY } from './config.js';
import { createRandom,shuffle } from './random.js';

// 按元音组近似分音节；这是拼写练习的分块，不声称覆盖英语发音规则。
export function splitWord(word){
  if(word.length<=3)return [word];
  const nuclei=[...word.matchAll(/[aeiouy]+/gi)];
  const cuts=[];
  for(let i=1;i<nuclei.length;i++){
    const previous=nuclei[i-1],current=nuclei[i],end=previous.index+previous[0].length;
    if(current.index===word.length-1&&current[0].toLowerCase()==='e')continue;
    const gap=current.index-end,cut=end+Math.max(0,gap-1);
    if(cut>=2&&word.length-cut>=2)cuts.push(cut);
  }
  if(!cuts.length&&word.length>ASSEMBLY.maxChunkLength){
    for(let at=3;at<word.length-1;at+=3)cuts.push(at);
  }
  const parts=[];let start=0;
  for(const end of [...new Set(cuts),word.length]){parts.push(word.slice(start,end));start=end;}
  return parts;
}

export class AssemblyRound {
  constructor(roster,seed,onRecord){
    this.roster=roster;this.random=createRandom(seed^0x41535345);this.onRecord=onRecord;this.stage=0;this.removedFragments=new Set();this.done=false;this.version=0;this.beginStage();
  }
  beginStage(){
    this.stage++;this.remaining=ASSEMBLY.stageSeconds[this.stage-1];this.attempts=0;this.selected=[];this.pending=null;this.assignments=new Map();this.solved=new Set();this.finishedRecords=new Set();this.removedMeteors=new Set();
    this.meanings=shuffle([...this.roster],this.random);
    this.fragments=shuffle(this.roster.flatMap(entry=>splitWord(entry.word).map((text,index)=>({id:entry.id+':'+index,text}))),this.random);
    this.meteors=shuffle(this.roster.flatMap(entry=>[{id:'en:'+entry.id,entryId:entry.id,side:'en',text:entry.word},{id:'zh:'+entry.id,entryId:entry.id,side:'zh',text:entry.meaning}]),this.random);
    this.version++;
  }
  get allAssigned(){return this.assignments.size+this.solved.size===this.roster.length&&this.selected.length===0&&!this.pending&&(this.stage===2||this.used.size+this.removedFragments.size===this.fragments.length);}
  get checksLeft(){return ASSEMBLY.maxChecks-this.attempts;}
  get used(){return new Set([...this.assignments.values()].flat());}
  fragment(id){
    if(this.done||this.stage!==1||!this.fragments.some(item=>item.id===id)||this.used.has(id)||this.removedFragments?.has(id))return;
    const index=this.selected.indexOf(id);if(index<0)this.selected.push(id);else this.selected.splice(index,1);this.version++;
  }
  meaning(id){
    if(this.done||this.stage!==1||this.solved.has(id)||!this.roster.some(item=>item.id===id))return;
    if(this.assignments.has(id)){this.assignments.delete(id);this.version++;return;}
    if(!this.selected.length)return;
    this.assignments.set(id,[...this.selected]);this.selected=[];this.version++;
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
  record(entry,kind,answer){this.onRecord(entry,kind,answer||'未作答',this.stage,this.attempts);}
  submit(){
    if(this.done||!this.allAssigned||!this.checksLeft)return null;
    this.attempts++;let correct=0;
    for(const entry of this.roster){
      if(this.solved.has(entry.id))continue;
      const answer=this.answer(entry.id),right=this.stage===1?this.roster.some(candidate=>candidate.word===answer&&candidate.meaning===entry.meaning):answer===entry.meaning;
      this.record(entry,right?'correct':'wrong',answer);
      if(right){this.solved.add(entry.id);this.finishedRecords.add(entry.id);correct++;
        if(this.stage===1){for(const id of this.assignments.get(entry.id))this.removedFragments.add(id);}else{this.removedMeteors.add('en:'+entry.id);this.removedMeteors.add(this.assignments.get('en:'+entry.id)[0]);}
      }
    }
    this.assignments.clear();this.selected=[];this.pending=null;this.version++;
    const stage=this.stage,complete=this.solved.size===this.roster.length;
    if(complete||!this.checksLeft)this.advance(false);
    return {correct,stage,complete,advanced:stage!==this.stage||this.done};
  }
  advance(recordUnfinished=true){
    if(this.done)return;
    if(recordUnfinished)for(const entry of this.roster)if(!this.finishedRecords.has(entry.id))this.record(entry,'incomplete',this.answer(entry.id));
    if(this.stage===1){this.beginStage();this.removedFragments=new Set();}else{this.done=true;this.remaining=0;this.version++;}
  }
  close(){if(this.done)return;for(const entry of this.roster)if(!this.finishedRecords.has(entry.id))this.record(entry,'incomplete',this.answer(entry.id));this.done=true;this.version++;}
  update(dt){if(this.done)return;this.remaining=Math.max(0,this.remaining-dt);if(this.remaining<=1e-8)this.advance();}
}
