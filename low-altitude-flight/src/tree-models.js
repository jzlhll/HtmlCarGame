import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TREE_MODELS, VIEW_DISTANCE } from './config.js';
import { treeProfiles } from './tree-species.js';
import { indexTreeGeometry } from './tree-indexing.js';
import { surfaceCache, surfaceTexture } from './surface-assets.js';

function markPart(geometry,foliage,color){
  const count=geometry.attributes.position.count,colors=new Float32Array(count*3),flags=new Float32Array(count);
  for(let i=0;i<count;i++){for(let c=0;c<3;c++)colors[i*3+c]=color[c]*(geometry.attributes.color?.array[i*3+c]??1);flags[i]=foliage;}
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

// 近处每片叶子具有独立轮廓和折脊，避免整张枝叶照片贴片占满视野。
function leafBladeGeometry(profile,p,index){
  const positions=[],normals=[],uvs=[],colors=[],indices=[],count=TREE_MODELS.leaflets[profile.type];
  const random=i=>{const v=Math.sin(i*127.1+index*311.7+profile.type*74.7+TREE_MODELS.seed)*43758.5453;return v-Math.floor(v);};
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,a=i*2.399963+index*1.17,r=Math.sqrt(1-y*y),n=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
    const right=new THREE.Vector3().crossVectors(n,Math.abs(y)>.85?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(n,right).normalize();
    const roll=random(i+19)*Math.PI*2,c=Math.cos(roll),t=Math.sin(roll),across=right.clone().multiplyScalar(c).addScaledVector(up,t),along=up.clone().multiplyScalar(c).addScaledVector(right,-t);
    const center=n.clone().multiplyScalar(.22+random(i+51)*.48),length=(.13+random(i+73)*.11)*(profile.type===2?1.3:1),width=length*(profile.type===3?.12:profile.type===2?.19:profile.type===4?.70:.47),shade=.80+random(i+91)*.32;
    const slender=profile.type===2||profile.type===3;
    const points=slender?[[0,-.5,0,.5,0],[1,0,.02,1,.5],[0,.5,0,.5,1],[-1,0,.02,0,.5]]:[[0,-.5,0,.5,0],[.82,-.22,.01,.91,.28],[.78,.18,.01,.89,.68],[0,.5,0,.5,1],[-.78,.18,.01,.11,.68],[-.82,-.22,.01,.09,.28]];
    const centerIndex=points.length;points.push([0,0,.08,.5,.5]);
    const base=positions.length/3;
    for(let edge=0;edge<centerIndex;edge++)indices.push(base+edge,base+(edge+1)%centerIndex,base+centerIndex);
    for(const point of points){
      const[x,y,z,u,v]=point,q=center.clone().addScaledVector(across,x*width).addScaledVector(along,y*length).addScaledVector(n,z*length);
      const normal=n.clone().addScaledVector(across,-x*.18).addScaledVector(along,-y*.18);
      normal.set(normal.x/p.rx,normal.y/p.ry,normal.z/p.rz).normalize();
      positions.push(p.x+q.x*p.rx,p.y+q.y*p.ry,p.z+q.z*p.rz);normals.push(normal.x,normal.y,normal.z);uvs.push(u,v);colors.push(shade,shade,shade*.98);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);return geometry;
}

function leafSprayGeometry(profile,p,index){
  const count=TREE_MODELS.midLeafCards,positions=[],normals=[],uvs=[];
  const tile=profile.type===4?1:profile.type===2?2:profile.type===3?3:0;
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,angle=i*2.399963+index*1.17+profile.type*.71,r=Math.sqrt(1-y*y),n=new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
    const right=new THREE.Vector3().crossVectors(n,Math.abs(y)>.85?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(n,right).normalize();
    const roll=Math.sin(index*7.1+i*3.7)*.6,rightRot=right.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up,Math.sin(roll)),upRot=up.clone().multiplyScalar(Math.cos(roll)).addScaledVector(right,-Math.sin(roll));
    // 小枝叶簇分散在冠团内部，避免大张交叉卡片形成整片叶墙。
    const depth=.38,width=.46,height=.54;
    const normal=new THREE.Vector3();
    for(const [x,y,u,v]of [[-1,-1,0,0],[1,-1,1,0],[-1,1,0,1],[-1,1,0,1],[1,-1,1,0],[1,1,1,1]]){
      const q=n.clone().multiplyScalar(depth).addScaledVector(rightRot,x*width).addScaledVector(upRot,y*height);
      normal.copy(n).addScaledVector(rightRot,x*.18).addScaledVector(upRot,y*.18);
      normal.set(normal.x/p.rx,normal.y/p.ry,normal.z/p.rz).normalize();
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
      const light=.92+(index%4)*.035;parts.push(markPart(level===0?leafBladeGeometry(profile,p,index):leafSprayGeometry(profile,p,index),level===0?3:2,[light,light,light*.94]));yield;continue;
    }
    const crown=new THREE.IcosahedronGeometry(1,detail),position=crown.attributes.position,normal=crown.attributes.normal;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),noise=1+.065*Math.sin(x*17+y*13+z*23+index*4.1);
      position.setXYZ(i,p.x+x*p.rx*noise,p.y+y*p.ry*noise,p.z+z*p.rz*noise);
      const nx=x/p.rx,ny=y/p.ry,nz=z/p.rz,length=Math.hypot(nx,ny,nz);normal.setXYZ(i,nx/length,ny/length,nz/length);
    }
    const light=.86+(index%4)*.055;markPart(crown,1,[light,light,light*.94]);
    const uv=crown.attributes.uv,colors=crown.attributes.color,tile=profile.type===4?1:profile.type===2?2:profile.type===3?3:0;
    for(let i=0;i<position.count;i++){
      const shade=.80+.24*Math.max(0,Math.min(1,(position.getY(i)-p.y)/p.ry*.5+.5));
      colors.setXYZ(i,colors.getX(i)*shade,colors.getY(i)*shade,colors.getZ(i)*shade);
      uv.setXY(i,(tile%2+.025+(uv.getX(i)%1)*.95)/2,(Math.floor(tile/2)+.025+uv.getY(i)*.95)/2);
    }
    parts.push(crown);yield;
  }
  for(const [index,branch]of profile.branches.entries()){
    if(distant&&index!==0||level===1&&(!branch.solid||index>0&&index%3))continue;
    const curve=new THREE.CatmullRomCurve3(branch.points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5);
    const source=new THREE.TubeGeometry(curve,distant?2:far?3:TREE_MODELS.branchSegments,branch.radius,far?3:6,false),pos=source.attributes.position;
    for(let i=0;i<pos.count;i++){
      const t=source.attributes.uv.getX(i),center=curve.getPointAt(t),taper=1-.72*t;
      pos.setXYZ(i,center.x+(pos.getX(i)-center.x)*taper,center.y+(pos.getY(i)-center.y)*taper,center.z+(pos.getZ(i)-center.z)*taper);
    }
    source.computeVertexNormals();const tube=level===0?source:source.toNonIndexed();if(level!==0)source.dispose();
    parts.push(markPart(tube,0,[1,1,1]));yield;
  }
  for(const [index,points]of profile.roots.entries()){
    if(far)continue;
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5);
    parts.push(markPart(new THREE.TubeGeometry(curve,5,profile.type===1?.0045:.007,3,false),profile.type===1?0:1,[.9,.92,.85]));yield;
  }
  const merged=mergeGeometries(parts);parts.forEach(p=>p.dispose());const geometry=yield* indexTreeGeometry(merged);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

// 六种树各有近、中、远三份共享原型；远处只保留主干与冠形，不生成细枝垂根。
export function* prepareTreeModels() {
  const cache=surfaceCache(),bank=[];yield {wait:cache.ready};
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:surfaceTexture('terrain-detail'),side:THREE.DoubleSide,alphaToCoverage:true});
  const compile=shader=>{
    shader.uniforms.foliageAtlas={value:surfaceTexture('foliage-color')};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float foliage;varying float vFoliage;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFoliage=foliage;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFoliage;uniform sampler2D foliageAtlas;').replace('#include <map_fragment>',`
      if(vFoliage>2.5){
        float rib=1.0-smoothstep(.015,.05,abs(vMapUv.x-.5));
        float veins=pow(max(0.0,cos((vMapUv.y-abs(vMapUv.x-.5)*.45)*45.0)),12.0);
        diffuseColor.rgb*=(.90+.14*vMapUv.y)*(1.0-rib*.10-veins*.035);
      }else if(vFoliage>1.5){
        vec4 leaf=texture2D(foliageAtlas,vMapUv);float footprint=max(fwidth(vMapUv.x),fwidth(vMapUv.y));
        float cut=mix(${TREE_MODELS.leafAlphaCutoff},.22,smoothstep(.003,.035,footprint));if(leaf.a<cut)discard;
        diffuseColor.rgb*=leaf.rgb;
      }else if(vFoliage>.5){
        float crownMip=smoothstep(${TREE_MODELS.blurDistance[0].toFixed(1)},${TREE_MODELS.blurDistance[1].toFixed(1)},length(vViewPosition))*1.5;
        vec4 crownLeaf=texture2D(foliageAtlas,vMapUv,crownMip);
        float rim=abs(dot(normalize(vNormal),normalize(vViewPosition)));
        if(rim<.18&&crownLeaf.a<.14)discard;
        diffuseColor.rgb*=.80+crownLeaf.g*.34;
      }
      else{
        float grain=texture2D(map,vec2(vMapUv.y*1.4,vMapUv.x*3.)).r;
        float fissure=smoothstep(.6,.94,sin(vMapUv.y*77.+sin(vMapUv.x*17.)*1.4));
        diffuseColor.rgb=vec3(.28,.23,.145)*(.72+grain*.6)*(1.-fissure*.32);
      }
    `);
    // 只淡出整棵树的远端覆盖率，不更换几何；多重采样覆盖保持深度和实体边缘稳定。
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`
      float forestCoverage=1.0-smoothstep(${(TREE_MODELS.fadeStart*VIEW_DISTANCE.scale).toFixed(1)},${(TREE_MODELS.visibleDistance*VIEW_DISTANCE.scale).toFixed(1)},length(vViewPosition));
      diffuseColor.a*=forestCoverage;
      if(diffuseColor.a<.001)discard;
      #include <alphatest_fragment>
    `);
    // 实例绿只染枝叶，避免树皮再乘深绿而变成黑条。
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`if(vFoliage>.5){
      #include <color_fragment>
    }`);
    // 中景叶簇使用冠形法线；背面不翻向冠内，近叶保留双面光照。

    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
      if(vFoliage>1.5&&vFoliage<2.5)normal=normalize(vNormal);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      if(vFoliage>.5)totalEmissiveRadiance+=diffuseColor.rgb*${TREE_MODELS.leafLightFill.toFixed(2)};`);
  };
  material.onBeforeCompile=compile;material.customProgramCacheKey=()=> 'six-tree-leaf-sprays-v6';
  const farMaterial=material.clone();farMaterial.side=THREE.FrontSide;farMaterial.onBeforeCompile=compile;farMaterial.customProgramCacheKey=material.customProgramCacheKey;
  for(const profile of treeProfiles){
    const leafSize=Math.max(...profile.leaves.map(p=>Math.max(p.rx,p.ry,p.rz)))*.24*(profile.type===2?1.3:profile.type===4?1.4:1);
    const model={material,midMaterial:material,farMaterial,leafSize};
    for(const level of [0,1,2]){
      const key='scene/trees/'+profile.id+'/'+level,record=cache.readable?yield {wait:cache.read(key)}:null;
      const count=record?.position?.length/3;
      const hit=Number.isInteger(count)&&count>0&&(record.index instanceof Uint16Array||record.index instanceof Uint32Array)&&record.index.length>0&&record.index.length%3===0&&record.index.every(i=>i<count)&&['position','normal','uv','color','foliage'].every(name=>record[name] instanceof Float32Array&&record[name].length===count*(name==='uv'?2:name==='foliage'?1:3)&&record[name].every(Number.isFinite));
      let geometry;
      if(hit){geometry=new THREE.BufferGeometry();for(const name of ['position','normal','uv','color','foliage'])geometry.setAttribute(name,new THREE.BufferAttribute(record[name],name==='uv'?2:name==='foliage'?1:3));geometry.setIndex(new THREE.BufferAttribute(record.index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();}
      else{
        geometry=yield* treeGeometry(profile,level);
        if(cache.available)yield {wait:cache.write(key,{...Object.fromEntries(Object.entries(geometry.attributes).map(([name,attribute])=>[name,attribute.array])),index:geometry.index.array})};
      }
      model[['geometry','midGeometry','farGeometry'][level]]=geometry;console.info('Tree prototype prepared '+JSON.stringify({species:profile.id,level,cacheHit:hit,vertices:geometry.attributes.position.count}));yield;
    }
    bank.push(model);
  }
  return bank;
}
