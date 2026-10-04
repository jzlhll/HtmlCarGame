const keys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space']);
const editing=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
export class Input {
  constructor(container){
    this.container=container;this.pressed=new Set();this.onSpace=()=>{};this.onBlur=()=>{};
    // 页面层捕获游戏按键，焦点移到页面本身也能继续操作；保留输入框与浏览器快捷键。
    window.addEventListener('keydown',event=>{
      if(!keys.has(event.code)||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||editing(event.target))return;
      event.preventDefault();
      if(!container.contains(document.activeElement))container.focus({preventScroll:true});
      // 上箭头不执行游戏操作，也不触发浏览器滚动或光标导航。
      if(event.code==='ArrowUp')return;
      if(event.code==='Space'){if(!event.repeat)this.onSpace();return;}
      this.pressed.add(event.code);
    },true);
    window.addEventListener('keyup',event=>{if(keys.has(event.code)){if(!event.altKey&&!event.ctrlKey&&!event.metaKey&&!editing(event.target))event.preventDefault();this.pressed.delete(event.code);}},true);
    window.addEventListener('blur',()=>{this.clear();this.onBlur();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();this.onBlur();}});
    container.addEventListener('pointerdown',event=>{if(!event.target.closest('button,summary'))container.focus({preventScroll:true});});
  }
  get down(){return this.pressed.has('ArrowDown');}
  get lateral(){return (this.pressed.has('ArrowRight')?1:0)-(this.pressed.has('ArrowLeft')?1:0);}
  clear(){this.pressed.clear();}
}
