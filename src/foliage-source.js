import { FOLIAGE_TEXTURE } from './config.js';

// 源图只在准备队列中解码；像素交给现有Worker处理，命中持久缓存时不读取源图。
export async function foliageSourcePixels(size){
  if(!FOLIAGE_TEXTURE.source||typeof createImageBitmap!=='function')return null;
  let bitmap;
  try{
    const response=await fetch(new URL(`./textures/${FOLIAGE_TEXTURE.source}.png`,import.meta.url));
    if(!response.ok)throw new Error('Foliage source response '+response.status);
    bitmap=await createImageBitmap(await response.blob());
    const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(size,size):document.createElement('canvas');
    canvas.width=canvas.height=size;const context=canvas.getContext('2d',{willReadFrequently:true});
    const tile=size/2,padding=Math.ceil(tile*.035);
    for(let row=0;row<2;row++)for(let col=0;col<2;col++)context.drawImage(bitmap,col*bitmap.width/2,row*bitmap.height/2,bitmap.width/2,bitmap.height/2,col*tile+padding,row*tile+padding,tile-padding*2,tile-padding*2);
    const data=context.getImageData(0,0,size,size).data;
    canvas.width=canvas.height=1;return new Uint8Array(data.buffer);
  }catch(error){console.warn('Foliage source preparation failed',error);throw error;}
  finally{bitmap?.close();}
}
