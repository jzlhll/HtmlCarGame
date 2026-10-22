import { AUDIO } from './config.js';
export class Speech {
  constructor(notice){this.notice=notice;this.current=null;this.pendingCancel=null;window.addEventListener('blur',()=>this.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});if('speechSynthesis'in window)window.speechSynthesis.getVoices();}
  stop(){this.pendingCancel?.();this.pendingCancel=null;if('speechSynthesis'in window)window.speechSynthesis.cancel();this.current=null;}
  englishVoice(){
    const unusual=/Albert|Bad News|Good News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Hysterical|Trinoids|Whisper|Zarvox|Organ|Superstar|Wobble|Jester|Robot/i;
    const voices=window.speechSynthesis.getVoices().filter(voice=>/^en(?:[-_]|$)/i.test(voice.lang)&&!unusual.test(voice.name));
    const score=voice=>{
      const name=voice.name;let value=/^en[-_]US$/i.test(voice.lang)?35:/^en[-_]GB$/i.test(voice.lang)?25:15;
      if(/Samantha/i.test(name))value+=1000;
      else if(/Google US English|Microsoft.*(Aria|Jenny|Ava)|Ava.*English/i.test(name))value+=950;
      else if(/Karen|Tessa|Serena|Moira|Allison|Susan|Sonia|Emma|Victoria/i.test(name))value+=850;
      else if(/Daniel|Alex|Tom|Google.*English|Microsoft.*(Guy|Ryan)/i.test(name))value+=650;
      if(/enhanced|premium|natural|neural/i.test(name))value+=50;
      return value;
    };
    return voices.sort((a,b)=>score(b)-score(a))[0];
  }
  play(word){
    this.stop();if(!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance==='undefined'){this.notice('此浏览器暂不支持单词朗读');return;}
    const voice=this.englishVoice();if(voice){this.speak(word,voice);return;}
    const synth=window.speechSynthesis,ready=()=>{const available=this.englishVoice();if(!available)return;this.pendingCancel?.();this.pendingCancel=null;this.speak(word,available);};
    const timer=setTimeout(()=>{this.pendingCancel?.();this.pendingCancel=null;this.notice('英语语音不可用，请在系统中安装英语语音');},1600);synth.addEventListener('voiceschanged',ready);this.pendingCancel=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',ready);};
  }
  speak(word,voice){
    const utterance=new SpeechSynthesisUtterance(word);utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=AUDIO.speechRate;utterance.pitch=AUDIO.speechPitch;utterance.volume=AUDIO.speechVolume;
    utterance.onstart=()=>console.info('English word playback started',JSON.stringify({voice:voice.name,language:voice.lang,rate:utterance.rate}));
    utterance.onerror=event=>{if(this.current!==utterance||['canceled','interrupted'].includes(event.error))return;this.current=null;this.notice('英语语音暂不可用，请检查系统语音设置');};utterance.onend=()=>{if(this.current===utterance)this.current=null;};this.current=utterance;window.speechSynthesis.speak(utterance);
  }
}
