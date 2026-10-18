import { WEATHER } from './config.js';
import { surfaceCache } from './surface-assets.js';

const randomStream=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

// 同一隐式外形供云模型与进入判定使用，团块融合为单一连续表面。
export function cloudField(x,y,z,template) {
  let field=1e6;
  for(const p of template){
    const distance=((x-p.x)/p.rx)**2+((y-p.y)/p.ry)**2+((z-p.z)/p.rz)**2-1;
    const h=Math.max(WEATHER.blend-Math.abs(field-distance),0)/WEATHER.blend;
    field=Math.min(field,distance)-h*h*WEATHER.blend*.25;
  }
  return field;
}

export function cloudTemplates() {
  return Array.from({length:WEATHER.variants},(_,variant)=>{
    const random=randomStream(WEATHER.seed+variant*101);
    const puffs=[-.2,0,.2].map(x=>({x,y:-.2,z:0,rx:.27,ry:.16,rz:.3}));
    for(let i=3;i<WEATHER.puffs;i++){
      const angle=(i-3)*2.399963+random()*.45,radius=i===3?0:.12+random()*.17;
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=-.045+random()*.19;
      puffs.push({x,y,z,rx:Math.min(.48-Math.abs(x),.12+random()*.065),ry:Math.min(.48-Math.abs(y),.21+random()*.13),rz:Math.min(.48-Math.abs(z),.12+random()*.065)});
    }
    return puffs;
  });
}

export function weatherLayout(route) {
  const random=randomStream(WEATHER.seed),distance=-route.destination.threshold+WEATHER.startZ;
  const count=Math.min(WEATHER.maxClouds,Math.max(4,Math.ceil(distance/WEATHER.spacing))),clouds=[];
  const thinCount=Math.max(1,Math.round(count*.1));
  const kindAt=id=>id%4===((Math.imul(Math.floor(id/4)+1,0x45d9f3b)^WEATHER.seed)>>>16)%4?'storm':'white';
  const thinIds=new Set();
  for(let i=0;i<thinCount;i++){let id=Math.floor((i+.5)*count/thinCount);while(kindAt(id)==='storm'||thinIds.has(id))id=(id+1)%count;thinIds.add(id);}
  for(let id=0;id<count;id++){
    const thin=thinIds.has(id),band=thin?WEATHER.thinBand:WEATHER.highBand;
    clouds.push({id,kind:kindAt(id),thin,
      x:(random()*2-1)*WEATHER.lateralSpread,z:WEATHER.startZ-id*WEATHER.spacing+(random()-.5)*1000,
      y:band[0]+random()*(band[1]-band[0]),variant:id%WEATHER.variants,density:thin?WEATHER.thinDensity:1});
  }
  return {clouds,templates:cloudTemplates()};
}

export function* prepareWeatherWorld(route,useCache) {
  if(!useCache)return weatherLayout(route);
  const cache=surfaceCache();yield {wait:cache.ready};
  const record=cache.available?yield {wait:cache.read('scene/weather/layout')}:null;
  const valid=record?.recipe===WEATHER.recipe&&Array.isArray(record.clouds)&&record.clouds.length>0&&record.clouds.length<=WEATHER.maxClouds
    &&record.clouds.every((c,i)=>c.id===i&&['white','storm'].includes(c.kind)&&['x','y','z','density','variant'].every(k=>Number.isFinite(c[k]))&&c.y>=WEATHER.thinBand[0]&&c.y<=WEATHER.highBand[1]&&Number.isInteger(c.variant)&&c.variant>=0&&c.variant<WEATHER.variants&&typeof c.thin==='boolean'&&c.density>0&&c.density<=1)
    &&Array.isArray(record.templates)&&record.templates.length===WEATHER.variants&&record.templates.every(p=>p.length===WEATHER.puffs&&p.every(v=>['x','y','z','rx','ry','rz'].every(k=>Number.isFinite(v[k]))&&v.rx>0&&v.ry>0&&v.rz>0));
  if(valid){console.info('Weather layout restored '+JSON.stringify({clouds:record.clouds.length}));return record;}
  const generated=weatherLayout(route);yield;
  if(cache.available)yield {wait:cache.write('scene/weather/layout',{recipe:WEATHER.recipe,...generated})};
  console.info('Weather layout generated '+JSON.stringify({clouds:generated.clouds.length,persistent:cache.available}));return generated;
}
