import * as THREE from 'three';
import { REGIONAL_WATER } from './config.js';
import { distanceToShore } from './regional-water.js';
import { surfaceCache } from './surface-assets.js';

function offsetRing(ring,distance){
  const area=ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p.x*q.z-q.x*p.z;},0),sign=area>=0?1:-1;
  return ring.map((p,i)=>{const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz)||1;return {x:p.x+sign*dz/n*distance,z:p.z-sign*dx/n*distance};});
}
function shapeFor(outline,holes=[]){const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x,-p.z)));for(const ring of holes)shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(p.x,-p.z))));return shape;}
function* geometryRecord(outline,holes,y,kind,body){
  const s=REGIONAL_WATER,source=new THREE.ShapeGeometry(shapeFor(outline,holes)),p=source.attributes.position,sourceIndex=source.index;
  const positions=[],colors=[],depths=[],indices=[],n=kind==='water'?s.waterSubdivisions:1;
  const shallow=new THREE.Color(body.id==='xiang-river'?s.riverColors[0]:s.lakeColors[0]),deep=new THREE.Color(body.id==='xiang-river'?s.riverColors[1]:s.lakeColors[1]),color=new THREE.Color();
  for(let face=0;face<sourceIndex.count;face+=3){
    const a=sourceIndex.getX(face),b=sourceIndex.getX(face+1),c=sourceIndex.getX(face+2),grid=[];
    for(let i=0;i<=n;i++){
      grid[i]=[];
      for(let j=0;j<=n-i;j++){
        const u=i/n,v=j/n,x=p.getX(a)*(1-u-v)+p.getX(b)*u+p.getX(c)*v,z=-(p.getY(a)*(1-u-v)+p.getY(b)*u+p.getY(c)*v);
        const depth=kind==='water'?Math.min(1,distanceToShore(x,z,body)/s.depthDistance):0;
        if(kind==='water')color.copy(shallow).lerp(deep,Math.sqrt(depth));else color.setHex(kind==='land'?s.islandColor:s.bankColor).multiplyScalar(.94+.06*Math.sin(x*.013+z*.009));
        grid[i][j]=positions.length/3;positions.push(x,y,z);colors.push(color.r,color.g,color.b);depths.push(depth);
      }
    }
    for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
      indices.push(grid[i][j],grid[i+1][j],grid[i][j+1]);if(i+j<n-1)indices.push(grid[i+1][j],grid[i+1][j+1],grid[i][j+1]);
    }
    if(face%96===0)yield;
  }
  source.dispose();return {kind,position:new Float32Array(positions),color:new Float32Array(colors),waterDepth:new Float32Array(depths),index:new Uint32Array(indices)};
}
function valid(record){
  const count=record?.position?.length/3;
  return ['water','bank','land'].includes(record?.kind)&&Number.isInteger(count)&&count>0&&record.position instanceof Float32Array&&record.color instanceof Float32Array&&record.color.length===count*3&&record.waterDepth instanceof Float32Array&&record.waterDepth.length===count&&record.index instanceof Uint32Array&&record.index.length%3===0&&record.index.length>0&&record.index.every(i=>i<count)&&[record.position,record.color,record.waterDepth].every(a=>a.every(Number.isFinite));
}

// 一层连续水面与岛洞；岸边浅水、缓慢流纹和反射只更新已编译材质的时间。
export class RegionalWaterView extends THREE.Group {
  constructor(world){
    super();this.world=world;this.time={value:0};this.cacheStats={hits:0,misses:0};this.landMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
    this.waterMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.46,metalness:.08});
    this.waterMaterial.customProgramCacheKey=()=> 'regional-water-v1';
    this.waterMaterial.onBeforeCompile=shader=>{
      shader.uniforms.riverTime=this.time;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float waterDepth;varying float vWaterDepth;varying vec2 vRiverPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterDepth=waterDepth;vRiverPosition=(modelMatrix*vec4(position,1.)).xz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        uniform float riverTime;varying float vWaterDepth;varying vec2 vRiverPosition;
        float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float waterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(waterHash(i),waterHash(i+vec2(1.,0.)),f.x),mix(waterHash(i+vec2(0.,1.)),waterHash(i+vec2(1.)),f.x),f.y);}
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 waterDrift=vec2(riverTime*.04,-riverTime*.08);
        float flowWarp=waterNoise(vRiverPosition*.0028+waterDrift*.3);
        float waterA=2.*waterNoise(vRiverPosition*${REGIONAL_WATER.waveScale[0]}+waterDrift*${REGIONAL_WATER.waveRate[0]}+flowWarp*3.)-1.;
        float waterB=2.*waterNoise(mat2(.8,.6,-.6,.8)*vRiverPosition*${REGIONAL_WATER.waveScale[1]}-waterDrift*${REGIONAL_WATER.waveRate[1]}+flowWarp)-1.;
        float waterFilter=1.-smoothstep(.5,2.5,max(fwidth(vRiverPosition.x),fwidth(vRiverPosition.y))*.027);
        diffuseColor.rgb*=1.+waterA*waterB*.045*waterFilter;
      `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        normal=normalize(normal+mat3(viewMatrix)*vec3(waterA,0.,waterB)*${REGIONAL_WATER.waveNormal}*waterFilter);
        float fresnel=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.66,.70),fresnel*.25);
      `);
    };
  }
  *build(){
    const cache=surfaceCache();yield {wait:cache.ready};
    for(const body of this.world.regionalWater.renderBodies){
      const key='scene/water/'+body.id,expected=2+body.islands.length*2,meta=cache.available?yield {wait:cache.read(key+'/meta')}:null,records=[];
      let hit=meta?.recipe===REGIONAL_WATER.recipe&&meta.count===expected;
      if(hit)for(let i=0;i<expected;i++){const record=yield {wait:cache.read(key+'/'+i)};if(!valid(record)){hit=false;break;}records.push(record);yield;}
      if(!hit){
        records.length=0;records.push(yield* geometryRecord(offsetRing(body.outline,REGIONAL_WATER.shoreWidth),[],.035,'bank',body));
        records.push(yield* geometryRecord(body.outline,body.holes,REGIONAL_WATER.waterElevation,'water',body));
        for(const island of body.islands){records.push(yield* geometryRecord(island,[],.095,'bank',body));records.push(yield* geometryRecord(offsetRing(island,-18),[],REGIONAL_WATER.landElevation,'land',body));}
        if(cache.available){for(const [i,record]of records.entries()){yield {wait:cache.write(key+'/'+i,record)};if(!cache.available)break;}if(cache.available)yield {wait:cache.write(key+'/meta',{recipe:REGIONAL_WATER.recipe,count:records.length})};}
      }
      for(const record of records){
        const geometry=new THREE.BufferGeometry(),normals=new Float32Array(record.position.length);for(let i=1;i<normals.length;i+=3)normals[i]=1;
        geometry.setAttribute('position',new THREE.BufferAttribute(record.position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(record.color,3));geometry.setAttribute('waterDepth',new THREE.BufferAttribute(record.waterDepth,1));geometry.setIndex(new THREE.BufferAttribute(record.index,1));geometry.computeBoundingSphere();this.add(new THREE.Mesh(geometry,record.kind==='water'?this.waterMaterial:this.landMaterial));yield;
      }
      this.cacheStats[hit?'hits':'misses']++;
      console.info('Regional water prepared '+JSON.stringify({id:body.id,cacheHit:hit,vertices:records.reduce((n,r)=>n+r.position.length/3,0)}));
    }
  }
  update(seconds){this.time.value=seconds;}
}
