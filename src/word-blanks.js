import { WORDS } from './config.js';
import { shuffle } from './random.js';

const VOWEL_GROUPS=['ai','au','ea','ee','ei','eu','ie','oa','oe','oi','oo','ou','ue','ui','eau','iou'];
const PREFIXES=['un','re','pre','dis','mis'];
const SUFFIXES=['ing','ed','er','est','ly','ful','less','ness','ment','tion','sion','able','ible','ous','ive','al'];

// 用固定比例的模式袋复用常见拼写片段；片段仅为拼写提示，不作为精确音节划分。
export class WordBlanks {
  constructor(random=Math.random){this.random=random;this.modes=[];}
  select(word){
    if(typeof word!=='string'||!word.length||!/^[A-Za-z]+$/.test(word))throw new Error('Alphabetic word required');
    if(!this.modes.length){
      const batch=WORDS.blankModeBatch??5,structured=Math.round(batch*(WORDS.blankStructuredRatio??.8));
      this.modes=shuffle(Array.from({length:batch},(_,index)=>index<structured?'structured':'random'),this.random);
    }
    const mode=this.modes.pop(),maximum=Math.max(1,Math.min(WORDS.blankCount[1],Math.floor(word.length*(WORDS.blankMaxFraction??.5))));
    let blanks;
    if(mode==='random'){
      const count=1+Math.floor(this.random()*maximum);
      blanks=shuffle(Array.from({length:word.length},(_,index)=>index),this.random).slice(0,count).sort((a,b)=>a-b);
    }else{
      const lower=word.toLowerCase(),vowels=[],affixes=[];
      for(let index=0;index<word.length;index++)if(/[aeiou]/.test(lower[index]))vowels.push({index,length:1});
      if(word.length>4){
        for(const unit of VOWEL_GROUPS){
          if(unit.length>maximum)continue;
          for(let index=lower.indexOf(unit);index>=0;index=lower.indexOf(unit,index+1))vowels.push({index,length:unit.length});
        }
        for(const unit of PREFIXES)if(unit.length<=maximum&&lower.startsWith(unit))affixes.push({index:0,length:unit.length});
        for(const unit of SUFFIXES)if(unit.length<=maximum&&lower.endsWith(unit))affixes.push({index:word.length-unit.length,length:unit.length});
      }
      let candidates=vowels;
      if(affixes.length&&(!vowels.length||this.random()<.2))candidates=affixes;
      if(!candidates.length){for(let index=0;index<word.length;index++)if(lower[index]==='y')candidates.push({index,length:1});}
      if(!candidates.length)candidates=[{index:0,length:1}];
      const selected=candidates[Math.floor(this.random()*candidates.length)];
      blanks=Array.from({length:selected.length},(_,offset)=>selected.index+offset);
    }
    return {blanks,mode,unit:blanks.map(index=>word[index]).join('')};
  }
}
