import * as THREE from 'three';
import { CAMERA } from './config.js';
import { GenerationQueue } from './generation-queue.js';

// 先登记WebGL默认解包状态，避免第一次分块复制为查询状态而等待此前GPU命令。
export function initializeTextureTransfer(renderer) {
  const gl=renderer.getContext();
  for(const key of [gl.UNPACK_ROW_LENGTH,gl.UNPACK_IMAGE_HEIGHT,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_IMAGES])renderer.state.pixelStorei(key,0);
}

function preparationObject(source) {
  const object=source.isInstancedMesh?new THREE.InstancedMesh(source.geometry,source.material,0)
    :source.isMesh?new THREE.Mesh(source.geometry,source.material)
    :source.isLineSegments?new THREE.LineSegments(source.geometry,source.material)
    :source.isLine?new THREE.Line(source.geometry,source.material)
    :source.isPoints?new THREE.Points(source.geometry,source.material):source.clone(false);
  if(source.isInstancedMesh){object.count=Math.min(1,source.count);object.instanceMatrix=source.instanceMatrix;object.instanceColor=source.instanceColor;object.morphTexture=source.morphTexture;}
  object.receiveShadow=source.receiveShadow;object.frustumCulled=false;
  object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false;object.matrixWorld.copy(source.matrixWorld);
  return object;
}

// 只提交代表几何与共享实例缓冲，绘制一个三角形即可上传；不把整关同时画进小视口。
export async function prepareSceneResources(renderer,views,extraTextures=[]) {
  const textures=new Set(extraTextures),groups=[],stats={compileMs:0,compileCpuMs:0,maxCompileMs:0,uploadCpuMs:0,maxTextureUploadMs:0,submitCpuMs:0,maxSubmitMs:0,objects:0};
  const queue=new GenerationQueue(prepare(),{urgent:true,name:'gpu-preparation'});
  queue.resume();const batches=await queue.done;
  for(const key of Object.keys(stats))stats[key]=Number(stats[key].toFixed(2));
  return {...stats,batches};

  function* prepare() {
    for(const {scene,camera} of views){
      const warmScene=new THREE.Scene();warmScene.background=scene.background;warmScene.environment=scene.environment;warmScene.fog=scene.fog;
      const lights=[],objects=[],seen=new Map(),stack=[scene];let visited=0;
      scene.updateMatrixWorld(true);
      while(stack.length){
        const source=stack.pop();stack.push(...source.children);
        if(source.isLight)lights.push(source);
        if(source.geometry&&source.material){
          const materials=Array.isArray(source.material)?source.material:[source.material];
          for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
          const key=source.geometry.id+':'+materials.map(m=>m.id).join(',')+':'+(source.instanceMatrix?.id??'')+':'+(source.instanceColor?.id??'')+':'+Boolean(source.receiveShadow)+':'+source.type;
          if(!seen.has(key)){const object=preparationObject(source);seen.set(key,object);objects.push(object);}
        }
        if(++visited%64===0)yield;
      }
      groups.push({warmScene,camera,lights,objects});stats.objects+=objects.length;
      yield 'boundary';
    }
    // 基础贴图上传同样走有界队列，材质编译不再隐式集中初始化全部贴图。
    for(const texture of textures){
      yield {task:'base-texture'};const start=performance.now();renderer.initTexture(texture);
      const ms=performance.now()-start;stats.uploadCpuMs+=ms;stats.maxTextureUploadMs=Math.max(stats.maxTextureUploadMs,ms);yield 'boundary';
    }
    const compiling=[],inFlight=new Map(),compileGroups=[];let compileStartedAt;
    // 同一材质的不同变体必须等前批完成，避免异步编译读取被后批改写的程序引用。
    for(const group of groups){
      const variants=new Set(),pending=[];
      for(const object of group.objects){
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const key=materials.map(m=>m.id).join(',')+':'+object.type+':'+Boolean(object.instanceColor)+':'+Object.keys(object.geometry.attributes).sort().join(',')+':'+Boolean(object.receiveShadow);
        if(!variants.has(key)){variants.add(key);pending.push({object,materials});}
      }
      compileGroups.push({...group,pending});
    }
    while(compileGroups.some(group=>group.pending.length)){
      let submitted=false;
      for(const {warmScene,camera,lights,pending} of compileGroups){
        const batch=[],materials=new Set();
        for(let i=0;i<pending.length&&batch.length<CAMERA.warmupBatchObjects;){
          const candidate=pending[i];
          if(candidate.materials.some(material=>inFlight.has(material)||materials.has(material))){i++;continue;}
          batch.push(candidate.object);for(const material of candidate.materials)materials.add(material);pending.splice(i,1);
        }
        if(!batch.length)continue;
        yield {task:'material-compile'};warmScene.children=[...lights,...batch];
        const start=performance.now();compileStartedAt??=start;
        const promise=renderer.compileAsync(warmScene,camera),cpu=performance.now()-start;
        const settled=promise.then(()=>null,error=>error).then(error=>{for(const material of materials)inFlight.delete(material);return error;});
        for(const material of materials)inFlight.set(material,settled);
        compiling.push(settled);submitted=true;
        stats.compileCpuMs+=cpu;stats.maxCompileMs=Math.max(stats.maxCompileMs,cpu);yield 'boundary';
      }
      if(!submitted){const error=yield {wait:Promise.race(inFlight.values())};if(error)throw error;}
    }
    if(compiling.length){
      const errors=yield {wait:Promise.all(compiling)},failed=errors.find(Boolean);
      if(failed)throw failed;
      stats.compileMs=performance.now()-compileStartedAt;yield 'boundary';
    }
    try {
      for(const {warmScene,camera,lights,objects} of groups)for(let i=0;i<objects.length;i+=CAMERA.warmupBatchObjects){
        yield {task:'geometry-submit'};
        const batch=objects.slice(i,i+CAMERA.warmupBatchObjects),ranges=new Map(),previousTarget=renderer.getRenderTarget();
        const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
        try {
          for(const object of batch){
            const geometry=object.geometry;if(ranges.has(geometry))continue;
            ranges.set(geometry,{range:{...geometry.drawRange},groups:geometry.groups});
            if(geometry.groups.length)geometry.groups=geometry.groups.map(group=>({...group,count:Math.min(3,group.count)}));
            else geometry.setDrawRange(geometry.drawRange.start,Math.min(3,geometry.drawRange.count));
          }
          warmScene.children=[...lights,...batch];renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(null);renderer.setViewport(0,0,CAMERA.warmupSize,CAMERA.warmupSize);renderer.setScissor(0,0,CAMERA.warmupSize,CAMERA.warmupSize);renderer.setScissorTest(true);
          const start=performance.now();renderer.render(warmScene,camera);const ms=performance.now()-start;
          stats.submitCpuMs+=ms;stats.maxSubmitMs=Math.max(stats.maxSubmitMs,ms);
        }finally{
          for(const [geometry,{range,groups:original}]of ranges){geometry.setDrawRange(range.start,range.count);geometry.groups=original;}
          renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
        }
        yield 'boundary';
      }
    }finally{renderer.shadowMap.needsUpdate=true;for(const {warmScene}of groups)warmScene.children=[];}
  }
}
