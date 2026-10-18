import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AIRCRAFT, AIRCRAFT_PREVIEW, worldHorizontalSpeed } from './config.js';

function silhouette(points) {
  const shape=new THREE.Shape();
  points.forEach(([x,z],index)=>index?shape.lineTo(x,z):shape.moveTo(x,z));
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(Math.PI/2);
}

function pathLine(material) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(24),3).setUsage(THREE.DynamicDrawUsage));
  const line=new THREE.LineSegments(geometry,material);line.frustumCulled=false;
  return line;
}

// 姿态卡片的相对交通示意：开局建立全部图形和航迹缓冲，飞行中只改变既有数据。
export class PreviewTraffic extends THREE.Group {
  constructor(route) {
    super();this.route=route;this.entries=new Map();this.point=new THREE.Vector3();this.end=new THREE.Vector3();this.direction=new THREE.Vector3();this.side=new THREE.Vector3();this.up=new THREE.Vector3(0,1,0);
    const settings=AIRCRAFT_PREVIEW.traffic;
    const plane=silhouette([[0,-6],[.8,-2],[5,1],[5,1.8],[.8,.4],[.7,4],[2.2,5],[2.2,5.7],[-2.2,5.7],[-2.2,5],[-.7,4],[-.8,.4],[-5,1.8],[-5,1],[-.8,-2]]);
    const bird=silhouette([[-1.6,1],[0,-1],[1.6,1],[0,-.3]]);
    const birds=[[0,0],[-3,3],[3,3],[-6,6],[6,6]].map(([x,z])=>bird.clone().translate(x,0,z));
    const flock=mergeGeometries(birds);bird.dispose();birds.forEach(part=>part.dispose());
    route.encounters.forEach((spec,id)=>{
      const color=spec.kind==='geese'?settings.geeseColor:settings.aircraftColor;
      const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
      const lineMaterial=new THREE.LineBasicMaterial({color});
      const model=new THREE.Mesh(spec.kind==='geese'?flock:plane,material);model.scale.setScalar(settings.symbolScale);
      const path=pathLine(lineMaterial),entry={model,path,material,lineMaterial,color,danger:false};
      model.visible=path.visible=false;this.entries.set(id,entry);this.add(model,path);
    });
    this.ownPath=pathLine(new THREE.LineBasicMaterial({color:settings.ownColor}));this.add(this.ownPath);
    this.visible=false;
  }

  writePath(line,start,end,drop=false) {
    const positions=line.geometry.attributes.position;
    this.direction.subVectors(end,start).normalize();this.side.crossVectors(this.direction,this.up);
    if (this.side.lengthSq()<1e-6) this.side.set(1,0,0);else this.side.normalize();
    const size=AIRCRAFT_PREVIEW.traffic.arrowSize;
    const set=(index,point)=>positions.setXYZ(index,point.x,point.y,point.z);
    set(0,start);set(1,end);set(2,end);set(4,end);
    for (const [index,sign] of [[3,1],[5,-1]]) positions.setXYZ(index,end.x-this.direction.x*size+this.side.x*size*.5*sign,end.y-this.direction.y*size,end.z-this.direction.z*size+this.side.z*size*.5*sign);
    set(6,start);positions.setXYZ(7,start.x,drop?AIRCRAFT_PREVIEW.gridHeight:start.y,start.z);
    positions.needsUpdate=true;
  }

  update(game,pose,models,referenceHeading) {
    const settings=AIRCRAFT_PREVIEW.traffic,scale=settings.radius/game.route.radarRange;
    const cosine=Math.cos(referenceHeading),sine=Math.sin(referenceHeading);
    for (const entry of this.entries.values()) entry.model.visible=entry.path.visible=false;
    let count=0;
    if (game.aircraft.systems.avionics && game.weather.radarAvailable) for (const contact of game.mission.contacts) {
      const entry=this.entries.get(contact.id),world=models.get(contact.id);
      if (!entry || !world || contact.hit) continue;
      const dx=world.position.x-pose.position.x,dz=world.position.z-pose.position.z;
      const dy=world.position.y+(contact.kind==='aircraft'?AIRCRAFT.bodyHeight*game.route.trafficScale:0)-pose.position.y-AIRCRAFT.bodyHeight;
      if (Math.hypot(dx,dy,dz)>game.route.radarRange) continue;
      const point=this.point.set((dx*cosine+dz*sine)*scale,dy*scale+AIRCRAFT.bodyHeight*settings.ownScale,(-dx*sine+dz*cosine)*scale);
      entry.model.position.copy(point);entry.model.rotation.y=referenceHeading-contact.heading;
      if (entry.danger!==contact.danger) {
        entry.danger=contact.danger;
        entry.material.color.setHex(contact.danger?settings.dangerColor:entry.color);
        entry.lineMaterial.color.setHex(contact.danger?settings.dangerColor:entry.color);
      }
      const vx=contact.velocity.x-worldHorizontalSpeed(game.aircraft.velocity.x),vy=contact.velocity.y-game.aircraft.velocity.y,vz=contact.velocity.z-worldHorizontalSpeed(game.aircraft.velocity.z);
      const end=this.end.set((vx*cosine+vz*sine)*scale,vy*scale,(-vx*sine+vz*cosine)*scale).multiplyScalar(game.route.radarHorizon);
      const length=end.length();if(length>settings.maximumPath)end.multiplyScalar(settings.maximumPath/length);
      else if(length>1e-6&&length<settings.minimumPath)end.multiplyScalar(settings.minimumPath/length);
      end.add(point);this.writePath(entry.path,point,end,true);
      entry.model.visible=entry.path.visible=true;count++;
    }
    this.visible=count>0;
    if (this.visible) {
      const velocity=game.aircraft.velocity;
      this.point.set(0,AIRCRAFT.bodyHeight*settings.ownScale,0);
      this.end.set(worldHorizontalSpeed(velocity.x*cosine+velocity.z*sine),velocity.y,worldHorizontalSpeed(-velocity.x*sine+velocity.z*cosine));
      if(this.end.lengthSq()>1e-6)this.end.setLength(settings.radius);else this.end.set(0,0,-settings.radius);
      this.end.add(this.point);this.writePath(this.ownPath,this.point,this.end);
    }
    return this.visible;
  }
}
