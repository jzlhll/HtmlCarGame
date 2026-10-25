import { SUPPLIES } from './config.js';
export const SUPPLY_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs><linearGradient id="crate-metal" x2="1" y2="1"><stop stop-color="#edbf65"/><stop offset=".5" stop-color="#a76a31"/><stop offset="1" stop-color="#5f3c2e"/></linearGradient></defs><path d="M7 20L32 7l25 13v31L32 62 7 51z" fill="url(#crate-metal)" stroke="#ffdc87" stroke-width="3"/><path d="M7 20l25 13 25-13M32 33v29" fill="none" stroke="#ffe5a1" stroke-width="3"/><path d="M18 14l25 13v29M44 13L20 26v30" stroke="#8ee4d8" stroke-width="5"/><path d="M32 15l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fff1b6"/><path d="M9 24v25l21 9V35Z" fill="#f6ce7b" opacity=".14"/><path d="M35 36v22l19-9V25Z" fill="#301d26" opacity=".22"/><path d="M28 32h8v11h-8Z" fill="#263b4a" stroke="#ffe2a0"/><path d="M30 35h4v4h-4Z" fill="#9bfde0"/><g fill="#ffe3a3"><circle cx="11" cy="26" r="1.5"/><circle cx="11" cy="47" r="1.5"/><circle cx="53" cy="26" r="1.5"/><circle cx="53" cy="47" r="1.5"/></g></svg>';
export function supplySpriteRecipe(){return {format:1,svg:SUPPLY_SVG,width:SUPPLIES.width,height:SUPPLIES.height,padding:SUPPLIES.spritePadding,ratio:Math.max(SUPPLIES.spriteMinPixelRatio,Math.ceil(devicePixelRatio||1)),shadow:SUPPLIES.shadow};}
export async function decodeSupplySprite(source){const image=new Image();image.src=source;await image.decode();return image;}
// 与原 CSS 相同的串联阴影只在准备期栅格化一次，游玩共享已解码图片。
export async function generateSupplySprite(recipe){
  const image=await decodeSupplySprite('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(recipe.svg)),canvas=document.createElement('canvas'),r=recipe.ratio;
  canvas.width=(recipe.width+recipe.padding*2)*r;canvas.height=(recipe.height+recipe.padding*2)*r;
  const context=canvas.getContext('2d');if(!context||!('filter' in context))throw new Error('Canvas filters unavailable');
  context.filter=recipe.shadow.map(([x,y,blur,color])=>'drop-shadow('+x*r+'px '+y*r+'px '+blur*r+'px '+color+')').join(' ');
  context.drawImage(image,recipe.padding*r,recipe.padding*r,recipe.width*r,recipe.height*r);
  return canvas.toDataURL('image/png');
}
