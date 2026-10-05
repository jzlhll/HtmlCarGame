import * as THREE from 'three';
import { VEHICLES, random, clamp } from './config.js';
import { DistanceFog } from './distance-fog.js';

const transform=new THREE.Object3D(),point=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),previousPoint=new THREE.Vector3(),nextPoint=new THREE.Vector3();

// 固定容量复用天气粒子与落点，所有动画取有效游戏时间，暂停时保持原画面。
export class WeatherView {
  constructor(scene,camera){
    this.scene=scene;this.camera=camera;scene.add(camera);this.impacts=[];this.frozenCars=[];this.distanceFog=new DistanceFog(scene,camera);
    const rng=random(0x673ab891);
    this.seeds=Array.from({length:700},()=>({x:rng(),y:rng(),z:rng(),phase:rng()*Math.PI*2}));
    this.rain=this.lines(560,0xa9e8ff,.65);this.wind=this.lines(160,0xffedba,.45);
    const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(700*3),3));
    const snowflake=document.createElement('canvas');snowflake.width=32;snowflake.height=32;
    const context=snowflake.getContext('2d');context.strokeStyle='#ffffff';context.lineWidth=3;context.lineCap='round';
    for(let i=0;i<3;i++){
      const angle=i*Math.PI/3,x=Math.cos(angle)*11,y=Math.sin(angle)*11;
      context.beginPath();context.moveTo(16-x,16-y);context.lineTo(16+x,16+y);context.stroke();
    }
    this.snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:0xffffff,map:new THREE.CanvasTexture(snowflake),size:.07,transparent:true,opacity:.9,depthWrite:false,fog:false}));
    camera.add(this.snow);this.snow.frustumCulled=false;this.snow.visible=false;
    this.warning=this.mesh(new THREE.RingGeometry(.75,1,24).rotateX(-Math.PI/2),0xffd25c,12,.85);
    this.ice=this.mesh(new THREE.CircleGeometry(1,12).rotateX(-Math.PI/2),0x99eaff,12,.65);
    this.bolts=this.mesh(new THREE.CylinderGeometry(1,1,1,5),0x70cbff,128,.85);
    this.cores=this.mesh(new THREE.CylinderGeometry(1,1,1,5),0xf4ffff,128,1);
    this.frozen=this.mesh(new THREE.IcosahedronGeometry(1,0),0xa7ecff,90,.35);
    this.sparks=this.mesh(new THREE.TetrahedronGeometry(1),0xbff5ff,96,.9);
    this.flash=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xd9f5ff,transparent:true,opacity:0,depthTest:false,depthWrite:false,fog:false}));
    this.flash.position.z=-.7;this.flash.renderOrder=20;camera.add(this.flash);
  }
  lines(count,color,opacity){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*6),3));
    const view=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,fog:false}));
    view.frustumCulled=false;view.visible=false;this.camera.add(view);return view;
  }
  mesh(geometry,color,count,opacity){
    const view=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,fog:false,side:THREE.DoubleSide}),count);
    view.count=0;view.frustumCulled=false;this.scene.add(view);return view;
  }
  reset(){this.impacts=[];}
  hit(s,d,kind,time,route=null){this.impacts.push({s,d,kind,time,route});if(this.impacts.length>4)this.impacts.shift();}
  precipitation(view,count,now,kind,direction=0){
    const positions=view.geometry.attributes.position.array,tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    for(let i=0;i<count;i++){
      const seed=this.seeds[i],depth=2+seed.z*48,height=depth*tan,width=height*this.camera.aspect;
      let x=(seed.x*2-1)*width,y;
      if(kind==='wind'){
        x=(((seed.x+now*direction*.28)%1+1)%1*2-1)*width;y=(seed.y*2-1)*height;
      }else{
        const fall=kind==='rain'?1.3:.16;
        y=(1-((seed.y+now*fall)%1)*2)*height;
        if(kind==='snow')x+=Math.sin(now*1.8+seed.phase)*height*.05;
      }
      const index=i*(kind==='snow'?3:6);
      positions[index]=x;positions[index+1]=y;positions[index+2]=-depth;
      if(kind!=='snow'){
        positions[index+3]=x+(kind==='wind'?direction*height*.19:height*.009);
        positions[index+4]=y+(kind==='rain'?height*.11:Math.sin(seed.phase+now)*height*.015);positions[index+5]=-depth;
      }
    }
    view.geometry.attributes.position.needsUpdate=true;
  }
  segment(mesh,index,from,to,radius){
    transform.position.copy(from).add(to).multiplyScalar(.5);
    point.copy(to).sub(from);const length=point.length();transform.quaternion.setFromUnitVectors(up,point.normalize());
    transform.scale.set(radius,length,radius);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);
  }
  draw(renderer,game){
    const now=game.activeSeconds,event=game.weather.event,active=event&&now<event.until&&['RUNNING','PAUSED','DYING'].includes(game.state);
    const season=active?event.season:-1;
    this.rain.visible=season===1;this.snow.visible=season===3;this.wind.visible=season===2;
    if(this.rain.visible)this.precipitation(this.rain,560,now,'rain');
    if(this.snow.visible)this.precipitation(this.snow,700,now,'snow');
    if(this.wind.visible)this.precipitation(this.wind,160,now,'wind',event.wind);
    this.scene.fog.near=240;this.scene.fog.far=560;
    if(season===0){
      this.scene.fog.color.setHex(0xdde9e5);this.scene.background.copy(this.scene.fog.color);
    }else if(season===1){
      this.scene.background.multiplyScalar(.72);this.scene.fog.color.copy(this.scene.background);
    }
    let warnings=0,ice=0,bolts=0;
    if(active)for(const hazard of game.weather.hazards){
      if(now>=hazard.until)continue;
      const p=renderer.local(hazard.s,hazard.d,hazard.route),waiting=now<hazard.from,pulse=1+Math.sin(now*14)*.08;
      if(hazard.kind==='ice'){
        renderer.instance(this.ice,ice++,p.x,p.y+.035,p.z,1.35,1,1.35,p.heading,p.pitch);
        if(waiting)renderer.instance(this.warning,warnings++,p.x,p.y+.05,p.z,1.5,1,1.5,p.heading,p.pitch);
      }else{
        renderer.instance(this.warning,warnings++,p.x,p.y+.04,p.z,1.4*pulse,1,1.4*pulse,p.heading,p.pitch);
        if(waiting)continue;
        const phase=Math.floor((now-hazard.from)*24),previous=previousPoint.set(p.x,p.y+.1,p.z);
        for(let i=1;i<=7;i++){
          const next=nextPoint.set(p.x+(i===7?0:Math.sin(i*17+hazard.id*3+phase)*1.2),p.y+i*3.5,p.z+Math.cos(i*13+phase)*.7);
          this.segment(this.bolts,bolts,previous,next,.13);this.segment(this.cores,bolts++,previous,next,.045);previous.copy(next);
        }
      }
    }
    let frozen=0;
    const frozenCars=this.frozenCars;frozenCars.length=0;
    if(['RUNNING','PAUSED','DYING'].includes(game.state)){
      if(game.player.frozenUntil>now)frozenCars.push(game.player);
      for(const car of game.traffic.cars)if(car.frozenUntil>now&&!car.remove)frozenCars.push(car);
    }
    if(frozenCars.length>this.frozen.instanceMatrix.count){
      // 车流容量随时间增长，冰冻外观按实际需求扩容并继续复用，避免超出实例缓冲区。
      const previous=this.frozen,capacity=Math.max(previous.instanceMatrix.count*2,frozenCars.length);
      this.frozen=this.mesh(previous.geometry,0xa7ecff,capacity,.35);
      this.scene.remove(previous);previous.dispose();previous.material.dispose();
    }
    for(const car of frozenCars){
      const p=renderer.local(car.s,car.d,car.route),size=VEHICLES[car.rank];
      renderer.instance(this.frozen,frozen++,p.x,p.y+.65,p.z,size.width*.85,1.35,size.length*.75,p.heading,p.pitch);
    }
    let sparks=0,flash=0;
    this.impacts=this.impacts.filter(impact=>now-impact.time<.65);
    for(const impact of this.impacts){
      const age=Math.max(0,now-impact.time),p=renderer.local(impact.s,impact.d,impact.route);
      if(impact.kind==='lightning')flash=Math.max(flash,clamp(1-age/.15,0,1)*.36);
      for(let i=0;i<20;i++){
        const angle=i*2.39996,radius=age*(3+i%5),size=(.65-age)*.16;
        renderer.instance(this.sparks,sparks++,p.x+Math.cos(angle)*radius,p.y+.5+age*(2+i%4),p.z+Math.sin(angle)*radius,size,size*3,size,angle);
      }
    }
    this.flash.material.opacity=flash;
    const height=2*.7*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));this.flash.scale.set(height*this.camera.aspect,height,1);
    for(const [mesh,count]of [[this.warning,warnings],[this.ice,ice],[this.bolts,bolts],[this.cores,bolts],[this.frozen,frozen],[this.sparks,sparks]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
    this.distanceFog.draw(renderer,game,season===0);
  }
}
