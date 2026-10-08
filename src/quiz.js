import { POEMS, POEM_PAIRS, POEM_HALVES } from './poems.js';
import { ENGLISH_BOOKS } from './english.js';
import { POLICE } from './config.js';

// 警车拦查答题：数学、语文、英语各约三分之一，固定范围随机出题。
// 数学:随机抽取三至五年级；五年级按北师大版设计(小数加减/乘除、分数加减、因数与倍数)。
// 语文:诗句→朝代作者、上下句衔接、2/4 字挖空三种题型;题池固定为二至五年级。
// 英语覆盖沪教牛津版三上、三下、四上、四下：单词缺两字母、句子选词两种题型。
// 选项以字符串表示，正确答案唯一，统一返回 {subject, text, options:[4 个字符串], answer:正确下标}。
// 题目随机统一走 rng():默认 Math.random,传入种子函数后自动化验证可复现具体题目;
// rng 为模块级可替换引用,makeQuestion 同步生成完毕即返回,无并发问题。
let rng=Math.random;
const ri=(low,high)=>low+Math.floor(rng()*(high-low+1));
const chance=.5;
const BLANK='（　　）';
const gcd=(a,b)=>b?gcd(b,a%b):a;
const fmtHundredths=h=>String(h/100); // 短表示自动去尾零,如 70 → "0.7"。
const fmtTenths=t=>String(t/10);
const pick=array=>array[Math.floor(rng()*array.length)];

// ---------- 数学:三、四年级整数口算 ----------
function buildInteger(grade){
  if(grade===3){
    if(rng()<chance){const b=ri(2,9),answer=ri(2,9);return {text:b*answer+' ÷ '+b,answer};}
    const a=ri(2,9),b=ri(2,9),c=ri(2,20);
    return {text:a+' × '+b+' + '+c,answer:a*b+c};
  }
  if(rng()<chance){const b=ri(3,9),c=ri(2,9),d=ri(2,30);return {text:b+' × ('+c+' + '+d+')',answer:b*(c+d)};}
  const a=ri(20,60),b=ri(2,15),c=ri(2,9);
  if(a>=b*c)return {text:a+' − '+b+' × '+c,answer:a-b*c};
  return {text:a+' + '+b+' × '+c,answer:a+b*c};
}

// ---------- 数学:北师大版五年级口算 ----------
// 全程用整数刻度计算避免浮点误差:十分/百分之一刻度表示小数,分数化简后按 "a/b" 输出。
function decimalAddSub(){
  const scale=rng()<.5?1:10; // 一位小数按十分刻度,两位小数按百分刻度。
  const a=ri(15,990)*scale,b=ri(15,990)*scale; // 均为百分之一刻度。
  if(rng()<chance)return {text:fmtHundredths(a)+' + '+fmtHundredths(b),hundredths:a+b};
  const high=Math.max(a,b),low=Math.min(a,b);
  return {text:fmtHundredths(high)+' − '+fmtHundredths(low),hundredths:high-low};
}
function decimalMultiply(){
  if(rng()<chance){ // 整数 × 一位小数,结果一位小数。
    const k=ri(2,9),a=ri(2,49); // a 为十分刻度。
    return {text:k+' × '+fmtTenths(a),tenths:k*a};
  }
  const a=ri(2,49),b=ri(2,49); // 一位小数 × 一位小数,结果两位小数,如 0.7 × 0.8 = 0.56。
  return {text:fmtTenths(a)+' × '+fmtTenths(b),hundredths:a*b};
}
function decimalDivide(){
  const k=ri(2,12); // 商为整数,保证整除。
  if(rng()<chance){const d=ri(2,9);return {text:(d*k)+' ÷ '+d,answer:k};} // 整数 dividend,如 28 ÷ 4 = 7。
  const d=ri(2,9),answer=ri(2,9); // 小数除法直接对应乘法口诀，如 5.6 ÷ 0.8 = 7。
  return {text:fmtTenths(d*answer)+' ÷ '+fmtTenths(d),answer};
}
function fractionPart(){
  const den=[4,5,6,8,9,10,12][ri(0,6)];
  if(rng()<chance){ // 同分母加减,结果不超过 1。
    const a=ri(1,den-1),b=ri(1,den-1),sum=a+b;
    if(sum<=den)return {text:a+'/'+den+' + '+b+'/'+den,num:sum,den};
    const high=Math.max(a,b),low=Math.min(a,b);
    return {text:high+'/'+den+' − '+low+'/'+den,num:high-low,den};
  }
  const a=ri(1,den-1); // 1 − a/c,北师大版五下"分数加减法"常见形式。
  return {text:'1 − '+a+'/'+den,num:den-a,den};
}
function factorQuestion(){
  if(rng()<chance){ // 最大公因数(五上第三单元"倍数与因数")。
    const a=ri(2,24),b=ri(2,24);
    return {text:a+' 和 '+b+' 的最大公因数',answer:gcd(a,b)};
  }
  const a=ri(2,12),b=ri(2,12);
  return {text:a+' 和 '+b+' 的最小公倍数',answer:a*b/gcd(a,b)};
}
function buildGrade5(){
  const kind=rng();
  if(kind<.22)return decimalAddSub();
  if(kind<.42)return decimalMultiply();
  if(kind<.62)return decimalDivide();
  if(kind<.82)return fractionPart();
  return factorQuestion();
}
// 统一数学题格式:把刻度结果折算为字符串答案与数值,便于生成同数量级的干扰项。
function normalizeMath(question){
  if(question.hundredths!==undefined)return {text:question.text,answer:fmtHundredths(question.hundredths),value:question.hundredths/100,unit:100};
  if(question.tenths!==undefined)return {text:question.text,answer:fmtTenths(question.tenths),value:question.tenths/10,unit:10};
  if(question.num!==undefined){
    const g=gcd(question.num,question.den),num=question.num/g,den=question.den/g;
    return {text:question.text,answer:den===1?String(num):num+'/'+den,value:question.num/question.den,fraction:{num,den}};
  }
  return {text:question.text,answer:String(question.answer),value:question.answer,integer:true};
}
// 乘除题固定考查小数点错位、第二数位进退位和计算错误；按整数刻度保留相同尾数。
function operationOptions(question){
  const correct=question.answer,options=[correct];
  const decimals=correct.split('.')[1]?.length??0,unit=10**decimals;
  const count=Math.round(question.value*unit);
  const push=value=>{const text=String(value);if(value>0&&!options.includes(text))options.push(text);};
  const scaled=rng()<chance?count*10/unit:count/(unit*10);
  // 题干与正确答案均为整数时不引入小数选项；整数相除得到小数时仍保留小数点错位干扰项。
  push(!question.text.includes('.')&&Number.isInteger(question.value)&&!Number.isInteger(scaled)?question.value*10:scaled);
  // 第二位按答案从右向左的数字位计数，跳过小数点；个位答案的第二位为十位。
  const offsets=rng()<chance?[-10,10]:[10,-10];
  for(const offset of offsets){if(options.length===3)break;push((count+offset)/unit);}
  // 另设末位计算错误；小数乘法使用第二位偏差，保证至少一个错误选项与答案同尾数。
  const sameTail=question.text.includes('×')&&question.text.includes('.');
  const extras=sameTail?[20,-20,30,40]:[1,-1,2,3];
  for(const offset of extras){if(options.length===4)break;push((count+offset)/unit);}
  return {text:question.text,...shuffle(options,correct)};
}
// 加减题按题干小数位对齐，至少两个错误选项保留末位，用第二数位偏差模拟漏进位、漏借位。
function addSubOptions(question){
  const correct=question.answer,options=[correct];
  const decimals=Math.max(0,...Array.from(question.text.matchAll(/\d+(?:\.(\d+))?/g),match=>match[1]?.length??0)),unit=10**decimals;
  const count=Math.round(question.value*unit),direction=rng()<chance?-1:1;
  const push=offset=>{
    const value=count+offset,text=String(value/unit);
    if(value>=0&&!options.includes(text))options.push(text);
  };
  for(const offset of [10*direction,-10*direction,20*direction,-20*direction,30]){
    if(options.length===3)break;
    push(offset);
  }
  // 另保留一个末位计算错误；答案去掉尾零时仍按题干精度生成，避免干扰项偏离过大。
  for(const offset of [direction,-direction,2*direction,-2*direction]){
    if(options.length===4)break;
    push(offset);
  }
  return {text:question.text,...shuffle(options,correct)};
}
// 分数干扰项化简后数值也不得与答案相等；因数与倍数题保持原有候选范围。
function mathOptions(question){
  if(!question.fraction&&/[×÷]/.test(question.text))return operationOptions(question);
  if(!question.fraction&&/[+−]/.test(question.text))return addSubOptions(question);
  const correct=question.answer,options=[correct];
  // 小数题候选项按刻度计数生成,再还原为短小数格式;整数题直接用数值。
  const format=value=>question.integer?String(value):question.unit===10?fmtTenths(value):fmtHundredths(value);
  const pushCount=value=>{if(!(value>=0))return;const text=format(value);if(!options.includes(text)&&options.length<4)options.push(text);};
  if(question.fraction){
    const {num,den}=question.fraction;
    const candidates=[[num+1,den],[num+2,den],[num-1,den],[num-2,den],[num,den*2],[num*2,den*3]];
    for(const [n,d] of candidates){
      if(options.length===4)break;
      if(n<=0)continue;
      const g=gcd(n,d),text=(d/g)===1?String(n/g):(n/g)+'/'+(d/g);
      if(Math.abs(n/d-question.value)<1e-9||options.includes(text))continue;
      options.push(text);
    }
  }else{
    const spread=question.integer?Math.max(4,Math.round(Math.abs(question.value)*.25)):Math.max(2,Math.round(question.unit*.12));
    let guard=0;
    while(options.length<4&&guard++<200){
      const step=ri(1,spread)*(rng()<chance?-1:1);
      pushCount(question.integer?question.value+step:Math.round(question.value*question.unit)+step);
    }
  }
  let filler=Math.round(question.value)+1,guard=0;
  while(options.length<4&&guard++<50){if(!options.includes(String(filler)))options.push(String(filler));filler++;}
  return {text:question.text,...shuffle(options,correct)};
}
function shuffle(options,correct){
  for(let i=options.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
  return {options,answer:options.indexOf(correct)};
}
function makeMathQuestion(grade){
  if(grade===5)return mathOptions(normalizeMath(buildGrade5()));
  let question;
  do{question=normalizeMath(buildInteger(grade));}while(/[×÷]/.test(question.text)&&question.value<=0);
  return mathOptions(question);
}

// ---------- 语文:二至五年级人教版古诗 ----------
const poemPool={
  poems:POEMS.filter(item=>item.grade>=2&&item.grade<=5),
  pairs:POEM_PAIRS.filter(item=>item.grade>=2&&item.grade<=5),
  halves:POEM_HALVES.filter(item=>item.grade>=2&&item.grade<=5),
};
// 题型 1:给出诗句,答朝代与作者;干扰项取其他诗人的"朝代 · 作者"。
function authorQuestion(pool){
  const poem=pick(pool.poems),half=poem.verse.split('，')[0];
  const correct=poem.dynasty+' · '+poem.author;
  const candidates=[...new Set(pool.poems.map(item=>item.dynasty+' · '+item.author).filter(name=>name!==correct))];
  if(candidates.length<3)return null;
  const options=[correct];
  while(options.length<4){
    const name=pick(candidates);
    if(!options.includes(name))options.push(name);
  }
  return {text:'「'+half+'」的作者是？',...shuffle(options,correct)};
}
// 题型 2:上下句衔接,干扰项为其他同字数诗句。
function lineQuestion(pool){
  const pair=pick(pool.pairs),askFirst=rng()<chance;
  const given=askFirst?pair.first:pair.second,answer=askFirst?pair.second:pair.first;
  const candidates=[...new Set(pool.halves.map(item=>item.text).filter(text=>text!==answer&&text!==given&&text.length===answer.length))];
  if(candidates.length<3)return null;
  const options=[answer];
  while(options.length<4&&candidates.length){
    const [value]=candidates.splice(Math.floor(rng()*candidates.length),1);
    if(!options.includes(value))options.push(value);
  }
  if(options.length<4)return null;
  return {text:'「'+given+'」的'+(askFirst?'下一句':'上一句')+'是？',...shuffle(options,answer)};
}
// 题型 3:挖空填写 2 或 4 个字,干扰项为题池其他诗句中的同长度片段。
function blankQuestion(pool){
  const half=pick(pool.halves),length=half.text.length;
  if(length<5||length>7)return null;
  const blank=length===5?2:rng()<chance?2:4;
  const start=ri(0,length-blank),correct=half.text.slice(start,start+blank);
  const segments=new Set();
  for(const item of pool.halves)for(let i=0;i+blank<=item.text.length;i++)segments.add(item.text.slice(i,i+blank));
  segments.delete(correct);
  const candidates=[...segments];
  if(candidates.length<3)return null;
  const options=[correct];
  while(options.length<4&&candidates.length){
    const [value]=candidates.splice(Math.floor(rng()*candidates.length),1);
    if(!options.includes(value))options.push(value);
  }
  if(options.length<4)return null;
  return {text:half.text.slice(0,start)+BLANK+half.text.slice(start+blank),...shuffle(options,correct)};
}
const CHINESE_TYPES=[authorQuestion,lineQuestion,blankQuestion];
function makeChinese(){
  const pool=poemPool;
  // 问作者权重为其他题型的一半；干扰项不足时，随机尝试其余题型。
  const first=rng()<POLICE.quizChineseAuthorChance?authorQuestion:rng()<chance?lineQuestion:blankQuestion;
  const types=CHINESE_TYPES.filter(build=>build!==first);
  if(rng()<chance)types.reverse();
  types.unshift(first);
  for(const build of types)for(let attempt=0;attempt<12;attempt++){
    const question=build(pool);
    if(question)return question;
  }
  // 兜底:上下句衔接不限同字数,题池必然存在配对。
  const pair=pick(pool.pairs),askFirst=rng()<chance;
  const given=askFirst?pair.first:pair.second,answer=askFirst?pair.second:pair.first;
  const candidates=[...new Set(pool.halves.map(item=>item.text).filter(text=>text!==answer&&text!==given))];
  const options=[answer];
  while(options.length<4&&candidates.length){
    const [value]=candidates.splice(Math.floor(rng()*candidates.length),1);
    if(!options.includes(value))options.push(value);
  }
  // 候选耗尽时用递增问号占位,保证四个选项互不相同。
  let marks=1;
  while(options.length<4)options.push(answer+'？'.repeat(marks++));
  return {text:'「'+given+'」的'+(askFirst?'下一句':'上一句')+'是？',...shuffle(options,answer)};
}

// ---------- 英语：按册、单元均匀抽题，两种题型各半 ----------
function makeEnglish(){
  const book=pick(ENGLISH_BOOKS),unitIndex=ri(0,book.units.length-1);
  const unit=book.units[unitIndex];
  const source={book:book.id,bookTitle:book.title,unit:unitIndex+1,unitTitle:unit.title};
  if(rng()<chance){
    const {word,meaning}=pick(unit.words);
    // 相邻两个字母分别显示下划线；中文释义明确所考词义，避免残词出现歧义。
    const starts=[];
    for(let i=0;i<word.length-1;i++)if(/^[a-z]{2}$/i.test(word.slice(i,i+2)))starts.push(i);
    const start=pick(starts),correct=word.slice(start,start+2),candidates=[];
    for(const letter of 'abcdefghijklmnopqrstuvwxyz'){
      const first=letter+correct[1],second=correct[0]+letter;
      if(first!==correct)candidates.push(first);
      if(second!==correct)candidates.push(second);
    }
    const options=[correct];
    while(options.length<4)options.push(candidates.splice(ri(0,candidates.length-1),1)[0]);
    return {...source,type:'word',text:'单词补全（'+meaning+'）：'+word.slice(0,start)+'__'+word.slice(start+2),...shuffle(options,correct)};
  }
  const [sentence,...wrong]=pick(unit.sentences),correct=sentence.match(/\{([^{}]+)\}/)[1];
  return {...source,type:'sentence',text:sentence.replace('{'+correct+'}','____'),...shuffle([correct,...wrong],correct)};
}

export function makeQuestion(seedRng){
  rng=seedRng??Math.random;
  const subject=rng();
  if(subject<1/3)return {subject:'math',...makeMathQuestion(ri(3,5))};
  if(subject>=2/3)return {subject:'english',...makeEnglish()};
  return {subject:'chinese',...makeChinese()};
}

// 结算只展示原题和填回的正确答案，不保留或重复列出四个选项。
export function answeredQuestion(question){
  const answer=question.options[question.answer];
  if(question.subject==='math')return question.text+' = '+answer;
  if(question.text.includes(BLANK))return question.text.replace(BLANK,'（'+answer+'）');
  if(/_{2,}/.test(question.text))return question.text.replace(/_{2,}/,question.type==='word'?answer:'('+answer+')');
  return question.text.replace(/[？?]$/,'')+'：'+answer;
}
