import { generateBossModels } from './boss-model.js';
self.onmessage=event=>{try{const data=generateBossModels(event.data),transfer=Object.values(data).flatMap(model=>Object.values(model).flatMap(part=>[part.positions.buffer,part.normals.buffer,part.colors.buffer]));self.postMessage({data},transfer);}catch(error){self.postMessage({error:String(error)});}};
