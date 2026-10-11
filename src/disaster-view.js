import * as THREE from 'three';
import { DISASTERS, VEHICLES, random, clamp, lerp } from './config.js';

function waveGeometry(){
  const cross=new THREE.CatmullRomCurve3([[-.5,.015],[-.38,.14],[-.2,.42],[-.04,.83],[.08,1],[.2,.62],[.35,.2],[.5,.015]].map(([x,y])=>new THREE.Vector3(x,y,0)));
  const positions=[],colors=[],indices=[],across=24,along=20,blue=new THREE.Color(0x087cb5),crest=new THREE.Color(0xedffff);
  for(let z=0;z<=along;z++)for(let x=0;x<=across;x++){
    const u=x/across,v=z/along,p=cross.getPoint(u),ripple=Math.sin(v*Math.PI*6)*.025,edge=.18+.82*Math.sin(v*Math.PI)**.3;
    positions.push(p.x,p.y*edge*(.94+.06*Math.sin(v*Math.PI*8)),v-.5);
    const foam=clamp((p.y-.62)/.38,0,1)+((p.x>.12&&p.x<.43)?Math.max(0,Math.sin(v*43+u*27))*.36:0);
    const color=blue.clone().lerp(crest,clamp(foam+ripple,0,1));colors.push(color.r,color.g,color.b);
    if(z<along&&x<across){const i=z*(across+1)+x;indices.push(i,i+across+1,i+1,i+1,i+across+1,i+across+2);}
  }
  // 波体侧面和底面闭合，宽厚水体覆盖路面，避免只有一张竖直薄片。
  const boundary=[];
  for(let x=0;x<=across;x++)boundary.push(x);
  for(let z=1;z<=along;z++)boundary.push(z*(across+1)+across);
  for(let x=across-1;x>=0;x--)boundary.push(along*(across+1)+x);
  for(let z=along-1;z>0;z--)boundary.push(z*(across+1));
  const bottom=positions.length/3;positions.push(0,0,0);colors.push(blue.r,blue.g,blue.b);
  for(let k=0;k<boundary.length;k++){
    const a=boundary[k],b=boundary[(k+1)%boundary.length],i=positions.length/3;
    positions.push(positions[a*3],0,positions[a*3+2],positions[b*3],0,positions[b*3+2]);colors.push(blue.r,blue.g,blue.b,blue.r,blue.g,blue.b);
    indices.push(a,b,i,i+1,i,b,bottom,i,i+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function icebergGeometry(seed,segments=10){
  const rng=random(seed),positions=[],colors=[],rings=[],blue=new THREE.Color(0x4b9cbf),snow=new THREE.Color(0xf0fbff);
  for(const [radius,height]of [[1,0],[.85,.2],[.55,.51],[.26,.77]]){
    const ring=[];
    for(let i=0;i<segments;i++){
      const angle=i*Math.PI*2/segments,reach=radius*(.76+rng()*.24),y=height?height+(rng()-.5)*.15:0;
      ring.push([Math.cos(angle)*reach-height*.19,y,Math.sin(angle)*reach+height*.12]);
    }
    rings.push(ring);
  }
  const triangle=(a,b,c)=>{
    const shade=.87+rng()*.13;
    for(const p of [a,b,c]){positions.push(...p);const color=blue.clone().lerp(snow,clamp((p[1]-.16)/.7,0,1)).multiplyScalar(shade);colors.push(color.r,color.g,color.b);}
  };
  for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<segments;i++){
    const j=(i+1)%segments;triangle(rings[ring][i],rings[ring+1][i],rings[ring][j]);triangle(rings[ring][j],rings[ring+1][i],rings[ring+1][j]);
  }
  const peak=[-.21,1,.12],shoulder=[.23,.79,-.12],split=Math.floor(segments/2);
  for(let i=0;i<segments;i++)triangle(rings[3][i],i<split?peak:shoulder,rings[3][(i+1)%segments]);
  triangle(rings[3][0],shoulder,peak);triangle(rings[3][split],peak,shoulder);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  // 各模板底部统一接触尺寸，保留不规则断面和偏移的峰顶。
  geometry.computeBoundingBox();const bounds=geometry.boundingBox;
  const xScale=2/(bounds.max.x-bounds.min.x),zScale=2/(bounds.max.z-bounds.min.z),xCenter=(bounds.max.x+bounds.min.x)/2,zCenter=(bounds.max.z+bounds.min.z)/2;
  const attribute=geometry.attributes.position;
  for(let i=0;i<attribute.count;i++)attribute.setXYZ(i,(attribute.getX(i)-xCenter)*xScale,attribute.getY(i),(attribute.getZ(i)-zCenter)*zScale);
  geometry.computeVertexNormals();return geometry;
}

// 第三关路面和灾害共用固定容量实例，不随事件数量积累网格。
export class DisasterView {
  constructor(scene){
    this.group=new THREE.Group();scene.add(this.group);this.staticGroup=new THREE.Group();this.group.add(this.staticGroup);this.meshes={};this.counts={};this.staticCounts={};this.layouts=new Map();
    this.staticNames=new Set(['sceneryVolcano','sceneryMouth','sceneryIce','board']);
    const basic=(color,opacity=1)=>new THREE.MeshStandardMaterial({color,roughness:.65,transparent:opacity<1,opacity,depthWrite:opacity===1});
    const mesh=(name,geometry,mat,capacity=128)=>{
      const value=new THREE.InstancedMesh(geometry,mat,capacity);value.count=0;value.frustumCulled=false;value.receiveShadow=true;(this.staticNames.has(name)?this.staticGroup:this.group).add(value);this.meshes[name]=value;
    };
    mesh('volcano',new THREE.ConeGeometry(1,1,9),basic(0x4c3230));
    mesh('mouth',new THREE.CylinderGeometry(1,1,.15,12),new THREE.MeshStandardMaterial({color:0xff8130,emissive:0xff3c05,emissiveIntensity:1.5}));
    const iceMaterial=basic(0xffffff);iceMaterial.vertexColors=true;
    mesh('ice',icebergGeometry(123),iceMaterial);mesh('iceRidge',icebergGeometry(417),iceMaterial);
    mesh('snow',new THREE.IcosahedronGeometry(1,0),basic(0xe3f9ff));
    mesh('sceneryVolcano',this.meshes.volcano.geometry,this.meshes.volcano.material);
    mesh('sceneryMouth',this.meshes.mouth.geometry,this.meshes.mouth.material);
    mesh('sceneryIce',icebergGeometry(763,7),iceMaterial);
    mesh('lava',new THREE.CylinderGeometry(.5,.5,.08,32),new THREE.MeshStandardMaterial({color:0xff6420,emissive:0xff3000,emissiveIntensity:1.2}));
    mesh('warning',new THREE.RingGeometry(.46,.5,40).rotateX(-Math.PI/2),basic(0xffe265,.85));
    mesh('cover',new THREE.BoxGeometry(1,.08,1),basic(0xe4f8ff,.86));
    const waveMaterial=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true});
    mesh('wave',waveGeometry(),waveMaterial);
    this.meshes.wave.castShadow=false;this.meshes.wave.receiveShadow=false;
    mesh('debris',new THREE.IcosahedronGeometry(1,0),basic(0xff8527));
    mesh('board',new THREE.BoxGeometry(1,.15,1),basic(0x546879),512);
    this.wet=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),basic(0x56cbea,.25));this.wet.visible=false;this.group.add(this.wet);
    this.roadMaterials=DISASTERS.themes.map((theme,index)=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),rng=random(2713+index);
      ctx.fillStyle='#'+theme.road.toString(16).padStart(6,'0');ctx.fillRect(0,0,128,128);
      if(index===1){
        ctx.strokeStyle='#445b70';ctx.lineWidth=3;
        for(let y=0;y<128;y+=16){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}
        for(const x of [10,118])for(let y=6;y<128;y+=16){ctx.fillStyle='#c7dde5';ctx.fillRect(x,y,2,2);}
      }else{
        ctx.strokeStyle=index===0?'#ff9e35':'#ecfcff';ctx.lineWidth=index===0?3:2;
        for(let i=0;i<17;i++){let x=rng()*128,y=rng()*128;ctx.beginPath();ctx.moveTo(x,y);for(let k=0;k<3;k++){x+=(rng()-.5)*40;y+=rng()*23;ctx.lineTo(x,y);}ctx.stroke();}
      }
      const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({map,roughness:index===2?.28:.85,emissive:index===0?0x7d1800:0x000000,emissiveIntensity:.35});
    });
    this.shoulderMaterials=DISASTERS.themes.map(theme=>basic(theme.shoulder));
  }
  reset(){this.group.visible=false;this.wet.visible=false;this.layouts.clear();this.cachedRoad=null;for(const mesh of Object.values(this.meshes)){mesh.count=0;mesh.visible=false;}}
  put(renderer,name,point,sx,sy,sz,height=0,counts=this.counts){
    const mesh=this.meshes[name],count=counts[name]??0;if(count>=mesh.instanceMatrix.count)return;
    renderer.instance(mesh,count,point.x,point.y+height,point.z,sx,sy,sz,point.heading,point.pitch);counts[name]=count+1;
  }
  mountain(renderer,side,now){
    const p=renderer.local(side.s,side.d,side.route),ice=side.kind==='ice',age=now-(side.eruptedAt??-100),collapse=ice&&age<1?1-.18*Math.sin(age*Math.PI):1;
    if(ice)this.put(renderer,side.id%2?'ice':'iceRidge',p,5,14*collapse,5);
    else{this.put(renderer,'volcano',p,8,10,8,5);this.put(renderer,'mouth',p,1.8,1,1.8,9.8);}
    if(age>=0&&age<1.2)for(let i=0;i<Math.ceil(9*(renderer.quality?.settings.particles??1));i++){
      const angle=i*2.39996,r=age*(2+i*.3),q={...p,x:p.x+Math.cos(angle)*r,z:p.z+Math.sin(angle)*r};
      this.put(renderer,ice?'snow':'debris',q,.35,.45,.35,ice?6-age*4:10+Math.sin(age/1.2*Math.PI)*6);
    }
  }
  upload(names,counts){
    for(const name of names){const mesh=this.meshes[name];mesh.count=counts[name]??0;mesh.visible=mesh.count>0;if(mesh.count){mesh.instanceMatrix.needsUpdate=true;mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);}}
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
                if(rng()<.35)continue;const d=side*(game.road.edge(s)+28+rng()*18);
                if(!game.road.onPavement(s,d,10))layout.push({s,d,kind:environment===0?'volcano':'ice'});
              }
            }
            this.layouts.set(block,layout);
          }
          for(const object of layout){
            if(object.kind!=='board'&&(object.s-first*size>far||quality===2&&Math.abs(Math.floor(object.s/110))%2))continue;
            const p=renderer.local(object.s,object.d,object.route),counts=this.staticCounts;
            if(object.kind==='board')this.put(renderer,'board',p,game.road.edge(object.s,object.route)*2,.8,.18,.1,counts);
            else if(object.kind==='ice')this.put(renderer,'sceneryIce',p,5,14,5,0,counts);
            else{this.put(renderer,'sceneryVolcano',p,8,10,8,5,counts);this.put(renderer,'sceneryMouth',p,1.8,1,1.8,9.8,counts);}
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
    this.group.visible=true;this.counts={};const events=game.disasters,now=game.activeSeconds;
    this.drawStatic(renderer,game);
    const animationHz=renderer.quality?.settings.animationHz??30,animationTime=Math.floor(now*animationHz)/animationHz;
    for(const side of events.sides)this.mountain(renderer,side,animationTime);
    for(const hazard of events.hazards){
      const p=renderer.local(hazard.s,hazard.d+(hazard.kind==='wave'?(now-hazard.from)*DISASTERS.waveSpeed*hazard.direction:0),hazard.route),size=hazard.dimensions;
      if(hazard.kind==='lava'){
        if(now<hazard.from){
          this.put(renderer,'warning',p,size.width,1,size.width,.08);
          const source=renderer.local(hazard.source.s,hazard.source.d,hazard.source.route),t=clamp((now-hazard.createdAt)/DISASTERS.lavaFallSeconds,0,1),q={...p,x:lerp(source.x,p.x,t),y:lerp(source.y+10,p.y,t)+Math.sin(t*Math.PI)*13,z:lerp(source.z,p.z,t)};
          this.put(renderer,'debris',q,.8,.8,.8);
        }else this.put(renderer,'lava',p,size.width,1,size.length,.09);
      }else if(hazard.kind==='cover'){
        this.put(renderer,'cover',p,size.width,1,size.length,.1);
        for(let i=0;i<Math.ceil(4*(renderer.quality?.settings.particles??1));i++)this.put(renderer,'snow',{...p,x:p.x+(i-1.5)*size.width/4},.4,.25,.4,.2);
      }else if(hazard.kind==='wave'){
        const pose=hazard.direction<0?{...p,heading:p.heading+Math.PI}:p;
        this.put(renderer,'wave',pose,size.width,DISASTERS.waveHeight,size.length,.08);
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
