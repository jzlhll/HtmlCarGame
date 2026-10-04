import * as THREE from 'three';
import { VEHICLES, laneD, random, clamp, lerp } from './config.js';
import { vehicleModel, material, mudCoating } from './models.js';
import { RoadsideScenery } from './scenery.js';
import { BUMP_SECONDS } from './hazards.js';

const palette=[
  {ground:0x9bcb73,leaf:0x91bf65,water:0x8ac6d9,sky:0xc5e0e9},
  {ground:0x609354,leaf:0x367b48,water:0x67adb8,sky:0xa9d6e8},
  {ground:0xc9a44e,leaf:0xc56943,water:0x84acba,sky:0xe4cfb1},
  {ground:0xe8f1f5,leaf:0xd7e5e3,water:0xaed4e1,sky:0xd4e1e9},
];
const temp=new THREE.Object3D();
export class GameRenderer {
  constructor(container){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xc5e0e9);this.scene.fog=new THREE.Fog(0xc5e0e9,240,560);
    this.camera=new THREE.PerspectiveCamera(55,1,.5,850);
    this.scene.add(new THREE.HemisphereLight(0xe3f0ff,0x668054,2.2));
    const light=new THREE.DirectionalLight(0xfff1cb,2.6);light.position.set(-25,45,15);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-28;light.shadow.camera.right=28;light.shadow.camera.top=50;light.shadow.camera.bottom=-30;light.shadow.camera.far=130;light.shadow.normalBias=.08;this.scene.add(light);this.scene.add(light.target);light.target.position.set(0,0,-10);
    this.groundMaterial=material(0x9bcb73);this.leafMaterial=material(0x91bf65);this.waterMaterial=material(0x8ac6d9);
    this.roadGroup=new THREE.Group();this.scene.add(this.roadGroup);this.strips=[];
    // 地面和路肩只铺在路面外，避免坡道三角面重叠产生横纹与闪烁。
    this.strip(this.groundMaterial,edge=>[-180,-edge-1.2],-.04);
    this.strip(this.groundMaterial,edge=>[edge+1.2,180],-.04);
    this.strip(material(0xc6bc99),edge=>[-edge-1.2,-edge],-.02);
    this.strip(material(0xc6bc99),edge=>[edge,edge+1.2],-.02);
    this.strip(material(0x46535a),edge=>[-edge,edge],0);
    for(const sign of [-1,1]){
      this.strip(material(0xf4e9c4),edge=>[sign*(edge-.10)-.035,sign*(edge-.10)+.035],.009);
      this.strip(material(0xe2c357),()=>[sign*.15-.035,sign*.15+.035],.011);
    }
    this.lines=new THREE.InstancedMesh(new THREE.BoxGeometry(.07,.012,4),material(0xd4ddd7),200);this.scene.add(this.lines);
    this.trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.15,.25,2,5),material(0x7a684d),150);this.trunks.castShadow=true;this.scene.add(this.trunks);
    this.trees=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),this.leafMaterial,150);this.trees.castShadow=true;this.scene.add(this.trees);
    this.rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material(0xa5b2a7),50);this.scene.add(this.rocks);
    this.lakes=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,.02,24),this.waterMaterial,4);this.scene.add(this.lakes);
    this.markers=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.65,.12),material(0xece4cc),110);this.scene.add(this.markers);
    this.roadside=new RoadsideScenery(this.scene);
    this.views=new Map();this.pools=new Map();this.player=vehicleModel(1,true);this.scene.add(this.player);this.playerRank=1;this.upgradeTime=0;
    this.playerMud=mudCoating(this.player);
    this.hazardMeshes={
      rim:new THREE.InstancedMesh(new THREE.RingGeometry(.72,1,12).rotateX(-Math.PI/2),material(0x797565),16),
      pit:new THREE.InstancedMesh(new THREE.CircleGeometry(.72,12).rotateX(-Math.PI/2),material(0x151c20),16),
      mud:new THREE.InstancedMesh(new THREE.CircleGeometry(1,14).rotateX(-Math.PI/2),material(0x735139),16),
      wet:new THREE.InstancedMesh(new THREE.CircleGeometry(1,12).rotateX(-Math.PI/2),material(0x493a28),16),
    };
    for(const mesh of Object.values(this.hazardMeshes)){mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;this.scene.add(mesh);}
    this.wallGroup=new THREE.Group();this.scene.add(this.wallGroup);
    for(let i=0;i<4;i++){
      const wall=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.1,.7),material(0xd8ccaa));base.position.y=.55;wall.add(base);
      for(let k=0;k<6;k++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.32,.72,.015),material(k%2?0xebbb55:0x293839));stripe.rotation.z=-.45;stripe.position.set(-1.45+k*.57,.65,.36);wall.add(stripe);}
      this.wallGroup.add(wall);
    }
    this.signs=[];
    const signMap=new THREE.CanvasTexture(this.signCanvas());
    for(let i=0;i<4;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:signMap}));sprite.scale.set(3.4,2.1,1);this.scene.add(sprite);this.signs.push(sprite);}
    this.effects=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material(0xf29f41),56);this.effects.frustumCulled=false;this.scene.add(this.effects);this.effects.count=0;
    this.effectRecords=[];
    const particleGeometry=new THREE.BufferGeometry();this.particlePositions=new Float32Array(100*3);
    this.particleRng=random(25677);
    for(let i=0;i<100;i++){this.particlePositions[i*3]=(this.particleRng()-.5)*65;this.particlePositions[i*3+1]=this.particleRng()*16;this.particlePositions[i*3+2]=15-this.particleRng()*90;}
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3));
    this.particles=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0xffffff,size:.12,transparent:true,opacity:.65,depthWrite:false}));this.particles.frustumCulled=false;this.scene.add(this.particles);
    this.colorA=new THREE.Color();this.colorB=new THREE.Color();this.lastScenery=-1;
    this.roadSamples=new Float64Array(109*9);this.dirty=true;this.cameraSettling=false;this.onInvalidate=()=>{};
    this.resize=()=>{const w=container.clientWidth,h=container.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.invalidate();};
    window.addEventListener('resize',this.resize);this.resize();
  }
  signCanvas(){const c=document.createElement('canvas');c.width=256;c.height=160;const x=c.getContext('2d');x.fillStyle='#f2d478';x.beginPath();x.roundRect(0,0,256,160,18);x.fill();x.fillStyle='#273b33';x.font='bold 31px system-ui';x.textAlign='center';x.fillText('前方并道',128,59);x.font='bold 59px system-ui';x.fillText('↙  ↘',128,130);return c;}
  strip(mat,bounds,y){
    const geometry=new THREE.BufferGeometry(),positions=new Float32Array(109*6),indices=[];
    for(let i=0;i<108;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(109*6),3));
    const normals=geometry.attributes.normal.array;for(let i=1;i<normals.length;i+=3)normals[i]=1;
    const mesh=new THREE.Mesh(geometry,mat);mesh.frustumCulled=false;mesh.receiveShadow=true;this.roadGroup.add(mesh);this.strips.push({mesh,bounds,y});
  }
  local(s,d=0){const p=this.road.at(s,d),dx=p.x-this.origin.x,dz=p.z-this.origin.z,h=this.origin.heading;return {x:Math.cos(h)*dx+Math.sin(h)*dz,y:p.y-this.origin.y,z:-Math.sin(h)*dx+Math.cos(h)*dz,heading:p.heading-h,pitch:p.pitch};}
  instance(mesh,index,x,y,z,sx,sy,sz,angle=0,pitch=0){temp.position.set(x,y,z);temp.rotation.set(pitch,-angle,0,'YXZ');temp.scale.set(sx,sy,sz);temp.updateMatrix();mesh.setMatrixAt(index,temp.matrix);}
  updateRoad(s){
    // 同一站点的中心、宽度、方向和法线只计算一次，所有条带共享。
    const samples=this.roadSamples;
    for(let i=0;i<109;i++){
      const station=s-80+i*5,p=this.local(station),n=i*9,sin=Math.sin(p.heading),cos=Math.cos(p.heading),pitchSin=Math.sin(p.pitch);
      samples[n]=p.x;samples[n+1]=p.y;samples[n+2]=p.z;samples[n+3]=this.road.edge(station);samples[n+4]=cos;samples[n+5]=sin;
      samples[n+6]=-sin*pitchSin;samples[n+7]=Math.cos(p.pitch);samples[n+8]=cos*pitchSin;
    }
    for(const strip of this.strips){
      const array=strip.mesh.geometry.attributes.position.array,normals=strip.mesh.geometry.attributes.normal.array;
      for(let i=0;i<109;i++){
        const sample=i*9,bounds=strip.bounds(samples[sample+3]);
        for(let j=0;j<2;j++){const d=bounds[j],n=i*6+j*3;array[n]=samples[sample]+samples[sample+4]*d;array[n+1]=samples[sample+1]+strip.y;array[n+2]=samples[sample+2]+samples[sample+5]*d;normals[n]=samples[sample+6];normals[n+1]=samples[sample+7];normals[n+2]=samples[sample+8];}
      }
      strip.mesh.geometry.attributes.position.needsUpdate=true;
      strip.mesh.geometry.attributes.normal.needsUpdate=true;
    }
    let index=0,pole=0;
    const first=Math.floor((s-80)/12)*12;
    for(let station=first;station<s+460;station+=12){
      for(const sign of [-1,1]){
        for(let lane=1;lane<3;lane++)if(lane<this.road.lanes(station)-.01){const p=this.local(station,sign*(.4+lane*3.6));this.instance(this.lines,index++,p.x,p.y+.025,p.z,1,1,1,p.heading,p.pitch);}
        const p=this.local(station,sign*(this.road.edge(station)+.7));this.instance(this.markers,pole++,p.x,p.y+.32,p.z,1,1,1,p.heading);
      }
    }
    this.lines.count=index;this.lines.instanceMatrix.needsUpdate=true;this.markers.count=pole;this.markers.instanceMatrix.needsUpdate=true;
    this.lines.computeBoundingSphere();this.markers.computeBoundingSphere();
    let wallIndex=0,signIndex=0;
    for(const closure of this.road.closures(s,470)){
      if(closure.kind==='wall')for(const sign of [-1,1]){
        const p=this.local(closure.end,sign*9.4),wall=this.wallGroup.children[wallIndex++];
        if(wall){wall.visible=true;wall.position.set(p.x,p.y,p.z);wall.rotation.set(p.pitch,-p.heading,0,'YXZ');}
      }
      for(const sign of [-1,1]){
        const p=this.local(closure.kind==='wall'?closure.end-240:closure.start-180,sign*(this.road.edge(closure.start)+2.8));
        const sprite=this.signs[signIndex++];if(sprite){sprite.visible=true;sprite.position.set(p.x,p.y+2.6,p.z);}
      }
    }
    this.wallGroup.children.forEach((w,i)=>{if(i>=wallIndex)w.visible=false;});this.signs.forEach((v,i)=>{if(i>=signIndex)v.visible=false;});
  }
  scenery(s){
    let tree=0,rock=0,lake=0;
    const first=Math.floor((s-80)/40);
    for(let block=first;block<=first+14;block++){
      const local=((block*40)%this.road.length+this.road.length)%this.road.length;
      const rng=random(this.road.seed^(local*137));
      const template=this.road.segment(Math.max(0,block*40)).scene;
      for(const sign of [-1,1]){
        for(let k=0;k<4;k++){
          const station=block*40+rng()*40,d=sign*(this.road.edge(station)+(k<2?5+rng()*3:48+rng()*24)),p=this.local(station,d),height=2.1+rng()*2.5;
          this.instance(this.trunks,tree,p.x,p.y+height*.36,p.z,1,height*.55/2,1);
          this.instance(this.trees,tree++,p.x,p.y+height,p.z,1.2+rng()*.8,height*.56,1.2+rng()*.8);
        }
        if(template===1&&lake<4&&rng()<.08){const station=block*40+20,p=this.local(station,sign*(this.road.edge(station)+65));if(Math.abs(p.pitch)<.025)this.instance(this.lakes,lake++,p.x,p.y-.018,p.z,9,1,17,p.heading);}
        if(template===2&&rock<50){const station=block*40+rng()*40,p=this.local(station,sign*(this.road.edge(station)+4+rng()*3));this.instance(this.rocks,rock++,p.x,p.y+.5,p.z,1.5,.7,1.3);}
      }
    }
    for(const [mesh,count]of [[this.trees,tree],[this.trunks,tree],[this.rocks,rock],[this.lakes,lake]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  }
  drawHazards(game){
    let pit=0,mud=0;
    for(const hazard of game.hazards.range(game.player.s-80,game.player.s+460)){
      const point=this.local(hazard.s,hazard.d),width=hazard.dimensions.width/2,length=hazard.dimensions.length/2;
      if(hazard.kind==='pothole'&&pit<16){
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
    const key=car.rank+':'+(car.appearance||'default')+':'+car.color,pool=this.pools.get(key)||[];let view=pool.pop();this.pools.set(key,pool);
    if(!view){
      view=new THREE.Group();view.add(vehicleModel(car.rank,false,car.appearance,car.color));
      const signal=new THREE.Group(),v=VEHICLES[car.rank];
      for(const sign of [-1,1]){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.15,.12,.18),material(0xffce4c));lamp.position.set(0,.5,sign*v.length*.35);signal.add(lamp);}
      view.add(signal);
    }
    this.scene.add(view);
    view.visible=true;view.rotation.set(0,0,0);view.scale.setScalar(1);view.children[1].visible=false;view.userData.poolKey=key;this.views.set(car.id,view);return view;
  }
  release(id){const view=this.views.get(id);if(!view)return;view.visible=false;this.scene.remove(view);this.views.delete(id);this.pools.get(view.userData.poolKey).push(view);}
  returnEffect(record){
    if(!record.view)return;
    record.view.visible=false;record.view.scale.setScalar(1);record.view.children[1].visible=false;
    this.scene.remove(record.view);
    this.pools.get(record.view.userData.poolKey).push(record.view);
    record.view=null;
  }
  resetEffects(){this.effectRecords.forEach(r=>this.returnEffect(r));this.effectRecords=[];this.effects.count=0;}
  resetRun(){
    this.resetEffects();
    for(const id of this.views.keys())this.release(id);
    this.traffic=null;this.cameraPitch=0;this.upgradeTime=0;this.roadside.reset();this.invalidate();
  }
  invalidate(){this.dirty=true;this.onInvalidate();}
  needsFrame(game){return this.dirty||this.lastState!==game.state||this.traffic!==game.traffic||this.cameraSettling;}
  effect(s,d,kind='eat',car=null){
    const view=car?this.views.get(car.id):null;
    if(view){this.views.delete(car.id);view.children[1].visible=false;}
    this.effectRecords.push({s,d,kind,time:0,view});
    if(this.effectRecords.length>8)this.returnEffect(this.effectRecords.shift());
  }
  draw(game,dt){
    if(this.traffic!==game.traffic){this.resetRun();this.traffic=game.traffic;}
    const live=game.state==='RUNNING',dying=game.state==='DYING',simDt=live?dt:0,effectDt=live||dying?dt:0;
    const refresh=live||dying||this.dirty||this.lastState!==game.state;
    this.lastState=game.state;this.dirty=false;
    if(!refresh){this.updateCamera(game,dt);this.renderer.render(this.scene,this.camera);return;}
    this.road=game.road;this.origin=this.road.at(game.player.s);
    this.updateRoad(game.player.s);this.scenery(game.player.s);this.drawHazards(game);
    const season=game.season(),a=palette[season.index],b=palette[(season.index+1)%4];
    this.roadside.draw(this,game.player.s,season,game.activeSeconds);
    const blend=(out,key)=>out.setHex(a[key]).lerp(this.colorB.setHex(b[key]),season.blend);
    blend(this.groundMaterial.color,'ground');blend(this.leafMaterial.color,'leaf');blend(this.waterMaterial.color,'water');blend(this.scene.background,'sky');this.scene.fog.color.copy(this.scene.background);
    if(this.playerRank!==game.player.rank){this.playerMud.dispose();this.scene.remove(this.player);this.player=vehicleModel(game.player.rank,true);this.playerMud=mudCoating(this.player);this.scene.add(this.player);this.playerRank=game.player.rank;this.upgradeTime=.25;}
    this.upgradeTime=Math.max(0,this.upgradeTime-simDt);
    const p=this.local(game.player.s,game.player.d),bump=Math.sin((1-game.player.bump/BUMP_SECONDS)*Math.PI);
    this.player.position.set(p.x,p.y+(game.player.bump>0?bump*.85:0),p.z);this.player.rotation.set(p.pitch+(game.player.bump>0?bump*.12:0),0,clamp(-game.input.lateral*.035-game.player.push*.018,-.12,.12),'YXZ');
    this.playerMud.visible=game.player.mud>0;
    const deathResult=game.state==='RESULT'&&game.result?.endReason==='death';
    this.player.visible=!deathResult&&(!dying||game.deathTime<1.1);this.player.scale.setScalar(dying?Math.max(.01,1-game.deathTime*.85):1-this.upgradeTime);
    for(const wheel of this.player.children)if(wheel.userData.wheelRadius)wheel.rotateY(-game.player.speed/3.6/wheel.userData.wheelRadius*simDt);
    if(dying){this.player.position.y=game.deathTime*.8;this.player.position.z-=game.deathTime*9;this.player.rotation.z=game.deathTime*2;}
    const ids=new Set();for(const car of game.traffic.cars)if(!car.remove)ids.add(car.id);
    for(const id of this.views.keys())if(!ids.has(id))this.release(id);
    for(const car of game.traffic.cars){
      if(car.remove)continue;
      const view=this.views.get(car.id)||this.acquire(car),point=this.local(car.s,car.d);
      view.position.set(point.x,point.y,point.z);view.rotation.set(point.pitch*car.direction,-point.heading+(car.direction<0?Math.PI:0),0,'YXZ');
      const signal=view.children[1];signal.visible=Boolean(car.merge)&&Math.floor(car.merge.time*6)%2===0;
      if(car.merge)signal.position.x=Math.sign(car.merge.lane-car.lane)*(VEHICLES[car.rank].width/2+.07);
      for(const wheel of view.children[0].children)if(wheel.userData.wheelRadius)wheel.rotateY(-car.speed/wheel.userData.wheelRadius*simDt);
    }
    this.particles.visible=true;
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
      record.time+=effectDt;const point=this.local(record.s,record.d),t=record.time;
      if(t>=.55){this.returnEffect(record);continue;}
      if(record.view){
        const ratio=t/.55,view=record.view;
        view.scale.setScalar(Math.max(.01,1-ratio));
        view.position.set(record.kind==='eat'?lerp(point.x,p.x,ratio):point.x,lerp(point.y,p.y,ratio)+.15+Math.sin(ratio*Math.PI)*.7,record.kind==='eat'?lerp(point.z,p.z,ratio):point.z-ratio*2);
        if(record.kind==='wreck')view.rotation.z=ratio*1.8;
      }
      for(let k=0;k<2;k++){const size=(.55-t)*.45;this.instance(this.effects,effect++,point.x+(k-.5)*t,point.y+.3+t,point.z,size,size,size);}
    }
    this.effectRecords=this.effectRecords.filter(r=>r.time<.55);this.effects.count=effect;this.effects.instanceMatrix.needsUpdate=true;
    this.updateCamera(game,dt);
    this.renderer.render(this.scene,this.camera);
  }
  updateCamera(game,dt){
    const shake=game.state==='DYING'?Math.max(0,.18-game.deathTime*.2)*Math.sin(game.deathTime*90):0;
    const target=this.road.at(game.player.s).pitch*.35;
    this.cameraPitch=lerp(this.cameraPitch||0,target,clamp(dt*3,0,1));
    this.cameraSettling=Math.abs(this.cameraPitch-target)>.0001;
    if(!this.cameraSettling)this.cameraPitch=target;
    const tilt=Math.sin(this.cameraPitch);
    this.camera.position.set(game.player.d*.13+shake,24-24*tilt,24+24*tilt);this.camera.lookAt(game.player.d*.13,16*tilt,-16);
  }
}
