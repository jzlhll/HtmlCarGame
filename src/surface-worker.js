import { surfacePixels, terrainPixels, environmentPixels, mipmapPixels } from './surface-recipes.js';
import { GenerationQueue } from './generation-queue.js';

self.onmessage = async ({data: {name,width,height,manual}}) => {
  let pixels, mipmaps;
  function* generate() {
    pixels = yield* (name==='environment'?environmentPixels(width,height):name==='terrain-detail'?terrainPixels(width):surfacePixels(name,width));
    if (manual) mipmaps=yield* mipmapPixels(pixels,width,height,name.endsWith('-color'));
  }
  try {
    const queue=new GenerationQueue(generate(),{urgent:true,name:'pixels',report:false});
    queue.resume(); const stats=await queue.done;
    self.postMessage({pixels,mipmaps,cpuMs:stats.cpuMs,maxBatchMs:stats.maxBatchMs},[...new Set([pixels.buffer,...(mipmaps||[]).map(level=>level.data.buffer)])]);
  } catch (error) { self.postMessage({error:error.message}); }
};
