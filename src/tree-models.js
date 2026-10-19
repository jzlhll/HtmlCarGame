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

function distantCrowns(profile){
  const count=TREE_MODELS.farCrownGroups[profile.type],groups=Array.from({length:count},()=>[]),vertical=profile.type===0||profile.type===3;
  for(const p of profile.leaves){
    const t=vertical?p.y:(Math.atan2(p.z,p.x)+Math.PI)/(Math.PI*2),index=Math.min(count-1,Math.floor(t*count));groups[index].push(p);
  }
  return groups.filter(group=>group.length).map(group=>{
    const x0=Math.min(...group.map(p=>p.x-p.rx)),x1=Math.max(...group.map(p=>p.x+p.rx)),y0=Math.min(...group.map(p=>p.y-p.ry)),y1=Math.max(...group.map(p=>p.y+p.ry)),z0=Math.min(...group.map(p=>p.z-p.rz)),z1=Math.max(...group.map(p=>p.z+p.rz));
    return {x:(x0+x1)/2,y:(y0+y1)/2,z:(z0+z1)/2,rx:(x1-x0)/2,ry:(y1-y0)/2,rz:(z1-z0)/2};
  });
}

function leafSprayGeometry(profile,p,index,level){
  const count=level===0?TREE_MODELS.leafCards[profile.type]:TREE_MODELS.midLeafCards,positions=[],normals=[],uvs=[];
  const tile=profile.type===4?1:profile.type===2?2:profile.type===3?3:0;
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,angle=i*2.399963+index*1.17+profile.type*.71,r=Math.sqrt(1-y*y),n=new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
    const right=new THREE.Vector3().crossVectors(n,Math.abs(y)>.85?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(n,right).normalize();
    const roll=Math.sin(index*7.1+i*3.7)*.6,rightRot=right.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up,Math.sin(roll)),upRot=up.clone().multiplyScalar(Math.cos(roll)).addScaledVector(right,-Math.sin(roll));
    const normal=new THREE.Vector3(n.x/p.rx,n.y/p.ry+.8,n.z/p.rz).normalize();
    for(const [x,y,u,v]of [[-1,-1,0,0],[1,-1,1,0],[-1,1,0,1],[-1,1,0,1],[1,-1,1,0],[1,1,1,1]]){
      const q=n.clone().multiplyScalar(.30).addScaledVector(rightRot,x*.62).addScaledVector(upRot,y*.72);
      positions.push(p.x+q.x*p.rx,p.y+q.y*p.ry,p.z+q.z*p.rz);normals.push(normal.x,normal.y,normal.z);uvs.push((tile%2+.025+u*.95)/2,(Math.floor(tile/2)+.025+v*.95)/2);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));return geometry;
}

function* treeGeometry(profile,level) {
  const far=level>0,distant=level===2;
  const parts=[],detail=far?TREE_MODELS.farDetail:TREE_MODELS.nearDetail;
  for(const [index,p]of (distant?distantCrowns(profile):profile.leaves).entries()){
    if(level===1&&profile.type===3&&index%2)continue;
    if(!distant){
      const light=.92+(index%4)*.035;parts.push(markPart(leafSprayGeometry(profile,p,index,level),2,[light,light,light*.94]));yield;continue;
    }
    const crown=new THREE.IcosahedronGeometry(1,detail),position=crown.attributes.position,normal=crown.attributes.normal;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),noise=1+.065*Math.sin(x*17+y*13+z*23+index*4.1);
      position.setXYZ(i,p.x+x*p.rx*noise,p.y+y*p.ry*noise,p.z+z*p.rz*noise);
      const nx=x/p.rx,ny=y/p.ry,nz=z/p.rz,length=Math.hypot(nx,ny,nz);normal.setXYZ(i,nx/length,ny/length,nz/length);
    }
    const light=.86+(index%4)*.055;parts.push(markPart(crown,1,[light,light,light*.94]));yield;
  }
  for(const [index,branch]of profile.branches.entries()){
    if(distant&&index!==0||level===1&&(!branch.solid||index>0&&index%3))continue;
    const curve=new THREE.CatmullRomCurve3(branch.points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5);
    const source=new THREE.TubeGeometry(curve,distant?2:far?3:TREE_MODELS.branchSegments,branch.radius,far?3:6,false),pos=source.attributes.position;
    for(let i=0;i<pos.count;i++){
      const t=source.attributes.uv.getX(i),center=curve.getPointAt(t),taper=1-.72*t;
      pos.setXYZ(i,center.x+(pos.getX(i)-center.x)*taper,center.y+(pos.getY(i)-center.y)*taper,center.z+(pos.getZ(i)-center.z)*taper);
    }
    source.computeVertexNormals();const tube=source.toNonIndexed();source.dispose();
    parts.push(markPart(tube,0,[1,1,1]));yield;
  }
  for(const [index,points]of profile.roots.entries()){
    if(far)continue;
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5);
    parts.push(markPart(new THREE.TubeGeometry(curve,far?2:5,profile.type===1?.0045:.007,3,false).toNonIndexed(),profile.type===1?0:1,[.9,.92,.85]));yield;
  }
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

// 六种树各有近、中、远三份共享原型；远处只保留主干与冠形，不生成细枝垂根。
export function* prepareTreeModels() {
  const cache=surfaceCache(),bank=[];yield {wait:cache.ready};
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:surfaceTexture('terrain-detail'),side:THREE.DoubleSide});
  const compile=shader=>{
    shader.uniforms.foliageAtlas={value:surfaceTexture('foliage-color')};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float foliage;varying float vFoliage;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFoliage=foliage;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFoliage;uniform sampler2D foliageAtlas;').replace('#include <map_fragment>',`
      if(vFoliage>1.5){
        vec4 leaf=texture2D(foliageAtlas,vMapUv);float footprint=max(fwidth(vMapUv.x),fwidth(vMapUv.y));
        float cut=mix(${TREE_MODELS.leafAlphaCutoff},.22,smoothstep(.003,.035,footprint));if(leaf.a<cut)discard;
        diffuseColor.rgb*=leaf.rgb;
      }else if(vFoliage>.5){diffuseColor.rgb*=mix(.80,1.20,texture2D(map,vMapUv*4.).r);}
      else{
        float grain=texture2D(map,vec2(vMapUv.y*1.4,vMapUv.x*3.)).r;
        float fissure=smoothstep(.6,.94,sin(vMapUv.y*77.+sin(vMapUv.x*17.)*1.4));
        diffuseColor.rgb=vec3(.27,.17,.085)*(.72+grain*.6)*(1.-fissure*.32);
      }
    `);
  };
  material.onBeforeCompile=compile;material.customProgramCacheKey=()=> 'six-tree-leaf-sprays-v3';
  const farMaterial=material.clone();farMaterial.side=THREE.FrontSide;farMaterial.onBeforeCompile=compile;farMaterial.customProgramCacheKey=material.customProgramCacheKey;
  for(const profile of treeProfiles){
    const model={material,midMaterial:material,farMaterial};
    for(const level of [0,1,2]){
      const key='scene/trees/'+profile.id+'/'+level,record=cache.available?yield {wait:cache.read(key)}:null;
      const count=record?.position?.length/3;
      const hit=Number.isInteger(count)&&count>0&&count%3===0&&['position','normal','uv','color','foliage'].every(name=>record[name] instanceof Float32Array&&record[name].length===count*(name==='uv'?2:name==='foliage'?1:3)&&record[name].every(Number.isFinite));
      let geometry;
      if(hit){geometry=new THREE.BufferGeometry();for(const name of ['position','normal','uv','color','foliage'])geometry.setAttribute(name,new THREE.BufferAttribute(record[name],name==='uv'?2:name==='foliage'?1:3));geometry.computeBoundingBox();geometry.computeBoundingSphere();}
      else{
        geometry=yield* treeGeometry(profile,level);
        if(cache.available)yield {wait:cache.write(key,Object.fromEntries(Object.entries(geometry.attributes).map(([name,attribute])=>[name,attribute.array])))};
      }
      model[['geometry','midGeometry','farGeometry'][level]]=geometry;console.info('Tree prototype prepared '+JSON.stringify({species:profile.id,level,cacheHit:hit,vertices:geometry.attributes.position.count}));yield;
    }
    bank.push(model);
  }
  return bank;
}
