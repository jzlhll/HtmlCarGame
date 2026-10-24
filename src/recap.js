import { LETTER_POINTS,letterShotCount,letterDotCount } from './letter-patterns.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={spelling:'单词飞机',choice:'选择题航母',mini:'小 Boss',final:'大 Boss'};
export function captureAttempt(word,bossFinal=false){
  if(word.kind==='choice')return {model:'choice',mode:word.mode,title:word.mode==='word-to-meaning'?word.entry.word:word.entry.meaning,options:word.options.map((option,index)=>({text:option.text,hits:option.hits,selected:index===word.selectedOption}))};
  return {model:word.boss?(bossFinal?'final':'mini'):'spelling',cells:[...word.entry.word].map((letter,index)=>{
    const blank=word.blanks.indexOf(index),cell=blank<0?null:word.letters[blank];
    return {given:blank<0,letter:blank<0?letter:cell.letter,count:cell?.count||0,complete:!!cell?.letter&&cell.count>=letterShotCount(cell.letter),litCount:cell?letterDotCount(cell.letter,cell.count):0};
  })};
}
function filledMarkup(record){
  const view=record.presentation;
  if(view?.options)return '<span class="recap-answer">'+escape(record.answer)+'</span>';
  if(!view?.cells)return '<span class="recap-answer" lang="en">'+escape(record.answer)+'</span>';
  return '<span class="recap-letters" lang="en" aria-label="当时填写：'+escape(record.answer)+'">'+view.cells.map(cell=>{
    if(cell.given)return '<span class="recap-given">'+escape(cell.letter)+'</span>';
    const points=LETTER_POINTS[cell.letter],complete=cell.complete??(!!points&&cell.count>=points.length);
    if(!cell.count||!points)return '<span class="recap-blank">_</span>';
    if(complete)return '<span class="recap-filled">'+escape(cell.letter)+'</span>';
    const lit=new Set(points.slice(0,cell.litCount??cell.count).map(point=>point.y*5+point.x));
    return '<span class="recap-partial" aria-label="未填完的 '+escape(cell.letter)+'">'+Array.from({length:35},(_,index)=>'<i'+(lit.has(index)?' class="lit"':'')+'></i>').join('')+'</span>';
  }).join('')+'</span>';
}
export function groupRecap(records){
  const words=new Map();
  for(const record of records){
    let group=words.get(record.wordId);
    if(!group){group={wordId:record.wordId,word:record.word,meaning:record.meaning,models:[],attempts:[],variants:new Map()};words.set(record.wordId,group);}
    const model=record.presentation?.model||(record.questionType==='choice'?'choice':record.boss?'mini':'spelling');if(!group.models.includes(model))group.models.push(model);
    const signature=JSON.stringify([record.kind,record.answer,record.presentation?.cells??null]);
    if(group.variants.has(signature))group.variants.get(signature).count++;
    else{const attempt={record,count:1};group.variants.set(signature,attempt);group.attempts.push(attempt);}
  }
  return [...words.values()];
}
export function recapMarkup(records,images={}){
  if(!records.length)return '<div class="recap-empty"><span>✦</span><h3>本关没有错题</h3><p>带着记住的单词，飞向下一片星海。</p></div>';
  return groupRecap(records).map(group=>'<section class="recap-attempt" data-word-id="'+escape(group.wordId)+'"><div class="recap-models">'+group.models.filter(model=>images[model]).map(model=>'<img class="recap-model" src="'+images[model]+'" alt="'+labels[model]+'模型">').join('')+'</div><div class="recap-correct"><small>正确</small><strong lang="en">'+escape(group.word)+'</strong></div><p class="recap-meaning">'+escape(group.meaning)+'</p><div class="recap-errors">'+group.attempts.map(({record,count})=>'<div class="recap-error"><small class="stat-'+record.kind+'">'+(record.kind==='wrong'?'错误':'未完成')+'</small>'+filledMarkup(record)+(count>1?'<small class="recap-repeat">×'+count+'</small>':'')+'</div>').join('')+'</div></section>').join('');
}
