import { MODEL_APPEARANCE, TRAFFIC_COLORS, CAR_COLORS, CAR_STYLES, TRUCK_STYLES, TANKER } from './config.js';
import { assetTextures } from './model-assets.js';
import { generateSurfacePixels } from './surface-pixels.js';

// 各关资源分组在非游玩阶段准备并持久化；驾驶期间不运行生成任务。
export const modelJobs=[
  ...['asphalt','ground','foliage','bark','wood','stone','hide','water','rubber','cow'].map(kind=>({id:'texture:'+kind,level:1,kind})),
  ...Array.from({length:5},(_,index)=>[false,true].map(low=>({id:'vehicle:'+(index+1)+':'+low,level:1,rank:index+1,low}))).flat(),
  ...CAR_STYLES.slice(1).flatMap(carStyle=>[false,true].map(low=>({id:'car:'+carStyle+':'+low,level:1,rank:3,low,carStyle}))),
  ...[...TRUCK_STYLES.slice(1),'tanker'].flatMap(truckStyle=>[false,true].map(low=>({id:'truck:'+truckStyle+':'+low,level:1,rank:4,low,truckStyle}))),
  {id:'animals',level:1},{id:'roadblocks',level:1},{id:'trees',level:1},{id:'rocks',level:1},
  {id:'texture:skin',level:2,kind:'skin'},
  ...[false,true].map(low=>({id:'vehicle:6:'+low,level:2,rank:6,low})),
  ...['small','triceratops','stegosaurus','diplodocus','chaser'].map(dinosaur=>({id:'dinosaur:'+dinosaur,level:2,dinosaur})),
  ...['ice','lava','foam'].map(kind=>({id:'texture:'+kind,level:3,kind})),
  {id:'disasters',level:3},
];
export async function generateModelJob(job,yieldWork){
  if(job.kind){
    if(assetTextures.has(job.kind))return;
    const rows=generateSurfacePixels(job.kind,MODEL_APPEARANCE.textureSize);let step;
    do{step=rows.next();if(!step.done&&yieldWork)await yieldWork();}while(!step.done);
    assetTextures.set(job.kind,step.value);
  }else if(job.rank){
    const {vehicleModel}=await import('./models.js');
    const colors=new Set(job.truckStyle==='tanker'?[TANKER.color]:[...TRAFFIC_COLORS[job.rank],...CAR_COLORS.map(value=>value.hex).filter(value=>typeof value==='number')]);
    for(const color of colors){vehicleModel(job.rank,false,color,job.low,job.truckStyle,job.carStyle);if(yieldWork)await yieldWork();}
  }else if(job.dinosaur){
    const {dinosaurModel}=await import('./dinosaur-models.js');dinosaurModel(job.dinosaur);
  }else if(job.id==='animals'){
    const {cowModel,horseModel}=await import('./models.js');cowModel();horseModel();
  }else if(job.id==='roadblocks'){
    const {roadblockGeometry}=await import('./roadblock-model.js');roadblockGeometry();
  }else if(job.id==='trees'){
    const {treeGeometry}=await import('./tree-model.js');treeGeometry();
  }else if(job.id==='rocks'){
    const {rockGeometry}=await import('./model-surfaces.js');rockGeometry();
  }else if(job.id==='disasters'){
    const {disasterGeometries}=await import('./disaster-view.js');disasterGeometries();
  }
}
