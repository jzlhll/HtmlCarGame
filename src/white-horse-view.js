import * as THREE from 'three';
import { WHITE_HORSE, VEHICLES, clamp } from './config.js';
import { horseModel } from './models.js';

// 白马奔跑、保护罩和撞飞碎片共用有限模型，动画按有效时间推进。
export class WhiteHorseView {
  constructor(scene){
    this.horse=horseModel();this.horse.visible=false;scene.add(this.horse);
    this.legs=this.horse.children.filter(part=>part.userData.horsePhase!==undefined);
    this.tail=this.horse.children.find(part=>part.userData.horseTail);
    this.shield=new THREE.Group();this.shield.visible=false;scene.add(this.shield);
    const sphere=new THREE.SphereGeometry(1,24,12);
    this.shell=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:0x78e4ff,transparent:true,opacity:.14,depthWrite:false,fog:false,side:THREE.DoubleSide}));
    this.shield.add(this.shell);
    const grid=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshBasicMaterial({color:0xcefbff,transparent:true,opacity:.3,wireframe:true,depthWrite:false,fog:false}));this.shield.add(grid);
    this.ring=new THREE.Mesh(new THREE.TorusGeometry(1,.016,6,48),new THREE.MeshBasicMaterial({color:0xc5ffff,transparent:true,opacity:.8,depthWrite:false,fog:false}));this.ring.rotation.x=Math.PI/2;this.shield.add(this.ring);
    this.debris=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff,fog:false}),48);
    this.debris.count=0;this.debris.frustumCulled=false;scene.add(this.debris);
    this.impacts=[];this.color=new THREE.Color();
  }
  reset(){this.horse.visible=false;this.shield.visible=false;this.impacts=[];this.debris.count=0;}
  hit(s,d,kind,time,direction=1,route=null){this.impacts.push({s,d,kind,time,direction,route});if(this.impacts.length>8)this.impacts.shift();}
  draw(renderer,game){
    const now=game.activeSeconds,event=game.whiteHorse,horse=event.horse,visible=['RUNNING','PAUSED','DYING'].includes(game.state);
    this.horse.visible=Boolean(visible&&horse&&now<horse.until&&(now-horse.from<WHITE_HORSE.visibleSeconds||Math.floor((now-horse.from-WHITE_HORSE.visibleSeconds)*8)%2===0));
    if(this.horse.visible){
      const p=renderer.local(horse.s,horse.d,horse.route),phase=(now-horse.from)*14;
      this.horse.position.set(p.x,p.y+Math.sin(phase*2)*.07,p.z);this.horse.rotation.set(p.pitch,-p.heading,0,'YXZ');
      for(const leg of this.legs){
        const stride=phase+leg.userData.horsePhase;leg.rotation.x=Math.sin(stride)*.7;
        leg.children.find(part=>part.userData.horseKnee).rotation.x=.15+Math.max(0,Math.sin(stride+.8))*.85;
      }
      this.tail.rotation.x=.35;this.tail.rotation.z=Math.sin(phase*.45)*.18;
    }
    const buff=event.buff,shielded=event.shielded(now),blink=shielded&&now>=buff.shieldUntil-WHITE_HORSE.shieldBlinkSeconds;
    this.shield.visible=Boolean(visible&&shielded&&(!blink||Math.floor((now-buff.shieldUntil+WHITE_HORSE.shieldBlinkSeconds)*8)%2===0));
    if(this.shield.visible){
      const p=renderer.local(game.player.s,game.player.d,game.player.route),size=VEHICLES[game.player.rank];
      this.shield.position.set(p.x,p.y+1,p.z);this.shield.rotation.set(p.pitch,-p.heading-game.player.yaw,0,'YXZ');
      this.shield.scale.set(size.width*.65+.4,1.55,size.length*.58+.6);
      this.shell.material.opacity=.14+Math.sin(now*11)*.025;this.ring.rotation.z=now*2;
    }
    const effectTime=now+(game.state==='DYING'?game.deathTime:0);
    this.impacts=visible?this.impacts.filter(impact=>effectTime-impact.time<.9):[];
    let count=0;
    for(const impact of this.impacts){
      const age=Math.max(0,effectTime-impact.time),p=renderer.local(impact.s,impact.d,impact.route),size=clamp(1-age/.9,0,1)*.22;
      this.color.setHex(impact.kind==='wall'||impact.kind==='roadwork'?0xf1cd78:0xa8f6ff);
      for(let i=0;i<6;i++){
        const angle=i*2.39996,radius=age*(3+i*.7);
        renderer.instance(this.debris,count,p.x+impact.direction*age*5+Math.cos(angle)*radius,p.y+.4+Math.sin(age/.9*Math.PI)*(1+i*.3),p.z-age*5+Math.sin(angle)*radius,size,size*(1+i%2),size,angle+age*6);
        this.debris.setColorAt(count++,this.color);
      }
    }
    this.debris.count=count;this.debris.visible=count>0;
    if(count){this.debris.instanceMatrix.needsUpdate=true;this.debris.instanceColor.needsUpdate=true;}
  }
}
