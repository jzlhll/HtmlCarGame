export class Input {
  constructor(game,onAction){this.game=game;this.onAction=onAction;this.keys=new Set();this.letters=[];this.segment=0;this.undo=false;this.erase=false;this.shell=false;this.selection=null;window.addEventListener('keydown',event=>this.down(event));window.addEventListener('keyup',event=>this.up(event));window.addEventListener('blur',()=>this.clear());}
  down(event){
    const code=event.code;if(this.game.state==='review'){if(event.target.closest?.('[data-recap-scroll]'))return;event.preventDefault();return;}
    if(event.target.closest?.('input,textarea,select,[contenteditable="true"]')||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
    if(['ArrowUp','ArrowDown'].includes(code)&&(!['playing','paused'].includes(this.game.state)||this.game.victoryRemaining==null))return;
    const letter=/^Key[A-Z]$/.test(code)?code.slice(3):null,number=/^(Digit|Numpad)[1-4]$/.test(code)?Number(code.at(-1))-1:null;
    if(!letter&&number===null&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Escape','Backquote','Backspace','ShiftLeft','ShiftRight'].includes(code))return;
    if(event.target.closest?.('button,a')&&code==='Space')return;
    event.preventDefault();if(event.repeat||this.keys.has(code))return;this.keys.add(code);
    if(this.game.state!=='playing'){this.onAction(code);return;}
    if(code==='Space'||code==='Escape'){this.onAction(code);return;}
    if(letter){this.letters.push(letter);this.segment++;}
    if(code==='Backquote'||code==='Backspace'){if(code==='Backspace')this.erase=true;else this.undo=true;this.letters=[];this.segment++;}
    if(code.startsWith('Shift'))this.shell=true;
    if(number!==null){this.selection=number;this.letters=[];this.segment++;}
  }
  up(event){this.keys.delete(event.code);if(/^Key[A-Z]$/.test(event.code)){const previous=this.letter;this.letters=this.letters.filter(letter=>letter!==event.code.slice(3));if(previous!==this.letter&&this.letter)this.segment++;}}
  get letter(){return this.letters.at(-1)||'';}
  get axis(){return Number(this.keys.has('ArrowRight'))-Number(this.keys.has('ArrowLeft'));}
  get verticalAxis(){return Number(this.keys.has('ArrowDown'))-Number(this.keys.has('ArrowUp'));}
  consume(){const actions={undo:this.undo,erase:this.erase,shell:this.shell,selection:this.selection};this.undo=false;this.erase=false;this.shell=false;this.selection=null;return actions;}
  clear(){this.keys.clear();this.letters=[];this.undo=false;this.erase=false;this.shell=false;this.selection=null;this.segment++;}
}
