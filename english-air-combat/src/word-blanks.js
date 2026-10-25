import { WORDS } from './config.js';
import { shuffle } from './random.js';

// 任意字母均可挖空；短词允许挖两个，其余最多挖词长的一半。
export class WordBlanks {
  constructor(random=Math.random){this.random=random;}
  select(word){
    if(typeof word!=='string'||word.length<2||!/^[A-Za-z]+$/.test(word))throw new Error('At least two alphabetic letters required');
    const minimum=Math.min(WORDS.blankMinCount,word.length),maximum=Math.max(minimum,Math.floor(word.length*WORDS.blankMaxFraction));
    const count=minimum+Math.floor(this.random()*(maximum-minimum+1));
    const blanks=shuffle(Array.from({length:word.length},(_,index)=>index),this.random).slice(0,count).sort((a,b)=>a-b);
    return {blanks,mode:'random',unit:blanks.map(index=>word[index]).join('')};
  }
}
