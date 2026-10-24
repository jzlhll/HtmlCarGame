import { cp, mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resourceSourcesModule } from './resource-sources.mjs';
import { APP_VERSION } from '../src/version.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'.pages-output');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
if(!/^v\d+\.\d+\.\d+$/.test(APP_VERSION)||APP_VERSION!=='v'+pkg.version||lock.version!==pkg.version||lock.packages[''].version!==pkg.version)throw new Error('Release versions differ');
if(process.env.RELEASE_TAG&&process.env.RELEASE_TAG!==APP_VERSION)throw new Error('Release tag differs');
if(process.env.GITHUB_REF_TYPE==='tag'&&process.env.GITHUB_REF_NAME!==APP_VERSION)throw new Error('Git tag differs');
await rm(output,{recursive:true,force:true});await mkdir(path.join(output,'src'),{recursive:true});
const modules=['bootstrap.js','config.js','storage.js','audio.js','game.js','assembly.js','assembly-view.js','recap.js','word-blanks.js','background-layout.js','input.js','ui.js','assets.js','supply-sprite.js','boss-model.js','boss-worker.js','boss-assets.js','scene.js','version.js','random.js','letter-patterns.js','projectiles.js','collision.js','vocabulary.js','vocabulary-data.js','vocabulary-primary.js','vocabulary-intermediate.js','vocabulary-cet4.js','vocabulary-cet6.js','resource-worker.js','learning-db.js','speech.js','accounts.js'];
const versioned=source=>source.replace(/(['"])(\.{1,2}\/[^'"?#]+\.js)\1/g,(_,quote,url)=>quote+url+'?v='+APP_VERSION+quote);
for(const name of modules)await writeFile(path.join(output,'src',name),versioned(await readFile(path.join(root,'src',name),'utf8')));
await cp(path.join(root,'src/style.css'),path.join(output,'src/style.css'));
await cp(path.join(root,'third-party'),path.join(output,'third-party'),{recursive:true});
await writeFile(path.join(output,'src/resource-sources.js'),await resourceSourcesModule(root));
let html=await readFile(path.join(root,'index.html'),'utf8');html=html.replaceAll('./node_modules/three/','./vendor/three/').replace('./src/bootstrap.js','./src/bootstrap.js?v='+APP_VERSION).replace('./src/style.css','./src/style.css?v='+APP_VERSION);await writeFile(path.join(output,'index.html'),html);
for(const name of ['build/three.module.js','build/three.core.js','LICENSE']){const target=path.join(output,'vendor/three',name);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(root,'node_modules/three',name),target);}
await writeFile(path.join(output,'.nojekyll'),'');
async function size(dir){let bytes=0,files=0;for(const name of await readdir(dir)){const file=path.join(dir,name),info=await stat(file);if(info.isDirectory()){const child=await size(file);bytes+=child.bytes;files+=child.files;}else{bytes+=info.size;files++;}}return {bytes,files};}
const total=await size(output);if(total.bytes>=10000000)throw new Error('Deployment exceeds 10 MB');console.info('English Air Combat static package prepared',total);
