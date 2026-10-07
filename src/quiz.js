import { POEMS, POEM_PAIRS, POEM_HALVES, POEM_AUTHORS } from './poems.js';

// 警车拦查答题:数学与人教版语文古诗各约 50% 随机出现。
// 数学:1–4、6 年级为通用口算;5 年级按北师大版设计(小数加减/乘除、分数加减、因数与倍数)。
// 语文:诗句→朝代作者、上下句衔接、2/4 字挖空三种题型;题池覆盖本年级及前两个年级(如五年级考 3–5 年级)。
// 选项以字符串表示,正确答案唯一,统一返回 {text, options:[4 个字符串], answer:正确下标}。
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

// ---------- 数学:整数口算(1–4、6 年级) ----------
function buildInteger(grade){
  if(grade===1){
    const a=ri(2,18),b=ri(1,15);
    if(a>=b&&rng()<chance)return {text:a+' − '+b,answer:a-b};
    return {text:a+' + '+b,answer:a+b};
  }
  if(grade===2){
    if(rng()<chance){const a=ri(2,9),b=ri(2,9);return {text:a+' × '+b,answer:a*b};}
    const a=ri(12,88),b=ri(3,20);
    if(a>=b&&rng()<chance)return {text:a+' − '+b,answer:a-b};
    return {text:a+' + '+b,answer:a+b};
  }
  if(grade===3){
    if(rng()<chance){const b=ri(2,9),answer=ri(2,9);return {text:b*answer+' ÷ '+b,answer};}
    const a=ri(2,9),b=ri(2,9),c=ri(2,20);
    return {text:a+' × '+b+' + '+c,answer:a*b+c};
  }
  if(grade===4){
    if(rng()<chance){const b=ri(3,9),c=ri(2,9),d=ri(2,30);return {text:b+' × ('+c+' + '+d+')',answer:b*(c+d)};}
    const a=ri(20,60),b=ri(2,15),c=ri(2,9);
    if(a>=b*c)return {text:a+' − '+b+' × '+c,answer:a-b*c};
    return {text:a+' + '+b+' × '+c,answer:a+b*c};
  }
  const a=ri(2,9),b=ri(2,12),c=ri(2,9),d=ri(2,9);
  if(rng()<chance)return {text:'('+a+' + '+b+') × ('+c+' + '+d+')',answer:(a+b)*(c+d)};
  return {text:'('+a+' + '+b+') × '+c+' − '+d+' × '+a,answer:(a+b)*c-d*a};
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
  const d=ri(2,49); // 除数为一位小数,如 7.2 ÷ 0.8 = 9。
  return {text:fmtTenths(d*k)+' ÷ '+fmtTenths(d),answer:k};
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
// 干扰项与正确答案同数量级且互不相同;分数干扰项化简后数值也不得与答案相等。
function mathOptions(question){
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
  return mathOptions(normalizeMath(buildInteger(grade)));
}

// ---------- 语文:人教版古诗(题池覆盖本年级及前两个年级) ----------
const poemPool=grade=>{
  const low=Math.max(1,grade-2);
  return {
    poems:POEMS.filter(item=>item.grade>=low&&item.grade<=grade),
    pairs:POEM_PAIRS.filter(item=>item.grade>=low&&item.grade<=grade),
    halves:POEM_HALVES.filter(item=>item.grade>=low&&item.grade<=grade),
  };
};
// 题型 1:给出诗句,答朝代与作者;干扰项取其他诗人的"朝代 · 作者"。
function authorQuestion(pool){
  const poem=pick(pool.poems),half=poem.verse.split('，')[0];
  const correct=poem.dynasty+' · '+poem.author;
  const candidates=[...new Set(POEM_AUTHORS.filter(name=>name!==correct))];
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
function makeChinese(grade){
  const pool=poemPool(grade);
  // 依次尝试各题型,单个题型干扰项不足时自动换题或换题型;
  // 打乱副本而非原数组,模块级状态不残留,同种子重复出题结果一致。
  const types=[...CHINESE_TYPES];
  for(let i=types.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
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

export function makeQuestion(grade,seedRng){
  rng=seedRng??Math.random;
  const g=Math.min(6,Math.max(1,grade|0||1));
  if(rng()<chance)return makeMathQuestion(g);
  return makeChinese(Math.min(5,g)); // 六年级语文使用五年级题池。
}
