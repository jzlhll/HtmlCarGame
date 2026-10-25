import * as THREE from '../node_modules/three/build/three.module.js';
import { assetTextures, cachedGeometry } from './model-assets.js';
import { generateSurfacePixels } from './surface-pixels.js';
import { MODEL_APPEARANCE } from './config.js';

const textures=new Map(),materials=new Map();
// 贴图优先读取后台结果；同步入口仅作为未预热材质的兼容回退。
export function surfaceTexture(kind){
  if(textures.has(kind))return textures.get(kind);
  let pixels=assetTextures.get(kind);
  if(!pixels){const job=generateSurfacePixels(kind,MODEL_APPEARANCE.textureSize);let step;do{step=job.next();}while(!step.done);pixels=step.value;assetTextures.set(kind,pixels);}
  const texture=new THREE.DataTexture(pixels.data,pixels.width,pixels.height);if(kind==='cow')texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;textures.set(kind,texture);return texture;
}
export function surfaceMaterial(kind,color=0xffffff){
  const key=kind+':'+color;if(materials.has(key))return materials.get(key);
  const settings={color,roughness:.85,metalness:0};
  if(kind==='paint')Object.assign(settings,{roughness:MODEL_APPEARANCE.paintRoughness,metalness:MODEL_APPEARANCE.paintMetalness,clearcoat:.65,clearcoatRoughness:.16});
  else if(kind==='glass')Object.assign(settings,{roughness:.08,metalness:.68,color:0x345362,envMapIntensity:1.45});
  else if(kind==='metal')Object.assign(settings,{roughness:.23,metalness:.85});
  else{
    const map=surfaceTexture(kind);Object.assign(settings,{map,bumpMap:map,bumpScale:kind==='bark'?.055:kind==='stone'?.065:kind==='asphalt'?.018:kind==='skin'?.018:.022});
    if(kind==='foliage')Object.assign(settings,{bumpScale:.012,roughness:1,side:THREE.DoubleSide});
    if(kind==='rubber')Object.assign(settings,{roughness:.84,vertexColors:true,bumpScale:.012});
    if(kind==='skin'||kind==='hide'||kind==='cow')Object.assign(settings,{roughness:.83,vertexColors:true});
    if(kind==='water')Object.assign(settings,{roughness:.22,metalness:.3,bumpScale:.065});
    if(kind==='ice')Object.assign(settings,{roughness:.26,metalness:.12,bumpScale:.045});
  }
  const material=kind==='paint'?new THREE.MeshPhysicalMaterial(settings):new THREE.MeshStandardMaterial(settings);if(kind==='rubber'){
    // 轮胎和金属轮辐共用一件几何，通过顶点明暗区分表面粗糙度与金属度。
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor = mix(0.88, 0.27, step(0.20, vColor.r));').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\n metalnessFactor = mix(0.0, 0.82, step(0.20, vColor.r));');};
    material.customProgramCacheKey=()=>'rubber-metal-rim-v1';
  }
  materials.set(key,material);return material;
}

// 倒角只用于车身等大轮廓，小装饰保留简单几何。
export function roundedBoxGeometry(radius=.065){const result=cachedGeometry('rounded:'+radius,()=>{
  const shape=new THREE.Shape(),a=-.5+radius,b=.5-radius;
  shape.moveTo(a,-.5);shape.lineTo(b,-.5);shape.quadraticCurveTo(.5,-.5,.5,a);shape.lineTo(.5,b);shape.quadraticCurveTo(.5,.5,b,.5);shape.lineTo(a,.5);shape.quadraticCurveTo(-.5,.5,-.5,b);shape.lineTo(-.5,a);shape.quadraticCurveTo(-.5,-.5,a,-.5);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:1-radius*2,bevelEnabled:true,bevelSize:radius*.45,bevelThickness:radius,bevelSegments:4,curveSegments:4,steps:1});
  geometry.computeBoundingBox();const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);geometry.computeVertexNormals();return geometry;
}).clone();result.userData={};return result;}
export function rockGeometry(seed=712,detail=3){return cachedGeometry('rock:'+seed+':'+detail,()=>{
  const geometry=new THREE.IcosahedronGeometry(1,detail),position=geometry.attributes.position,colors=[],color=new THREE.Color();
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),noise=Math.sin(x*9+seed)*Math.cos(z*7-seed*.3)*.18+Math.sin(y*8+x*4)*.13;
    position.setXYZ(i,x*(1+noise),Math.max(-.55,y*(1+noise*.5)),z*(1+noise));
    const shade=.82+(y+1)*.07+Math.sin(y*18+x*3)*.035;color.setRGB(shade,shade,shade);colors.push(color.r,color.g,color.b);
  }
  geometry.computeBoundingBox();const floor=geometry.boundingBox.min.y,height=geometry.boundingBox.max.y-floor;for(let i=0;i<position.count;i++)position.setY(i,(position.getY(i)-floor)/height*2-1);
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
});}
export function skyEnvironment(){
  const width=MODEL_APPEARANCE.environmentWidth,height=width/2,data=new Float32Array(width*height*4),sky=new THREE.Color(0xb8d0e0),horizon=new THREE.Color(0xf0e5d0),ground=new THREE.Color(0x4b5148),color=new THREE.Color();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const latitude=y/(height-1),longitude=x/width,sun=Math.exp(-((longitude-.28)**2/.001+(latitude-.30)**2/.0007));
    const cloud=latitude<.5?Math.max(0,Math.sin(longitude*Math.PI*8+Math.sin(latitude*31))*Math.sin(latitude*37))**8:0;
    color.copy(latitude<.5?sky:ground).lerp(horizon,Math.exp(-(((latitude-.5)/.17)**2))*.7);color.multiplyScalar(latitude<.5?1.4+cloud*2:1);color.addScalar(sun*12);
    const i=(y*width+x)*4;data[i]=color.r;data[i+1]=color.g;data[i+2]=color.b;data[i+3]=1;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}

export function organicGeometry(sections,sides=24){
  const curve=new THREE.CatmullRomCurve3(sections.map(([z,width,height,y=0])=>new THREE.Vector3(width,height,y)),false,'catmullrom',.35),positions=[],uvs=[],colors=[],indices=[],rings=sections.length*5;
  for(let row=0;row<=rings;row++){
    const t=row/rings,p=curve.getPoint(t),i=Math.min(sections.length-2,Math.floor(t*(sections.length-1))),blend=t*(sections.length-1)-i,z=sections[i][0]*(1-blend)+sections[i+1][0]*blend;
    for(let side=0;side<=sides;side++){
      const a=side/sides*Math.PI*2,vertical=Math.sin(a),width=Math.max(.002,p.x),height=Math.max(.002,p.y);
      positions.push(Math.cos(a)*width,p.z+vertical*height,z);uvs.push(side/sides,t);
      const shade=.80+.20*Math.max(0,vertical)+.035*Math.sin(z*19+a*3);colors.push(shade,shade,shade);
      if(row&&side){const b=row*(sides+1)+side-1,c=b-sides-1;indices.push(c,c+1,b,b,c+1,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
