// 这些是易混拼写候选，不把发音与拼法的对应关系当作没有例外的定律。
// 依据见 docs/design/english-air-combat/10-挖空选择与触屏关卡.md。
const groups=[
  {id:'cious-tious',pattern:/(?:cious|tious|sious)$/gi,parts:['cious','tious','sious'],weight:7},
  {id:'ious-ous',pattern:/(?:ious|eous|uous|ous)$/gi,parts:['ious','eous','uous','ous'],weight:6},
  {id:'tion-sion',pattern:/(?:ssion|tion|sion|cian)$/gi,parts:['tion','sion','ssion','cian'],weight:6},
  {id:'able-ible',pattern:/(?:able|ible)$/gi,parts:['able','ible','eble'],weight:5},
  {id:'ance-ence',pattern:/(?:ance|ence|ancy|ency)$/gi,parts:['ance','ence','ancy','ency'],weight:5},
  {id:'ant-ent',pattern:/(?:ant|ent)$/gi,parts:['ant','ent','int'],weight:4},
  {id:'au-ou',pattern:/(?:au|ou|aw|ow|oa)/gi,parts:['au','ou','aw','ow','oa'],weight:5},
  {id:'ie-ei',pattern:/(?:ie|ei|ee|ea)/gi,parts:['ie','ei','ee','ea'],weight:5},
  {id:'digraph',pattern:/(?:th|ch|sh|ph|wh)/gi,parts:['th','ch','sh','ph','wh','ht'],weight:4},
  {id:'silent-prefix',pattern:/^(?:kn|wr|gn|ps|pn)/gi,parts:unit=>({kn:['kn','n','gn'],wr:['wr','r','rw'],gn:['gn','n','kn'],ps:['ps','s','sp'],pn:['pn','n','np']})[unit.toLowerCase()],weight:4},
  {id:'silent-ending',pattern:/(?:mb|mn)$/gi,parts:['mb','m','mn','n'],weight:4},
  {id:'silent-gh',pattern:/(?:ght|gh)/gi,parts:['ght','gh','t','th'],weight:4},
  {id:'soft-c-s',pattern:/[cs](?=[eiy])/gi,parts:['c','s','z'],weight:3},
  {id:'hard-c-k',pattern:/[ck](?![eiy])/gi,parts:['c','k','s'],weight:2},
  {id:'vowels',pattern:/[aeiou]/gi,parts:['a','e','i','o','u'],weight:1}
];
const shuffle=(values,random)=>{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
const matchCase=(value,original)=>original===original.toUpperCase()?value.toUpperCase():/^[A-Z]/.test(original)?value[0].toUpperCase()+value.slice(1):value;
export function spellingCandidates(word,knownWords){
  const candidates=[],seen=new Set();
  const add=(start,unit,parts,rule,weight)=>{
    const key=start+':'+unit.length;if(seen.has(key))return;
    const before=word.slice(0,start),after=word.slice(start+unit.length),incorrect=[];
    for(const part of parts){const text=matchCase(part,unit),completedWord=before+text+after;if(text.toLowerCase()===unit.toLowerCase()||knownWords.has(completedWord.toLowerCase())||incorrect.some(option=>option.text.toLowerCase()===text.toLowerCase()))continue;incorrect.push({text,completedWord,correct:false,hits:0});}
    if(incorrect.length<2)return;
    seen.add(key);candidates.push({rule,weight,start,unit,before,after,incorrect});
  };
  for(const group of groups){group.pattern.lastIndex=0;for(const match of word.matchAll(group.pattern))add(match.index,match[0],typeof group.parts==='function'?group.parts(match[0]):group.parts,group.id,group.weight);}
  for(const match of word.matchAll(/([b-df-hj-np-tv-z])\1/gi))add(match.index,match[0],[match[0],match[1],match[1]+(match[1].toLowerCase()==='r'?'l':'r')],'double-consonant',5);
  if(!candidates.length){
    // 极短词或特殊拼写仍有可用题目，排除能组成已收录单词的干扰拼法。
    for(let i=0;i<word.length;i++)add(i,word[i],['a','e','i','o','u','c','s','k','th','ch','sh','ee','ou','au'],'letter-fallback',1);
  }
  return candidates;
}
export function createSpellingChoice(word,random,knownWords){
  const available=spellingCandidates(word,knownWords),patterns=available.filter(candidate=>candidate.rule!=='vowels'),candidates=patterns.length?patterns:available;if(!candidates.length)throw new Error('No unambiguous spelling choice: '+word);
  let ticket=random()*candidates.reduce((sum,candidate)=>sum+candidate.weight,0),selected=candidates.at(-1);
  for(const candidate of candidates){ticket-=candidate.weight;if(ticket<0){selected=candidate;break;}}
  const {rule,start,unit,before,after}=selected,wrong=shuffle(selected.incorrect,random).slice(0,2);
  return {mode:'spelling-gap',rule,blankStart:start,blankLength:unit.length,unit,before,after,stem:before+'_'.repeat(unit.length)+after,options:shuffle([{text:unit,completedWord:word,correct:true,hits:0},...wrong],random)};
}
