import * as THREE from 'three';
import { DINOSAURS, random, lerp } from './config.js';
import { dinosaurModel, animateDinosaur } from './dinosaur-models.js';

const footShape=new THREE.Shape();
footShape.moveTo(-.32,-.5);footShape.lineTo(.32,-.5);footShape.lineTo(.48,-.1);footShape.lineTo(.5,.35);footShape.lineTo(.28,.22);footShape.lineTo(.18,.5);footShape.lineTo(0,.29);footShape.lineTo(-.18,.5);footShape.lineTo(-.28,.22);footShape.lineTo(-.5,.35);footShape.lineTo(-.48,-.1);footShape.closePath();
const footprint=new THREE.ShapeGeometry(footShape).rotateX(-Math.PI/2);

// 完整恐龙使用共享模型与实例批次，踩踏预兆和残留脚印使用有限实例。
export class DinosaurView {
  constructor(scene){
    this.models=new Map();this.pools=new Map();this.sources=[];this.seen=new Set();this.point={};
    this.plants=new THREE.InstancedMesh(new THREE.ConeGeometry(.5,1,5),new THREE.MeshStandardMaterial({color:0x7c8951,roughness:1}),96);this.plants.frustumCulled=false;scene.add(this.plants);this.plants.count=0;
    this.ripples=new THREE.InstancedMesh(new THREE.RingGeometry(.85,1,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xb8d4bd,transparent:true,opacity:.3,depthWrite:false}),12);this.ripples.frustumCulled=false;scene.add(this.ripples);this.ripples.count=0;
    this.prints=new THREE.InstancedMesh(footprint,new THREE.MeshBasicMaterial({color:0x65513b,transparent:true,opacity:.55,depthWrite:false}),DINOSAURS.footCapacity);
    this.warning=new THREE.InstancedMesh(footprint,new THREE.MeshBasicMaterial({color:0xe18c37,transparent:true,opacity:.65,depthWrite:false}),DINOSAURS.footCapacity);
    for(const mesh of [this.prints,this.warning]){mesh.frustumCulled=false;scene.add(mesh);mesh.visible=false;}
  }
  reset(){for(const item of this.models.values()){let pool=this.pools.get(item.kind);if(!pool){pool=[];this.pools.set(item.kind,pool);}pool.push(item.view);}this.models.clear();this.sources.length=0;this.seen.clear();for(const mesh of [this.prints,this.warning,this.plants,this.ripples])mesh.visible=false;}
  draw(renderer,game){
    this.sources.length=0;
    if(game.level!==2){if(this.models.size)this.reset();return;}
    const seen=this.seen,time=game.activeSeconds;seen.clear();let plants=0,ripples=0;
    const add=(key,kind,s,d,route,angle=0,scale=1,ground=true,phase=0,hit=null)=>{
      seen.add(key);let item=this.models.get(key);
      if(!item){const pool=this.pools.get(kind);item={kind,view:pool?.pop()??dinosaurModel(kind)};this.models.set(key,item);}
      const view=item.view,p=ground?renderer.localGround(s,d,this.point):renderer.local(s,d,route,this.point);
      view.position.set(p.x,p.y+(hit?.hit?Math.sin(Math.min(1,hit.hitTime/.8)*Math.PI)*.5:0),p.z);view.rotation.set(ground?0:p.pitch,-p.heading+angle,0,'YXZ');view.scale.setScalar((view.userData.dinoScale??1)*scale*(hit?.hit?Math.max(.01,1-hit.hitTime/.8):1));
      animateDinosaur(view,time,kind==='small'||kind==='chaser',phase);renderer.trafficView.add(view);
      return p;
    };
    for(const site of renderer.faunaSites??[]){
      if(seen.size>=DINOSAURS.sceneryCapacity)break;
      const rng=random(site.id*397^game.seed),kind=site.kind;
      const count=kind==='diplodocus'?2+Math.floor(rng()*2):2;
      for(let i=0;i<count;i++){
        const s=site.s+(i-(count-1)/2)*(kind==='diplodocus'?12:8),d=site.d+(kind==='diplodocus'?Math.sign(site.d)*13:(rng()-.5)*8);
        if(game.road.onPavement(s,d,kind==='diplodocus'?18:10))continue;
        const angle=kind==='diplodocus'?Math.sign(site.d)*Math.PI/2:rng()*Math.PI*2;
        add('site:'+site.id+':'+i,kind,s,d,null,angle,1,true,i*Math.PI);
      }
      for(let i=0;i<6&&plants<96;i++){const p=renderer.localGround(site.s+(rng()-.5)*18,site.d+(rng()-.5)*8,this.point);renderer.instance(this.plants,plants++,p.x,p.y+.2,p.z,.6,.4+rng()*.4,.6);}
      if(kind==='diplodocus')for(let i=0;i<count&&ripples<12;i++){const p=renderer.localGround(site.s+(i-(count-1)/2)*12,site.d+Math.sign(site.d)*2,this.point),radius=.5+(time*.5+i)%1.4;renderer.instance(this.ripples,ripples++,p.x,p.y+.045,p.z,radius,1,radius);}
      this.sources.push({...site,type:kind==='diplodocus'?'lake':'grazing',y:game.road.groundElevation(site.s)});
    }
    for(const [mesh,count]of [[this.plants,plants],[this.ripples,ripples]]){mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;}
    for(const animal of game.crossings.cows){
      add('small:'+animal.id,'small',animal.s,animal.d,animal.route,-animal.direction*Math.PI/2,1,false,animal.id,animal);
    }
    for(const group of game.infrastructure.trains){
      for(let i=0;i<DINOSAURS.bridgeCount;i++)add('bridge:'+group.id+':'+i,'small',group.s+(i%2-.5)*3,group.d-i*DINOSAURS.bridgeSpacing,null,-Math.PI/2,1.6,true,i*.7);
      this.sources.push({id:'bridge:'+group.id,s:group.s,d:group.d,type:'bridge',y:game.road.groundElevation(group.s)});
    }
    const chaser=game.dinosaurs.chaser;
    if(chaser){
      const s=(chaser.previousRoute??null)===(chaser.route??null)?lerp(chaser.previousS,chaser.s,renderer.motionAlpha):chaser.s,d=game.dinosaurs.chaserD(chaser,s);
      const fade=Math.min(1,(chaser.until-time)/DINOSAURS.exitFadeSeconds);
      add('chaser:'+chaser.id,'chaser',s,d,chaser.route,0,Math.max(.01,fade),false,chaser.phase);
      this.sources.push({id:'chaser:'+chaser.id,s,d,route:chaser.route,type:'bridge'});
    }
    for(const [key,item]of this.models)if(!seen.has(key)){let pool=this.pools.get(item.kind);if(!pool){pool=[];this.pools.set(item.kind,pool);}pool.push(item.view);this.models.delete(key);}
    const cfg=DINOSAURS;let prints=0,warnings=0;
    for(const foot of game.dinosaurs.feet){
      const p=renderer.local(foot.s,foot.d,foot.route,this.point),warning=time<foot.from;
      if(warning){const pulse=.75+.2*Math.sin(time*12);renderer.instance(this.warning,warnings++,p.x,p.y+.04,p.z,cfg.footWidth*pulse,1,cfg.footLength*pulse,p.heading,p.pitch);}
      else{
        const fade=Math.max(.05,1-(time-foot.until)/cfg.footFade);
        renderer.instance(this.prints,prints++,p.x,p.y+.03,p.z,cfg.footWidth*fade,1,cfg.footLength*fade,p.heading,p.pitch);
      }
    }
    for(const [mesh,count]of [[this.prints,prints],[this.warning,warnings]]){mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;}
  }
}
