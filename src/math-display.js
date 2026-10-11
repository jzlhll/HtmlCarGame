const escape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// 内部仍用斜杠保存分数，所有数学展示统一转换为课本式分式。
export function mathText(text){
  return escape(text).replace(/\b(\d+)\/(\d+)\b/g,(_,num,den)=>'<math class="math-fraction" displaystyle="true" aria-label="'+den+' 分之 '+num+'"><mfrac><mn>'+num+'</mn><mn>'+den+'</mn></mfrac></math>');
}
