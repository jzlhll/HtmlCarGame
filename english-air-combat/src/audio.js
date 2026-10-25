import { AUDIO } from './config.js';
export class Audio {
  constructor(storage){this.storage=storage;this.context=null;this.voices=new Set();this.lastShot=-Infinity;}
  async unlock(){try{this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();}catch(error){console.warn('Audio unavailable',error);}}
  stop(){for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();}
  play(kind){const context=this.context,volume=this.storage.settings.volume;if(!context||context.state!=='running'||volume<=0)return;if(kind==='shot'){if(context.currentTime-this.lastShot<1/AUDIO.maxShotsPerSecond)return;this.lastShot=context.currentTime;}
    const notes={shot:[650,.045,'sine'],letter:[880,.1,'sine'],undo:[260,.14,'triangle'],success:[1046,.28,'sine'],wrong:[110,.28,'sawtooth'],shell:[170,.18,'triangle'],kill:[65,.25,'sawtooth'],hurt:[160,.22,'square'],won:[784,.65,'sine'],lost:[130,.6,'triangle'],tick:[540,.05,'sine']}[kind];if(!notes)return;
    const [frequency,duration,type]=notes,oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.exponentialRampToValueAtTime(kind==='success'||kind==='won'?frequency*1.5:frequency*.55,now+duration);gain.gain.setValueAtTime(volume*(kind==='shot'?.06:.13),now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain).connect(context.destination);this.voices.add(oscillator);oscillator.onended=()=>{this.voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start();oscillator.stop(now+duration+.02);
  }
}
