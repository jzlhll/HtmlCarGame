import * as THREE from 'three';
import { SURFACE_APPEARANCE, LANDSCAPE, FACADE_SURFACE } from './config.js';
import { surfaceTexture } from './surface-assets.js';
import { buildingParts } from './building-layout.js';

export function* createCityBlocks(sites, floorAt=()=>0, shared={}) {
  const appearance=LANDSCAPE.city.facade;
  const group=new THREE.Group(),parts=sites.flatMap(site=>{
    let hash=Math.imul(Math.round(site.x),73856093)^Math.imul(Math.round(site.z),19349663)^FACADE_SURFACE.seed;
    hash=Math.imul(hash^(hash>>>13),1274126177)>>>0;
    const family=hash%4,phase=(hash>>>8)/16777216;
    return buildingParts(site).map(part=>({...part,color:site.color,floor:floorAt(site.x,site.z),family,phase}));
  });
  shared.cube??=new THREE.BoxGeometry(1,1,1);
  const geometry=new THREE.BufferGeometry();for(const [name,attribute] of Object.entries(shared.cube.attributes))geometry.setAttribute(name,attribute);geometry.setIndex(shared.cube.index);
  const sizes=new Float32Array(parts.length*3),styles=new Float32Array(parts.length*4);
  geometry.setAttribute('facadeSize',new THREE.InstancedBufferAttribute(sizes,3));
  geometry.setAttribute('facadeStyle',new THREE.InstancedBufferAttribute(styles,4));
  const material=shared.facadeMaterial??=new THREE.MeshPhysicalMaterial({map:surfaceTexture('facade-color'),roughnessMap:surfaceTexture('facade-detail'),bumpMap:surfaceTexture('facade-detail'),bumpScale:SURFACE_APPEARANCE.facadeBump*.55,roughness:appearance.roughness,metalness:appearance.metalness,clearcoat:appearance.clearcoat,clearcoatRoughness:appearance.clearcoatRoughness});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 facadeSize;attribute vec4 facadeStyle;varying float vFacadeLevel;varying vec4 vFacadeStyle;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vFacadeLevel=position.y+.5;vFacadeStyle=facadeStyle;
      vec2 facadeRepeat=vec2(abs(normal.x)>.5?facadeSize.z:facadeSize.x,facadeSize.y)/vec2(${appearance.tileMetres.map(value=>value.toFixed(1)).join(',')})*facadeStyle.x;
      vec2 facadeOffset=vec2(facadeStyle.w,facadeStyle.w*.618);
      #ifdef USE_MAP
      vMapUv=vMapUv*facadeRepeat+facadeOffset;
      #endif
      #ifdef USE_BUMPMAP
      vBumpMapUv=vBumpMapUv*facadeRepeat+facadeOffset;
      #endif
      #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv=vRoughnessMapUv*facadeRepeat+facadeOffset;
      #endif`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFacadeLevel;varying vec4 vFacadeStyle;');
    // 窗格接近亚像素时增大过滤足迹，同时淡出凹凸与粗糙度变化，避免远景摩尔纹。
    const filteredMap=THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','textureGrad(map,vMapUv,facadeDx*facadeFilter,facadeDy*facadeFilter)');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 facadeDx=dFdx(vMapUv),facadeDy=dFdy(vMapUv);
      vec2 facadeCells=vec2(${appearance.windowCells.map(value=>value.toFixed(1)).join(',')});
      float facadeFootprint=max(length(facadeDx*facadeCells),length(facadeDy*facadeCells));
      float facadeDetail=1.0-smoothstep(${appearance.detailFootprint.map(value=>value.toFixed(3)).join(',')},facadeFootprint);
      float facadeBlur=smoothstep(${FACADE_SURFACE.blurDistance[0].toFixed(1)},${FACADE_SURFACE.blurDistance[1].toFixed(1)},length(vViewPosition));
      float facadeFilter=1.0+(1.0-facadeDetail)*${FACADE_SURFACE.farFilter.toFixed(1)}*facadeBlur;
      ${filteredMap}
      vec4 facadeTex=textureGrad(roughnessMap,vRoughnessMapUv,facadeDx*facadeFilter,facadeDy*facadeFilter);
      float facadePane=facadeTex.b;
      float facadeGlass=facadePane*vFacadeStyle.y;
      vec3 facadeStone=mix(vec3(1.04,1.01,.92),vec3(.90,.94,.97),step(1.5,vFacadeStyle.z));
      vec3 facadeGlassTint=mix(vec3(.78,.96,1.08),vec3(1.04,.94,.79),step(2.5,vFacadeStyle.z));
      diffuseColor.rgb*=mix(facadeStone,facadeGlassTint,facadeGlass)*1.65*(.76+.24*smoothstep(0.0,.3,vFacadeLevel));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=mix(${FACADE_SURFACE.stoneRoughness.toFixed(2)},${FACADE_SURFACE.glassRoughness.toFixed(2)},facadeGlass);
      roughnessFactor=mix(max(roughnessFactor,${appearance.farRoughness.toFixed(3)}),roughnessFactor,facadeDetail);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`vec3 facadeSmoothNormal=normal;
      #include <normal_fragment_maps>
      normal=normalize(mix(facadeSmoothNormal,normal,facadeDetail));`);
  };
  material.customProgramCacheKey=()=> 'city-filtered-facades-v5';
  const mesh=new THREE.InstancedMesh(geometry,material,parts.length),pose=new THREE.Object3D(),color=new THREE.Color();
  const details=[],movements=[];
  const track=(target,index,x,z,shift)=>{if(shift)movements.push({target,index,x,z,shift});};
  for(const [index,part] of parts.entries()){
    pose.position.set(part.x,part.floor+part.y,part.z);pose.scale.set(part.width,part.height,part.depth);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);mesh.setColorAt(index,color.setHex(part.color));
    sizes.set([part.width,part.height,part.depth],index*3);
    const glass=part.role==='equipment'?.04:part.role==='podium'?.35:[.92,.62,.42,.76][part.family];
    styles.set([.78+part.phase*.58,glass,part.family,part.phase],index*4);
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
