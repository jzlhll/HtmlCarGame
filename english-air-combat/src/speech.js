import { AUDIO } from './config.js';

const unusualVoice=/Albert|Bad News|Good News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Hysterical|Trinoids|Whisper|Zarvox|Organ|Superstar|Wobble|Jester|Robot/i;
const voiceLanguage=voice=>{
  const raw=String(voice?.lang||'').trim().replace(/_/g,'-').replace(/^eng(?=-|$)/i,'en');
  try{return Intl.getCanonicalLocales(raw)[0]||'';}catch{return /^en(?:-|$)/i.test(raw)?raw.split('-').slice(0,2).join('-'):raw;}
};
const voiceScore=voice=>{
  const name=voice.name||'',lang=voiceLanguage(voice);let score=lang==='en-US'?35:lang==='en-GB'?25:15;
  if(/Samantha/i.test(name))score+=1000;
  else if(/Google US English|Microsoft.*(Aria|Jenny|Ava)|Ava.*English/i.test(name))score+=950;
  else if(/Karen|Tessa|Serena|Moira|Allison|Susan|Sonia|Emma|Victoria/i.test(name))score+=850;
  else if(/Daniel|Alex|Tom|Google.*English|Microsoft.*(Guy|Ryan)/i.test(name))score+=650;
  if(/enhanced|premium|natural|neural/i.test(name))score+=50;
  return score;
};

export class Speech {
  constructor(notice){
    this.notice=notice;this.current=null;this.pendingCancel=null;this.preferred=null;
    window.addEventListener('blur',()=>this.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
    // Android Edge 可能尚未初始化系统语音，页面启动时不枚举声音。
  }
  stop(){
    this.pendingCancel?.();this.pendingCancel=null;this.current=null;
    try{window.speechSynthesis?.cancel?.();}catch(error){console.warn('English word cancellation failed',error);}
  }
  englishVoices(){
    try{return Array.from(window.speechSynthesis.getVoices?.()||[]).filter(voice=>{
      const lang=voiceLanguage(voice);return (/^en(?:-|$)/i.test(lang)||!lang&&/English|Samantha/i.test(voice.name||''))&&!unusualVoice.test(voice.name||'');
    }).sort((a,b)=>voiceScore(b)-voiceScore(a));}
    catch(error){console.warn('English voice enumeration failed',error);return [];}
  }
  play(word){
    this.stop();const synth=window.speechSynthesis;
    if(!synth||typeof synth.speak!=='function'||typeof SpeechSynthesisUtterance==='undefined'){this.notice('此浏览器暂不支持单词朗读');return;}
    const text=String(word||'').trim();if(!text)return;
    let active=true,timer=null,live=null,started=false;const tried=new Set();
    const clearAttempt=()=>{
      clearTimeout(timer);timer=null;
      if(live){live.onstart=null;live.onboundary=null;live.onerror=null;live.onend=null;if(this.current===live)this.current=null;}
    };
    const finish=message=>{if(!active)return;active=false;clearAttempt();this.pendingCancel=null;if(message)this.notice(message);};
    this.pendingCancel=()=>{active=false;clearAttempt();};
    const key=plan=>[plan.voice?.voiceURI||plan.voice?.name||'',plan.voice?.lang||'',plan.lang,plan.neutral].join('|');
    const fallback=()=>{
      // 声音枚举只发生在首次 speak 之后；列表为空也继续尝试系统默认路径。
      if(tried.size>=AUDIO.speechMaxAttempts-1){const plan={lang:'',neutral:true};return tried.has(key(plan))?null:plan;}
      const voices=this.englishVoices().slice(0,AUDIO.speechFallbackVoices),plans=[
        {lang:'en',neutral:true},
        ...voices.map(voice=>({voice,lang:voiceLanguage(voice)||'en',neutral:true})),
        {lang:'en-US',neutral:true},{lang:'en-GB',neutral:true},{lang:'',neutral:true}
      ];
      return plans.find(plan=>!tried.has(key(plan)));
    };
    const failed=(error,utterance)=>{
      if(!active||this.current!==utterance)return;
      const wasStarted=started;clearAttempt();this.preferred=null;
      // 先解绑旧事件再取消，防止旧取消回调触发下一条朗读。
      try{synth.cancel?.();}catch(cancelError){console.warn('English fallback cancellation failed',cancelError);}
      console.warn('English word playback failed',JSON.stringify({error,started:wasStarted,attempt:tried.size}));
      if(error==='not-allowed'){finish('系统阻止了朗读，请再次点击朗读按钮');return;}
      if(wasStarted){finish('朗读被系统中断，请再次点击重试');return;}
      if(['audio-busy','audio-hardware'].includes(error)){finish('系统音频暂不可用，请稍后再试');return;}
      if(document.hidden){finish();return;}
      // 给取消队列一次释放机会，下一次点击、切词或失焦会取消这次回退。
      timer=setTimeout(()=>{if(!active)return;const plan=fallback();if(plan)attempt(plan);else finish('系统朗读的多种方式均未成功，请检查手机的文字转语音设置');},AUDIO.speechRetryMilliseconds);
    };
    const attempt=plan=>{
      if(!active)return;started=false;tried.add(key(plan));
      let utterance;
      try{
        utterance=new SpeechSynthesisUtterance(text);live=utterance;this.current=utterance;
        if(plan.lang)utterance.lang=plan.lang;if(plan.voice)utterance.voice=plan.voice;
        utterance.rate=plan.neutral?1:AUDIO.speechRate;utterance.pitch=plan.neutral?1:AUDIO.speechPitch;utterance.volume=AUDIO.speechVolume;
        const onStarted=()=>{
          if(!active||this.current!==utterance||started)return;started=true;clearTimeout(timer);timer=null;
          // 成功后才能安全枚举并优选后续播放的自然英语声音。
          this.preferred=plan.lang?(plan.voice||this.englishVoices()[0]||null):null;
          console.info('English word playback started',JSON.stringify({voice:plan.voice?.name||'system-default',language:plan.lang||'system-default',rate:utterance.rate,attempt:tried.size}));
        };
        utterance.onstart=onStarted;utterance.onboundary=onStarted;
        utterance.onend=()=>{if(active&&this.current===utterance)finish();};
        utterance.onerror=event=>{
          if(!active||this.current!==utterance)return;
          if(['canceled','interrupted'].includes(event.error)){finish();return;}
          failed(event.error||'synthesis-failed',utterance);
        };
        timer=setTimeout(()=>{
          if(!active||this.current!==utterance||started)return;
          if(synth.speaking&&!synth.paused){onStarted();return;}
          failed('start-timeout',utterance);
        },AUDIO.speechStartMilliseconds);
        if(synth.paused&&typeof synth.resume==='function'){try{synth.resume();}catch(error){console.warn('English word resume failed',error);}}
        synth.speak(utterance);
      }catch(error){
        console.warn('English word playback exception',error);
        if(utterance)failed('synthesis-failed',utterance);else finish('此浏览器暂时无法创建系统朗读');
      }
    };
    // 首次播放在点击调用栈内直接进入系统 TTS，不等待声音列表事件。
    attempt(this.preferred?{voice:this.preferred,lang:voiceLanguage(this.preferred)||'en',neutral:false}:{lang:'en',neutral:false});
  }
}
