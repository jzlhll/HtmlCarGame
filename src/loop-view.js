import * as THREE from 'three';
import { CanopyLOD } from './canopy-lod.js';
import { LOOP_WORLD, LANDSCAPE, SURFACE_APPEARANCE, WORLD_BOUNDARY } from './config.js';
import { loopVariant, isRouteCell, loopRiverZ, sampleLoopTerrain, LoopWorld } from './loop-world.js';
import { mountainIndices } from './terrain.js';
import { modelGeometry, surfaceTexture } from './surface-assets.js';
import { createTerrainMaterial } from './terrain-material.js';
import { createCityBlocks } from './city-blocks.js';
import { createCountryside } from './countryside-view.js';
import { createDistrict } from './district-view.js';
import { createCityStreets } from './city-streets.js';

// 固定模板池围绕玩家滚动，飞行中不分配模型、纹理、网格或碰撞资源。
export class LoopView extends THREE.Group {
  constructor(world, makeLandmarks, trees) {
    super();this.trees=trees;this.world=world;this.makeLandmarks=makeLandmarks;this.center={value:new THREE.Vector2()};this.time={value:0};
    this.templates=[];this.slots=[];this.cellX=Infinity;this.cellZ=Infinity;
    const geometries=Array.from({length:LOOP_WORLD.variants},(_,i)=>modelGeometry(`loop-terrain-${i}`));
    const names=new Set(LANDSCAPE.landmarks.map(t=>t.name)), boxes=new Set();
    for(const bucket of world.boxCells.values())for(const box of bucket)if(names.has(box.name))boxes.add(box);
    world.loop=new LoopWorld(world.route,geometries,world.buildings.filter(site=>site.name==='城市楼房'),[...boxes],world.loopStreets,world.bodySweep);
    this.geometries=geometries;
  }

  *build() {
    const groundMaterial=createTerrainMaterial(surfaceTexture('terrain-detail'));
    const waterMaterial=new THREE.MeshStandardMaterial({color:0x398e9c,roughness:.32,metalness:.15});
    const shoreMaterial=new THREE.MeshStandardMaterial({color:0xb8b088,roughness:1});
    for(let variant=0;variant<LOOP_WORLD.variants;variant++) {
      yield {task:`world-template-${variant}`};
      const group=new THREE.Group(), geometry=this.geometries[variant], lod=new THREE.LOD();
      if(!geometry.boundingSphere)geometry.computeBoundingSphere();yield 'boundary';
      for(const [index,step] of [1,2,4].entries()) {
        const g=step===1?geometry:new THREE.BufferGeometry();
        if(step!==1){for(const [name,attribute] of Object.entries(geometry.attributes))g.setAttribute(name,attribute);g.setIndex(mountainIndices(LOOP_WORLD.segments,step));}
        g.boundingSphere=geometry.boundingSphere;lod.addLevel(new THREE.Mesh(g,groundMaterial),[0,5500,10000][index],.12);yield 'boundary';
      }
      group.add(lod);yield 'boundary';
      const ribbon=(width,y)=>{
        const positions=[],indices=[],half=LOOP_WORLD.tileSize/2-400;
        for(let i=0;i<=192;i++){
          const x=-half+i/192*half*2,z=loopRiverZ(x,variant),taper=Math.sin(i/192*Math.PI)**.25;
          positions.push(x,y,z-width*taper/2,x,y,z+width*taper/2);
          if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
        }
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
      };
      group.add(new THREE.Mesh(ribbon(240,.01),shoreMaterial),new THREE.Mesh(ribbon(150,.06),waterMaterial));
      yield 'boundary';
      const country=yield* createCountryside({width:12000,length:12000,seed:LOOP_WORLD.seed+variant*101,
        heightAt:(x,z)=>sampleLoopTerrain(geometry,x,z),
        landAt:(x,z)=>variant!==2||Math.max(Math.abs(x),Math.abs(z))>5350,
        roadZ:x=>loopRiverZ(x,variant)+(variant===2?-420:420),trees:this.trees,treeField:this.world.loop.treeFields[variant]});
      group.add(country);
      if(variant===2){
        const city=yield* createCityBlocks(this.world.loop.city,()=>0,{variationViews:this.world.variationViews});group.add(city);
        group.add(yield* createDistrict(this.world.loop.parking));
        const landmarks=this.makeLandmarks();landmarks.position.z=-LANDSCAPE.city.center[1];group.add(landmarks);
        group.add(yield* createCityStreets(this.world.loop.streets));
      }
      this.templates.push(group);yield 'boundary';
    }
    const wallMaterial=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1,bumpMap:surfaceTexture('terrain-detail'),bumpScale:6});
    wallMaterial.userData.keepOcean=true;wallMaterial.userData.boundary=true;
    for(let side=0;side<4;side++){const mesh=new THREE.Mesh(modelGeometry(`boundary-${side}`),wallMaterial);this.add(mesh);yield 'boundary';}
    const oceanMaterial=new THREE.MeshStandardMaterial({color:LANDSCAPE.coast.deepColor,roughness:.35,metalness:.2});
    oceanMaterial.userData.keepOcean=true;
    oceanMaterial.onBeforeCompile=shader=>{
      shader.uniforms.loopTime=this.time;
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float loopTime;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.96+.04*sin(vViewPosition.x*.035+loopTime)*cos(vViewPosition.z*.02-loopTime*.7);');
    };
    this.ocean=new THREE.Mesh(new THREE.PlaneGeometry((WORLD_BOUNDARY.halfWidth+WORLD_BOUNDARY.width)*2,WORLD_BOUNDARY.front-WORLD_BOUNDARY.back+WORLD_BOUNDARY.width*2),oceanMaterial);this.ocean.rotation.x=-Math.PI/2;this.ocean.position.set(0,LOOP_WORLD.seaLevel,(WORLD_BOUNDARY.front+WORLD_BOUNDARY.back)/2);this.add(this.ocean);
    for(let z=-LOOP_WORLD.poolRadius;z<=LOOP_WORLD.poolRadius;z++)for(let x=-LOOP_WORLD.poolRadius;x<=LOOP_WORLD.poolRadius;x++){
      const slot=new THREE.Group();
      for(const template of this.templates){
        const clone=cloneTemplate(template);
        clone.visible=false;clone.userData.loopClone=true;clone.userData.loopWarmup=this.slots.length===0;slot.add(clone);
      }this.slots.push({x,z,group:slot});this.add(slot);yield;
    }
    this.cellX=Infinity;this.cellZ=Infinity;
  }

  installHorizon(group) {
    group.traverse(object=>{
      for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
        if(material.userData.keepOcean||material.userData.loopHorizon)continue;
        material.userData.loopHorizon=true;const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
        material.onBeforeCompile=(shader,renderer)=>{
          previous.call(material,shader,renderer);shader.uniforms.loopCenter=this.center;shader.uniforms.loopRadius={value:LOOP_WORLD.radius};
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vLoopWorld;');
          shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 loopPoint=vec4(transformed,1.0);
#ifdef USE_INSTANCING
loopPoint=instanceMatrix*loopPoint;
#endif
vLoopWorld=(modelMatrix*loopPoint).xz;
#include <project_vertex>`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vLoopWorld;uniform vec2 loopCenter;uniform float loopRadius;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(distance(vLoopWorld,loopCenter)>loopRadius)discard;');
        };
        material.customProgramCacheKey=()=>key+'-loop-horizon-v1';material.needsUpdate=true;
      }
    });
  }

  update(position,seconds) {
    this.center.value.set(position.x,position.z);this.time.value=seconds;
    
    const x=Math.floor((position.x+LOOP_WORLD.tileSize/2)/LOOP_WORLD.tileSize),z=Math.floor((position.z+LOOP_WORLD.tileSize/2)/LOOP_WORLD.tileSize);
    if(x!==this.cellX||z!==this.cellZ){
      this.cellX=x;this.cellZ=z;
      for(const slot of this.slots){
        slot.column=x+slot.x;slot.row=z+slot.z;const variant=loopVariant(slot.column,slot.row);
        slot.group.position.set(slot.column*LOOP_WORLD.tileSize,0,slot.row*LOOP_WORLD.tileSize);slot.group.updateMatrix();
        slot.group.children.forEach((child,index)=>{child.visible=index===variant;});
      }
      this.traverse(object=>{object.matrixWorldAutoUpdate=true;});this.updateMatrixWorld(true);
      this.traverse(object=>{object.matrixWorldAutoUpdate=false;});
      if(this.ocean)this.ocean.matrixWorldAutoUpdate=true;
    }
    for(const slot of this.slots){
      const dx=Math.max(0,Math.abs(slot.group.position.x-position.x)-LOOP_WORLD.tileSize/2);
      const dz=Math.max(0,Math.abs(slot.group.position.z-position.z)-LOOP_WORLD.tileSize/2);
      slot.group.visible=Math.abs(slot.group.position.x)<WORLD_BOUNDARY.halfWidth+LOOP_WORLD.tileSize/2&&slot.group.position.z<WORLD_BOUNDARY.front+LOOP_WORLD.tileSize/2&&slot.group.position.z>WORLD_BOUNDARY.back-LOOP_WORLD.tileSize/2&&!isRouteCell(slot.column,slot.row,this.world.route)&&Math.hypot(dx,dz)<=LOOP_WORLD.radius;
    }
  }
}

// 相同模板共享实例缓冲，不在每个池槽复制成千上万个矩阵。
function cloneTemplate(source) {
  let clone;
  if(source.isInstancedMesh){
    clone=new THREE.InstancedMesh(source.geometry,source.material,0);
    THREE.Object3D.prototype.copy.call(clone,source,false);
    clone.count=source.count;clone.instanceMatrix=source.instanceMatrix;clone.instanceColor=source.instanceColor;
    clone.boundingBox=source.boundingBox;clone.boundingSphere=source.boundingSphere;
  }else if(source.isLOD){
    clone=source.isCanopyLOD?new CanopyLOD(source.localBounds):new THREE.LOD();THREE.Object3D.prototype.copy.call(clone,source,false);
    for(const level of source.levels)clone.addLevel(cloneTemplate(level.object),level.distance,level.hysteresis);
  }else{
    clone=source.clone(false);for(const child of source.children)clone.add(cloneTemplate(child));
  }
  return clone;
}
