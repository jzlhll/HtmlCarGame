import * as THREE from 'three';
import { POLICE, clamp, lerp } from './config.js';
import { vehicleModel, material } from './models.js';

// 警车使用小汽车底盘的白车身,车顶警灯红蓝交替闪烁;渔网用网格纹理面片渲染,
// 下落阶段悬在半空并在地面显示预警圈,落地后平铺路面,过期前一直能抓人。
function netTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.strokeStyle='rgba(248,246,238,.95)';ctx.lineWidth=7;
  for(let i=0;i<=4;i++){
    const p=i*32;
    ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,128);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(128,p);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);
  return texture;
}
export class PoliceView {
  constructor(scene){
    this.group=new THREE.Group();
    this.body=vehicleModel(3,false,0xf2f5f7);
    this.group.add(this.body);
    // 蓝色车身涂装条与车头涂装,让警车在一排车流中一眼可辨。
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.64,.2,3.1),material(0x1d4f9c));
    stripe.position.set(0,.5,.2);this.group.add(stripe);
    const hood=new THREE.Mesh(new THREE.BoxGeometry(1.2,.03,1),material(0x1d4f9c));
    hood.position.set(0,.665,-1.6);this.group.add(hood);
    const bar=new THREE.Group();bar.position.set(0,1.52,.2);
    bar.add(new THREE.Mesh(new THREE.BoxGeometry(.82,.09,.56),material(0x263238)));
    this.lamps=[];
    for(const [color,offset] of [[0xff2d2d,-.24],[0x2d6bff,.24]]){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.34,.16,.5),new THREE.MeshBasicMaterial({color,fog:false}));
      lamp.position.set(offset,.12,0);bar.add(lamp);this.lamps.push(lamp);
    }
    this.group.add(bar);
    this.group.visible=false;scene.add(this.group);
    // 渔网实例池:网面 + 落地前的地面预警圈。
    const texture=netTexture();
    this.netViews=[];
    for(let i=0;i<6;i++){
      const view=new THREE.Group();
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),
        new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
      view.add(mesh);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1,32).rotateX(-Math.PI/2),
        new THREE.MeshBasicMaterial({color:0xffa036,transparent:true,opacity:.75,fog:false}));
      ring.position.y=.06;view.add(ring);
      view.userData.mesh=mesh;view.userData.ring=ring;
      view.visible=false;scene.add(view);this.netViews.push(view);
    }
  }
  reset(){this.group.visible=false;for(const view of this.netViews)view.visible=false;}
  draw(renderer,game,dt){
    const police=game.police?.police;
    const visible=Boolean(police)&&['RUNNING','PAUSED','QUIZ','CAUGHT','DYING'].includes(game.state);
    this.group.visible=visible;
    if(!visible)for(const view of this.netViews)view.visible=false;
    if(visible){
      const p=renderer.local(police.s,police.d,police.route??null);
      this.group.position.set(p.x,p.y,p.z);
      this.group.rotation.set(p.pitch,-p.heading,0,'YXZ');
      // 红蓝警灯按 6Hz 交替闪烁,答题与暂停期间时间冻结,警灯同步定格。
      const phase=Math.floor(game.activeSeconds*6)%2;
      this.lamps[0].visible=phase===0;this.lamps[1].visible=phase===1;
      const spin=dt>0&&game.state==='RUNNING'?police.speed/3.6*dt:0;
      for(const wheel of this.body.children)if(wheel.userData.wheelRadius)wheel.rotateY(-spin/clamp(wheel.userData.wheelRadius,.1,1));
    }
    // 渔网:下落阶段从空中加速降落并显示地面预警圈,落地后平铺路面直到过期。
    const nets=game.police?.nets??[];
    for(let i=0;i<this.netViews.length;i++){
      const view=this.netViews[i],net=nets[i];
      if(!visible||!net){view.visible=false;continue;}
      const age=game.activeSeconds-net.born,ratio=clamp(age/net.fall,0,1);
      const point=renderer.local(net.s,net.d,net.route??null);
      // 落下阶段高度按平方缓动(加速下坠),从空中收到路面。
      const height=lerp(9,.12,ratio*ratio);
      view.visible=true;
      view.position.set(point.x,point.y+height,point.z);
      view.rotation.set(point.pitch,-point.heading,0,'YXZ');
      const mesh=view.userData.mesh,ring=view.userData.ring,landed=ratio>=1;
      mesh.scale.setScalar(net.size);
      ring.scale.setScalar(net.size);
      ring.visible=!landed;
      mesh.material.opacity=landed?.9:.85-ratio*.25;
    }
  }
}
