import * as config from './config.js';
import { modelJobs } from './model-jobs.js';
import { RESOURCE_SOURCES } from './resource-sources.js';
import { CACHE_FORMAT_VERSION, GENERATOR_VERSION } from './version.js';

// 配置与固定种子也进入资源键；与时间、成绩、程序 tag 无关的模型不受它们影响。
function fingerprint(value){
  const text=JSON.stringify(value);let a=0x811c9dc5,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
  for(let i=0;i<text.length;i++){const code=text.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b^code,2246822507);c=Math.imul(c^code,3266489909);d=Math.imul(d^code,668265263);}
  return [a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
}
export function resourcePlan(){
  const version={project:'HtmlCarGame',format:CACHE_FORMAT_VERSION,generator:GENERATOR_VERSION,engine:RESOURCE_SOURCES.engine,seed:'fixed-procedural'};
  const {profile,...appearance}=config.MODEL_APPEARANCE;
  const groups=[],add=(id,jobs,source,settings,dependencies=[])=>{
    const key='htmlCarGame:'+id+':'+fingerprint({version,source,settings,jobs,dependencies});
    groups.push({id,key,jobs});return key;
  };
  for(const job of modelJobs.filter(job=>job.kind))add(job.id,[job],RESOURCE_SOURCES.pixels,{kind:job.kind,size:config.MODEL_APPEARANCE.textureSize});
  const vehicles=add('vehicles',modelJobs.filter(job=>job.rank||job.id==='animals'),RESOURCE_SOURCES.vehicles,{
    vehicles:config.VEHICLES,colors:config.TRAFFIC_COLORS,playerColors:config.CAR_COLORS,carStyles:config.CAR_STYLES,truckStyles:config.TRUCK_STYLES,tanker:config.TANKER_APPEARANCE,tankerColor:config.TANKER.color,
    lengthScale:config.VEHICLE_LENGTH_SCALE,widthScale:config.VEHICLE_WIDTH_SCALE,bicycleWidth:config.BICYCLE_WIDTH_SCALE,tire:config.BICYCLE_TIRE_WIDTH,armor:config.ARMORED_TANK,cow:config.COW_CROSSING.dimensions,smallPart:config.RENDER_QUALITY.smallPartSize,
  });
  add('roadblocks',modelJobs.filter(job=>job.id==='roadblocks'),RESOURCE_SOURCES.roadblocks,{width:config.ROADBLOCKS.width,height:config.ROADBLOCKS.height,depth:config.ROADBLOCKS.depth});
  add('trees',modelJobs.filter(job=>job.id==='trees'),RESOURCE_SOURCES.trees,{});
  add('rocks',modelJobs.filter(job=>job.id==='rocks'),RESOURCE_SOURCES.rocks,{seed:712,detail:3});
  add('dinosaurs',modelJobs.filter(job=>job.dinosaur),RESOURCE_SOURCES.dinosaurs,{dinosaurs:config.DINOSAURS,smallPart:config.RENDER_QUALITY.smallPartSize},[vehicles]);
  add('disasters',modelJobs.filter(job=>job.id==='disasters'),RESOURCE_SOURCES.disasters,{appearance,disasters:config.DISASTERS});
  return groups;
}
