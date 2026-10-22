import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export async function resourceSourcesModule(root){
  const hash=createHash('sha256');
  for(const file of ['src/resource-worker.js','src/random.js']){hash.update(file);hash.update(await readFile(path.join(root,file)));}
  const bossHash=createHash('sha256');for(const file of ['src/boss-model.js','src/boss-worker.js']){bossHash.update(file);bossHash.update(await readFile(path.join(root,file)));}
  const packageData=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  return 'export const RESOURCE_SOURCES='+JSON.stringify({space:hash.digest('hex'),boss:bossHash.digest('hex'),engine:packageData.dependencies.three})+';';
}
