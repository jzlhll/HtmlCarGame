import * as THREE from 'three';
import { ROADWORKS } from './config.js';
import { material } from './models.js';

// 施工网格固定容量复用，锥桶和路面分块跟随弯道与坡度。
export class RoadworksView {
  constructor(scene){
    this.meshes={
      surface:new THREE.InstancedMesh(new THREE.BoxGeometry(1,.025,1),material(0x756d61),64),
      cone:new THREE.InstancedMesh(new THREE.ConeGeometry(.25,.65,8),material(0xf38b32),192),
      band:new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.17,.14,8),material(0xffeed6),192),
      foot:new THREE.InstancedMesh(new THREE.BoxGeometry(.52,.05,.52),material(0x293638),192),
    };
    for(const mesh of Object.values(this.meshes)){mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;scene.add(mesh);}
    this.barriers=[];
    const boxGeometry=new THREE.BoxGeometry(1,1,1);
    for(let index=0;index<8;index++){
      const group=new THREE.Group();
      const box=(color,size,x,y,z,angle=0)=>{
        const mesh=new THREE.Mesh(boxGeometry,material(color));mesh.scale.set(...size);mesh.position.set(x,y,z);mesh.rotation.z=angle;mesh.castShadow=true;group.add(mesh);
      };
      for(const side of [-1,1]){box(0x293638,[.16,1,.22],side*1.25,.5,0);box(0x293638,[.55,.12,.7],side*1.25,.06,0);}
      box(0xf4cf6c,[ROADWORKS.barrierWidth,.65,.3],0,.85,0);
      for(const face of [-1,1])for(let stripe=0;stripe<7;stripe++)box(0x343638,[.22,.55,.018],-1.4+stripe*.46,.85,face*.16,-.5);
      box(0x293638,[.12,1.5,.12],0,1.6,0);
      box(0xffeed6,[1.55,1.55,.18],0,2.25,0);
      for(const face of [-1,1])for(const angle of [-Math.PI/4,Math.PI/4])box(0xe64737,[.19,1.62,.025],0,2.25,face*.11,angle);
      for(const side of [-1,1])box(0xff9f32,[.25,.25,.25],side*1.4,1.3,0);
      group.visible=false;scene.add(group);this.barriers.push(group);
    }
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;
    const context=canvas.getContext('2d');context.fillStyle='#f4cf6c';context.beginPath();context.roundRect(0,0,256,192,16);context.fill();
    context.fillStyle='#df4434';context.font='bold 96px system-ui';context.textAlign='center';context.fillText('X',128,98);
    context.fillStyle='#293638';context.font='bold 32px system-ui';context.fillText('施工 · 绕行',128,158);
    const map=new THREE.CanvasTexture(canvas);this.signs=[];
    for(let index=0;index<4;index++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map}));sprite.scale.set(3.4,2.55,1);sprite.visible=false;scene.add(sprite);this.signs.push(sprite);}
  }
  draw(renderer,s){
    let surface=0,cone=0,barrier=0,sign=0;
    for(const site of renderer.road.roadworks(s-80-ROADWORKS.warningDistance,s+460+ROADWORKS.warningDistance)){
      if(renderer.whiteHorse.smashed.has('work:'+site.id))continue;
      for(const station of [site.start,site.end]){
        if(station<s-80||station>s+460)continue;
        const view=this.barriers[barrier++],point=renderer.local(station,site.d);
        if(view){view.visible=true;view.position.set(point.x,point.y,point.z);view.rotation.set(point.pitch,-point.heading,0,'YXZ');}
      }
      const warning=site.direction>0?site.start-ROADWORKS.warningDistance:site.end+ROADWORKS.warningDistance;
      if(warning>=s-80&&warning<=s+460){
        const point=renderer.local(warning,site.direction*(renderer.road.edge(warning)+2.3)),view=this.signs[sign++];
        if(view){view.visible=true;view.position.set(point.x,point.y+2.5,point.z);}
      }
      for(let station=site.start;station<site.end;station+=5){
        const length=Math.min(5,site.end-station),middle=station+length/2;
        if(middle<s-80||middle>s+460||surface>=64)continue;
        const point=renderer.local(middle,site.d);
        renderer.instance(this.meshes.surface,surface++,point.x,point.y+.035,point.z,3.1,1,length,point.heading,point.pitch);
      }
      const count=Math.ceil(site.length/8);
      for(let index=0;index<=count;index++)for(const side of [-1,1]){
        const station=site.start+site.length*index/count;
        if(station<s-80||station>s+460||cone>=192)continue;
        const point=renderer.local(station,site.d+side*1.45);
        renderer.instance(this.meshes.cone,cone,point.x,point.y+.35,point.z,1,1,1,point.heading,point.pitch);
        renderer.instance(this.meshes.band,cone,point.x,point.y+.4,point.z,1,1,1,point.heading,point.pitch);
        renderer.instance(this.meshes.foot,cone++,point.x,point.y+.04,point.z,1,1,1,point.heading,point.pitch);
      }
    }
    this.barriers.forEach((view,index)=>{if(index>=barrier)view.visible=false;});
    this.signs.forEach((view,index)=>{if(index>=sign)view.visible=false;});
    for(const [name,mesh]of Object.entries(this.meshes)){mesh.count=name==='surface'?surface:cone;mesh.visible=mesh.count>0;if(mesh.count)mesh.instanceMatrix.needsUpdate=true;}
  }
}
