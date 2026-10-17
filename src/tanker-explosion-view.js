import * as THREE from 'three';
import { TANKER, clamp } from './config.js';

// 无敌引爆时使用独立视觉时钟，致命引爆跟随死亡动画；播完才弹救援题。
export class TankerExplosionView {
  constructor(scene){
    this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);this.record=null;this.pose=new THREE.Object3D();this.color=new THREE.Color();
    const basic=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false});
    this.scorch=new THREE.Mesh(new THREE.CircleGeometry(1,64).rotateX(-Math.PI/2),basic(0x201b18,.42));this.scorch.position.y=.035;this.group.add(this.scorch);
    const glow=basic(0xffb331,.75);glow.blending=THREE.AdditiveBlending;
    this.core=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),glow);this.group.add(this.core);
    this.fire=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),basic(0xffffff),18);this.fire.frustumCulled=false;this.fire.setColorAt(0,new THREE.Color(0xffb124));this.group.add(this.fire);
    this.smoke=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),basic(0xffffff,.65),20);this.smoke.frustumCulled=false;this.smoke.setColorAt(0,new THREE.Color(0x4b4540));this.group.add(this.smoke);
    const ring=basic(0xffd78a,.85);ring.blending=THREE.AdditiveBlending;ring.side=THREE.DoubleSide;
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.94,1,96).rotateX(-Math.PI/2),ring);this.ring.position.y=.16;this.group.add(this.ring);
    this.sparksData=new Float32Array(64*3);const sparksGeometry=new THREE.BufferGeometry();sparksGeometry.setAttribute('position',new THREE.BufferAttribute(this.sparksData,3));
    this.sparks=new THREE.Points(sparksGeometry,new THREE.PointsMaterial({color:0xffcf75,size:.20,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.sparks.frustumCulled=false;this.group.add(this.sparks);
  }
  start(car){this.record={s:car.s,d:car.d,route:car.route??null,time:0};this.group.visible=true;}
  reset(){this.record=null;this.group.visible=false;}
  animating(game){return Boolean(this.record&&this.record.time<TANKER.explosionSeconds&&game.state!=='PAUSED'&&game.state!=='PREPARING'&&(game.state!=='DYING'||!document.hidden&&document.hasFocus()));}
  warm(){this.group.visible=true;this.fire.count=1;this.smoke.count=1;}
  finishWarm(){this.group.visible=Boolean(this.record);}
  put(mesh,index,x,y,z,size,squash=1){
    const pose=this.pose;pose.position.set(x,y,z);pose.scale.set(size,size*squash,size);pose.rotation.set(index*.73,index*1.31,index*.47);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);
  }
  draw(renderer,game,dt){
    const record=this.record;if(!record)return;
    if(game.state==='DYING'&&game.cause==='tanker')record.time=Math.min(TANKER.explosionSeconds,game.deathTime);
    else if(this.animating(game))record.time=Math.min(TANKER.explosionSeconds,record.time+dt);
    const t=record.time,radius=TANKER.blastRadius,progress=t/TANKER.explosionSeconds,p=renderer.local(record.s,record.d,record.route);
    this.group.visible=true;this.group.position.set(p.x,p.y,p.z);this.group.rotation.set(p.pitch,-p.heading,0,'YXZ');
    this.scorch.scale.setScalar(radius);this.scorch.material.opacity=.35*clamp(t/.22,0,1);
    const flame=clamp(t/TANKER.fireSeconds,0,1),flare=Math.sin(flame*Math.PI)**.45;
    this.core.visible=t<TANKER.fireSeconds;this.core.position.y=1.5+flame*4;this.core.scale.setScalar(.6+flare*6);this.core.material.opacity=(1-flame)*.88;
    this.fire.visible=t<TANKER.fireSeconds;this.fire.count=this.fire.visible?18:0;
    for(let i=0;i<this.fire.count;i++){
      const angle=i*2.399963,reach=(.25+flame*.75)*(2+i%4),height=1.2+flame*(4+i%5),size=(.8+(i%3)*.5)*flare;
      this.put(this.fire,i,Math.cos(angle)*reach,height,Math.sin(angle)*reach,size,1.2);this.color.setHSL(.065+(i%4)*.012,1,.40+(1-flame)*.25);this.fire.setColorAt(i,this.color);
    }
    const smokeAge=clamp((t-.12)/(TANKER.explosionSeconds-.12),0,1);this.smoke.visible=t>.12&&progress<1;this.smoke.count=this.smoke.visible?20:0;this.smoke.material.opacity=Math.sin(smokeAge*Math.PI)**.6*.78;
    for(let i=0;i<this.smoke.count;i++){
      const angle=i*2.399963,reach=smokeAge*(3+i%5),size=(1+(i%4)*.5)*(.3+smokeAge*1.7);
      this.put(this.smoke,i,Math.cos(angle)*reach+smokeAge*2,2+smokeAge*(5+i%6),Math.sin(angle)*reach,size,1.15);this.color.setScalar(.12+(i%4)*.035);this.smoke.setColorAt(i,this.color);
    }
    const shock=clamp(t/.72,0,1);this.ring.visible=t<1.05;this.ring.scale.setScalar(radius*(1-(1-shock)**3));this.ring.material.opacity=(1-clamp(t/1.05,0,1))*.9;
    this.sparks.visible=t<1.15;this.sparks.material.opacity=1-clamp(t/1.15,0,1);
    for(let i=0;i<64;i++){
      const angle=i*2.399963,reach=t*(7+i%10);this.sparksData[i*3]=Math.cos(angle)*reach;this.sparksData[i*3+1]=Math.max(.1,1+t*(5+i%8)-t*t*5);this.sparksData[i*3+2]=Math.sin(angle)*reach;
    }
    this.sparks.geometry.attributes.position.needsUpdate=true;
    for(const mesh of [this.fire,this.smoke])if(mesh.count){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}
  }
}
