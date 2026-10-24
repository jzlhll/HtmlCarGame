import { LETTER_POINTS,letterShotCount,letterDotCount } from './letter-patterns.js';
import { CHOICES } from './config.js';
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
  if(view?.options)return '<div class="recap-question">'+escape(view.title)+'</div><div class="recap-options">'+view.options.map(option=>'<div class="recap-option'+(option.selected?' selected':'')+'"><span>'+escape(option.text)+'</span><small>'+(option.selected?'当时选择':option.hits?'命中 '+option.hits+'/'+CHOICES.hitsToSelect:'未选择')+'</small></div>').join('')+'</div>';
  if(!view?.cells)return '<div class="recap-answer" lang="en">'+escape(record.answer)+'</div>';
  return '<div class="recap-letters" lang="en" aria-label="当时填写：'+escape(record.answer)+'">'+view.cells.map(cell=>{
    if(cell.given)return '<span class="recap-given">'+escape(cell.letter)+'</span>';
    const points=LETTER_POINTS[cell.letter],complete=cell.complete??(!!points&&cell.count>=points.length);
    if(!cell.count||!points)return '<span class="recap-blank">_</span>';
    if(complete)return '<span class="recap-filled">'+escape(cell.letter)+'</span>';
    const lit=new Set(points.slice(0,cell.litCount??cell.count).map(point=>point.y*5+point.x));
    return '<span class="recap-partial" aria-label="未填完的 '+escape(cell.letter)+'">'+Array.from({length:35},(_,index)=>'<i'+(lit.has(index)?' class="lit"':'')+'></i>').join('')+'</span>';
  }).join('')+'</div>';
}
export function recapMarkup(records,images={}){
  if(!records.length)return '<div class="recap-empty"><span>✦</span><h3>本关没有错题</h3><p>带着记住的单词，飞向下一片星海。</p></div>';
  return records.map((record,index)=>{
    const model=record.presentation?.model||(record.questionType==='choice'?'choice':record.boss?'mini':'spelling');
    return '<article class="recap-attempt" data-word-id="'+escape(record.wordId)+'"><div class="recap-attempt-heading"><span>'+String(index+1).padStart(2,'0')+' · '+labels[model]+'</span><span class="stat-'+record.kind+'">'+(record.kind==='wrong'?'写错':'没写完')+'</span></div>'+(images[model]?'<img class="recap-model" src="'+images[model]+'" alt="'+labels[model]+'模型">':'')+'<div class="recap-original"><small>当时的作答</small>'+filledMarkup(record)+'</div><div class="recap-correction"><small>正确答案</small><strong lang="en">'+escape(record.word)+'</strong><p>'+escape(record.meaning)+'</p></div></article>';
  }).join('');
}
