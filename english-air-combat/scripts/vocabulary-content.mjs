import { VOCABULARY_EXAMPLE_OVERRIDES, SCHOOL_EXAMPLE_OVERRIDES, SCHOOL_MEANING_CORRECTIONS, VOCABULARY_MEANING_CORRECTIONS } from '../src/vocabulary-example-overrides.js';

export const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
export function wordForms(word){
  const forms=[word,`${word}s`,`${word}es`,`${word}ed`,`${word}ing`];
  if(word.endsWith('e'))forms.push(`${word.slice(0,-1)}ing`,`${word}d`);
  if(word.endsWith('y'))forms.push(`${word.slice(0,-1)}ies`,`${word.slice(0,-1)}ied`);
  if(/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(word))forms.push(`${word}${word.at(-1)}ed`,`${word}${word.at(-1)}ing`);
  return forms;
}
export function containsWord(text,word){const tokens=text.toLowerCase().match(/[a-z]+/g)||[];return wordForms(word.toLowerCase()).some(form=>tokens.includes(form));}
const chinese=value=>value.replace(/\([^)]*\)|（[^）]*）|\[[^\]]*\]/g,'').replace(/[^\u3400-\u9fff]/g,'');
const generic=new Set(['的','地','得','使','有','一','以','为','于','在','和','是','或','者','某','人','事','物','等','用','与','对','把','被']);
function affinity(definition,translation){
  const text=chinese(translation);let best=0;
  for(const sense of definition.split(/[，,；;、]/)){
    const gloss=chinese(sense);if(!gloss)continue;
    if(gloss.length===1){if(!generic.has(gloss)&&text.includes(gloss))best=Math.max(best,1);continue;}
    for(let length=Math.min(gloss.length,5);length>=2;length--)for(let start=0;start+length<=gloss.length;start++)if(text.includes(gloss.slice(start,start+length)))best=Math.max(best,length);
  }
  return best;
}
const domainTerms=/\b(adsorption|chromatography|polymer|semiconductor|hydraulic|turbine|electrode|coefficient|sulfate|voltage|welding|tensile|stator|rotor|crusher|spectrometry|spectroscopy|chromium|carbide|chloride|sodium|hydrogen|molecular|catalyst|thermal|isotope|impedance|silicon|condenser|junction|electrophoretic)\b/i;
function exampleScore(example,word){
  const tokens=example.text.split(/\s+/).length;
  return (example.kind==='sentence'?20:0)+Math.abs(tokens-(example.kind==='phrase'?3:10))+(example.text.length>120?20:0)+(domainTerms.test(example.text)?25:0)+(/[\[（(]/.test(example.meaning)?5:0)+(!example.text.toLowerCase().split(/[^a-z]+/).includes(word)?2:0);
}
function usable(example,word){return example.text&&example.meaning&&/[\u3400-\u9fff]/.test(example.meaning)&&!/[\uFFFD\u0000-\u001F]/.test(example.text+example.meaning)&&!/美国著名影星|人名|姓氏/.test(example.meaning)&&containsWord(example.text,word)&&!(example.kind==='phrase'&&/\b(a|an|the)$/i.test(example.text));}
function sensesFor(rows){
  const seen=new Set(),senses=[];
  for(const row of rows)for(const item of row.translations||[]){
    const meaning=clean(item.translation),partOfSpeech=clean(item.type),key=partOfSpeech+':'+meaning;
    if(!/[\u3400-\u9fff]/.test(meaning)||/人名|姓氏/.test(meaning)||seen.has(key))continue;
    seen.add(key);senses.push({meaning,partOfSpeech});
  }
  return senses;
}
function partOfSpeechFor(meaning,example,rows,word){
  const candidates=sensesFor(rows).filter(sense=>sense.partOfSpeech);
  candidates.sort((a,b)=>(affinity(b.meaning,example.meaning)*3+affinity(b.meaning,meaning))-(affinity(a.meaning,example.meaning)*3+affinity(a.meaning,meaning)));
  return candidates[0]?.partOfSpeech||{usa:'n',excited:'adj'}[word]||'';
}
// 例子必须先与词义配对，再比较长短；不能仅因包含目标词就跨义项拼接。
export function createVocabularyEntry(libraryId,key,word,rows,originalEntry){
  if(originalEntry)return {entry:{...originalEntry,partOfSpeech:originalEntry.partOfSpeech||partOfSpeechFor(originalEntry.meaning,originalEntry.example,rows,key),id:`${libraryId}-${key}`,libraryId,word,group:0},needsReview:false};
  const explicitMeaning=(libraryId==='intermediate'&&SCHOOL_MEANING_CORRECTIONS[key])||VOCABULARY_MEANING_CORRECTIONS[key];
  const explicitExample=(libraryId==='intermediate'&&SCHOOL_EXAMPLE_OVERRIDES[key])||VOCABULARY_EXAMPLE_OVERRIDES[key];
  const senses=sensesFor(rows),allCandidates=[];
  for(const row of rows){
    const rowSenses=sensesFor([row]);
    for(const example of [...(row.phrases||[]).map(item=>({text:clean(item.phrase),meaning:clean(item.translation),kind:'phrase'})),...(row.sentences||[]).map(item=>({text:clean(item.sentence),meaning:clean(item.translation),kind:'sentence'}))]){
      if(!usable(example,key))continue;
      const eligible=explicitMeaning?[{meaning:explicitMeaning,partOfSpeech:''}]:rowSenses;
      const sense=[...eligible].sort((a,b)=>affinity(b.meaning,example.meaning)-affinity(a.meaning,example.meaning))[0];
      if(sense)allCandidates.push({example,sense,affinity:affinity(sense.meaning,example.meaning)});
    }
  }
  let selected;
  if(explicitExample){
    const eligible=explicitMeaning?[{meaning:explicitMeaning,partOfSpeech:''}]:senses;
    const sense=[...eligible].sort((a,b)=>affinity(b.meaning,explicitExample.meaning)-affinity(a.meaning,explicitExample.meaning))[0];
    if(sense)selected={example:explicitExample,sense,affinity:affinity(sense.meaning,explicitExample.meaning),curated:true};
  }else{
    selected=allCandidates.sort((a,b)=>(a.affinity?0:1000)-(b.affinity?0:1000)+exampleScore(a.example,key)-exampleScore(b.example,key))[0];
  }
  if(!selected)return {error:'Missing meaning or example',word,libraryId};
  const meaning=explicitMeaning||selected.sense.meaning,example={...selected.example};
  if(!usable(example,key))throw new Error(`Invalid curated vocabulary example: ${libraryId}/${key}`);
  example.text=example.text[0].toUpperCase()+example.text.slice(1);
  return {entry:{id:`${libraryId}-${key}`,libraryId,word,meaning,partOfSpeech:selected.sense.partOfSpeech||partOfSpeechFor(meaning,example,rows,key),group:0,example},needsReview:!selected.curated&&!selected.affinity};
}
