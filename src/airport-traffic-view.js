import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AIRPORT_TRAFFIC } from './config.js';
import { createAirportTraffic } from './airport-traffic.js';

// 停机模型共享玩家几何，卡车仅一份顶点色几何；撞击时只改已有矩阵。
export class AirportTrafficView extends THREE.Group {
  constructor(route, aircraft) {
    super();
    const actors=createAirportTraffic(route), planes=actors.filter(actor=>actor.kind==='aircraft');
    this.planeMeshes=[];this.trucks=[];
    const materials=new Map(),pose=new THREE.Object3D(),matrix=new THREE.Matrix4();
    aircraft.updateMatrixWorld(true);
    aircraft.traverse(source=>{
      if(!source.isMesh||source.parent===aircraft.userData.navigationLights)return;
      let material=materials.get(source.material);
      if(!material){material=source.material.clone();materials.set(source.material,material);}
      const mesh=new THREE.InstancedMesh(source.geometry,material,planes.length);
      for(const [i,actor] of planes.entries()){
        pose.position.set(actor.position.x,actor.position.y,actor.position.z);pose.rotation.y=-actor.heading;pose.updateMatrix();
        mesh.setMatrixAt(i,matrix.multiplyMatrices(pose.matrix,source.matrixWorld));
      }
      mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;this.add(mesh);this.planeMeshes.push(mesh);
    });
    this.updateMatrixWorld(true);
    for(const mesh of this.planeMeshes){mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;}
    const parts=[],size=AIRPORT_TRAFFIC.truckSize,color=new THREE.Color();
    const part=(geometry,hex,x,y,z)=>{
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.dispose();
      g.translate(x,y-size.height/2,z);g.deleteAttribute('uv');color.setHex(hex);
      const colors=new Float32Array(g.attributes.position.count*3);
      for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
      g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);
    };
    const block=(w,h,l,hex,x,y,z)=>part(new THREE.BoxGeometry(w,h,l),hex,x,y,z);
    block(size.width*.85,1,size.length,0x363d40,0,1.2,0);
    block(size.width,2.8,3.2,0xe2ad46,0,2.45,-3.2);
    block(size.width*.94,2.7,5.8,0xc8c6af,0,2.5,1.4);
    block(size.width*.83,1.05,.08,0x254750,0,3,-4.84);
    for(const side of [-1,1]){
      block(.08,1.05,1.5,0x254750,side*size.width*.505,3,-3.4);
      block(.35,.35,.1,0xffedbb,side*1.35,1.7,-4.86);
      block(.22,.28,.1,0xaf3628,side*1.35,1.4,4.35);
      for(const z of [-3,3])part(new THREE.CylinderGeometry(.8,.8,.5,12).rotateZ(Math.PI/2),0x242a2c,side*size.width*.48,.8,z);
      for(const z of [-3,3])part(new THREE.CylinderGeometry(.36,.36,.52,10).rotateZ(Math.PI/2),0x899396,side*size.width*.48,.8,z);
    }
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.15});
    for(const actor of actors.filter(actor=>actor.kind==='truck')){
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.position.set(actor.position.x,actor.position.y+size.height/2,actor.position.z);mesh.rotation.y=-actor.heading;
      mesh.userData.actorId=actor.id;this.trucks.push(mesh);this.add(mesh);
    }
  }

  update(game) {
    const settings=AIRPORT_TRAFFIC, launch=settings.truckLaunch, size=settings.truckSize;
    let moved=false;
    for(const mesh of this.trucks){
      const actor=game.mission.airportTraffic.find(item=>item.id===mesh.userData.actorId);
      const t=actor.hit?Math.max(0,game.mission.elapsed-actor.hitAt):0;
      // 约三秒后侧翻落地，滚转后的包络仍落在地面，不悬空或继续穿地。
      const duration=2*launch.up/launch.gravity, time=Math.min(t,duration), roll=time*launch.rollRate*actor.side;
      const bottom=Math.abs(Math.cos(roll))*size.height/2+Math.abs(Math.sin(roll))*size.width/2;
      const x=actor.position.x+actor.launch.x*time,y=actor.position.y+Math.max(bottom,size.height/2+launch.up*time-.5*launch.gravity*time*time),z=actor.position.z+actor.launch.z*time;
      if(mesh.position.x!==x||mesh.position.y!==y||mesh.position.z!==z||this.runId!==game.runId)moved=true;
      mesh.position.set(x,y,z);mesh.rotation.set(0,-actor.heading+time*launch.yawRate,roll,'YXZ');
    }
    this.runId=game.runId;return moved;
  }
}
