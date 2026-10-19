import * as THREE from 'three';
import { SURFACE_APPEARANCE, LANDSCAPE } from './config.js';
import { surfaceTexture } from './surface-assets.js';
import { buildingParts } from './building-layout.js';

export function* createCityBlocks(sites, floorAt=()=>0, shared={}) {
  const appearance=LANDSCAPE.city.facade;
  const group=new THREE.Group(),parts=sites.flatMap(site=>buildingParts(site).map(part=>({...part,color:site.color,floor:floorAt(site.x,site.z)})));
  shared.cube??=new THREE.BoxGeometry(1,1,1);
  const geometry=new THREE.BufferGeometry();for(const [name,attribute] of Object.entries(shared.cube.attributes))geometry.setAttribute(name,attribute);geometry.setIndex(shared.cube.index);
  const sizes=new Float32Array(parts.length*3);
  geometry.setAttribute('facadeSize',new THREE.InstancedBufferAttribute(sizes,3));
  const material=shared.facadeMaterial??=new THREE.MeshPhysicalMaterial({map:surfaceTexture('facade-color'),roughnessMap:surfaceTexture('facade-detail'),bumpMap:surfaceTexture('facade-detail'),bumpScale:SURFACE_APPEARANCE.facadeBump*.55,roughness:appearance.roughness,metalness:appearance.metalness,clearcoat:appearance.clearcoat,clearcoatRoughness:appearance.clearcoatRoughness});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 facadeSize;varying float vFacadeLevel;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vFacadeLevel=position.y+.5;
      vec2 facadeRepeat=vec2(abs(normal.x)>.5?facadeSize.z:facadeSize.x,facadeSize.y)/vec2(${appearance.tileMetres.map(value=>value.toFixed(1)).join(',')});
      #ifdef USE_MAP
      vMapUv*=facadeRepeat;
      #endif
      #ifdef USE_BUMPMAP
      vBumpMapUv*=facadeRepeat;
      #endif
      #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv*=facadeRepeat;
      #endif`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFacadeLevel;');
    // 窗格接近亚像素时增大过滤足迹，同时淡出凹凸与粗糙度变化，避免远景摩尔纹。
    const filteredMap=THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','textureGrad(map,vMapUv,facadeDx*facadeFilter,facadeDy*facadeFilter)');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 facadeDx=dFdx(vMapUv),facadeDy=dFdy(vMapUv);
      vec2 facadeCells=vec2(${appearance.windowCells.map(value=>value.toFixed(1)).join(',')});
      float facadeFootprint=max(length(facadeDx*facadeCells),length(facadeDy*facadeCells));
      float facadeDetail=1.0-smoothstep(${appearance.detailFootprint.map(value=>value.toFixed(3)).join(',')},facadeFootprint);
      float facadeFilter=1.0+(1.0-facadeDetail)*${appearance.filterSpread.toFixed(1)};
      ${filteredMap}
      diffuseColor.rgb*=1.65*(.76+.24*smoothstep(0.0,.3,vFacadeLevel));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(max(roughnessFactor,${appearance.farRoughness.toFixed(3)}),roughnessFactor,facadeDetail);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`vec3 facadeSmoothNormal=normal;
      #include <normal_fragment_maps>
      normal=normalize(mix(facadeSmoothNormal,normal,facadeDetail));`);
  };
  material.customProgramCacheKey=()=> 'city-filtered-facades-v3';
  const mesh=new THREE.InstancedMesh(geometry,material,parts.length),pose=new THREE.Object3D(),color=new THREE.Color();
  const details=[],movements=[];
  const track=(target,index,x,z,shift)=>{if(shift)movements.push({target,index,x,z,shift});};
  for(const [index,part] of parts.entries()){
    pose.position.set(part.x,part.floor+part.y,part.z);pose.scale.set(part.width,part.height,part.depth);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);mesh.setColorAt(index,color.setHex(part.color));
    sizes.set([part.width,part.height,part.depth],index*3);
    track(mesh,index,part.x,part.z,part.shift);const detailStart=details.length;
    // 楼层交给过滤后的立面贴图；实体只保留屋顶、女儿墙与设备箱。
    const roof=part.floor+part.y+part.height/2;
    details.push({x:part.x,y:roof+appearance.roofThickness/2,z:part.z,w:part.width+.3,h:appearance.roofThickness,d:part.depth+.3});
    if(part.role==='equipment')for(const side of [-1,1])details.push({x:part.x+side*part.width*.7,y:roof-.9,z:part.z,w:part.width*.23,h:1.6,d:part.depth*.8});
    if(part.role!=='equipment')for(const side of [-1,1]){
      details.push({x:part.x+side*(part.width/2-appearance.parapetThickness/2),y:roof+appearance.parapetHeight/2,z:part.z,w:appearance.parapetThickness,h:appearance.parapetHeight,d:part.depth});
      details.push({x:part.x,y:roof+appearance.parapetHeight/2,z:part.z+side*(part.depth/2-appearance.parapetThickness/2),w:part.width,h:appearance.parapetHeight,d:appearance.parapetThickness});
    }
    for(let i=detailStart;i<details.length;i++)details[i].shift=part.shift;
    if(index%16===0)yield;
  }
  yield 'boundary';mesh.computeBoundingSphere();mesh.receiveShadow=true;group.add(mesh);
  const trim=new THREE.InstancedMesh(shared.cube,shared.trimMaterial??=new THREE.MeshStandardMaterial({color:0xa7aaa0,roughness:.82,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),details.length);
  for(const [index,part] of details.entries()){
    pose.position.set(part.x,part.y,part.z);pose.scale.set(part.w,part.h,part.d);pose.updateMatrix();trim.setMatrixAt(index,pose.matrix);
    track(trim,index,part.x,part.z,part.shift);
    if(index%128===0)yield;
  }
  yield 'boundary';trim.computeBoundingSphere();group.add(trim);
  const shadowMaterial=shared.shadowMaterial??=new THREE.MeshBasicMaterial({color:0x142323,transparent:true,opacity:.17,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  shadowMaterial.customProgramCacheKey=()=> 'city-ground-shadow-v1';
  shadowMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vShadowUv;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvShadowUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vShadowUv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=smoothstep(0.0,.14,min(min(vShadowUv.x,1.0-vShadowUv.x),min(vShadowUv.y,1.0-vShadowUv.y)));');
  };
  const shadowGeometry=shared.shadowGeometry??=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const shadows=new THREE.InstancedMesh(shadowGeometry,shadowMaterial,sites.length);
  for(const [index,site] of sites.entries()){
    pose.position.set(site.x+site.height*.16,floorAt(site.x,site.z)+.07,site.z+site.height*.12);pose.scale.set(site.width+site.height*.32,1,site.depth+site.height*.24);pose.rotation.set(0,0,0);pose.updateMatrix();shadows.setMatrixAt(index,pose.matrix);
    track(shadows,index,site.x+site.height*.16,site.z+site.height*.12,site.shift);
    if(index%32===0)yield;
  }
  yield 'boundary';shadows.computeBoundingSphere();group.add(shadows);
  if(movements.length){
    const update=()=>{
      for(const {target,index,x,z,shift}of movements){const offset=index*16;target.instanceMatrix.array[offset+12]=x+shift.x;target.instanceMatrix.array[offset+14]=z+shift.z;}
      for(const target of [mesh,trim,shadows]){target.instanceMatrix.needsUpdate=true;target.computeBoundingSphere();}
    };
    update();shared.variationViews?.push(update);
  }
  return group;
}
