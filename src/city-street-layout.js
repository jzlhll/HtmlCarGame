import { CITY_STREETS } from './config.js';
import { surfaceCache } from './surface-assets.js';

const overlaps=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;

// 街区边界布置干道，边界内侧布置小路；路口独立铺面，避免交叉叠面。
export function* cityStreetLayoutSteps(settings, exclusions=[], id='city') {
  const c=CITY_STREETS,cx=settings.x??settings.center[0],cz=settings.z??settings.center[1],spacing=settings.spacing;
  const lines=(count,center)=>{
    const list=[],kindAt=i=>i%c.primaryEvery===0||i===Math.round(count/2)?3:2;
    for(let i=0;i<=count;i++){
      const kind=kindAt(i);
      list.push({at:center+(i-count/2)*spacing,width:c.widths[kind-1],kind});
      if(i<count){
        // 加宽干道后把相邻小路向街区内侧退让，路面边缘保留净空。
        const inset=boundary=>Math.max(c.alleyInset,c.widths[kindAt(boundary)-1]/2+c.widths[0]/2+c.alleyRoadGap);
        for(const offset of [inset(i),spacing-inset(i+1)])list.push({at:center+(i-count/2)*spacing+offset,width:c.widths[0],kind:1});
      }
    }
    return list.sort((a,b)=>a.at-b.at);
  };
  const xs=lines(settings.columns,cx),zs=lines(settings.rows,cz),patches=[],cars=[];
  const clip=patch=>{
    let parts=[patch];
    for(const box of exclusions){
      const next=[];
      for(const p of parts){
        if(!overlaps(p,box)){next.push(p);continue;}
        const x0=Math.max(p.minX,box.minX),x1=Math.min(p.maxX,box.maxX),z0=Math.max(p.minZ,box.minZ),z1=Math.min(p.maxZ,box.maxZ);
        for(const [minX,maxX,minZ,maxZ]of [[p.minX,x0,p.minZ,p.maxZ],[x1,p.maxX,p.minZ,p.maxZ],[x0,x1,p.minZ,z0],[x0,x1,z1,p.maxZ]])if(maxX-minX>.01&&maxZ-minZ>.01)next.push({...p,minX,maxX,minZ,maxZ});
      }
      parts=next;if(!parts.length)break;
    }
    patches.push(...parts);
  };
  const segment=(line,start,end,axis)=>{
    if(end<=start)return;
    const p=axis===0?{minX:line.at-line.width/2,maxX:line.at+line.width/2,minZ:start,maxZ:end}:{minX:start,maxX:end,minZ:line.at-line.width/2,maxZ:line.at+line.width/2};
    Object.assign(p,{axis,kind:line.kind,width:line.width,start,end,center:line.at});clip(p);
    let state=(Math.imul(Math.round(line.at),73856093)^Math.imul(Math.round(start),19349663)^c.seed)>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const lanes=line.kind===3?3:line.kind===2?2:1,step=c.carSpacing[line.kind-1];
    for(let lane=0;lane<lanes*2;lane++)for(let along=start+32+random()*step*.4;along<end-32;along+=step){
      if(random()>c.carDensity[line.kind-1])continue;
      const side=lane<lanes?-1:1,offset=side*(lane%lanes+.5)*line.width*.36/lanes;
      const bus=line.kind>1&&random()<.12,width=bus?3.2:2.8,height=bus?3.6:2.2,length=bus?13.5:7+random()*2;
      const x=axis===0?line.at+offset:along,z=axis===0?along:line.at+offset;
      const halfX=(axis===0?width:length)/2+1,halfZ=(axis===0?length:width)/2+1;
      if(exclusions.some(b=>overlaps({minX:x-halfX,maxX:x+halfX,minZ:z-halfZ,maxZ:z+halfZ},b)))continue;
      cars.push({x,z,width,height,length,heading:(axis===0?0:Math.PI/2)+(side<0?Math.PI:0),color:c.carColors[Math.floor(random()*c.carColors.length)]});
    }
  };
  for(const x of xs){for(let j=0;j<zs.length-1;j++)segment(x,zs[j].at+zs[j].width/2,zs[j+1].at-zs[j+1].width/2,0);yield;}
  for(const z of zs){for(let i=0;i<xs.length-1;i++)segment(z,xs[i].at+xs[i].width/2,xs[i+1].at-xs[i+1].width/2,1);yield;}
  for(const x of xs){for(const z of zs)clip({minX:x.at-x.width/2,maxX:x.at+x.width/2,minZ:z.at-z.width/2,maxZ:z.at+z.width/2,axis:0,kind:0,width:x.width,center:x.at,start:z.at-z.width/2,end:z.at+z.width/2});yield;}
  return {id,patches,cars};
}

export function streetCarBox(car) {
  const alongX=Math.abs(Math.sin(car.heading))>.5,w=(alongX?car.length:car.width*1.12)/2,d=(alongX?car.width*1.12:car.length)/2;
  return {min:{x:car.x-w,y:CITY_STREETS.elevation,z:car.z-d},max:{x:car.x+w,y:CITY_STREETS.elevation+car.height*.9,z:car.z+d},name:'城市道路车辆'};
}

// 浏览器准备阶段恢复布局，显示与碰撞继续消费同一份对象；同步逻辑采样走纯数值路径。
export function* prepareCityStreetLayout(settings,exclusions,id,useCache) {
  if(!useCache)return yield* cityStreetLayoutSteps(settings,exclusions,id);
  const cache=surfaceCache();yield {wait:cache.ready};
  const key='scene/streets/'+id,meta=cache.readable?yield {wait:cache.read(key+'/layout-meta')}:null;
  const patches=[],cars=[];
  let hit=meta?.recipe===CITY_STREETS.recipe&&Number.isInteger(meta.patches)&&meta.patches>0&&meta.patches<128&&Number.isInteger(meta.cars)&&meta.cars>=0&&meta.cars<128;
  const patchFields=['minX','maxX','minZ','maxZ','axis','kind','width','start','end','center'],carFields=['x','z','width','height','length','heading','color'];
  if(hit)for(const [role,target,fields]of [['patches',patches,patchFields],['cars',cars,carFields]]){
    for(let i=0;i<meta[role];i++){
      const part=yield {wait:cache.read(key+'/layout-'+role+'/'+i)};
      if(!Array.isArray(part)||!part.length||part.length>512||!part.every(p=>p&&fields.every(k=>Number.isFinite(p[k]))&&(role==='patches'?p.maxX>p.minX&&p.maxZ>p.minZ&&p.width>0&&p.kind>=0&&p.kind<=3:p.width>0&&p.height>0&&p.length>0))){hit=false;break;}
      target.push(...part);yield;
    }
    if(!hit)break;
  }
  if(hit){console.info('City street layout restored '+JSON.stringify({id,patches:patches.length,cars:cars.length}));return {id,patches,cars};}
  const network=yield* cityStreetLayoutSteps(settings,exclusions,id),counts={};
  if(cache.available){
    for(const role of ['patches','cars']){
      counts[role]=Math.ceil(network[role].length/512);
      for(let i=0;i<counts[role];i++){yield {wait:cache.write(key+'/layout-'+role+'/'+i,network[role].slice(i*512,(i+1)*512))};if(!cache.available)break;}
      if(!cache.available)break;
    }
    if(cache.available)yield {wait:cache.write(key+'/layout-meta',{recipe:CITY_STREETS.recipe,...counts})};
  }
  console.info('City street layout generated '+JSON.stringify({id,persistent:cache.available,patches:network.patches.length,cars:network.cars.length}));return network;
}
