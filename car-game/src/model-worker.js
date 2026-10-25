import { modelJobs, generateModelJob } from './model-jobs.js';
import { collectModelAssets, installModelAssets } from './model-assets.js';

const sent=new Set();
self.onmessage=async({data})=>{
  if(data.restore){installModelAssets(data.restore);for(const geometry of data.restore.geometries)sent.add(geometry.key);for(const texture of data.restore.textures)sent.add('texture:'+texture.key);return;}
  const {id}=data;
  try{
    const job=modelJobs.find(value=>value.id===id);if(!job)throw new Error('Unknown model job: '+id);
    await generateModelJob(job);
    const {transfer,...assets}=collectModelAssets(sent);self.postMessage({id,assets},transfer);
  }catch(error){self.postMessage({id,error:String(error?.stack??error)});}
};
