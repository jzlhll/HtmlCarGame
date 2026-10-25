import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// 按共享依赖计算资源组指纹；程序 tag 变化不会使兼容的生成结果失效。
export async function resourceSourcesModule(root){
  const common=['src/model-assets.js','src/model-surfaces.js'];
  const vehicle=[...common,'src/models.js','src/tanker-model.js'];
  const groups={pixels:['src/surface-pixels.js'],vehicles:vehicle,roadblocks:['src/roadblock-model.js','src/model-assets.js'],trees:['src/tree-model.js','src/model-assets.js'],rocks:common,dinosaurs:[...vehicle,'src/dinosaur-models.js'],disasters:[...common,'src/disaster-view.js']};
  const sources={};
  for(const [name,files]of Object.entries(groups)){
    const hash=createHash('sha256');for(const file of ['src/model-jobs.js',...files]){hash.update(file);hash.update(await readFile(path.join(root,file)));}
    sources[name]=hash.digest('hex');
  }
  sources.engine=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).dependencies.three;
  return 'export const RESOURCE_SOURCES='+JSON.stringify(sources)+';\n';
}
