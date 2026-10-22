import { VOCAB } from './config.js';
import { VOCABULARY } from './vocabulary-data.js';
import { shuffle } from './random.js';
export function learningWeight(stats){
  const total=(stats?.correct||0)+(stats?.wrong||0)+(stats?.incomplete||0),rate=total?(stats?.correct||0)/total:0;
  return rate>.85?.01:rate>.75?.25:rate>.5?.5:1;
}
export class Vocabulary {
  constructor(random,storage,roster=null){this.random=random;this.storage=storage;this.roster=roster;this.bag=[];this.pools=[0,1,2].map(group=>VOCABULARY.filter(entry=>entry.group===group&&/^[A-Za-z]{2,14}$/.test(entry.word)&&(entry.verified||VOCAB.usePreviewPool)));}
  select(count){
    // 随机起点的等距分配使每组只取目标数量的上下整数，长期保留小比例组。
    const quotas=VOCAB.groupWeights.map(()=>0),offset=this.random();let group=0,boundary=VOCAB.groupWeights[0]*count;
    for(let i=0;i<count;i++){while(group<VOCAB.groupWeights.length-1&&i+offset>=boundary){group++;boundary+=VOCAB.groupWeights[group]*count;}quotas[group]++;}
    const roster=[];
    for(let group=0;group<3;group++){
      const pool=[...this.pools[group]];if(pool.length<quotas[group])throw new Error('Insufficient vocabulary for level');
      for(let i=0;i<quotas[group];i++){
        const weights=pool.map(entry=>learningWeight(this.storage.learning[entry.id])),total=weights.reduce((a,b)=>a+b,0);let value=this.random()*total,index=0;
        while(index<weights.length-1&&value>=weights[index]){value-=weights[index];index++;}
        roster.push(pool.splice(index,1)[0]);
      }
    }
    return shuffle(roster,this.random);
  }
  next(active=new Set()){
    if(!this.roster?.length)return null;
    if(!this.bag.length)this.bag=shuffle([...this.roster],this.random);
    const index=this.bag.findIndex(entry=>!active.has(entry.id));if(index<0)return null;
    const entry=this.bag[index];return {entry,commit:()=>{const found=this.bag.indexOf(entry);if(found>=0)this.bag.splice(found,1);}};
  }
}
