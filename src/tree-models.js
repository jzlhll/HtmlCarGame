import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TREE_MODELS } from './config.js';
import { treeProfiles } from './tree-species.js';
import { surfaceCache, surfaceTexture } from './surface-assets.js';

function markPart(geometry,foliage,color){
  const count=geometry.attributes.position.count,colors=new Float32Array(count*3),flags=new Float32Array(count);
  for(let i=0;i<count;i++){colors.set(color,i*3);flags[i]=foliage;}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('foliage',new THREE.BufferAttribute(flags,1));return geometry;
}

function* treeGeometry(profile,far) {
  const parts=[],detail=far?TREE_MODELS.farDetail:TREE_MODELS.nearDetail;
  for(const [index,p]of profile.leaves.entries()){
    if(far&&profile.type===3&&index%2)continue;
    const crown=new THREE.IcosahedronGeometry(1,detail),position=crown.attributes.position,normal=crown.attributes.normal;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),noise=1+.065*Math.sin(x*17+y*13+z*23+index*4.1);
      position.setXYZ(i,p.x+x*p.rx*noise,p.y+y*p.ry*noise,p.z+z*p.rz*noise);
      const nx=x/p.rx,ny=y/p.ry,nz=z/p.rz,length=Math.hypot(nx,ny,nz);normal.setXYZ(i,nx/length,ny/length,nz/length);
    }
    const light=.86+(index%4)*.055;parts.push(markPart(crown,1,[light,light,light*.94]));yield;
  }
  for(const [index,branch]of profile.branches.entries()){
    if(far&&!branch.solid&&index%2)continue;
    const curve=new THREE.CatmullRomCurve3(branch.points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5);
    const tube=new THREE.TubeGeometry(curve,far?4:TREE_MODELS.branchSegments,branch.radius,far?3:6,false).toNonIndexed();
    parts.push(markPart(tube,0,[1,1,1]));yield;
  }
  for(const [index,points]of profile.roots.entries()){
    if(far&&index%3)continue;
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5);
    parts.push(markPart(new THREE.TubeGeometry(curve,far?2:5,profile.type===1?.0045:.007,3,false).toNonIndexed(),profile.type===1?0:1,[.9,.92,.85]));yield;
  }
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

// 十二份可复用原型持久缓存；不同树种分实例批次，飞行中不创建枝叶。
export function* prepareTreeModels() {
  const cache=surfaceCache(),bank=[];yield {wait:cache.ready};
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:surfaceTexture('terrain-detail')});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float foliage;varying float vFoliage;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFoliage=foliage;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFoliage;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(vec3(.30,.19,.095),diffuseColor.rgb,vFoliage);').replace('#include <map_fragment>','diffuseColor.rgb*=mix(.74,1.28,texture2D(map,vMapUv*4.).r);');
  };
  material.customProgramCacheKey=()=> 'six-tree-species-v1';
  for(const profile of treeProfiles){
    const model={material,farMaterial:material};
    for(const far of [false,true]){
      const key='scene/trees/'+profile.id+'/'+Number(far),record=cache.available?yield {wait:cache.read(key)}:null;
      const count=record?.position?.length/3;
      const hit=Number.isInteger(count)&&count>0&&count%3===0&&['position','normal','uv','color','foliage'].every(name=>record[name] instanceof Float32Array&&record[name].length===count*(name==='uv'?2:name==='foliage'?1:3)&&record[name].every(Number.isFinite));
      let geometry;
      if(hit){geometry=new THREE.BufferGeometry();for(const name of ['position','normal','uv','color','foliage'])geometry.setAttribute(name,new THREE.BufferAttribute(record[name],name==='uv'?2:name==='foliage'?1:3));geometry.computeBoundingBox();geometry.computeBoundingSphere();}
      else{
        geometry=yield* treeGeometry(profile,far);
        if(cache.available)yield {wait:cache.write(key,Object.fromEntries(Object.entries(geometry.attributes).map(([name,attribute])=>[name,attribute.array])))};
      }
      model[far?'farGeometry':'geometry']=geometry;console.info('Tree prototype prepared '+JSON.stringify({species:profile.id,far,cacheHit:hit,vertices:geometry.attributes.position.count}));yield;
    }
    bank.push(model);
  }
  return bank;
}
