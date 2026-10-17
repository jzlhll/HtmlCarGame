import { KEYBOARD_TRAINING } from './config.js';
const STORAGE_KEY='htmlCarGame.childMode.v1';
const keyPool=[...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',label=>({code:'Key'+label,label})),...Array.from('0123456789',label=>({code:'Digit'+label,label})),{code:'Comma',label:',',name:'逗号（，）'},{code:'Period',label:'.',name:'句号（。）'},{code:'Semicolon',label:';',name:'分号（；）'}];
const trainingKey=code=>keyPool.some(key=>key.code===code);
function makeTask(count,rng=Math.random){
  const pool=[...keyPool],keys=[];
  while(keys.length<count)keys.push(pool.splice(Math.floor(rng()*pool.length),1)[0]);
  return {keys,index:0};
}
function taskMarkup(task){
  const current=task.keys[task.index];
  return '<div class="key-sequence" aria-label="按键顺序">'+task.keys.map((key,index)=>'<kbd class="'+(index<task.index?'key-done':index===task.index?'key-current':'key-waiting')+'"'+(index===task.index?' aria-current="step"':'')+'>'+key.label+'</kbd>').join('')+'</div><div class="key-progress" role="status" aria-live="polite">已完成 '+task.index+' / '+task.keys.length+(current?' · 请按 '+(current.name??current.label):' · 完成')+'</div>';
}
// 本机儿童模式独立保存；Pages 发布时以无训练功能的模块替换。
export class KeyboardMode {
  constructor(){
    try{this.enabled=localStorage.getItem(STORAGE_KEY)!=='false';}catch{this.enabled=true;}
    this.startTask=null;
  }
  setEnabled(enabled){
    this.enabled=enabled;this.resetStart();
    try{localStorage.setItem(STORAGE_KEY,String(enabled));return true;}catch{return false;}
  }
  resetStart(){this.startTask=null;}
  startReady(){return !this.enabled||this.startTask?.index===KEYBOARD_TRAINING.startCount;}
  optionMarkup(){return '<label class="debug-option child-option"><input type="checkbox" data-action="child-mode"'+(this.enabled?' checked':'')+'><span>儿童模式</span></label>';}
  startMarkup(){
    if(!this.enabled)return null;
    this.startTask??=makeTask(KEYBOARD_TRAINING.startCount);
    return '<div class="keyboard-start"><div class="keyboard-title">依次找到这 '+KEYBOARD_TRAINING.startCount+' 个按键，开始这一程</div>'+taskMarkup(this.startTask)+'<small>直接按键盘，无需 Shift；按错后继续找当前按键。</small></div>';
  }
  makeRescueQuestion(rng){
    if(!this.enabled||rng()>=KEYBOARD_TRAINING.rescueChance)return null;
    return {subject:'keyboard',subjectLabel:'找按键',text:'依次找到下面 '+KEYBOARD_TRAINING.rescueCount+' 个按键',...makeTask(KEYBOARD_TRAINING.rescueCount,rng),seconds:KEYBOARD_TRAINING.rescueSeconds};
  }
  quizMarkup(question){
    if(question.subject!=='keyboard')return null;
    return taskMarkup(question)+'<p class="key-instructions">直接按键盘，无需 Shift。按错或超时会结束本局。</p>';
  }
  answerText(question){return question.subject==='keyboard'?'按键顺序：'+question.keys.map(key=>key.name??key.label).join(' → '):null;}
  handleKey(event,game){
    const starting=this.enabled&&['READY','RESULT'].includes(game.state),rescue=game.state==='QUIZ'&&game.quiz?.subject==='keyboard';
    if(!starting&&!rescue)return false;
    // Tab 保留焦点导航；自动重复、上档键及非题目按键均不能推进。
    if(event.code==='Tab')return false;
    if(event.repeat||event.shiftKey)return true;
    if(rescue&&game.quizRemaining()<=0){game.die('quizTimeout');return true;}
    const code=event.code.replace(/^Numpad([0-9])$/,'Digit$1');
    if(!trainingKey(code))return true;
    if(starting)this.startTask??=makeTask(KEYBOARD_TRAINING.startCount);
    const task=starting?this.startTask:game.quiz;
    if(code!==task.keys[task.index]?.code){if(rescue)game.die('quizWrong');return true;}
    task.index++;
    if(task.index===task.keys.length){if(starting)game.start();else game.passQuiz(true);}
    else game.onChange();
    return true;
  }
}
