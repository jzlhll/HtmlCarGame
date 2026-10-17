import { cp, mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resourceSourcesModule } from './resource-sources.mjs';
import { APP_VERSION } from '../src/version.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-output');
if(!/^v\d+\.\d+\.\d+$/.test(APP_VERSION))throw new Error('Invalid APP_VERSION');
const packageVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
if(lock.version!==packageVersion||lock.packages?.['']?.version!==packageVersion)throw new Error('Package lock version differs from package version');
if(APP_VERSION!=='v'+packageVersion)throw new Error('Release version differs from package version');
if(process.env.RELEASE_TAG&&process.env.RELEASE_TAG!==APP_VERSION)throw new Error('Release tag differs from APP_VERSION');
if(process.env.GITHUB_REF_TYPE==='tag'&&process.env.GITHUB_REF_NAME!==APP_VERSION)throw new Error('Release tag differs from APP_VERSION');
// 输出目录完全由本脚本生成，先清理以免已删除模块残留在发布包。
await rm(output,{recursive:true,force:true});
await mkdir(output, { recursive: true });
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
await writeFile(path.join(output,'src/resource-sources.js'),await resourceSourcesModule(root));
await rm(path.join(output,'src/keyboard-mode.css'),{force:true});
await writeFile(path.join(output,'src/keyboard-mode.js'),`// Pages 版统一使用普通开始与答题流程。
export class KeyboardMode {
  enabled=false;
  setEnabled(){return true;}
  resetStart(){}
  startReady(){return true;}
  optionMarkup(){return '';}
  startMarkup(){return null;}
  makeRescueQuestion(){return null;}
  quizMarkup(){return null;}
  answerText(){return null;}
  handleKey(){return false;}
}
`);
const versioned=source=>source.replace(/(['"])(\.{1,2}\/[^'"?#]+\.js)\1/g,(_,quote,url)=>quote+url+'?v='+APP_VERSION+quote);
// Worker 使用相对模块地址，与页面共享同一份 Three.js，不额外分发引擎。
for(const name of await readdir(path.join(output,'src')))if(name.endsWith('.js')){
  const file=path.join(output,'src',name);let source=(await readFile(file,'utf8')).replaceAll('../node_modules/three/','../vendor/three/');
  if(name==='config.js')source=source.replace(/^export const KEYBOARD_TRAINING=.*\n/m,'');
  await writeFile(file,versioned(source));
}
let html = (await readFile(path.join(root, 'index.html'), 'utf8')).replaceAll('./node_modules/three/', './vendor/three/').replace('  <link rel="stylesheet" href="./src/keyboard-mode.css">\n','');
html=html.replace('./src/bootstrap.js','./src/bootstrap.js?v='+APP_VERSION).replace('./src/style.css','./src/style.css?v='+APP_VERSION);
html=html.replace(/<script type="importmap">(.*?)<\/script>/,(_,json)=>{
  const map=JSON.parse(json);map.imports.three+='?v='+APP_VERSION;map.imports['three/addons/utils/BufferGeometryUtils.js']='./vendor/three/examples/jsm/utils/BufferGeometryUtils.js?v='+APP_VERSION;
  return '<script type="importmap">'+JSON.stringify(map)+'</script>';
});
await writeFile(path.join(output, 'index.html'), html);
for (const file of ['build/three.module.js', 'build/three.core.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'LICENSE']) {
  const destination = path.join(output, 'vendor/three', file);
  await mkdir(path.dirname(destination), { recursive: true });
  if(file.endsWith('.js'))await writeFile(destination,versioned((await readFile(path.join(root,'node_modules/three',file),'utf8')).replace("from 'three';","from '../../../build/three.module.js';")));
  else await cp(path.join(root, 'node_modules/three', file), destination);
}
await writeFile(path.join(output, '.nojekyll'), '');
async function size(directory){let bytes=0,files=0;for(const name of await readdir(directory)){const file=path.join(directory,name),info=await stat(file);if(info.isDirectory()){const child=await size(file);bytes+=child.bytes;files+=child.files;}else{bytes+=info.size;files++;}}return {bytes,files};}
const total=await size(output);if(total.bytes>=10000000)throw new Error('Deployment exceeds 10 MB: '+total.bytes);
console.log('Static game files prepared in .pages-output',JSON.stringify(total));
