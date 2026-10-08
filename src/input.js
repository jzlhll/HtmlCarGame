import { MOBILE } from './config.js';
const keys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space']);
// 答题状态用数字键 1–4 或字母键 A–D 选择选项;不进入持续按下集合。
const quizKeys={Digit1:0,Digit2:1,Digit3:2,Digit4:3,KeyA:0,KeyB:1,KeyC:2,KeyD:3,Numpad1:0,Numpad2:1,Numpad3:2,Numpad4:3};
const editing=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
export class Input {
  constructor(container){
    this.container=container;this.pressed=new Set();this.lateralSeconds=0;this.lateralDirection=0;this.onSpace=()=>{};this.onBlur=()=>{};this.onQuiz=null;
    this.touchPressed=new Set();this.touchPointers=new Map();this.stickPointer=null;this.onLayoutChange=()=>{};
    this.stick=document.getElementById('steering-stick');this.thumb=document.getElementById('stick-thumb');
    this.coarsePointer=window.matchMedia('(pointer: coarse)');this.compactWindow=window.matchMedia('(max-width: '+MOBILE.compactWidth+'px)');
    const syncViewport=()=>{
      const viewport=window.visualViewport,w=viewport?.width||window.innerWidth,h=viewport?.height||window.innerHeight;
      const touchMode=!!(navigator.userAgentData?.mobile||this.coarsePointer.matches||this.compactWindow.matches||(navigator.maxTouchPoints>0&&/Android|iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)));
      const landscape=touchMode&&w>h,changed=touchMode!==this.touchMode||landscape!==this.landscape;
      this.touchMode=touchMode;this.landscape=landscape;
      container.classList.toggle('touch-mode',touchMode);container.classList.toggle('landscape',landscape);
      container.style.setProperty('--viewport-height',h+'px');
      document.getElementById('portrait-hint').hidden=!landscape;
      if(changed){this.clear();this.onLayoutChange();}
    };
    window.addEventListener('resize',syncViewport);window.visualViewport?.addEventListener('resize',syncViewport);
    this.coarsePointer.addEventListener('change',syncViewport);this.compactWindow.addEventListener('change',syncViewport);syncViewport();
    this.bindTouch();
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
  get down(){return this.pressed.has('ArrowDown')||this.touchPressed.has('ArrowDown');}
  get nitro(){return this.pressed.has('ArrowUp')||this.touchPressed.has('ArrowUp');}
  get lateral(){return (this.pressed.has('ArrowRight')||this.touchPressed.has('ArrowRight')?1:0)-(this.pressed.has('ArrowLeft')||this.touchPressed.has('ArrowLeft')?1:0);}
  bindTouch(){
    const controls=document.getElementById('touch-controls');
    const available=()=>this.touchMode&&!this.landscape&&!controls.hidden;
    controls.addEventListener('contextmenu',event=>event.preventDefault());
    // 每根手指独立捕获，拖出按钮仍保持操作；取消、失焦或切换状态统一释放。
    for(const [id,key] of [['touch-brake','ArrowDown'],['touch-nitro','ArrowUp']]){
      const button=document.getElementById(id);
      button.addEventListener('pointerdown',event=>{
        if(!available()||event.button!==0||[...this.touchPointers.values()].some(pointer=>pointer.button===button))return;
        event.preventDefault();button.setPointerCapture(event.pointerId);
        this.touchPointers.set(event.pointerId,{button,key});this.touchPressed.add(key);
        button.classList.add('held');button.setAttribute('aria-pressed','true');
      });
      const release=event=>{
        const pointer=this.touchPointers.get(event.pointerId);if(!pointer||pointer.button!==button)return;
        this.touchPointers.delete(event.pointerId);this.touchPressed.delete(key);
        button.classList.remove('held');button.setAttribute('aria-pressed','false');
        if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
      };
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
    }
    const move=event=>{
      if(event.pointerId!==this.stickPointer)return;
      event.preventDefault();
      const rect=this.stick.getBoundingClientRect(),travel=rect.width*MOBILE.stickTravelRatio;
      let x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2;
      const distance=Math.hypot(x,y);if(distance>travel){x*=travel/distance;y*=travel/distance;}
      this.thumb.style.transform='translate('+x+'px,'+y+'px)';
      const previous=this.lateral;
      this.touchPressed.delete('ArrowLeft');this.touchPressed.delete('ArrowRight');
      if(Math.abs(x)>travel*MOBILE.stickDeadZone)this.touchPressed.add(x>0?'ArrowRight':'ArrowLeft');
      if(previous!==this.lateral){this.lateralSeconds=0;this.lateralDirection=this.lateral;}
    };
    this.stick.addEventListener('pointerdown',event=>{
      if(!available()||this.stickPointer!==null||event.button!==0)return;
      event.preventDefault();this.stickPointer=event.pointerId;this.stick.setPointerCapture(event.pointerId);this.stick.classList.add('held');move(event);
    });
    this.stick.addEventListener('pointermove',move);
    const releaseStick=event=>{
      if(event.pointerId!==this.stickPointer)return;
      this.stickPointer=null;this.touchPressed.delete('ArrowLeft');this.touchPressed.delete('ArrowRight');
      this.thumb.style.transform='';this.stick.classList.remove('held');this.lateralSeconds=0;this.lateralDirection=this.lateral;
      if(this.stick.hasPointerCapture(event.pointerId))this.stick.releasePointerCapture(event.pointerId);
    };
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.stick.addEventListener(type,releaseStick);
  }
  advance(dt){
    const lateral=this.lateral;
    if(lateral!==this.lateralDirection)this.lateralSeconds=0;
    this.lateralDirection=lateral;this.lateralSeconds=lateral?this.lateralSeconds+dt:0;
  }
  clear(){
    this.pressed.clear();this.touchPressed.clear();this.lateralSeconds=0;this.lateralDirection=0;
    const pointers=[...this.touchPointers];this.touchPointers.clear();
    for(const [id,{button}] of pointers){button.classList.remove('held');button.setAttribute('aria-pressed','false');if(button.hasPointerCapture(id))button.releasePointerCapture(id);}
    const id=this.stickPointer;this.stickPointer=null;
    this.thumb.style.transform='';this.stick.classList.remove('held');
    if(id!==null&&this.stick.hasPointerCapture(id))this.stick.releasePointerCapture(id);
  }
}
