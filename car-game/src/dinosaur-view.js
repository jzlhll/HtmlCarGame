import * as THREE from 'three';
import { DINOSAURS, random, lerp } from './config.js';
import { dinosaurModel, animateDinosaur } from './dinosaur-models.js';

// 完整恐龙使用共享模型与实例批次，追行底圈仅跟随身体，不留下脚印。
export class DinosaurView {
  constructor(scene){
    this.bounds=new Map();this.models=new Map();this.pools=new Map();this.sources=[];this.seen=new Set();this.point={};this.layouts=new Map();this.groundGroup=new THREE.Group();scene.add(this.groundGroup);
    this.plants=new THREE.InstancedMesh(new THREE.ConeGeometry(.5,1,5),new THREE.MeshStandardMaterial({color:0x7c8951,roughness:1}),96);this.plants.frustumCulled=false;this.groundGroup.add(this.plants);this.plants.count=0;
    this.ripples=new THREE.InstancedMesh(new THREE.RingGeometry(.85,1,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xb8d4bd,transparent:true,opacity:.3,depthWrite:false}),12);this.ripples.frustumCulled=false;this.groundGroup.add(this.ripples);this.ripples.count=0;
    this.baseRing=new THREE.Mesh(new THREE.RingGeometry(.94,1,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe4d5aa,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}));
    scene.add(this.baseRing);this.baseRing.visible=false;
  }
  reset(){for(const item of this.models.values()){let pool=this.pools.get(item.kind);if(!pool){pool=[];this.pools.set(item.kind,pool);}pool.push(item.view);}this.models.clear();this.sources.length=0;this.seen.clear();this.layouts.clear();this.sites=null;for(const mesh of [this.baseRing,this.plants,this.ripples])mesh.visible=false;}
  updateScenery(renderer,game){
    const scenery=renderer.faunaSites,water=renderer.infrastructure.sites;
    if(this.road!==game.road||this.revision!==game.road.revision||this.seed!==game.seed){this.layouts.clear();this.sites=null;this.road=game.road;this.revision=game.road.revision;this.seed=game.seed;}
    if(this.sites===scenery&&this.waterSites===water)return;
    this.sites=scenery;this.waterSites=water;this.cacheOrigin=game.road.at(game.player.s);this.animals=[];this.waves=[];this.scenerySources=[];
    // 水域优先提交，河流与桥下水域沿稳定结构 ID 布置岸边梁龙。
    const sites=scenery.filter(site=>site.kind==='diplodocus');
    for(const site of water)if(site.feature==='river')sites.push({id:'water:'+site.id,s:site.flatStart-DINOSAURS.waterBankOffset,d:game.road.edge(site.flatStart)+DINOSAURS.waterRoadOffset,kind:'diplodocus',river:true,waterS:site.center});
    sites.push(...scenery.filter(site=>site.kind!=='diplodocus'));
    const ids=new Set();let plants=0;
    for(const site of sites){
      if(this.animals.length>=DINOSAURS.sceneryCapacity)break;
      ids.add(site.id);let layout=this.layouts.get(site.id);
      if(!layout){
        layout={animals:[],plants:[],waves:[],source:{...site,type:site.kind==='diplodocus'?'lake':'grazing',y:game.road.groundElevation(site.s)}};
        const siteSeed=typeof site.id==='number'?site.id:[...site.id].reduce((hash,char)=>Math.imul(hash,31)+char.charCodeAt(0),0);
        const rng=random(siteSeed*397^game.seed),kind=site.kind,count=kind==='diplodocus'?2+Math.floor(rng()*2):2;
        const world=(s,d)=>({...game.road.at(s,d),y:game.road.groundElevation(s)});
        for(let i=0;i<count;i++){
          const s=site.s+(site.river?0:(i-(count-1)/2)*(kind==='diplodocus'?12:8));
          let d=site.d+(kind==='diplodocus'?(site.river?(i-(count-1)/2)*14:Math.sign(site.d)*13):(rng()-.5)*8);
          // 湖泊或河流旁若邻近副路，向远离路面的岸线调整，不能把整群过滤掉。
          if(kind==='diplodocus')for(let shift=0;shift<8&&game.road.onPavement(s,d,18);shift++)d+=Math.sign(site.d)*8;
          if(game.road.onPavement(s,d,kind==='diplodocus'?18:10))continue;
          layout.animals.push({key:'site:'+site.id+':'+i,kind,s,d,angle:kind==='diplodocus'?(site.river?0:Math.sign(site.d)*Math.PI/2):rng()*Math.PI*2,phase:i*Math.PI,world:world(s,d)});
        }
        for(let i=0;i<6;i++){const p=world(site.s+(rng()-.5)*18,site.d+(rng()-.5)*8);layout.plants.push({...p,height:.4+rng()*.4});}
        if(kind==='diplodocus')for(let i=0;i<count;i++)layout.waves.push({...world(site.river?site.waterS:site.s+(i-(count-1)/2)*12,site.d+(site.river?(i-(count-1)/2)*14:Math.sign(site.d)*2)),phase:i});
        this.layouts.set(site.id,layout);
      }
      this.animals.push(...layout.animals);this.scenerySources.push(layout.source);this.waves.push(...layout.waves);
      for(const p of layout.plants)if(plants<this.plants.instanceMatrix.count)renderer.instance(this.plants,plants++,p.x-this.cacheOrigin.x,p.y-this.cacheOrigin.y+.2,p.z-this.cacheOrigin.z,.6,p.height,.6);
    }
    for(const id of this.layouts.keys())if(!ids.has(id))this.layouts.delete(id);
    this.plants.count=plants;this.plants.visible=plants>0;if(plants)this.plants.instanceMatrix.needsUpdate=true;
  }
  draw(renderer,game){
    this.sources.length=0;
    if(game.level!==2){if(this.models.size)this.reset();this.baseRing.visible=false;return;}
    const seen=this.seen,time=game.activeSeconds;seen.clear();let ripples=0;
    this.updateScenery(renderer,game);
    const add=(key,kind,s,d,route,angle=0,scale=1,ground=true,phase=0,hit=null,jump=null,world=null)=>{
      seen.add(key);
      const p=world?this.point:ground?renderer.localGround(s,d,this.point):renderer.local(s,d,route,this.point);
      if(world){const origin=renderer.origin,dx=world.x-origin.x,dz=world.z-origin.z,cos=Math.cos(origin.heading),sin=Math.sin(origin.heading);Object.assign(p,{x:cos*dx+sin*dz,y:world.y-origin.y,z:-sin*dx+cos*dz,heading:world.heading-origin.heading,pitch:world.pitch});}
      const progress=jump?Math.max(0,Math.min(1,(time-jump.startAt)/DINOSAURS.footWarning)):0,hop=Math.sin(progress*Math.PI);
      const radius=this.bounds.get(kind);
      if(radius&&!renderer.trafficView.visibleAt(p,radius*Math.max(1,scale)+DINOSAURS.jumpHeight))return p;
      let item=this.models.get(key);
      if(!item){
        const pool=this.pools.get(kind);item={kind,view:pool?.pop()??dinosaurModel(kind)};this.models.set(key,item);item.view.userData.animationTick=null;
        const bounds=item.view.userData.batchBounds;this.bounds.set(kind,(Math.hypot(...bounds.center)+bounds.radius)*(item.view.userData.dinoScale??1));
      }
      const view=item.view;
      view.position.set(p.x,p.y+hop*DINOSAURS.jumpHeight+(hit?.hit?Math.sin(Math.min(1,hit.hitTime/.8)*Math.PI)*.5:0),p.z);view.rotation.set(ground?0:p.pitch,-p.heading+angle,(jump?.side??0)*hop*DINOSAURS.jumpTilt,'YXZ');view.scale.setScalar((view.userData.dinoScale??1)*scale*(hit?.hit?Math.max(.01,1-hit.hitTime/.8):1));
      renderer.trafficView.add(view,()=>{
        const near=kind==='small'||kind==='chaser'||Math.hypot(p.x,p.z)<renderer.quality.settings.vehicleDetail,tick=Math.floor(time*renderer.quality.settings.animationHz);
        if(near||view.userData.animationTick!==tick){animateDinosaur(view,time,kind==='small'||kind==='chaser',phase,hop,jump?.side??0);view.userData.animationTick=tick;}
      });
      return p;
    };
    const origin=renderer.origin,dx=this.cacheOrigin.x-origin.x,dz=this.cacheOrigin.z-origin.z,cos=Math.cos(origin.heading),sin=Math.sin(origin.heading);
    this.groundGroup.position.set(cos*dx+sin*dz,this.cacheOrigin.y-origin.y,-sin*dx+cos*dz);this.groundGroup.rotation.y=origin.heading;
    for(const animal of this.animals)add(animal.key,animal.kind,animal.s,animal.d,null,animal.angle,1,true,animal.phase,null,null,animal.world);
    for(const p of this.waves){
      if(ripples>=this.ripples.instanceMatrix.count)break;
      const radius=.5+(time*.5+p.phase)%1.4;
      renderer.instance(this.ripples,ripples++,p.x-this.cacheOrigin.x,p.y-this.cacheOrigin.y+.045,p.z-this.cacheOrigin.z,radius,1,radius);
    }
    this.ripples.count=ripples;this.ripples.visible=ripples>0;if(ripples)this.ripples.instanceMatrix.needsUpdate=true;
    this.sources.push(...this.scenerySources);
    for(const animal of game.crossings.cows){
      add('small:'+animal.id,'small',animal.s,animal.d,animal.route,-animal.direction*Math.PI/2,1,false,animal.id,animal);
    }
    for(const group of game.infrastructure.trains){
      for(let i=0;i<DINOSAURS.bridgeCount;i++)add('bridge:'+group.id+':'+i,'small',group.s+(i%2-.5)*3,group.d-i*DINOSAURS.bridgeSpacing,null,-Math.PI/2,DINOSAURS.bridgeScale,true,i*.7);
      this.sources.push({id:'bridge:'+group.id,s:group.s,d:group.d,type:'bridge',y:game.road.groundElevation(group.s)});
    }
    const chaser=game.dinosaurs.chaser;
    this.baseRing.visible=Boolean(chaser);
    if(chaser){
      const sameRoute=(chaser.previousRoute??null)===(chaser.route??null),s=sameRoute?lerp(chaser.previousS,chaser.s,renderer.motionAlpha):chaser.s,d=game.dinosaurs.chaserD(chaser,s,sameRoute?lerp(chaser.previousD,chaser.d,renderer.motionAlpha):chaser.d);
      const fade=Math.max(0,Math.min(1,(chaser.until-time)/DINOSAURS.exitFadeSeconds));
      const p=add('chaser:'+chaser.id,'chaser',s,d,chaser.route,0,Math.max(.01,fade),false,chaser.phase,null,chaser.jump);
      this.baseRing.position.set(p.x,p.y+.045,p.z);this.baseRing.rotation.set(p.pitch,-p.heading,0,'YXZ');this.baseRing.scale.setScalar(DINOSAURS.baseRingRadius*Math.max(.01,fade));this.baseRing.material.opacity=.65*fade;
      if(!chaser.defeated)this.sources.push({id:'chaser:'+chaser.id,s,d,route:chaser.route,type:'bridge'});
    }
    for(const [key,item]of this.models)if(!seen.has(key)){let pool=this.pools.get(item.kind);if(!pool){pool=[];this.pools.set(item.kind,pool);}pool.push(item.view);this.models.delete(key);}
  }
}
