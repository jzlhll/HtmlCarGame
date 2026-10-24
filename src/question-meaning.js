import { WORDS } from './config.js';

// 出题时抽取，保留原义项顺序；渲染和瞄准不再重新随机。
export function questionMeaning(meaning,random,limit=WORDS.meaningLimit){
  const parts=[...new Set(meaning.split(/[；;]/).map(part=>part.trim()).filter(Boolean))];
  if(parts.length<=limit)return parts.join('；');
  const indices=parts.map((_,index)=>index);
  for(let i=0;i<limit;i++){const next=i+Math.floor(random()*(indices.length-i));[indices[i],indices[next]]=[indices[next],indices[i]];}
  return indices.slice(0,limit).sort((a,b)=>a-b).map(index=>parts[index]).join('；');
}
export function aimedChoice(word,x){
  const left=word.x-word.width/2;
  return x<left||x>left+word.width?-1:Math.min(word.options.length-1,Math.floor((x-left)/(word.width/word.options.length)));
}
