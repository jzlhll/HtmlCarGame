import * as THREE from '../node_modules/three/build/three.module.js';
import { cachedGeometrySet } from './model-assets.js';
import { surfaceMaterial, surfaceTexture, rockGeometry } from './model-surfaces.js';
import { MODEL_APPEARANCE, DISASTERS, VEHICLES, LANE_WIDTH, random, clamp, lerp } from './config.js';

// 连续空间噪声让山脊和浪面连成结构，避免逐顶点随机形成碎刺。
function reliefNoise(x,z,seed=0){
  const ix=Math.floor(x),iz=Math.floor(z),tx=x-ix,tz=z-iz,sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);
  const hash=(a,b)=>{let h=Math.imul(a+seed,374761393)^Math.imul(b-seed,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  return lerp(lerp(hash(ix,iz),hash(ix+1,iz),sx),lerp(hash(ix,iz+1),hash(ix+1,iz+1),sx),sz);
}
function waveGeometry(){
  // 浪唇向前翻卷后折回，内侧形成空腔；后浪保持连续厚度。
  const cross=new THREE.CatmullRomCurve3([[-.5,.012],[-.40,.075],[-.25,.27],[-.07,.59],[.09,.85],[.22,.98],[.33,1],[.405,.925],[.405,.815],[.34,.74],[.27,.755],[.235,.805],[.25,.65],[.35,.36],[.50,.012]].map(([x,y])=>new THREE.Vector3(x,y,0)),false,'catmullrom',.25);
  const positions=[],colors=[],uvs=[],foamWeights=[],indices=[],across=MODEL_APPEARANCE.waveAcross,along=MODEL_APPEARANCE.waveAlong,deep=new THREE.Color(0x15596f),turquoise=new THREE.Color(0x42a7b2),color=new THREE.Color();
  for(let z=0;z<=along;z++)for(let x=0;x<=across;x++){
    const u=x/across,v=z/along,p=cross.getPoint(u),edge=.14+.86*Math.sin(v*Math.PI)**.28;
    const swell=reliefNoise(v*8,u*2,49)-.5,ripple=reliefNoise(u*18,v*25,73)-.5;
    const crest=.94+.09*Math.sin(v*Math.PI*5)+swell*.11,shift=Math.sin(v*Math.PI*4)*.023+swell*.035;
    const height=p.y*edge*crest+ripple*.008*Math.sin(v*Math.PI);
    positions.push(p.x+shift*p.y,height,v-.5);
    const lace=reliefNoise(u*38,v*54,71),vein=reliefNoise(u*13,v*31,117);
    const lip=p.y>.73?clamp((p.y-.73)/.23,0,1):0,breakup=clamp((lace-.26)*1.9,0,1);
    const white=clamp(lip*(.30+breakup*.80)+(u>.64&&p.y>.30?Math.max(0,vein-.47)*1.0:0),0,1);
    const pocket=u>.56&&u<.81?.72:1;
    color.copy(deep).lerp(turquoise,clamp(p.y*.82+ripple*.10,0,1)).multiplyScalar(pocket);foamWeights.push(white);
    colors.push(color.r,color.g,color.b);uvs.push(u*3+Math.sin(v*11)*.03,v*5);
    if(z<along&&x<across){const i=z*(across+1)+x;indices.push(i,i+across+1,i+1,i+1,i+across+1,i+across+2);}
  }
  const boundary=[];
  for(let x=0;x<=across;x++)boundary.push(x);
  for(let z=1;z<=along;z++)boundary.push(z*(across+1)+across);
  for(let x=across-1;x>=0;x--)boundary.push(along*(across+1)+x);
  for(let z=along-1;z>0;z--)boundary.push(z*(across+1));
  const bottom=positions.length/3;positions.push(0,0,0);colors.push(deep.r,deep.g,deep.b);uvs.push(0,0);foamWeights.push(0);
  for(let k=0;k<boundary.length;k++){
    const a=boundary[k],b=boundary[(k+1)%boundary.length],i=positions.length/3;
    positions.push(positions[a*3],0,positions[a*3+2],positions[b*3],0,positions[b*3+2]);colors.push(deep.r,deep.g,deep.b,deep.r,deep.g,deep.b);uvs.push(0,0,1,0);foamWeights.push(0,0);indices.push(a,b,i,i+1,i,b,bottom,i,i+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('waveFoam',new THREE.Float32BufferAttribute(foamWeights,1));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function volcanoGeometry(){
  const positions=[],colors=[],uvs=[],indices=[],segments=MODEL_APPEARANCE.volcanoSegments,rings=MODEL_APPEARANCE.volcanoRings,innerRings=14;
  const ring=(radius,height,t,inside=false)=>{
    for(let i=0;i<=segments;i++){
      const a=i/segments*Math.PI*2,lobes=1+.067*Math.sin(a*3+.7)+.037*Math.sin(a*7-1.3),x=Math.cos(a)*radius,z=Math.sin(a)*radius;
      const broad=reliefNoise(x*3.8+4,z*3.8-2,71),detail=reliefNoise(x*19+2,z*19+3,163),fine=reliefNoise(x*47,z*47,91);
      const ridge=Math.sin(a*17+reliefNoise(x*5,z*5,231)*8+t*1.8)*.5+.5,gully=Math.pow(1-ridge,3),fracture=Math.abs(reliefNoise(x*10,z*10,199)*2-1);
      const erosion=inside?0:Math.sin(t*Math.PI)*(.13*(broad-.5)+.065*(detail-.5)+.045*(fracture-.5)-gully*.065);
      const reach=radius*lobes*(1+(broad-.5)*.06),peak=t>.65?Math.sin(a*5+.7)*.017+Math.sin(a*11)*.009:0;
      const y=height+erosion+peak*Math.pow(clamp((t-.65)/.35,0,1),.7)+(inside?0:Math.sin(t*Math.PI)*Math.sin(height*48+broad*7)*.008);
      positions.push(Math.cos(a)*reach+.10*t,y,Math.sin(a)*reach+.055*t);uvs.push(i/segments*4,t*2);
      const shade=(inside?.34:.61)+broad*.19+(detail-.5)*.09+(fine-.5)*.04-(inside?0:gully*.095);
      colors.push(shade*1.035,shade,shade*.92);
    }
  };
  for(let row=0;row<=rings;row++){
    const t=row/rings,radius=.20+.80*Math.pow(1-t,.93),height=-.5+.98*Math.pow(t,1.33);
    ring(radius,height,t);
  }
  for(let row=1;row<=innerRings;row++){
    const t=row/innerRings,radius=lerp(.20,.075,t),height=.48-.30*Math.sin(t*Math.PI/2);
    ring(radius,height,1,true);
  }
  const count=rings+innerRings;
  for(let row=1;row<=count;row++)for(let i=0;i<segments;i++){
    const a=(row-1)*(segments+1)+i,b=row*(segments+1)+i;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const center=positions.length/3;positions.push(.10,.175,.055);colors.push(.25,.23,.20);uvs.push(.5,.5);
  for(let i=0;i<segments;i++){const a=count*(segments+1)+i;indices.push(a,center,a+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function icebergGeometry(seed,segments=24,massive=false){
  const rng=random(seed),positions=[],colors=[],rings=[],blue=new THREE.Color(0x3792b3),snow=new THREE.Color(0xebf7f5),normal=new THREE.Vector3(),edgeA=new THREE.Vector3(),edgeB=new THREE.Vector3();
  // 大冰山保留宽阔雪台和成层冰壁，避免仅把细尖冰柱等比放大。
  const profile=massive?[[1,0],[.98,.10],[.94,.35],[.88,.38],[.86,.61],[.78,.64],[.73,.82],[.54,.85],[.25,.88]]:[[1,0],[.94,.16],[.94,.34],[.81,.40],[.80,.56],[.63,.63],[.57,.76],[.32,.83],[.09,.81]];
  const outline=Array.from({length:segments},(_,i)=>.85+rng()*.15);
  for(let row=0;row<profile.length;row++){
    const [radius,height]=profile[row],ring=[];
    for(let i=0;i<segments;i++){
      const angle=i*Math.PI*2/segments,reach=radius*outline[i]*(row?1+(rng()-.5)*.07:1);
      const ridge=Math.sin(angle*3+seed*.1)*.075+Math.cos(angle*5+row*.23)*.035,y=height?height+ridge*Math.min(1,height*2)+(rng()-.5)*.025:0;
      ring.push([Math.cos(angle)*reach-height*.17,y,Math.sin(angle)*reach+height*.10]);
    }
    rings.push(ring);
  }
  const triangle=(a,b,c)=>{
    edgeA.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);edgeB.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);normal.crossVectors(edgeA,edgeB).normalize();
    const up=Math.max(0,normal.y),shade=.88+rng()*.12;
    for(const p of [a,b,c]){
      positions.push(...p);const band=.96+Math.sin(p[1]*58+p[0]*3)*.025,cap=clamp((p[1]-.51)/.30,0,1)*(.18+up*.82);
      const color=blue.clone().lerp(snow,cap).multiplyScalar(shade*band);colors.push(color.r,color.g,color.b);
    }
  };
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<segments;i++){
    const j=(i+1)%segments;triangle(rings[row][i],rings[row+1][i],rings[row][j]);triangle(rings[row][j],rings[row+1][i],rings[row+1][j]);
  }
  const peak=massive?[-.12,.91,.07]:[-.14,.87,.09];for(let i=0;i<segments;i++)triangle(rings.at(-1)[i],peak,rings.at(-1)[(i+1)%segments]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingBox();const bounds=geometry.boundingBox;
  const xScale=2/(bounds.max.x-bounds.min.x),zScale=2/(bounds.max.z-bounds.min.z),xCenter=(bounds.max.x+bounds.min.x)/2,zCenter=(bounds.max.z+bounds.min.z)/2,attribute=geometry.attributes.position;
  for(let i=0;i<attribute.count;i++)attribute.setXYZ(i,(attribute.getX(i)-xCenter)*xScale,attribute.getY(i)/bounds.max.y,(attribute.getZ(i)-zCenter)*zScale);
  const uv=[];for(let i=0;i<attribute.count;i++)uv.push(attribute.getX(i)*.7+attribute.getZ(i)*.3,attribute.getY(i)*2);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return geometry;
}

export function disasterGeometries(){return cachedGeometrySet('disasters',()=>({volcano:volcanoGeometry(),wave:waveGeometry(),ice:icebergGeometry(123),iceRidge:icebergGeometry(417),sceneryIce:icebergGeometry(763,12),sceneryIceMassif:icebergGeometry(1039,40,true),sceneryIceRidge:icebergGeometry(1427,32,true),debris:rockGeometry(47,0)}));}

// 第三关路面和灾害共用固定容量实例，不随事件数量积累网格。
export class DisasterView {
  constructor(scene){
    this.group=new THREE.Group();scene.add(this.group);this.staticGroup=new THREE.Group();this.group.add(this.staticGroup);this.meshes={};this.counts={};this.staticCounts={};this.layouts=new Map();
    this.staticNames=new Set(['sceneryVolcano','sceneryMouth','sceneryIce','sceneryIceMassif','sceneryIceRidge','board']);
    const basic=(color,opacity=1)=>new THREE.MeshStandardMaterial({color,roughness:.65,transparent:opacity<1,opacity,depthWrite:opacity===1});
    const mesh=(name,geometry,mat,capacity=128)=>{
      const value=new THREE.InstancedMesh(geometry,mat,capacity);value.count=0;value.frustumCulled=false;value.receiveShadow=true;(this.staticNames.has(name)?this.staticGroup:this.group).add(value);this.meshes[name]=value;
    };
    const shapes=disasterGeometries();
    const volcanic=surfaceMaterial('stone',0xa1a5a5).clone();volcanic.vertexColors=true;mesh('volcano',shapes.volcano,volcanic);
    mesh('mouth',new THREE.CylinderGeometry(1,1,.08,64),new THREE.MeshStandardMaterial({color:0xff8b24,emissive:0xff3c05,emissiveIntensity:1.4,map:surfaceTexture('lava'),emissiveMap:surfaceTexture('lava'),roughness:.8}));
    const iceMaterial=surfaceMaterial('ice',0xffffff).clone();iceMaterial.vertexColors=true;
    mesh('ice',shapes.ice,iceMaterial);mesh('iceRidge',shapes.iceRidge,iceMaterial);
    mesh('snow',new THREE.IcosahedronGeometry(1,0),basic(0xe3f9ff));
    mesh('sceneryVolcano',this.meshes.volcano.geometry,this.meshes.volcano.material);
    mesh('sceneryMouth',this.meshes.mouth.geometry,this.meshes.mouth.material);
    mesh('sceneryIce',shapes.sceneryIce,iceMaterial);
    mesh('sceneryIceMassif',shapes.sceneryIceMassif,iceMaterial,32);mesh('sceneryIceRidge',shapes.sceneryIceRidge,iceMaterial,32);
    mesh('lava',new THREE.CylinderGeometry(.5,.5,.08,32),new THREE.MeshStandardMaterial({color:0xff6420,emissive:0xff3000,emissiveIntensity:1.2,map:surfaceTexture('lava'),emissiveMap:surfaceTexture('lava'),roughness:.8}));
    mesh('warning',new THREE.RingGeometry(.46,.5,40).rotateX(-Math.PI/2),basic(0xffe265,.85));
    mesh('cover',new THREE.BoxGeometry(1,.08,1),basic(0xe4f8ff,.86));
    const waveMaterial=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true});
    this.waveUniforms={waveTime:{value:0},waveFoamMap:{value:surfaceTexture('foam')}};
    // 保持无场景阴影，使用表面法线产生水面反光，细泡沫在片元中采样。
    waveMaterial.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.waveUniforms);
      shader.vertexShader='attribute float waveFoam; varying float vWaveFoam; varying vec2 vWaveUv; varying vec3 vWaveSurface;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n vWaveFoam = waveFoam; vWaveUv = uv; vWaveSurface = mvPosition.xyz;');
      shader.fragmentShader='uniform float waveTime; uniform sampler2D waveFoamMap; varying float vWaveFoam; varying vec2 vWaveUv; varying vec3 vWaveSurface;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec3 surfaceNormal = normalize(cross(dFdx(vWaveSurface), dFdy(vWaveSurface)));
        vec3 eye = normalize(-vWaveSurface);
        float sheen = pow(1.0 - abs(dot(surfaceNormal, eye)), 3.0);
        float glint = pow(max(0.0, dot(reflect(normalize(vec3(-0.35, -0.8, -0.3)), surfaceNormal), eye)), 42.0);
        vec2 foamUv = vWaveUv * vec2(1.4, 1.5) + vec2(-waveTime * 0.035, waveTime * 0.012);
        float cells = texture2D(waveFoamMap, foamUv).r;
        float froth = clamp(vWaveFoam * (0.34 + smoothstep(0.20, 0.70, cells) * 1.20), 0.0, 1.0);
        diffuseColor.rgb = diffuseColor.rgb * (0.89 + sheen * 0.12) + vec3(0.06, 0.09, 0.10) * sheen + vec3(glint * 0.22);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.89, 0.85), froth);
      `);
    };
    waveMaterial.customProgramCacheKey=()=>'breaking-wave-foam-v1';
    mesh('wave',shapes.wave,waveMaterial);
    mesh('spray',new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xe9f4ec,transparent:true,opacity:.85,depthWrite:false}),128);
    this.meshes.wave.castShadow=false;this.meshes.wave.receiveShadow=false;
    mesh('debris',shapes.debris,new THREE.MeshStandardMaterial({color:0xd67330,emissive:0xb82704,emissiveIntensity:.4,vertexColors:true}));
    mesh('board',new THREE.BoxGeometry(1,.15,1),surfaceMaterial('wood',0x546879),512);
    this.wet=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),basic(0x56cbea,.25));this.wet.visible=false;this.group.add(this.wet);
    this.roadMaterials=DISASTERS.themes.map((theme,index)=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),rng=random(2713+index);
      ctx.fillStyle='#'+theme.road.toString(16).padStart(6,'0');ctx.fillRect(0,0,128,128);
      if(index===0){
        const grain=surfaceTexture('lava').image,image=ctx.createImageData(128,128),base=theme.road,hot=DISASTERS.roadSurface.lavaHot;
        const channels=color=>[(color>>16)&255,(color>>8)&255,color&255],cold=channels(base),warm=channels(hot);
        for(let i=0;i<128*128;i++){
          const at=(Math.floor(Math.floor(i/128)*grain.height/128)*grain.width+Math.floor((i%128)*grain.width/128))*4,heat=clamp((grain.data[at]-65)/190,0,1)**1.35;
          image.data.set([...cold.map((value,c)=>lerp(value,warm[c],heat)),255],i*4);
        }ctx.putImageData(image,0,0);
      }else if(index===1){
        ctx.strokeStyle='#445b70';ctx.lineWidth=3;
        for(let y=0;y<128;y+=16){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}
        for(const x of [10,118])for(let y=6;y<128;y+=16){ctx.fillStyle='#c7dde5';ctx.fillRect(x,y,2,2);}
      }else{
        ctx.strokeStyle='#'+DISASTERS.roadSurface.iceCrack.toString(16).padStart(6,'0');ctx.lineWidth=DISASTERS.roadSurface.iceCrackWidth;
        for(let i=0;i<DISASTERS.roadSurface.iceCrackCount;i++){let x=rng()*128,y=rng()*128;ctx.beginPath();ctx.moveTo(x,y);for(let k=0;k<3;k++){x+=(rng()-.5)*40;y+=rng()*23;ctx.lineTo(x,y);}ctx.stroke();}
      }
      const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({map,bumpMap:surfaceTexture(index===0?'stone':index===1?'wood':'ice'),bumpScale:index===2?.04:.025,roughness:index===2?DISASTERS.roadSurface.iceRoughness:.85,emissive:index===0?DISASTERS.roadSurface.lavaEmissive:0x000000,emissiveIntensity:DISASTERS.roadSurface.lavaGlow,emissiveMap:index===0?map:null});
    });
    this.shoulderMaterials=DISASTERS.themes.map(theme=>basic(theme.shoulder));
    this.groundMaterials=DISASTERS.themes.map((theme,index)=>surfaceMaterial(index===0?'stone':index===1?'water':'ice',theme.ground));
  }
  reset(){this.group.visible=false;this.wet.visible=false;this.layouts.clear();this.cachedRoad=null;for(const mesh of Object.values(this.meshes)){mesh.count=0;mesh.visible=false;}}
  put(renderer,name,point,sx,sy,sz,height=0,counts=this.counts){
    const mesh=this.meshes[name],count=counts[name]??0;if(count>=mesh.instanceMatrix.count)return;
    renderer.instance(mesh,count,point.x,point.y+height,point.z,sx,sy,sz,point.heading,point.pitch);counts[name]=count+1;
  }
  mountain(renderer,side,now){
    const p=renderer.local(side.s,side.d,side.route),ice=side.kind==='ice',age=now-(side.eruptedAt??-100),collapse=ice&&age<1?1-.18*Math.sin(age*Math.PI):1;
    let emitter=p;
    if(ice)this.put(renderer,side.id%2?'ice':'iceRidge',p,5,14*collapse,5);
    else emitter=this.volcano(renderer,{...p,heading:p.heading+side.id*2.399963});
    if(age>=0&&age<1.2)for(let i=0;i<Math.ceil(9*(renderer.quality?.settings.particles??1));i++){
      const angle=i*2.39996,r=age*(2+i*.3),q={...emitter,x:emitter.x+Math.cos(angle)*r,z:emitter.z+Math.sin(angle)*r};
      this.put(renderer,ice?'snow':'debris',q,.35,.45,.35,ice?6-age*4:MODEL_APPEARANCE.volcanoHeight+Math.sin(age/1.2*Math.PI)*6);
    }
  }
  volcano(renderer,point,counts=this.counts,staticModel=false){
    const radius=MODEL_APPEARANCE.volcanoRadius,height=MODEL_APPEARANCE.volcanoHeight;
    this.put(renderer,staticModel?'sceneryVolcano':'volcano',point,radius,height,radius*1.1,height/2,counts);
    const mouth=this.volcanoCrater(point);
    this.put(renderer,staticModel?'sceneryMouth':'mouth',mouth,radius*MODEL_APPEARANCE.volcanoLavaRadius,1,radius*1.1*MODEL_APPEARANCE.volcanoLavaRadius,height*(.5+MODEL_APPEARANCE.volcanoLavaFraction),counts);return mouth;
  }
  volcanoCrater(point){
    const radius=MODEL_APPEARANCE.volcanoRadius,cos=Math.cos(point.heading),sin=Math.sin(point.heading);
    return {...point,x:point.x+cos*radius*.10-sin*radius*.0605,z:point.z+sin*radius*.10+cos*radius*.0605};
  }
  upload(names,counts){
    for(const name of names){const mesh=this.meshes[name];mesh.count=counts[name]??0;mesh.visible=mesh.count>0;if(mesh.count){mesh.instanceMatrix.needsUpdate=true;mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);}}
  }
  iceScenery(road,s,side,rng){
    const settings=DISASTERS.iceScenery,kind=rng()<settings.smallChance?'small':rng()<.5?'massif':'ridge',dimensions=settings[kind];
    const width=lerp(...dimensions.width,rng()),height=lerp(...dimensions.height,rng()),length=lerp(...dimensions.length,rng());
    const radius=Math.hypot(width,length)/2,rotation=(rng()-.5)*Math.PI,span=radius+settings.searchDistance;
    const from=s-span,to=s+span,routes=[null,...road.forksRange(from,to).map(fork=>fork.id)],point={};
    // 按完整山脚的外接圆检查主副路与弯道，采样间距也纳入安全余量。
    for(let attempt=0;attempt<settings.placementAttempts;attempt++){
      const d=side*(road.edge(s)+radius+settings.clearance+attempt*radius*.5),center=road.at(s,d);let clear=true;
      for(const route of routes){
        const fork=route?road.route(route):null,start=Math.max(from,fork?.start??from),end=Math.min(to,fork?.end??to);
        for(let station=start;station<=end;station+=settings.sampleStep){
          road.at(station,road.branchCenter(station,route),route,point);
          if(Math.hypot(center.x-point.x,center.z-point.z)<radius+road.edge(station,route)+settings.clearance+settings.sampleStep/2){clear=false;break;}
        }
        if(!clear)break;
      }
      if(clear)return {s,d,kind:'ice',shape:kind,width,height,length,rotation};
    }
    return null;
  }
  // 静态火山默认远离路面；按概率贴近主路，让山脚向内压住外侧车道约一半宽度，仅视觉贴近不改碰撞，副路仍保持净空。
  volcanoSpot(road,s,side,rng){
    const settings=DISASTERS.volcanoScenery,radius=MODEL_APPEARANCE.volcanoRadius,edge=road.edge(s);
    const far=side*(edge+28+rng()*18);
    const fallback=()=>road.onPavement(s,far,radius*1.3)?{s,d:far,kind:'volcano'}:null;
    if(rng()>=settings.closeChance)return fallback();
    const footprint=radius*settings.footprintScale,close=side*(edge+footprint-settings.encroachLanes*LANE_WIDTH);
    const span=footprint+settings.clearance,from=s-span,to=s+span,center=road.at(s,close),point={};
    for(const fork of road.forksRange(from,to)){
      const start=Math.max(from,fork.start),end=Math.min(to,fork.end);
      for(let station=start;station<=end;station+=settings.sampleStep){
        road.at(station,road.branchCenter(station,fork.id),fork.id,point);
        if(Math.hypot(center.x-point.x,center.z-point.z)<footprint+road.edge(station,fork.id)+settings.clearance)return fallback();
      }
    }
    return {s,d:close,kind:'volcano'};
  }
  drawStatic(renderer,game){
    const size=DISASTERS.sceneryBlock,first=Math.floor((game.player.s-80)/size),last=first+6,environment=game.disasters.environment,quality=renderer.quality?.detailLevel??0;
    if(this.cachedRoad!==game.road||this.cachedRevision!==game.road.revision||this.cachedEnvironment!==environment){
      this.layouts.clear();this.cachedBlock=null;this.cachedRoad=game.road;this.cachedRevision=game.road.revision;this.cachedEnvironment=environment;
    }
    if(this.cachedBlock!==first||this.cachedQuality!==quality){
      this.cachedBlock=first;this.cachedQuality=quality;this.staticCounts={};
      for(const block of this.layouts.keys())if(block<first||block>last)this.layouts.delete(block);
      const current=renderer.origin;this.staticOrigin=game.road.at(first*size);renderer.origin=this.staticOrigin;
      try{
        const far=renderer.quality?.settings.environmentFar??440;
        for(let block=first;block<=last;block++){
          let layout=this.layouts.get(block);
          if(!layout){
            layout=[];const start=block*size,end=start+size;
            if(environment===1){
              const routes=[null,...game.road.forksRange(start,end).map(fork=>fork.id)];
              for(const route of routes)for(let s=Math.ceil(start/6)*6;s<end;s+=6){
                const fork=route?game.road.route(route):null;if(fork&&(s<fork.start||s>fork.end))continue;
                layout.push({s,d:game.road.branchCenter(s,route),route,kind:'board'});
              }
            }else for(let s=Math.ceil(start/110)*110;s<end;s+=110){
              const rng=random(game.seed^s);
              for(const side of [-1,1]){
                if(rng()<.35)continue;
                if(environment===2){const iceberg=this.iceScenery(game.road,s,side,rng);if(iceberg)layout.push(iceberg);}
                else{const spot=this.volcanoSpot(game.road,s,side,rng);if(spot)layout.push(spot);}
              }
            }
            this.layouts.set(block,layout);
          }
          for(const object of layout){
            if(object.kind!=='board'&&(object.s-first*size>far||quality===2&&Math.abs(Math.floor(object.s/110))%2))continue;
            const p=renderer.local(object.s,object.d,object.route),counts=this.staticCounts;
            if(object.kind==='board')this.put(renderer,'board',p,game.road.edge(object.s,object.route)*2,.8,.18,.1,counts);
            else if(object.kind==='ice')this.put(renderer,object.shape==='massif'?'sceneryIceMassif':object.shape==='ridge'?'sceneryIceRidge':'sceneryIce',{...p,heading:p.heading+object.rotation},object.width/2,object.height,object.length/2,0,counts);
            else this.volcano(renderer,{...p,heading:p.heading+object.s*.017},counts,true);
          }
        }
        this.upload(this.staticNames,this.staticCounts);
      }finally{renderer.origin=current;}
    }
    const current=renderer.origin,cached=this.staticOrigin,dx=cached.x-current.x,dz=cached.z-current.z,cos=Math.cos(current.heading),sin=Math.sin(current.heading);
    this.staticGroup.position.set(cos*dx+sin*dz,cached.y-current.y,-sin*dx+cos*dz);this.staticGroup.rotation.y=current.heading-cached.heading;
  }
  draw(renderer,game){
    if(!game.disasters){this.reset();return;}
    this.group.visible=true;this.counts={};const events=game.disasters,now=game.activeSeconds;this.waveUniforms.waveTime.value=now;
    this.drawStatic(renderer,game);
    const animationHz=renderer.quality?.settings.animationHz??30,animationTime=Math.floor(now*animationHz)/animationHz;
    for(const side of events.sides)this.mountain(renderer,side,animationTime);
    for(const hazard of events.hazards){
      const p=renderer.local(hazard.s,hazard.d+(hazard.kind==='wave'?(now-hazard.from)*DISASTERS.waveSpeed*hazard.direction:0),hazard.route),size=hazard.dimensions;
      if(hazard.kind==='lava'){
        if(now<hazard.from){
          this.put(renderer,'warning',p,size.width,1,size.width,.08);
          const sourcePoint=renderer.local(hazard.source.s,hazard.source.d,hazard.source.route),source=this.volcanoCrater({...sourcePoint,heading:sourcePoint.heading+hazard.source.id*2.399963}),t=clamp((now-hazard.createdAt)/DISASTERS.lavaFallSeconds,0,1),q={...p,x:lerp(source.x,p.x,t),y:lerp(source.y+MODEL_APPEARANCE.volcanoHeight,p.y,t)+Math.sin(t*Math.PI)*13,z:lerp(source.z,p.z,t)};
          this.put(renderer,'debris',q,.8,.8,.8);
        }else this.put(renderer,'lava',p,size.width,1,size.length,.09);
      }else if(hazard.kind==='cover'){
        this.put(renderer,'cover',p,size.width,1,size.length,.1);
        for(let i=0;i<Math.ceil(4*(renderer.quality?.settings.particles??1));i++)this.put(renderer,'snow',{...p,x:p.x+(i-1.5)*size.width/4},.4,.25,.4,.2);
      }else if(hazard.kind==='wave'){
        const pose=hazard.direction<0?{...p,heading:p.heading+Math.PI}:p;
        this.put(renderer,'wave',pose,size.width,DISASTERS.waveHeight,size.length,.08);
        const sprayCount=Math.ceil(18*(renderer.quality?.settings.particles??1)),cos=Math.cos(pose.heading),sin=Math.sin(pose.heading);
        for(let i=0;i<sprayCount;i++){
          const v=(i+.5)/sprayCount,phase=((now-hazard.from)*1.1+i*.618)%1,edge=.14+.86*Math.sin(v*Math.PI)**.28;
          const x=(.33+phase*.16)*size.width,z=(v-.5)*size.length*.92,height=DISASTERS.waveHeight*edge*.96+Math.sin(phase*Math.PI)*.7-phase*1.2;
          const q={...pose,x:pose.x+cos*x-sin*z,z:pose.z+sin*x+cos*z},radius=.055+(i%3)*.022;
          this.put(renderer,'spray',q,radius,radius*(1+phase),radius,height);
        }

      }else if(hazard.kind==='iceberg'){
        // 车道障碍的可见外沿与矩形接触尺寸一致。
        this.put(renderer,hazard.id%2?'ice':'iceRidge',p,size.width/2,DISASTERS.icebergHeight,size.length/2);
      }
    }
    const wet=now<(game.player.wetUntil??0);this.wet.visible=wet;
    if(wet){const size=VEHICLES[game.player.rank],p=renderer.local(game.player.s,game.player.d,game.player.route);this.wet.position.set(p.x,p.y+size.height*.55,p.z);this.wet.scale.set(size.width*.8,size.height*.8,size.length*.7);this.wet.rotation.y=-p.heading-(game.player.yaw||0);}
    this.upload(Object.keys(this.meshes).filter(name=>!this.staticNames.has(name)),this.counts);
  }
}
