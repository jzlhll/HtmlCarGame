import * as THREE from 'three';
import { cloudField } from './weather-world.js';
import { WEATHER, SCENERY } from './config.js';
import { surfaceCache } from './surface-assets.js';
import { cloudX, cloudZ } from './weather.js';

// 沿隐式团块场提取一个外壳，内部交叠面不会提交到GPU。
function* cloudGeometry(template) {
  const [nx,ny,nz]=WEATHER.meshGrid,sx=nx+1,sy=ny+1,stride=sx*sy;
  const field=new Float32Array(stride*(nz+1)),index=(x,y,z)=>z*stride+y*sx+x;
  for(let z=0;z<=nz;z++){
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)field[index(x,y,z)]=cloudField(x/nx-.5,y/ny-.5,z/nz-.5,template);
    yield;
  }
  const gradients=new Float32Array(field.length*3);
  for(let z=0;z<=nz;z++){
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
      const i=index(x,y,z)*3;
      gradients[i]=(field[index(Math.min(nx,x+1),y,z)]-field[index(Math.max(0,x-1),y,z)])*nx/WEATHER.width;
      gradients[i+1]=(field[index(x,Math.min(ny,y+1),z)]-field[index(x,Math.max(0,y-1),z)])*ny/WEATHER.height;
      gradients[i+2]=(field[index(x,y,Math.min(nz,z+1))]-field[index(x,y,Math.max(0,z-1))])*nz/WEATHER.length;
    }yield;
  }
  const offsets=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],positions=[],normals=[];
  const point=(a,b)=>{
    const t=a.value/(a.value-b.value),p=a.position.map((v,i)=>v+(b.position[i]-v)*t),n=a.normal.map((v,i)=>v+(b.normal[i]-v)*t),length=Math.hypot(...n)||1;
    return {p,n:n.map(v=>v/length)};
  };
  const triangle=(a,b,c)=>{
    const u=b.p.map((v,i)=>v-a.p[i]),v=c.p.map((n,i)=>n-a.p[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((sum,n,i)=>sum+n*(a.n[i]+b.n[i]+c.n[i]),0)<0)[b,c]=[c,b];
    for(const vertex of [a,b,c]){positions.push(...vertex.p);normals.push(...vertex.n);}
  };
  for(let z=0;z<nz;z++){
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const ids=offsets.map(o=>index(x+o[0],y+o[1],z+o[2]));
      if(ids.every(i=>field[i]>=0)||ids.every(i=>field[i]<0))continue;
      const corners=offsets.map((o,k)=>({value:field[ids[k]],position:[((x+o[0])/nx-.5)*WEATHER.width,((y+o[1])/ny-.5)*WEATHER.height,((z+o[2])/nz-.5)*WEATHER.length],normal:Array.from(gradients.subarray(ids[k]*3,ids[k]*3+3))}));
      for(const tetra of tetrahedra){
        const inside=tetra.filter(i=>corners[i].value<0),outside=tetra.filter(i=>corners[i].value>=0);
        if(!inside.length||!outside.length)continue;
        if(inside.length===2){
          const a=point(corners[inside[0]],corners[outside[0]]),b=point(corners[inside[0]],corners[outside[1]]),c=point(corners[inside[1]],corners[outside[0]]),d=point(corners[inside[1]],corners[outside[1]]);
          triangle(a,b,c);triangle(b,d,c);
        }else{
          const single=inside.length===1?inside[0]:outside[0],others=inside.length===1?outside:inside;
          triangle(...others.map(i=>point(corners[single],corners[i])));
        }
      }
    }yield;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return geometry;
}

// 云团和闪电骨架在准备阶段建立，飞行时只移动既有云与闪电顶点。
export class WeatherView extends THREE.Group {
  constructor(world){super();this.world=world;this.clouds=[];this.skyMix={value:0};this.skyTint={value:new THREE.Color(0xc8d1d3)};}
  *build(){
    const cache=surfaceCache(),geometries=[];
    for(let variant=0;variant<WEATHER.variants;variant++){
      const key='scene/weather/geometry/'+variant,record=cache.available?yield {wait:cache.read(key)}:null;
      let geometry;
      const hit=record?.positions instanceof Float32Array&&record.normals instanceof Float32Array&&record.positions.length===record.normals.length&&record.positions.length>0&&record.positions.length%9===0&&record.positions.every(Number.isFinite)&&record.normals.every(Number.isFinite);
      if(hit){
        geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(record.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(record.normals,3));
      }else{
        geometry=yield* cloudGeometry(this.world.weather.templates[variant]);
        if(cache.available)yield {wait:cache.write(key,{positions:geometry.attributes.position.array,normals:geometry.attributes.normal.array})};
      }
      geometry.computeBoundingSphere();geometries.push(geometry);console.info('Weather geometry prepared '+JSON.stringify({variant,cacheHit:hit,vertices:geometry.attributes.position.count}));yield;
    }
    const materials=new Map();
    for(const cloud of this.world.weather.clouds){
      const key=cloud.kind+cloud.thin;
      if(!materials.has(key)){
        const material=new THREE.MeshStandardMaterial({color:cloud.kind==='white'?0xe9eef0:0x687681,roughness:1,emissive:cloud.kind==='white'?0xa3b1b8:0x27323b,emissiveIntensity:.3,transparent:cloud.thin,opacity:cloud.thin?.38:1,depthWrite:!cloud.thin});
        material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 cloudLocalPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\ncloudLocalPosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 cloudLocalPosition;').replace('#include <color_fragment>','#include <color_fragment>\nfloat billowShade=clamp(cloudLocalPosition.y/'+WEATHER.height.toFixed(1)+'+.5,0.,1.);\ndiffuseColor.rgb*=mix(.76,1.06,billowShade);');};
        material.customProgramCacheKey=()=> 'solid-clouds-v4';materials.set(key,material);
      }
      const mesh=new THREE.Mesh(geometries[cloud.variant],materials.get(key));mesh.position.set(cloud.x,cloud.y,cloud.z);mesh.userData.cloudId=cloud.id;this.clouds.push(mesh);this.add(mesh);yield;
    }
    this.boltPositions=new Float32Array(18*6);const boltGeometry=new THREE.BufferGeometry();boltGeometry.setAttribute('position',new THREE.BufferAttribute(this.boltPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.bolt=new THREE.LineSegments(boltGeometry,new THREE.LineBasicMaterial({color:0xd5edff,transparent:true,opacity:0,depthWrite:false,depthTest:true,fog:false}));this.bolt.frustumCulled=false;this.add(this.bolt);
    this.flashLight=new THREE.PointLight(0xc9e6ff,0,10000,1);this.add(this.flashLight);yield;
  }
  installSky(sky){
    const material=sky.material,previous=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);shader.uniforms.cloudSkyMix=this.skyMix;shader.uniforms.cloudSkyTint=this.skyTint;shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float cloudSkyMix;uniform vec3 cloudSkyTint;').replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,cloudSkyTint,cloudSkyMix);\n#include <opaque_fragment>');};
    material.customProgramCacheKey=()=> 'weather-sky-v1';material.needsUpdate=true;
  }
  update(game,scene){
    const weather=game.weather;
    for(const mesh of this.clouds){const cloud=this.world.weather.clouds[mesh.userData.cloudId];mesh.position.x=cloudX(cloud,weather.seconds);mesh.position.z=cloudZ(cloud,weather.seconds);mesh.updateMatrix();}
    scene.fog.far=weather.visibility;scene.fog.near=weather.kind==='white'?35:SCENERY.fogNear*(weather.kind==='storm'?WEATHER.stormVisibilityRatio:1);
    const tint=weather.kind==='white'?0xcbd5d8:weather.kind==='storm'?0x657481:SCENERY.colors.skyHorizon;
    scene.fog.color.setHex(tint);scene.background.setHex(tint);this.skyTint.value.setHex(tint);this.skyMix.value=weather.strength*(weather.kind==='white'?.96:weather.kind==='storm'?.52:0);
    const flash=weather.flash,age=weather.seconds-flash.at,visible=age>=0&&age<WEATHER.flashSeconds;
    this.bolt.visible=visible;this.flashLight.intensity=visible?18*(1-age/WEATHER.flashSeconds):0;
    if(visible){
      this.flashLight.position.set(flash.endX,flash.endY+20,flash.endZ);this.bolt.material.opacity=(1-age/WEATHER.flashSeconds)*.9;
      if(this.lastFlash!==flash.at||this.runId!==game.runId){
        for(let i=0;i<18;i++)for(let end=0;end<2;end++){
          const t=(i+end)/18,jitter=t>0&&t<1?Math.sin((i+end)*13.71+flash.cloud)*40:0;
          this.boltPositions.set([flash.x+(flash.endX-flash.x)*t+jitter,flash.y+(flash.endY-flash.y)*t,flash.z+(flash.endZ-flash.z)*t+jitter*.6],(i*2+end)*3);
        }this.bolt.geometry.attributes.position.needsUpdate=true;this.lastFlash=flash.at;
      }
    }
    this.runId=game.runId;
  }
}
