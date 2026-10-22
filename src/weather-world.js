import { arcPoint } from './route-path.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { WEATHER } from './config.js';
import { surfaceCache } from './surface-assets.js';

const cloudNoise=new ImprovedNoise();
const randomStream=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

// 大团块、空间扭曲与边缘侵蚀共用一个隐式场，模型和穿云判定保持一致。
export function cloudField(x,y,z,template) {
  const shape=WEATHER.shape,edge=Math.max(Math.abs(x),Math.abs(y),Math.abs(z));
  const border=Math.max(0,Math.min(1,(.49-edge)/.10));
  const warpedY=y+cloudNoise.noise(x*shape.warpScale+11.7,y*1.7,z*shape.warpScale-7.3)*shape.warp*border;
  let field=1e6;
  for(const p of template){
    const distance=((x-p.x)/p.rx)**2+((warpedY-p.y)/p.ry)**2+((z-p.z)/p.rz)**2-1;
    const h=Math.max(WEATHER.blend-Math.abs(field-distance),0)/WEATHER.blend;
    field=Math.min(field,distance)-h*h*WEATHER.blend*.25;
  }
  // 只在外壳附近计算细节；云芯和远处空域无需噪声侵蚀。
  if(field<-.65||field>.45)return field;
  const lower=Math.max(0,Math.min(1,(.12-y)/.5));
  const broad=.5+.5*cloudNoise.noise(x*shape.billowScale+5.3,y*shape.billowScale-3.1,z*shape.billowScale+13.8);
  const detail=.5+.5*cloudNoise.noise(x*shape.detailScale-17.4,y*shape.detailScale+8.5,z*shape.detailScale+2.9);
  return field+shape.erosion*(.35+.65*lower)*(.35*broad+.65*detail*detail);
}

// 六类轮廓保留偏心峰、鞍部和风切长脊，形状池固定缓存，开局仅重排变换。
export function cloudTemplates() {
  const crowns=[
    [[-.26,-.07,0],[0,.01,.08],[.22,-.04,-.06],[-.1,-.03,-.2],[.12,-.08,.23],[.29,-.12,.18]],
    [[-.14,.20,-.04],[.10,.04,.05],[.28,-.08,.06],[-.28,-.08,.12],[.04,-.1,-.23],[-.06,-.03,.23]],
    [[-.23,.14,-.02],[.23,.07,.03],[-.05,-.13,0],[-.24,-.03,.23],[.21,-.04,-.22],[.02,-.1,.25]],
    [[-.27,.03,-.18],[-.08,.17,-.08],[.13,.02,.04],[.28,.13,.16],[-.20,-.04,.19],[.03,-.02,.26]],
    [[-.12,.16,-.23],[-.10,.09,-.08],[0,.01,.08],[.12,-.06,.24],[.25,-.12,.27],[-.25,-.08,-.15]],
    [[-.10,-.03,0],[-.12,.20,-.02],[.08,.22,.04],[-.30,.16,.03],[.28,.15,-.04],[.05,.13,.24]],
  ];
  return Array.from({length:WEATHER.variants},(_,variant)=>{
    const random=randomStream(WEATHER.seed+variant*101),puffs=[];
    const add=(x,y,z,rx,ry,rz)=>{
      x+=(random()-.5)*.018;y+=(random()-.5)*.018;z+=(random()-.5)*.018;
      puffs.push({x,y,z,rx:Math.min(.475-Math.abs(x),rx),ry:Math.min(.475-Math.abs(y),ry),rz:Math.min(.475-Math.abs(z),rz)});
    };
    // 底部沿各自云峰错落延伸，避免所有模板共用一层扁椭球托底。
    for(let i=0;i<4;i++){
      const c=crowns[variant][(i+variant)%6],y=-.14-random()*.12+(i%2)*.045;
      add(c[0]*.78,y,c[2]*.85,.16+random()*.055,.13+random()*.075,.16+random()*.055);
    }
    for(const [i,c]of crowns[variant].entries())add(...c,.18+random()*.045,variant===5&&i>1?.13:.19+random()*.05,.17+random()*.055);
    for(let i=0;i<8;i++){
      const c=crowns[variant][i%6],angle=i*2.399963,side=.10+random()*.04;
      const underside=i<4;
      add(c[0]+Math.cos(angle)*side,c[1]-(underside?.13:.015)+random()*.05,c[2]+Math.sin(angle)*side,
        .095+random()*.055,underside?.13+random()*.04:.11+random()*.04,.095+random()*.055);
    }
    for(let i=0;i<4;i++){
      const c=crowns[variant][i],top=variant===0?.15:variant===5?.13:.21;
      add(c[0]+(random()-.5)*.10,c[1]+top,c[2]+(random()-.5)*.10,.075+random()*.025,.08+random()*.035,.075+random()*.025);
    }
    return puffs;
  });
}

function cloudPlacements(count,seed) {
  const random=randomStream(seed),clouds=[],thinCount=Math.max(1,Math.round(count*.1));
  const variants=Array.from({length:WEATHER.variants},(_,i)=>i);
  for(let i=variants.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[variants[i],variants[j]]=[variants[j],variants[i]];}
  const kindAt=id=>id%4===((Math.imul(Math.floor(id/4)+1,0x45d9f3b)^seed)>>>16)%4?'storm':'white';
  const thinIds=new Set();
  for(let i=0;i<thinCount;i++){let id=Math.floor((i+.5)*count/thinCount);while(kindAt(id)==='storm'||thinIds.has(id))id=(id+1)%count;thinIds.add(id);}
  for(let id=0;id<count;id++){
    const thin=thinIds.has(id),band=thin?WEATHER.thinBand:WEATHER.highBand;
    clouds.push({id,kind:kindAt(id),thin,
      x:(random()*2-1)*WEATHER.lateralSpread,z:WEATHER.startZ-id*WEATHER.spacing+(random()*2-1)*WEATHER.alongJitter,
      y:band[0]+random()*(band[1]-band[0]),variant:variants[id%variants.length],density:thin?WEATHER.thinDensity:1,
      heading:(random()*2-1)*WEATHER.headingSpread+(random()<.5?Math.PI:0),scaleX:.9+random()*.1,scaleZ:.9+random()*.1});
  }
  return clouds;
}

function followArc(clouds,arc){
  if(!arc)return clouds;
  for(const cloud of clouds){const point=arcPoint(arc,-cloud.z,cloud.x);cloud.x=point.x;cloud.z=point.z;cloud.heading+=point.heading;}
  return clouds;
}

export function varyWeather(layout,seed) {
  const clouds=followArc(cloudPlacements(layout.clouds.length,seed),layout.arc);
  for(let i=0;i<clouds.length;i++)Object.assign(layout.clouds[i],clouds[i]);
}

export function weatherLayout(route) {
  const distance=route.length+WEATHER.startZ;
  const count=Math.min(WEATHER.maxClouds,Math.max(4,Math.ceil(distance/WEATHER.spacing)));
  return {clouds:followArc(cloudPlacements(count,WEATHER.seed),route.arc),templates:cloudTemplates(),...(route.arc?{arc:route.arc}:{})};
}

export function* prepareWeatherWorld(route,useCache) {
  if(!useCache)return weatherLayout(route);
  const cache=surfaceCache();yield {wait:cache.ready};
  const record=cache.readable?yield {wait:cache.read('scene/weather/layout')}:null;
  const valid=record?.recipe===WEATHER.recipe&&Array.isArray(record.clouds)&&record.clouds.length>0&&record.clouds.length<=WEATHER.maxClouds
    &&record.clouds.every((c,i)=>c.id===i&&['white','storm'].includes(c.kind)&&['x','y','z','density','variant','heading','scaleX','scaleZ'].every(k=>Number.isFinite(c[k]))&&c.y>=WEATHER.thinBand[0]&&c.y<=WEATHER.highBand[1]&&Number.isInteger(c.variant)&&c.variant>=0&&c.variant<WEATHER.variants&&typeof c.thin==='boolean'&&c.density>0&&c.density<=1&&c.scaleX>=.9&&c.scaleX<=1&&c.scaleZ>=.9&&c.scaleZ<=1)
    &&Array.isArray(record.templates)&&record.templates.length===WEATHER.variants&&record.templates.every(p=>p.length===WEATHER.puffs&&p.every(v=>['x','y','z','rx','ry','rz'].every(k=>Number.isFinite(v[k]))&&v.rx>0&&v.ry>0&&v.rz>0));
  if(valid){console.info('Weather layout restored '+JSON.stringify({clouds:record.clouds.length}));return record;}
  const generated=weatherLayout(route);yield;
  if(cache.available)yield {wait:cache.write('scene/weather/layout',{recipe:WEATHER.recipe,...generated})};
  console.info('Weather layout generated '+JSON.stringify({clouds:generated.clouds.length,persistent:cache.available}));return generated;
}
