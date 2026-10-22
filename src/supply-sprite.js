import { SUPPLIES } from './config.js';
export const SUPPLY_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><path d="M7 20L32 7l25 13v31L32 62 7 51z" fill="#b57b32" stroke="#ffdc87" stroke-width="3"/><path d="M7 20l25 13 25-13M32 33v29" fill="none" stroke="#ffe5a1" stroke-width="3"/><path d="M18 14l25 13v29M44 13L20 26v30" stroke="#8ee4d8" stroke-width="5"/><path d="M32 15l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fff1b6"/></svg>';
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
