import * as THREE from 'three';
import { COUNTRYSIDE } from './config.js';
import { terrainNoise } from './terrain.js';
import { surfaceTexture } from './surface-assets.js';
import { restoreCountryside, saveCountryside } from './countryside-cache.js';

// 所有田块、田埂和路面在准备阶段贴合实际三角地形，飞行时只复用。
export function* createCountryside({width, length, centerZ=0, seed, heightAt, landAt=()=>true, roadZ, trees, forestOnly=false, treeHeight=[14,34], treeArea=COUNTRYSIDE.treeArea, treeNear=COUNTRYSIDE.treeNear, treeFar=COUNTRYSIDE.treeFar}) {
  const group=new THREE.Group(), fieldPositions=[],fieldColors=[],fieldUv=[],fieldIndices=[];
  const roadPositions=[],roadColors=[],roadUv=[],roadIndices=[],landUses=[];
  const color=new THREE.Color(), settings=COUNTRYSIDE;
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const roadCenter=roadZ||((x)=>centerZ+Math.sin(x*.0008+seed)*length*.17+length*.17);
  const fieldMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  fieldMaterial.userData.detailTexture=surfaceTexture('terrain-detail');fieldMaterial.userData.landUniforms=new Set();
  fieldMaterial.customProgramCacheKey=()=> 'country-crops-v2';
  fieldMaterial.onBeforeCompile=shader=>{
    shader.uniforms.countryDetail={value:fieldMaterial.userData.detailTexture};fieldMaterial.userData.landUniforms.add(shader.uniforms.countryDetail);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCropUv;attribute float landUse;varying float vLandUse;varying vec2 vCountryWorld;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvCropUv=uv;vLandUse=landUse;vCountryWorld=(modelMatrix*vec4(position,1.0)).xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vCropUv;varying float vLandUse;varying vec2 vCountryWorld;uniform sampler2D countryDetail;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float edge=min(min(vCropUv.x,vCropUv.y),min(1.0-vCropUv.x,1.0-vCropUv.y));
      float rows=.92+.08*sin(vCropUv.x*340.0+sin(vCropUv.y*5.0)*1.8);
      float furrow=mix(rows,1.0,smoothstep(450.0,4000.0,length(vViewPosition)));
      float canopy=.88+.12*sin(vCropUv.x*117.0+sin(vCropUv.y*67.0)*2.0)*cos(vCropUv.y*131.0);
      vec2 warp=vec2(sin(vCountryWorld.y*.0007),cos(vCountryWorld.x*.0009))*.27;
      float soil=.7+texture2D(countryDetail,vCountryWorld*.0031+warp).r*.6;
      diffuseColor.rgb*=soil*mix(mix(.62,furrow,smoothstep(.006,.027,edge)),canopy,vLandUse);
`);
  };
  const roadMaterial=createRoadMaterial(),cacheKey='scene/country/'+seed+'-'+width+'-'+length+'-'+centerZ+'-'+Number(forestOnly)+'-'+treeHeight.join('_');
  const restored=yield* restoreCountryside(cacheKey,fieldMaterial,roadMaterial,trees,centerZ,{treeNear,treeFar});if(restored)return restored;
  const flushFields=()=>{
    if(!fieldPositions.length)return;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(fieldPositions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(fieldColors,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(fieldUv,2));geometry.setAttribute('landUse',new THREE.Float32BufferAttribute(landUses,1));
    geometry.setIndex(fieldIndices);geometry.computeVertexNormals();geometry.computeBoundingSphere();group.add(new THREE.Mesh(geometry,fieldMaterial));
    fieldPositions.length=fieldColors.length=fieldUv.length=fieldIndices.length=landUses.length=0;
  };
  const nx=Math.max(3,Math.floor(width/settings.fieldSpacing)),nz=Math.max(2,Math.floor(length/settings.fieldDepth));
  for(let row=0;row<nz;row++){
    for(let col=0;col<nx;col++){
      const cellW=width/nx,cellD=length/nz,cx=(col+.5)*cellW-width/2,cz=centerZ+(row+.5)*cellD-length/2;
      const left=cx-cellW*(.42+random()*.025),right=cx+cellW*(.42+random()*.025);
      const back=cz-cellD*(.4+random()*.04),front=cz+cellD*(.4+random()*.04),skew=(random()-.5)*cellW*.15;
      const woodland=terrainNoise(cx*.0023,cz*.0023,seed+71)>.61;
      if(forestOnly||Math.abs(cz-roadCenter(cx))<cellD*.42+settings.roadWidth||!landAt(cx,cz))continue;
      const h=heightAt(cx,cz),rise=Math.max(Math.abs(heightAt(cx+cellW*.35,cz)-h),Math.abs(heightAt(cx,cz+cellD*.35)-h));
      if(h<0||rise/cellW>.21)continue;
      const first=fieldPositions.length/3,n=8;
      color.setHex(woodland?0x465b37:settings.fieldColors[Math.floor(random()*settings.fieldColors.length)]).multiplyScalar(.9+random()*.16);
      for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
        const u=ix/n,v=iz/n,x=left+(right-left)*u+skew*(v-.5)+Math.sin(v*Math.PI*2+row)*cellW*.045,z=back+(front-back)*v+Math.sin(u*Math.PI*2+col)*cellD*.035;
        fieldPositions.push(x,heightAt(x,z)+.11,z);fieldUv.push(u,v);landUses.push(woodland?1:0);fieldColors.push(color.r,color.g,color.b);
        if(ix&&iz){const a=first+(iz-1)*(n+1)+ix-1,b=a+n+1;fieldIndices.push(a,b,a+1,a+1,b,b+1);}
      }
      if(col%3===0)yield;
    }
    if((row+1)%4===0){flushFields();yield 'boundary';}else yield;
  }
  flushFields();yield 'boundary';
  // 同一条连续公路包含路肩、边线与中央虚线，不用一条无细节色带充数。
  const samples=Math.ceil(width/32),half=width/2-40;
  for(let i=0;i<=samples;i++){
    const x=-half+i/samples*half*2,z=roadCenter(x),dz=(roadCenter(x+1)-roadCenter(x-1))/2;
    const norm=Math.hypot(1,dz),base=roadPositions.length/3;
    for(const side of [-1,1]){
      const px=x-side*dz/norm*settings.roadWidth/2,pz=z+side/norm*settings.roadWidth/2;
      roadPositions.push(px,heightAt(px,pz)+.24,pz);roadColors.push(1,1,1);roadUv.push((side+1)/2,x+half);
    }
    if(i&&landAt(x,z)&&landAt(x-half*2/samples,roadCenter(x-half*2/samples))&&heightAt(x,z)>=0){const a=base-2;roadIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
    if(i%24===0)yield;
  }
  const roadGeometry=new THREE.BufferGeometry();roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadPositions,3));roadGeometry.setAttribute('color',new THREE.Float32BufferAttribute(roadColors,3));roadGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(roadUv,2));roadGeometry.setIndex(roadIndices);roadGeometry.computeVertexNormals();group.add(new THREE.Mesh(roadGeometry,roadMaterial));
  yield 'boundary';
  // 林带沿田块和道路成簇分布，避免均匀散点铺满整块绿色地面。
  if(trees){
    const count=Math.floor(width*length/treeArea),forest=new THREE.InstancedMesh(trees.geometry,trees.material,count),pose=new THREE.Object3D();let live=0;
    for(let i=0;i<count*3&&live<count;i++){
      if(i%64===0)yield;
      const x=(random()-.5)*width,z=centerZ+(random()-.5)*length;
      const cluster=terrainNoise(x*.0023,z*.0023,seed+71),nearRoad=Math.abs(z-roadCenter(x));
      if(cluster<(forestOnly?.38:.58)||!forestOnly&&nearRoad<settings.roadWidth||!landAt(x,z))continue;
      const y=heightAt(x,z);if(y<0||y>3600)continue;
      const scale=treeHeight[0]+random()*(treeHeight[1]-treeHeight[0]);pose.position.set(x,y-.2,z);pose.scale.setScalar(scale);pose.rotation.y=random()*Math.PI*2;pose.updateMatrix();forest.setMatrixAt(live,pose.matrix);forest.setColorAt(live,color.setHex(settings.treeColors[i%settings.treeColors.length]));live++;
      if(i%128===0)yield;
    }
    forest.count=live;forest.computeBoundingSphere();yield 'boundary';
    const lod=new THREE.LOD();lod.position.z=centerZ;forest.position.z=-centerZ;lod.addLevel(forest,0,.12);
    if(trees.farGeometry){
      const far=new THREE.InstancedMesh(trees.farGeometry,trees.farMaterial,0);far.count=live;far.instanceMatrix=forest.instanceMatrix;far.instanceColor=forest.instanceColor;far.position.z=-centerZ;far.boundingSphere=forest.boundingSphere.clone();far.boundingSphere.radius+=4;lod.addLevel(far,treeNear,.12);
    }
    lod.addLevel(new THREE.Group(),treeFar,.12);group.add(lod);
  }
  yield* saveCountryside(cacheKey,group,fieldMaterial);
  return group;
}

export function createRoadMaterial() {
  const roadMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  roadMaterial.customProgramCacheKey=()=> 'country-roads-v1';
  roadMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vRoadUv;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvRoadUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vRoadUv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float edge=abs(vRoadUv.x-.5),border=1.0-smoothstep(.009,.018,abs(edge-.375));
      float median=(1.0-smoothstep(.005,.018,edge))*step(.48,fract(vRoadUv.y*.045));
      vec3 pavement=mix(vec3(.075,.085,.087),vec3(.20,.18,.135),smoothstep(.41,.46,edge));
      float grain=fract(sin(dot(vRoadUv,vec2(812.4,327.7)))*43758.5)*.035;
      diffuseColor.rgb=(pavement+grain)*mix(vec3(1),vec3(2.6,2.5,2.1),max(border,median));`);
  };
  return roadMaterial;
}
