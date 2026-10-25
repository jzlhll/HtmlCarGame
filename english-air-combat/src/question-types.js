import { CHOICES } from './config.js';
import { shuffle } from './random.js';
export function questionTypeBag(choiceOnly,random){
  const mix=CHOICES.mix[choiceOnly?'touch':'desktop'];
  return shuffle(Object.entries(mix).flatMap(([kind,ratio])=>Array.from({length:Math.round(ratio*CHOICES.batchSize)},()=>kind)),random);
}
