const keys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space']);
// 答题状态用数字键 1–4 或字母键 A–D 选择选项;不进入持续按下集合。
const quizKeys={Digit1:0,Digit2:1,Digit3:2,Digit4:3,KeyA:0,KeyB:1,KeyC:2,KeyD:3,Numpad1:0,Numpad2:1,Numpad3:2,Numpad4:3};
const editing=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
export class Input {
  constructor(container){
    this.container=container;this.pressed=new Set();this.lateralSeconds=0;this.lateralDirection=0;this.onSpace=()=>{};this.onBlur=()=>{};this.onQuiz=null;
    // 页面层捕获游戏按键，焦点移到页面本身也能继续操作；保留输入框与浏览器快捷键。
    window.addEventListener('keydown',event=>{
      if(event.isComposing||event.altKey||event.ctrlKey||event.metaKey||editing(event.target))return;
      if(this.onQuiz&&quizKeys[event.code]!==undefined){event.preventDefault();this.onQuiz(quizKeys[event.code]);return;}
      if(!keys.has(event.code))return;
      event.preventDefault();
      if(!container.contains(document.activeElement))container.focus({preventScroll:true});
      if(event.code==='Space'){if(!event.repeat)this.onSpace();return;}
      const lateral=this.lateral;this.pressed.add(event.code);
      if(this.lateral!==lateral){this.lateralSeconds=0;this.lateralDirection=this.lateral;}
    },true);
    window.addEventListener('keyup',event=>{if(keys.has(event.code)){if(!event.altKey&&!event.ctrlKey&&!event.metaKey&&!editing(event.target))event.preventDefault();const lateral=this.lateral;this.pressed.delete(event.code);if(this.lateral!==lateral){this.lateralSeconds=0;this.lateralDirection=this.lateral;}}},true);
    window.addEventListener('blur',()=>{this.clear();this.onBlur();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();this.onBlur();}});
    container.addEventListener('pointerdown',event=>{if(!event.target.closest('button,summary,input,label'))container.focus({preventScroll:true});});
  }
  get down(){return this.pressed.has('ArrowDown');}
  get nitro(){return this.pressed.has('ArrowUp');}
  get lateral(){return (this.pressed.has('ArrowRight')?1:0)-(this.pressed.has('ArrowLeft')?1:0);}
  advance(dt){
    const lateral=this.lateral;
    if(lateral!==this.lateralDirection)this.lateralSeconds=0;
    this.lateralDirection=lateral;this.lateralSeconds=lateral?this.lateralSeconds+dt:0;
  }
  clear(){this.pressed.clear();this.lateralSeconds=0;this.lateralDirection=0;}
}
