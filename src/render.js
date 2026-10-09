import * as THREE from 'three';
import { VEHICLES, SECOND_LEVEL_SCENE, SHELL, TREE_SCENERY, ROAD_RENDER, RENDER_QUALITY, POLICE, CAMERA, laneD, random, clamp, lerp, carColor, DEFAULT_CAR_COLOR } from './config.js';
import { vehicleModel, cowModel, material, mudCoating } from './models.js';
import { RoadsideScenery } from './scenery.js';
import { RoadworksView } from './roadworks-view.js';
import { BUMP_SECONDS } from './hazards.js';
import { WeatherView } from './weather-view.js';
import { TrafficView } from './traffic-view.js';
import { WhiteHorseView } from './white-horse-view.js';
import { PoliceView } from './police-view.js';
import { InfrastructureView } from './infrastructure-view.js';
import { BranchRoadView } from './branch-road-view.js';
import { treeGeometry } from './tree-model.js';
import { DinosaurView } from './dinosaur-view.js';
import { ArsenalView } from './arsenal-view.js';
import { levelGuideImages } from './level-guide.js';

const palette=[
  {ground:0x789e91,leaf:0x4d995e,water:0x3ca4b4,sky:0xc1dce6},
  {ground:0x698b82,leaf:0x2f7548,water:0x258d9e,sky:0xa5cbdc},
  {ground:0xaf9b81,leaf:0xc58a40,water:0x538f9f,sky:0xe2c6ae},
  {ground:0xd4e2e8,leaf:0x9fb8a1,water:0x72b8cb,sky:0xc6d7e5},
];
const temp=new THREE.Object3D();
const signalGeometry=new THREE.BoxGeometry(.15,.12,.18),queueLightGeometry=new THREE.BoxGeometry(.16,.14,.08);
export class GameRenderer {
  constructor(container){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.pixelRatio=Math.min(devicePixelRatio,1.5);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.shadowMap.enabled=true;
    this.qualityWarmup=1;this.qualitySeconds=0;this.qualityFrames=0;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xc5e0e9);this.scene.fog=new THREE.Fog(0xc5e0e9,240,560);
    this.camera=new THREE.PerspectiveCamera(CAMERA.fov,1,.5,850);
    this.weatherView=new WeatherView(this.scene,this.camera);this.whiteHorseView=new WhiteHorseView(this.scene);this.policeView=new PoliceView(this.scene);
    this.scene.add(new THREE.HemisphereLight(0xe3f0ff,0x668054,2.2));
    const light=new THREE.DirectionalLight(0xfff1cb,2.6);light.position.set(-25,45,15);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-28;light.shadow.camera.right=28;light.shadow.camera.top=50;light.shadow.camera.bottom=-30;light.shadow.camera.far=130;light.shadow.normalBias=.08;    this.scene.add(light);this.scene.add(light.target);light.target.position.set(0,0,-10);
    this.light=light;this.trafficView=new TrafficView(this.scene);this.dinosaurView=new DinosaurView(this.scene);this.arsenalView=new ArsenalView();this.faunaSites=[];this.level=1;
    this.staticGroup=new THREE.Group();this.scene.add(this.staticGroup);this.infrastructure=new InfrastructureView(this.scene,this.staticGroup);this.staticStation=null;this.branchRoad=new BranchRoadView(this.staticGroup);
    const soil=document.createElement('canvas');soil.width=128;soil.height=128;const soilCtx=soil.getContext('2d'),soilRng=random(84217);soilCtx.fillStyle=SECOND_LEVEL_SCENE.road;soilCtx.fillRect(0,0,128,128);
    for(let i=0;i<2200;i++){soilCtx.fillStyle=soilRng()<.5?SECOND_LEVEL_SCENE.grainDark:SECOND_LEVEL_SCENE.grainLight;soilCtx.fillRect(soilRng()*128,soilRng()*128,1+soilRng()*3,1+soilRng()*2);}
    for(const x of [28,87]){soilCtx.fillStyle=SECOND_LEVEL_SCENE.tracks;soilCtx.fillRect(x,0,10,128);}
    const soilMap=new THREE.CanvasTexture(soil);soilMap.wrapS=soilMap.wrapT=THREE.RepeatWrapping;soilMap.colorSpace=THREE.SRGBColorSpace;
    this.dirtMaterial=new THREE.MeshStandardMaterial({map:soilMap,roughness:1});
    this.groundMaterial=material(0x9bcb73);this.leafMaterial=material(0x91bf65).clone();this.leafMaterial.vertexColors=true;this.waterMaterial=material(0x8ac6d9);
    this.roadGroup=new THREE.Group();this.scene.add(this.roadGroup);this.strips=[];
    // 地面和路肩只铺在路面外，避免坡道三角面重叠产生横纹与闪烁。
    this.strip(this.groundMaterial,edge=>[-180,-edge-1.2],-.04,true);
    this.strip(this.groundMaterial,edge=>[edge+1.2,180],-.04,true);
    this.strip(material(0x8195a0),edge=>[-edge-1.2,-edge],-.02);
    this.strip(material(0x8195a0),edge=>[edge,edge+1.2],-.02);
    this.strip(material(0x293e50),edge=>[-edge,edge],0);
    for(const sign of [-1,1]){
      this.strip(material(0xf4e9c4),edge=>[sign*(edge-.10)-.035,sign*(edge-.10)+.035],.009);
      this.strip(material(0xe2c357),()=>[sign*.15-.035,sign*.15+.035],.011);
    }
    this.lines=new THREE.InstancedMesh(new THREE.BoxGeometry(.07,.012,4),material(0xd4ddd7),200);this.scene.add(this.lines);
    const treeParts=treeGeometry();
    this.trunks=new THREE.InstancedMesh(treeParts.trunk,material(0x7a684d),TREE_SCENERY.capacity);this.trunks.castShadow=true;this.scene.add(this.trunks);
    this.trees=new THREE.InstancedMesh(treeParts.broadleaf,this.leafMaterial,TREE_SCENERY.capacity);this.trees.castShadow=true;this.scene.add(this.trees);
    this.pines=new THREE.InstancedMesh(treeParts.conifer,this.leafMaterial,TREE_SCENERY.capacity);this.pines.castShadow=true;this.scene.add(this.pines);
    this.rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material(0xa5b2a7),50);this.scene.add(this.rocks);
    this.lakes=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,.02,24),this.waterMaterial,4);this.scene.add(this.lakes);
    this.markers=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.65,.12),material(0xece4cc),110);this.scene.add(this.markers);
    this.roadside=new RoadsideScenery(this.scene);
    this.roadworks=new RoadworksView(this.staticGroup);
    this.roadPoint={};this.localPoint={};this.playerMotion={};this.vehicleMotion={};this.carIds=new Set();this.cowIds=new Set();this.views=new Map();this.pools=new Map();this.carColorId=DEFAULT_CAR_COLOR;this.player=vehicleModel(1,true,carColor(this.carColorId).hex);this.scene.add(this.player);this.playerRank=1;this.upgradeTime=0;
    this.playerMud=mudCoating(this.player);
    this.exhaust=new THREE.Group();this.exhaust.visible=false;this.player.add(this.exhaust);
    const jetGeometry=new THREE.ConeGeometry(1,1,8).rotateX(Math.PI/2);
    for(let i=0;i<2;i++){
      const jet=new THREE.Group(),outer=new THREE.Mesh(jetGeometry,new THREE.MeshBasicMaterial({color:0x43cfff,transparent:true,opacity:.7})),core=new THREE.Mesh(jetGeometry,new THREE.MeshBasicMaterial({color:0xe3fbff}));
      outer.scale.set(.26,.26,2.3);outer.position.z=1.15;core.scale.set(.13,.13,1.5);core.position.z=.8;jet.add(outer,core);this.exhaust.add(jet);
    }
    this.cowViews=new Map();this.cowPool=[];
    this.hazardMeshes={
      rim:new THREE.InstancedMesh(new THREE.RingGeometry(.72,1,12).rotateX(-Math.PI/2),material(0x797565),64),
      pit:new THREE.InstancedMesh(new THREE.CircleGeometry(.72,12).rotateX(-Math.PI/2),material(0x151c20),64),
      mud:new THREE.InstancedMesh(new THREE.CircleGeometry(1,14).rotateX(-Math.PI/2),material(0x735139),16),
      wet:new THREE.InstancedMesh(new THREE.CircleGeometry(1,12).rotateX(-Math.PI/2),material(0x493a28),16),
    };
    for(const mesh of Object.values(this.hazardMeshes)){mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;this.staticGroup.add(mesh);}
    // 天降炮弹:下落弹体、地面红色预警圈与持久弹坑;弹坑用深色扁盒贴在路面。
    this.shellBomb=new THREE.InstancedMesh(new THREE.SphereGeometry(.5,10,8),new THREE.MeshStandardMaterial({color:0x33383c,roughness:.5}),8);
    this.craterMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material(0x2a251f),40);
    for(const mesh of [this.shellBomb,this.craterMesh]){mesh.count=0;mesh.frustumCulled=false;this.scene.add(mesh);}
    this.shellWarn=new THREE.InstancedMesh(new THREE.RingGeometry(SHELL.areaSize/2-.5,SHELL.areaSize/2,36).rotateX(-Math.PI/2),
      new THREE.MeshBasicMaterial({color:0xff5340,transparent:true,opacity:.7,fog:false}),8);
    this.shellWarn.count=0;this.shellWarn.frustumCulled=false;this.shellWarn.visible=false;this.scene.add(this.shellWarn);
    this.wallGroup=new THREE.Group();this.staticGroup.add(this.wallGroup);
    for(let i=0;i<4;i++){
      const wall=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.1,.7),material(0xd8ccaa));base.position.y=.55;wall.add(base);
      for(let k=0;k<6;k++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.32,.72,.015),material(k%2?0xebbb55:0x293839));stripe.rotation.z=-.45;stripe.position.set(-1.45+k*.57,.65,.36);wall.add(stripe);}
      this.wallGroup.add(wall);
    }
    this.signs=[];
    const signMap=new THREE.CanvasTexture(this.signCanvas());
    for(let i=0;i<4;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:signMap}));sprite.scale.set(3.4,2.1,1);this.staticGroup.add(sprite);this.signs.push(sprite);}
    this.staticGroup.add(this.roadGroup,this.lines,this.markers,this.trunks,this.trees,this.pines,this.rocks,this.lakes);
    this.effects=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material(0xf29f41),56);this.effects.frustumCulled=false;this.scene.add(this.effects);this.effects.count=0;
    this.effectRecords=[];
    const particleGeometry=new THREE.BufferGeometry();this.particlePositions=new Float32Array(100*3);
    this.particleRng=random(25677);
    for(let i=0;i<100;i++){this.particlePositions[i*3]=(this.particleRng()-.5)*65;this.particlePositions[i*3+1]=this.particleRng()*16;this.particlePositions[i*3+2]=15-this.particleRng()*90;}
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3));
    this.particles=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0xffffff,size:.12,transparent:true,opacity:.65,depthWrite:false}));this.particles.frustumCulled=false;this.scene.add(this.particles);
    this.colorA=new THREE.Color();this.colorB=new THREE.Color();this.lastScenery=-1;
    this.roadSamples=new Float64Array(ROAD_RENDER.sampleCapacity*10);this.dirty=true;this.cameraSettling=false;this.onInvalidate=()=>{};
    this.resize=()=>{
      const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
      this.renderer.setSize(w,h);this.camera.aspect=w/h;
      // 竖屏扩大纵向视野，保留横向车道，同时把玩家留在底部触控区上方。
      this.camera.fov=Math.min(CAMERA.portraitMaxFov,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(CAMERA.fov/2))/Math.min(1,w/h))));
      this.camera.updateProjectionMatrix();this.invalidate();
    };
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(container);this.resize();
  }
  signCanvas(){const c=document.createElement('canvas');c.width=256;c.height=160;const x=c.getContext('2d');x.fillStyle='#f2d478';x.beginPath();x.roundRect(0,0,256,160,18);x.fill();x.fillStyle='#273b33';x.font='bold 31px system-ui';x.textAlign='center';x.fillText('前方并道',128,59);x.font='bold 59px system-ui';x.fillText('↙  ↘',128,130);return c;}
  roadGeometry(capacity=ROAD_RENDER.sampleCapacity){
    const geometry=new THREE.BufferGeometry(),positions=new Float32Array(capacity*6),indices=[];
    for(let i=0;i<capacity-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(capacity*4),2));geometry.setIndex(indices);geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(capacity*6),3));
    const normals=geometry.attributes.normal.array;for(let i=1;i<normals.length;i+=3)normals[i]=1;
    return geometry;
  }
  strip(mat,bounds,y,terrain=false){
    const geometry=this.roadGeometry();
    const mesh=new THREE.Mesh(geometry,mat);mesh.frustumCulled=false;mesh.receiveShadow=true;this.roadGroup.add(mesh);this.strips.push({mesh,bounds,y,terrain});
  }
  ensureRoadCapacity(required){
    if(required<=this.roadSamples.length/10)return;
    const capacity=Math.max(required,this.roadSamples.length/5);
    this.roadSamples=new Float64Array(capacity*10);
    for(const strip of this.strips){strip.mesh.geometry.dispose();strip.mesh.geometry=this.roadGeometry(capacity);}
  }
  local(s,d=0,route=null,out={}){const p=this.road.at(s,d,route,this.roadPoint),dx=p.x-this.origin.x,dz=p.z-this.origin.z,h=this.origin.heading;out.x=Math.cos(h)*dx+Math.sin(h)*dz;out.y=p.y-this.origin.y;out.z=-Math.sin(h)*dx+Math.cos(h)*dz;out.heading=p.heading-h;out.pitch=p.pitch;return out;}
  motion(target,previous=target.previous,out=this.vehicleMotion){
    // 只平滑展示坐标，不回写逻辑状态；路线切换和车型变化直接显示新状态。
    if(!previous||this.motionAlpha===1||(previous.route??null)!==(target.route??null)||previous.rank!==undefined&&previous.rank!==target.rank)return target;
    out.s=lerp(previous.s,target.s,this.motionAlpha);out.d=lerp(previous.d,target.d,this.motionAlpha);out.route=target.route;out.speed=target.speed;return out;
  }
  localGround(s,d=0,out={}){const p=this.local(s,d,null,out);p.y+=this.road.groundElevation(s)-this.road.at(s,0,null,this.roadPoint).y;return p;}
  instance(mesh,index,x,y,z,sx,sy,sz,angle=0,pitch=0){temp.position.set(x,y,z);temp.rotation.set(pitch,-angle,0,'YXZ');temp.scale.set(sx,sy,sz);temp.updateMatrix();mesh.setMatrixAt(index,temp.matrix);}
  updateStatic(game){
    const s=Math.floor(game.player.s/10)*10,origin=this.origin;
    if(this.staticStation!==s||this.staticBreakRevision!==game.whiteHorse.revision||this.staticRoadRevision!==this.road.revision){
      this.staticBreakRevision=game.whiteHorse.revision;this.staticRoadRevision=this.road.revision;
      this.staticStation=s;this.staticOrigin=this.road.at(s);this.origin=this.staticOrigin;
      this.updateRoad(s);this.infrastructure.rebuild(this,s);this.branchRoad.draw(this,s);this.roadworks.draw(this,s);this.scenery(s);this.drawHazards({player:{s},hazards:game.hazards});
      this.origin=origin;
    }
    // 静态场景每十米更新一次几何，其余帧只转换父节点，弯道和坡道仍连续移动。
    const cached=this.staticOrigin,dx=cached.x-origin.x,dz=cached.z-origin.z,cos=Math.cos(origin.heading),sin=Math.sin(origin.heading);
    this.staticGroup.position.set(cos*dx+sin*dz,cached.y-origin.y,-sin*dx+cos*dz);
    this.staticGroup.rotation.y=origin.heading-cached.heading;
  }
  updateRoad(s){
    // 所有条带共享采样；截止点两侧在同一位置分别保留宽、窄边界，避免斜边随采样移动和交叠闪烁。
    const firstStation=s-80,lastStation=s+460,roadStep=5,roadPoints=Math.round((lastStation-firstStation)/roadStep)+1;
    const boundaries=this.road.walls(firstStation,lastStation-firstStation).filter(wall=>wall.end>=firstStation&&wall.end<=lastStation);
    // 先按最坏点数扩容，采样、顶点及索引始终共用容量，避免密集截止点静默越界。
    this.ensureRoadCapacity(roadPoints+boundaries.length*2);
    const samples=this.roadSamples;
    let sampleCount=0,boundaryIndex=0;
    const sample=(station,edge)=>{
      const p=this.local(station),n=sampleCount++*10,sin=Math.sin(p.heading),cos=Math.cos(p.heading),pitchSin=Math.sin(p.pitch);
      samples[n]=p.x;samples[n+1]=p.y;samples[n+2]=p.z;samples[n+3]=edge;samples[n+4]=cos;samples[n+5]=sin;
      samples[n+6]=-sin*pitchSin;samples[n+7]=Math.cos(p.pitch);samples[n+8]=cos*pitchSin;samples[n+9]=this.road.groundElevation(station)-p.y-this.origin.y;
    };
    for(let i=0;i<roadPoints;i++){
      const station=firstStation+i*roadStep;
      while(boundaryIndex<boundaries.length&&boundaries[boundaryIndex].end<=station){
        const wall=boundaries[boundaryIndex++];
        sample(wall.end,.4+wall.lanes*3.6);
        sample(wall.end,this.road.edge(wall.end));
      }
      if(boundaries[boundaryIndex-1]?.end!==station)sample(station,this.road.edge(station));
    }
    for(const strip of this.strips){
      const uv=strip.mesh.geometry.attributes.uv.array;
      const array=strip.mesh.geometry.attributes.position.array,normals=strip.mesh.geometry.attributes.normal.array;
      for(let i=0;i<sampleCount;i++){
        const sample=i*10,bounds=strip.bounds(samples[sample+3]);
        for(let j=0;j<2;j++){const d=bounds[j],n=i*6+j*3;uv[i*4+j*2]=d*.15;uv[i*4+j*2+1]=(firstStation+i*roadStep)*.15;array[n]=samples[sample]+samples[sample+4]*d;array[n+1]=samples[sample+1]+strip.y+(strip.terrain?samples[sample+9]:0);array[n+2]=samples[sample+2]+samples[sample+5]*d;normals[n]=strip.terrain?0:samples[sample+6];normals[n+1]=strip.terrain?1:samples[sample+7];normals[n+2]=strip.terrain?0:samples[sample+8];}
      }
      strip.mesh.geometry.setDrawRange(0,(sampleCount-1)*6);
      strip.mesh.geometry.attributes.uv.needsUpdate=true;
      strip.mesh.geometry.attributes.position.needsUpdate=true;
      strip.mesh.geometry.attributes.normal.needsUpdate=true;
    }
    let index=0,pole=0;
    const first=Math.floor((s-80)/12)*12;
    for(let station=first;station<s+460;station+=12){
      for(const sign of [-1,1]){
        for(let lane=1;lane<3;lane++)if(lane<this.road.lanes(station)-.01){const p=this.local(station,sign*(.4+lane*3.6));this.instance(this.lines,index++,p.x,p.y+.025,p.z,1,1,1,p.heading,p.pitch);}
        if(this.road.junction(station,sign))continue;
        const p=this.local(station,sign*(this.road.edge(station)+.7));this.instance(this.markers,pole++,p.x,p.y+.32,p.z,1,1,1,p.heading);
      }
    }
    this.lines.count=index;this.lines.instanceMatrix.needsUpdate=true;this.markers.count=pole;this.markers.instanceMatrix.needsUpdate=true;
    this.lines.computeBoundingSphere();this.markers.computeBoundingSphere();
    let wallIndex=0,signIndex=0;
    for(const closure of this.road.closures(s,470)){
      if(closure.kind==='wall')for(const sign of [-1,1]){
        const p=this.local(closure.end,sign*9.4),wall=this.wallGroup.children[wallIndex++];
        if(wall){wall.visible=!this.whiteHorse.smashed.has('wall:'+closure.end+':'+sign);wall.position.set(p.x,p.y,p.z);wall.rotation.set(p.pitch,-p.heading,0,'YXZ');}
      }
      for(const sign of [-1,1]){
        const p=this.local(closure.kind==='wall'?closure.end-240:closure.start-180,sign*(this.road.edge(closure.start)+2.8));
        const sprite=this.signs[signIndex++];if(sprite){sprite.visible=true;sprite.position.set(p.x,p.y+2.6,p.z);}
      }
    }
    this.wallGroup.children.forEach((w,i)=>{if(i>=wallIndex)w.visible=false;});this.signs.forEach((v,i)=>{if(i>=signIndex)v.visible=false;});
  }
  scenery(s){
    let tree=0,broadleaf=0,conifer=0,rock=0,lake=0;this.faunaSites=[];
    const first=Math.floor((s-80)/40);
    for(let block=first;block<=first+14;block++){
      const local=((block*40)%this.road.length+this.road.length)%this.road.length;
      const rng=random(this.road.seed^(local*137));
      const template=this.road.segment(Math.max(0,block*40)).scene;
      for(const sign of [-1,1]){
        for(let k=0;k<4;k++){
          const station=block*40+rng()*40,d=sign*(this.road.edge(station)+(k<2?5+rng()*3:48+rng()*24)),p=this.localGround(station,d),height=lerp(TREE_SCENERY.minHeight,TREE_SCENERY.maxHeight,rng());
          if(this.road.onPavement(station,d,3))continue;
          const radius=lerp(TREE_SCENERY.minRadius,TREE_SCENERY.maxRadius,rng()),angle=rng()*Math.PI*2,pine=rng()<TREE_SCENERY.coniferChance;
          this.instance(this.trunks,tree++,p.x,p.y,p.z,this.level===2?.5:1,height*(this.level===2?.18:.60),this.level===2?.5:1,angle);
          if(this.level!==2)this.instance(pine?this.pines:this.trees,pine?conifer++:broadleaf++,p.x,p.y+height*(pine?.55:.72),p.z,radius,height*(pine?.28:.23),radius*(.85+rng()*.3),angle);
        }
        if(template===1&&lake<4&&rng()<.08){const station=block*40+20,p=this.localGround(station,sign*(this.road.edge(station)+65));if(Math.abs(p.pitch)<.025){this.instance(this.lakes,lake++,p.x,p.y-.018,p.z,9,1,17,p.heading);if(this.level===2)this.faunaSites.push({id:block*2+(sign>0?1:0),s:station,d:sign*(this.road.edge(station)+65),kind:'diplodocus'});}}
        if((template===2||this.level===2)&&rock<50){const station=block*40+rng()*40,d=sign*(this.road.edge(station)+4+rng()*3);if(!this.road.onPavement(station,d,3)){const p=this.localGround(station,d);this.instance(this.rocks,rock++,p.x,p.y+.5,p.z,this.level===2?2.7:1.5,this.level===2?1.5:.7,this.level===2?2.1:1.3);}}
        if(this.level===2&&block%2===0&&rng()<.4){const station=block*40+20,d=sign*(this.road.edge(station)+23);if(!this.road.onPavement(station,d,10)&&!this.road.infrastructure(station).length)this.faunaSites.push({id:block*2+(sign>0?1:0)+100000,s:station,d,kind:block%4===0?'triceratops':'stegosaurus'});}
      }
    }
    for(const [mesh,count]of [[this.trees,broadleaf],[this.pines,conifer],[this.trunks,tree],[this.rocks,rock],[this.lakes,lake]]){mesh.count=count;mesh.instanceMatrix.clearUpdateRanges();if(count){mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;}mesh.computeBoundingSphere();}
  }
  drawHazards(game){
    let pit=0,mud=0;
    for(const hazard of game.hazards.range(game.player.s-80,game.player.s+460)){
      const point=this.local(hazard.s,hazard.d,hazard.route),width=hazard.dimensions.width/2,length=hazard.dimensions.length/2;
      if(hazard.kind==='pothole'&&pit<64){
        this.instance(this.hazardMeshes.rim,pit,point.x,point.y+.04,point.z,width,1,length,point.heading,point.pitch);
        this.instance(this.hazardMeshes.pit,pit++,point.x,point.y+.03,point.z,width,1,length,point.heading,point.pitch);
      }else if(hazard.kind==='mud'&&mud<16){
        this.instance(this.hazardMeshes.mud,mud,point.x,point.y+.035,point.z,width,1,length,point.heading,point.pitch);
        this.instance(this.hazardMeshes.wet,mud++,point.x,point.y+.045,point.z,width*.62,1,length*.66,point.heading,point.pitch);
      }
    }
    for(const [key,count]of [['rim',pit],['pit',pit],['mud',mud],['wet',mud]]){
      const mesh=this.hazardMeshes[key];mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;
    }
  }
  acquire(car){
    const key=car.rank+':'+car.color,pool=this.pools.get(key)||[];let view=pool.pop();this.pools.set(key,pool);
    if(!view){
      view=new THREE.Group();view.add(vehicleModel(car.rank,false,car.color));
      const signal=new THREE.Group(),v=VEHICLES[car.rank];
      for(const sign of [-1,1]){const lamp=new THREE.Mesh(signalGeometry,material(0xffce4c));lamp.position.set(0,.5,sign*v.length*.35);signal.add(lamp);}
      view.add(signal);
      const queueLights=new THREE.Group();
      for(const side of [-1,1]){const lamp=new THREE.Mesh(queueLightGeometry,material(0xffa538));lamp.position.set(side*v.width*.38,.6,v.length/2+.02);queueLights.add(lamp);}
      view.add(queueLights);view.userData.signal=signal;view.userData.queueLights=queueLights;
    }
    view.visible=true;view.rotation.set(0,0,0);view.scale.setScalar(1);view.userData.signal.visible=false;view.userData.queueLights.visible=false;view.userData.poolKey=key;this.views.set(car.id,view);return view;
  }
  releaseCow(id){const view=this.cowViews.get(id);if(!view)return;this.scene.remove(view);this.cowViews.delete(id);this.cowPool.push(view);}
  // 天降炮弹:下落弹体从高空按剩余时长线性下降,地面预警圈随落点脉冲闪烁(逐弹实例,多弹并存互不覆盖);
  // 弹坑持久留在路面,按弹体生成时的实际尺寸缩放。
  drawShells(game){
    const shells=game.shell?.shells??[],craters=game.shell?.craters??[];
    const live=game.state==='RUNNING'||game.state==='PAUSED';
    let bomb=0,mark=0,warn=0;
    const pulse=.55+Math.sin(game.activeSeconds*9)*.25;
    for(const crater of craters){
      const p=this.local(crater.s,crater.d,crater.route??null),size=crater.size??SHELL.areaSize;
      this.instance(this.craterMesh,mark++,p.x,p.y+.04,p.z,size,.06,size,p.heading,p.pitch);
    }
    for(const shell of shells){
      const p=this.local(shell.s,shell.d,shell.route??null);
      if(bomb<8){
        const ratio=1-shell.fall/shell.total;
        this.instance(this.shellBomb,bomb++,p.x,p.y+lerp(70,1,ratio),p.z,1,1,1,0,0);
      }
      if(mark<40){
        // 早期弹坑与当前预警圈同框时不再重复绘制弹坑(预警圈即落点)。
        if(!craters.some(crater=>crater.id===shell.id)){
          this.instance(this.craterMesh,mark++,p.x,p.y+.05,p.z,shell.size??SHELL.areaSize,.05,shell.size??SHELL.areaSize,p.heading,p.pitch);
        }
      }
      if(live&&warn<8){
        const scale=(shell.size??SHELL.areaSize)/SHELL.areaSize;
        this.instance(this.shellWarn,warn++,p.x,p.y+.08,p.z,scale,1,scale,p.heading);
      }
    }
    this.shellWarn.count=warn;this.shellWarn.visible=warn>0;
    if(warn){this.shellWarn.instanceMatrix.needsUpdate=true;this.shellWarn.material.opacity=pulse;}
    this.shellBomb.count=bomb;this.shellBomb.visible=bomb>0;if(bomb)this.shellBomb.instanceMatrix.needsUpdate=true;
    this.craterMesh.count=mark;this.craterMesh.visible=mark>0;if(mark)this.craterMesh.instanceMatrix.needsUpdate=true;
  }
  drawDriving(game,dt){
    const p=game.player,live=game.state==='RUNNING',paused=game.state==='PAUSED',size=VEHICLES[p.rank];
    this.exhaust.visible=(live||paused)&&game.nitro.boost>0;
    this.exhaust.position.set(0,.42,size.length/2+.05);
    const pulse=1+Math.sin(game.activeSeconds*47)*.12;
    this.exhaust.children.forEach((jet,index)=>{jet.visible=p.rank>2||index===0;jet.position.x=p.rank>2?(index-.5)*size.width*.55:0;jet.scale.set(1,1,pulse);});
  }
  drawCows(game){
    const ids=this.cowIds;ids.clear();for(const cow of game.crossings.cows)if(cow.kind!=='dinosaur')ids.add(cow.id);
    for(const id of this.cowViews.keys())if(!ids.has(id))this.releaseCow(id);
    for(const cow of game.crossings.cows){
      if(cow.kind==='dinosaur')continue;
      let view=this.cowViews.get(cow.id);
      if(!view){view=this.cowPool.pop()||cowModel();this.cowViews.set(cow.id,view);this.scene.add(view);}
      const motion=this.motion(cow),p=this.local(motion.s,motion.d+(cow.launched?cow.launchSide*cow.hitTime*9:0),null,this.localPoint),reaction=cow.hit?Math.sin(Math.min(1,cow.hitTime/.8)*Math.PI):0;
      view.position.set(p.x,p.y+reaction*(cow.launched?3:.3),p.z);view.rotation.set(cow.launched?cow.hitTime*3:0,-p.heading-cow.direction*Math.PI/2,cow.launched?cow.launchSide*cow.hitTime*4:reaction*.15);
      view.scale.setScalar(cow.hit?Math.max(.01,1-cow.hitTime/.8):1);
      for(const part of view.children){
        if(part.userData.cowLeg)part.rotation.x=Math.sin(cow.time*8+(part.userData.cowLeg>0?0:Math.PI))*.3;
        if(part.userData.cowTail)part.rotation.z=Math.sin(cow.time*3)*.15;
      }
    }
  }
  release(id){const view=this.views.get(id);if(!view)return;view.visible=false;this.scene.remove(view);this.views.delete(id);this.pools.get(view.userData.poolKey).push(view);}
  returnEffect(record){
    if(!record.view)return;
    record.view.visible=false;record.view.scale.setScalar(1);record.view.userData.signal.visible=false;record.view.userData.queueLights.visible=false;
    this.scene.remove(record.view);
    this.pools.get(record.view.userData.poolKey).push(record.view);
    record.view=null;
  }
  resetEffects(){
    this.weatherView.reset();this.whiteHorseView.reset();this.policeView.reset();
    this.effectRecords.forEach(r=>this.returnEffect(r));this.effectRecords=[];this.effects.count=0;
    this.exhaust.visible=false;
  }
  // 颜色选择页换色时重建玩家模型，尾焰与泥浆涂层跟随重建。
  setCarColor(id){
    if(this.carColorId===id)return;
    this.carColorId=id;
    this.playerMud.dispose();this.scene.remove(this.player);
    this.player=vehicleModel(this.playerRank,true,carColor(id).hex);
    this.playerMud=mudCoating(this.player);this.player.add(this.exhaust);
    this.scene.add(this.player);this.invalidate();
  }
  resetRun(){
    this.resetEffects();this.dinosaurView.reset();this.arsenalView.reset();
    for(const id of this.views.keys())this.release(id);
    for(const id of this.cowViews.keys())this.releaseCow(id);
    this.traffic=null;this.staticStation=null;this.cameraPitch=0;this.cameraX=0;this.cameraZ=0;this.cameraHeading=0;this.upgradeTime=0;this.roadside.reset();this.infrastructure.reset();this.invalidate();
  }
  guideImages(){return this.guidePreviews??=levelGuideImages(this.renderer);}
  invalidate(){this.dirty=true;this.onInvalidate();}
  needsFrame(game){return this.dirty||this.lastState!==game.state||this.traffic!==game.traffic||this.cameraSettling;}
  updateQuality(dt,live,game){
    if(!live){this.qualitySeconds=0;this.qualityFrames=0;this.qualityWarmup=1;return;}
    // 跳过起步着色器编译；只根据持续两秒的帧间隔降档，避免偶发停顿改变画质。
    if(this.qualityWarmup>0){this.qualityWarmup-=dt;return;}
    this.qualitySeconds+=dt;this.qualityFrames++;
    if(this.qualitySeconds<2)return;
    const targetFps=game.level===2?RENDER_QUALITY.secondLevelFps:game.nitro.boost>0||game.player.speed>=RENDER_QUALITY.firstLevelFastSpeed?RENDER_QUALITY.firstLevelFastFps:45;
    if(this.qualitySeconds/this.qualityFrames>1/targetFps&&this.pixelRatio>.75){
      this.pixelRatio=Math.max(.75,this.pixelRatio-.25);this.renderer.setPixelRatio(this.pixelRatio);
    }
    this.qualitySeconds=0;this.qualityFrames=0;
  }
  effect(s,d,kind='eat',car=null,launchSide=1){
    const view=car?this.views.get(car.id):null;
    if(view){this.views.delete(car.id);view.userData.signal.visible=false;}
    this.effectRecords.push({s,d,route:car?(car.route??null):this.playerRoute,kind,time:0,view,launchSide});
    if(this.effectRecords.length>8)this.returnEffect(this.effectRecords.shift());
  }
  draw(game,dt){
    if(this.traffic!==game.traffic){this.resetRun();this.traffic=game.traffic;}
    const live=game.state==='RUNNING',dying=game.state==='DYING',exiting=game.state==='LEVEL_EXIT',simDt=live?dt:0,effectDt=live||dying?dt:0;
    this.updateQuality(dt,live,game);
    const refresh=live||dying||exiting||game.state==='CAUGHT'||this.dirty||this.lastState!==game.state;
    this.lastState=game.state;this.dirty=false;
    if(!refresh){this.updateCamera(game,dt);this.renderer.render(this.scene,this.camera);return;}
    if(this.level!==game.level){this.level=game.level;this.staticStation=null;this.roadside.reset();this.infrastructure.reset();}
    this.motionAlpha=live?clamp(game.renderAlpha??1,0,1):1;
    this.renderPlayer=this.motion(game.player,game.renderPreviousPlayer,this.playerMotion);
    const roadMaterial=this.level===2?this.dirtMaterial:material(0x293e50),shoulderMaterial=material(this.level===2?SECOND_LEVEL_SCENE.shoulder:0x8195a0);
    // 更换已有节点的材质不会触发 childadded，主副路共用的新材质必须显式接入浓雾。
    this.weatherView.distanceFog.bind(roadMaterial);this.weatherView.distanceFog.bind(shoulderMaterial);
    this.strips[4].mesh.material=roadMaterial;
    for(const i of [2,3])this.strips[i].mesh.material=shoulderMaterial;
    this.playerRoute=game.player.route;this.whiteHorse=game.whiteHorse;this.road=game.road;this.origin=this.road.at(this.renderPlayer.s);
    this.updateStatic(game);this.infrastructure.draw(this,game);this.drawShells(game);this.drawCows(game);
    this.updateCamera(game,dt);this.trafficView.begin(this.camera,this.light,true);
    const season=game.season(),a=palette[season.index],b=palette[(season.index+1)%4];
    this.roadside.draw(this,game.player.s,season,game.activeSeconds);
    const blend=(out,key)=>out.setHex(a[key]).lerp(this.colorB.setHex(b[key]),season.blend);
    blend(this.groundMaterial.color,'ground');blend(this.leafMaterial.color,'leaf');blend(this.waterMaterial.color,'water');blend(this.scene.background,'sky');
    this.light.color.setHex(this.level===2?SECOND_LEVEL_SCENE.sun:0xfff1cb);
    if(this.level===2){this.groundMaterial.color.setHex(SECOND_LEVEL_SCENE.ground);this.waterMaterial.color.setHex(SECOND_LEVEL_SCENE.water);this.scene.background.setHex(SECOND_LEVEL_SCENE.sky);this.rocks.material.color.setHex(SECOND_LEVEL_SCENE.rock);this.trunks.material.color.setHex(SECOND_LEVEL_SCENE.trunk);}else this.rocks.material.color.setHex(0xa5b2a7);this.scene.fog.color.copy(this.scene.background);
    if(this.playerRank!==game.player.rank){this.playerMud.dispose();this.scene.remove(this.player);this.player=vehicleModel(game.player.rank,true,carColor(this.carColorId).hex);this.playerMud=mudCoating(this.player);this.player.add(this.exhaust);this.scene.add(this.player);this.playerRank=game.player.rank;this.upgradeTime=.25;}
    this.upgradeTime=Math.max(0,this.upgradeTime-simDt);
    const departing=(exiting||game.state==='LEVEL_CLEAR')&&game.levelExit,visual=departing?game.levelExit:this.renderPlayer;
    const p=this.local(visual.s,visual.d,visual.route),bump=Math.sin((1-game.player.bump/BUMP_SECONDS)*Math.PI);
    this.player.position.set(p.x,p.y+(game.player.bump>0?bump*.85:0),p.z);this.player.rotation.set(p.pitch+(game.player.bump>0?bump*.12:0),-p.heading,!departing?clamp(-(game.player.sidePush?0:game.input.lateral)*.035-game.player.push*.018,-.12,.12):0,'YXZ');
    this.playerMud.visible=game.player.mud>0;
    if(game.state==='CAUGHT'&&game.caught){
      // 被渔网罩住:catchSeconds 内缩小、旋转并被拉向警车位置。
      const k=clamp(game.caught.t/POLICE.catchSeconds,0,1),cp=this.local(game.caught.police.s,game.caught.police.d,game.caught.police.route);
      this.player.position.set(lerp(p.x,cp.x,k),lerp(p.y,cp.y,k)+Math.sin(k*Math.PI)*1.5,lerp(p.z,cp.z,k));
      this.player.scale.setScalar(Math.max(.03,1-k));
      this.player.rotation.z=k*2.4;
    }
    const deathResult=game.state==='RESULT'&&game.result?.endReason==='death';
    const blink=!game.whiteHorse.shielded(game.activeSeconds)&&(live||game.state==='PAUSED')&&game.activeSeconds<game.player.invincibleUntil&&Math.floor(game.activeSeconds*12)%2===1;
    this.player.visible=!deathResult&&(!dying||game.deathTime<1.1)&&(!blink||dying);this.player.scale.setScalar(dying?Math.max(.01,1-game.deathTime*.85):1-this.upgradeTime);
    for(const wheel of this.player.children)if(wheel.userData.wheelRadius)wheel.rotateY(-visual.speed/3.6/wheel.userData.wheelRadius*(exiting?dt:simDt));
    if(dying){this.player.position.y=game.deathTime*.8;this.player.position.z-=game.deathTime*9;this.player.rotation.z=game.deathTime*2;}
    this.drawDriving(game,dt);
    const ids=this.carIds;ids.clear();for(const car of game.traffic.cars)if(!car.remove)ids.add(car.id);
    for(const id of this.views.keys())if(!ids.has(id))this.release(id);
    for(const car of game.traffic.cars){
      if(car.remove)continue;
      const view=this.views.get(car.id)||this.acquire(car),motion=this.motion(car),point=this.local(motion.s,motion.d,motion.route,this.localPoint);
      view.position.set(point.x,point.y,point.z);view.rotation.set(point.pitch*car.direction,-point.heading+(car.direction<0?Math.PI:0),0,'YXZ');
      const signal=view.userData.signal;signal.visible=Boolean(car.merge)&&Math.floor(car.merge.time*6)%2===0;
      view.userData.queueLights.visible=Boolean(car.convoy||car.warning)&&Math.floor(game.activeSeconds*4)%2===0;
      if(car.merge)signal.position.x=Math.sign(car.merge.lane-car.lane)*(VEHICLES[car.rank].width/2+.07);
      for(const wheel of view.children[0].children)if(wheel.userData.wheelRadius)wheel.rotateY(-car.speed/wheel.userData.wheelRadius*simDt);
      this.trafficView.add(view);
    }
    this.particles.visible=this.level!==2;
    this.particles.material.color.setHex(season.index===2?0xf4bd6e:season.index===0?0xffe2eb:0xffffff);
    this.particles.material.opacity=season.index===3?.7:.32;
    for(let i=0;i<100;i++){
      this.particlePositions[i*3+1]-=simDt*(season.index===3?1.6:.7);
      this.particlePositions[i*3+2]+=simDt*(game.player.speed/3.6);
      if(this.particlePositions[i*3+1]<0)this.particlePositions[i*3+1]=16;
      if(this.particlePositions[i*3+2]>20)this.particlePositions[i*3+2]=-70;
    }
    this.particles.geometry.attributes.position.needsUpdate=true;
    let effect=0;
    if(dying){
      for(let i=0;i<40;i++){
        const angle=i*2.39996,t=game.deathTime,r=t*(2+(i%7)*.6),size=Math.max(.02,(1-t/1.3)*(.12+(i%4)*.08));
        this.instance(this.effects,effect++,p.x+Math.cos(angle)*r,.4+Math.sin(t*Math.PI)*((i%4)+1),p.z+Math.sin(angle)*r,size,size,size,angle+t);
      }
    }
    for(const record of this.effectRecords){
      record.time+=effectDt;const point=this.local(record.s,record.d,record.route),t=record.time;
      const duration=record.kind==='knockaway'?.75:.55;
      if(t>=duration){this.returnEffect(record);continue;}
      if(record.view){
        const ratio=t/duration,view=record.view;
        view.scale.setScalar(Math.max(.01,1-ratio));
        if(record.kind==='knockaway'){
          const destination=this.local(record.s+ratio*12,record.d+record.launchSide*ratio*5,record.route);
          view.position.set(destination.x,destination.y+.2+Math.sin(ratio*Math.PI)*3,destination.z);
          view.rotation.z=record.launchSide*ratio*4;view.rotation.x=ratio*2;
        }else{
          view.position.set(record.kind==='eat'?lerp(point.x,p.x,ratio):point.x,lerp(point.y,p.y,ratio)+.15+Math.sin(ratio*Math.PI)*.7,record.kind==='eat'?lerp(point.z,p.z,ratio):point.z-ratio*2);
          if(record.kind==='wreck')view.rotation.z=ratio*1.8;
        }
        this.trafficView.add(view);
      }
      for(let k=0;k<2;k++){const size=(duration-t)*.45;this.instance(this.effects,effect++,point.x+(k-.5)*t,point.y+.3+t,point.z,size,size,size);}
    }
    this.effectRecords=this.effectRecords.filter(r=>r.time<(r.kind==='knockaway'?.75:.55));this.effects.count=effect;this.effects.instanceMatrix.needsUpdate=true;
    this.dinosaurView.draw(this,game);this.arsenalView.draw(this,game);this.trafficView.finish();
    this.weatherView.draw(this,game);this.whiteHorseView.draw(this,game);this.policeView.draw(this,game,simDt);
    this.renderer.render(this.scene,this.camera);
  }
  updateCamera(game,dt){
    if(game.state==='LEVEL_EXIT'||game.state==='LEVEL_CLEAR'){this.cameraSettling=false;return;}
    const player=this.renderPlayer??game.player;
    const shake=game.state==='DYING'?Math.max(0,.18-game.deathTime*.2)*Math.sin(game.deathTime*90):0;
    const target=this.road.at(player.s,player.d,player.route).pitch*.35;
    this.cameraPitch=lerp(this.cameraPitch||0,target,clamp(dt*3,0,1));
    this.cameraSettling=Math.abs(this.cameraPitch-target)>.0001;
    if(!this.cameraSettling)this.cameraPitch=target;
    const tilt=Math.sin(this.cameraPitch);
    const center=this.road.branchCenter(player.s,player.route),p=this.local(player.s,center,player.route);
    const blend=clamp(dt*5,0,1);
    this.cameraX=lerp(this.cameraX||0,p.x,blend);this.cameraZ=lerp(this.cameraZ||0,p.z,blend);this.cameraHeading=lerp(this.cameraHeading||0,p.heading,blend);
    this.cameraSettling ||=Math.abs(this.cameraX-p.x)+Math.abs(this.cameraZ-p.z)+Math.abs(this.cameraHeading-p.heading)>.001;
    const lateral=(player.d-center)*.13,cos=Math.cos(this.cameraHeading),sin=Math.sin(this.cameraHeading);
    p.x=this.cameraX;p.z=this.cameraZ;
    this.camera.position.set(p.x+cos*lateral-sin*24+shake,p.y+24-24*tilt,p.z+sin*lateral+cos*(24+24*tilt));
    this.camera.lookAt(p.x+cos*lateral+sin*16,p.y+16*tilt,p.z+sin*lateral-cos*16);
  }
}
