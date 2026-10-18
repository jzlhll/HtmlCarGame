import { AIRCRAFT, LANDSCAPE } from './config.js';

function siteHash(x,z) {
  let hash=Math.imul(Math.round(x),73856093)^Math.imul(Math.round(z),19349663);
  return Math.imul(hash^(hash>>>13),1274126177)>>>0;
}

// 固定种子打散楼型，四类数量均衡；净空从楼体边缘计算，保留连续纵向通道。
export function cityBuildingSites(settings, excluded=()=>false) {
  const city=LANDSCAPE.city,centerX=settings.x??settings.center[0],centerZ=settings.z??settings.center[1];
  const gap=Math.max(AIRCRAFT.wingspan*city.passageWingSpans,city.passageWidth),limit=settings.spacing-gap-2,sites=[];
  for(let row=0;row<settings.rows;row++)for(let column=0;column<settings.columns;column++){
    const x=centerX+(column-(settings.columns-1)/2)*settings.spacing,z=centerZ+(row-(settings.rows-1)/2)*settings.spacing;
    if(excluded(x,z)||(settings.corridors||[]).some(offset=>Math.abs(x-centerX-offset)<(limit+gap)/2))continue;
    sites.push({x,z,hash:siteHash(x,z)});
  }
  sites.sort((a,b)=>a.hash-b.hash||a.z-b.z||a.x-b.x);
  return sites.map((site,index)=>{
    const profile=city.profiles[index%city.profiles.length];let state=site.hash;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const sample=range=>range[0]+random()*(range[1]-range[0]);
    return {x:site.x,z:site.z,width:Math.min(limit,sample(profile.width)),depth:Math.min(limit,sample(profile.depth)),
      height:sample(profile.height),color:city.colors[Math.floor(random()*city.colors.length)],profile:profile.id};
  });
}

// 裙房、宽板楼与阶梯主体的分段轮廓同时用于渲染和碰撞。
export function buildingParts(site) {
  let hash=Math.imul(Math.round(site.x),73856093)^Math.imul(Math.round(site.z),19349663);
  hash=Math.imul(hash^(hash>>>13),1274126177);
  const parts=[],style=site.profile==='broad'||site.profile==='lowrise'?(hash>>>0)%2:(hash>>>0)%5;
  const box=(x,z,bottom,height,width,depth,role='wall')=>parts.push({x,z,y:bottom+height/2,width,depth,height,role,style});
  const {x,z,width,depth,height}=site;
  if(height<45)box(x,z,0,height,width,depth);
  else {
    const podium=Math.min(48,height*.22);box(x,z,0,podium,width,depth,'podium');
    const towerHeight=height-podium;
    if(style===0){
      // 厚实板楼：横向体量完整，仅顶部小幅退台。
      box(x,z,podium,towerHeight*.84,width*.96,depth*.87);
      box(x,z,podium+towerHeight*.84,towerHeight*.16,width*.8,depth*.76);
    }else if(style===1){
      box(x,z,podium,towerHeight,width*.92,depth*.9);
    }else if(style===2){
      box(x-width*.12,z,podium,towerHeight,width*.66,depth*.94);
      box(x+width*.33,z+depth*.09,podium,towerHeight*.73,width*.32,depth*.74);
    }else{
      const count=style===3?3:2;
      for(let i=0;i<count;i++)box(x,z,podium+towerHeight*i/count,towerHeight/count,width*(.94-i*.12),depth*(.96-i*.09));
    }
  }
  box(x,z,height+1.5,3,Math.min(26,width*.27),Math.min(34,depth*.3),'equipment');
  return parts;
}
