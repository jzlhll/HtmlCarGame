import { SURFACE_APPEARANCE, LANDSCAPE, FACADE_SURFACE } from './config.js';
import { foliagePixels } from './foliage-texture.js';
import { smoothRange } from './terrain.js';

const settings = SURFACE_APPEARANCE;

// 固定种子表面配方逐行生成，空闲调度器可以在任意行边界让出主线程。
function hash(x, y, salt = 0) {
  let value = Math.imul(x + settings.seed + salt, 374761393) ^ Math.imul(y + salt, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

function noise(x, y, period, salt = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smoothRange(0, 1, x - ix), fy = smoothRange(0, 1, y - iy);
  const at = (a, b) => hash((a + period) % period, (b + period) % period, salt);
  const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

export function* surfacePixels(name, size) {
  if(name==='foliage-color')return yield* foliagePixels(size);
  const pixels = new Uint8Array(size * size * 4);
  const usesPatch = name.startsWith('asphalt') || ['paint-detail', 'grass-color', 'concrete-color'].includes(name);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = hash(x, y), patch = usesPatch ? noise(x / size * 8, y / size * 8, 8) : 0, index = (y * size + x) * 4;
      // 像素直接写入缓冲区，避免每个像素创建颜色数组触发集中回收。
      let red, green, blue = 0;
      if (name.startsWith('asphalt')) {
        const crack = Math.abs(Math.sin(x / size * Math.PI * 8 + Math.sin(y / size * Math.PI * 4) * 0.8)) < 0.014 && patch > 0.5;
        const value = 82 + grain * 28 + patch * 14 - (crack ? 28 : 0);
        if (name.endsWith('color')) { red=value*0.92; green=value*0.98; blue=value; }
        else { red=100+grain*45-(crack?60:0); green=205+grain*24; }
      } else if (name === 'paint-detail') {
        const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
        const rivetX = Math.abs((x + 32) % 64 - 32), rivetY = Math.abs((y + 32) % 64 - 32);
        const rivet = (Math.abs(x - 7) < 1.5 || Math.abs(x - size + 8) < 1.5) && rivetY < 1.5 || (Math.abs(y - 7) < 1.5 || Math.abs(y - size + 8) < 1.5) && rivetX < 1.5;
        red=edge<1.5?72:rivet?95:128+grain*4; green=175+patch*32+grain*4;
      } else if (name === 'grass-color') {
        const broad = noise(x / size * 3, y / size * 3, 3, 53);
        const blade = Math.sin((x * 0.7 + y * 1.3) * Math.PI) * grain;
        red=123+broad*34+patch*16+blade*10; green=142+broad*37+patch*10+blade*12; blue=102+broad*30+grain*14;
      } else if (name === 'concrete-color') {
        const edge = Math.min(x,y,size-1-x,size-1-y), joint = edge < 1.5;
        const value = 166 + patch*19 + grain*12 - (joint ? 32 : 0);
        red=value*0.97; green=value; blue=value*0.99;
      } else if (name.startsWith('facade')) {
        const u = x / size * 8, v = y / size * 16, fx = u % 1, fy = v % 1;
        const window = fx > 0.13 && fx < 0.87 && fy > 0.15 && fy < 0.82;
        const mullion = Math.abs(fx-0.5) < 0.018,cellX=Math.floor(u),cellY=Math.floor(v),pane=hash(cellX,cellY,FACADE_SURFACE.seed);
        const blind=hash(cellX,cellY,79)>.62&&fy>.35+hash(cellX,cellY,83)*.3;
        const sill=fy>.77&&fy<.84,streak=Math.max(0,(fy-.82)/.18)*(hash(cellX,cellY,87)>.5?1:0);
        if (name.endsWith('color')) {
          const reflection=noise(x/size*4,y/size*4,4,71),lit=pane>.91;
          if(window&&!mullion){
            const room=blind?.80:1,glint=.84+pane*.28;
            red=(lit?169+reflection*30:58+reflection*48)*room*glint;
            green=(lit?161+reflection*25:84+reflection*54)*room*glint;
            blue=(lit?126+grain*12:104+reflection*48)*room*glint;
          }else{
            const shade=mullion?FACADE_SURFACE.frameShade:sill?.73:1;
            red=(161+grain*13-streak*20)*shade;green=(166+grain*12-streak*18)*shade;blue=(159+grain*11-streak*16)*shade;
          }
        }else{
          red=window&&!mullion?85+(blind?10:0):sill?132:158;
          green=window&&!mullion?80+pane*30:220;
          blue=window&&!mullion?255:0;
        }
      } else if (name === 'rubber-detail') {
        const groove = Math.abs(Math.sin(y / size * Math.PI * 8)) < 0.16;
        red=groove?60:130+grain*12; green=234+grain*16;
      } else if (name === 'panel-detail') { red=106+grain*40; green=226+grain*22; }
      else { red=120+grain*12+Math.sin(x*Math.PI/2)*6; green=160+hash(x,0)*34+grain*8; }
      pixels[index] = Math.round(Math.max(0, Math.min(255, red)));
      pixels[index+1] = Math.round(Math.max(0, Math.min(255, green)));
      pixels[index+2] = Math.round(Math.max(0, Math.min(255, blue)));
      pixels[index+3] = 255;
      if ((x+1)%256===0) yield;
    }
    yield;
  }
  return pixels;
}

export function* terrainPixels(size) {
  const data = new Uint8Array(size * size * 4);
  let seed = LANDSCAPE.seed;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const layers = [];
  for (const period of [4, 8, 16, 32, 64, 128]) {
    const values = new Float32Array(period * period);
    for (let row = 0; row < period; row++) {
      for (let column = 0; column < period; column++) values[row * period + column] = random();
      yield;
    }
    layers.push({period, values});
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0, weight = 0.5;
      for (const {period, values} of layers) {
        const u = x / size * period, v = y / size * period, ix = Math.floor(u), iy = Math.floor(v);
        const a = values[iy * period + ix], b = values[iy * period + (ix + 1) % period];
        const c = values[(iy + 1) % period * period + ix], d = values[(iy + 1) % period * period + (ix + 1) % period];
        const fx = smoothRange(0, 1, u - ix), fy = smoothRange(0, 1, v - iy);
        value += (a + (b - a) * fx + (c - a) * fy * (1 - fx) + (d - b) * fx * fy) * weight; weight *= 0.5;
      }
      const i = (y * size + x) * 4;
      // G保存连续节理，B保存矿物风化；准备期多花计算，飞行仍只读同一张纹理。
      const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
      const jointA=Math.abs(Math.sin(u*5+Math.sin(v*2)*.65+value*1.2));
      const jointB=Math.abs(Math.sin(v*3-u+Math.sin(u*3)*.35));
      const crack=(1-smoothRange(.015,.10,Math.min(jointA,jointB)))*(.55+value*.45);
      const mineral=.50+.24*Math.sin(u+Math.sin(v)*.55)+.17*Math.sin(v*2+Math.sin(u*2)*.4);
      data[i]=Math.round(Math.max(0,Math.min(1,value*.92+.04-crack*.10))*255);
      data[i+1]=Math.round(crack*255);data[i+2]=Math.round(Math.max(0,Math.min(1,mineral))*255);
      data[i + 3] = 255;
    }
    yield;
  }
  return data;
}

export function* environmentPixels(width, height) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = y / (height - 1), u = x / width;
      const top = v < 0.5 ? [62, 112, 157] : [180, 195, 192], bottom = v < 0.5 ? [180, 195, 192] : [75, 84, 64];
      const blend = v < 0.5 ? Math.sin(v * Math.PI) : Math.sqrt((v - 0.5) * 2);
      const sun = Math.exp(-((u - 0.67) ** 2 + (v - 0.29) ** 2) * 1800) * 120;
      for (let channel = 0; channel < 3; channel++) pixels[(y * width + x) * 4 + channel] = Math.round(Math.min(255, top[channel] * (1 - blend) + bottom[channel] * blend + sun));
      pixels[(y * width + x) * 4 + 3] = 255;
    }
    yield;
  }
  return pixels;
}

// 颜色纹理在线性空间降采样，细节纹理保持数值空间；每行可中断。
export function* mipmapPixels(data,width,height,color) {
  const levels=[{data,width,height}];
  const linear=color?Float32Array.from({length:256},(_,value)=>value<=10?value/3294.6:((value/255+0.055)/1.055)**2.4):null;
  while (width>1 || height>1) {
    const nextWidth=Math.max(1,width>>1), nextHeight=Math.max(1,height>>1), next=new Uint8Array(nextWidth*nextHeight*4);
    for (let y=0;y<nextHeight;y++) {
      for (let x=0;x<nextWidth;x++) for (let channel=0;channel<4;channel++) {
        let sum=0;
        for (let dy=0;dy<2;dy++) for (let dx=0;dx<2;dx++) {
          const value=data[(Math.min(height-1,y*2+dy)*width+Math.min(width-1,x*2+dx))*4+channel];
          sum+=color&&channel<3?linear[value]:value;
        }
        let value=sum/4;
        if (color&&channel<3) value=255*(value<=0.0031308?value*12.92:1.055*value**(1/2.4)-0.055);
        next[(y*nextWidth+x)*4+channel]=Math.round(value);
      }
      yield;
    }
    data=next;width=nextWidth;height=nextHeight;levels.push({data,width,height});yield 'boundary';
  }
  return levels;
}
