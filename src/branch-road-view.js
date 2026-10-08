import * as THREE from 'three';
import { SECOND_LEVEL_SCENE } from './config.js';
import { material } from './models.js';

// 两条路线使用相同的路面与标线，不通过外观暴露主副路线。
export class BranchRoadView {
  constructor(parent){this.group=new THREE.Group();parent.add(this.group);this.views=[];}
  create(){
    const group=new THREE.Group(),strips=[],edgeColors=[0x8195a0,0x293e50,0xf4e9c4,0xe2c357];this.group.add(group);
    const add=(color,bounds,y)=>{
      // 长分叉可覆盖完整 540 米可视区间，需要容纳最多 109 个五米采样点。
      const geometry=new THREE.BufferGeometry(),positions=new Float32Array(110*6),indices=[];
      for(let i=0;i<109;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(110*4),2));geometry.setIndex(indices);
      const normals=new Float32Array(110*6);for(let i=1;i<normals.length;i+=3)normals[i]=1;
      geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
      const mesh=new THREE.Mesh(geometry,material(color));mesh.frustumCulled=false;mesh.receiveShadow=true;group.add(mesh);strips.push({mesh,bounds,y});
    };
    add(edgeColors[0],edge=>[-edge-1.2,edge+1.2],.005);
    add(edgeColors[1],edge=>[-edge,edge],.02);
    for(const sign of [-1,1]){
      add(edgeColors[2],edge=>[sign*(edge-.10)-.035,sign*(edge-.10)+.035],.03);
      add(edgeColors[3],()=>[sign*.15-.035,sign*.15+.035],.035);
    }
    const lines=new THREE.InstancedMesh(new THREE.BoxGeometry(.07,.012,4),material(0xd4ddd7),200);lines.frustumCulled=false;group.add(lines);
    const rails=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.3,19.8),material(0x93acb6),64);
    const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.16,.8,.16),material(0x506772),64);
    const markers=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.65,.12),material(0xece4cc),100);
    for(const mesh of [rails,posts,markers]){mesh.frustumCulled=false;group.add(mesh);}
    return {group,strips,lines,rails,posts,markers};
  }
  draw(renderer,s){
    let count=0;
    for(const fork of renderer.road.forksRange(s-80,s+460)){
      const view=this.views[count]??(this.views[count]=this.create());count++;view.group.visible=true;
      const first=Math.max(fork.start,s-80),last=Math.min(fork.end,s+460),points=[];
      for(let station=first;station<=last;station+=5){const center=renderer.road.branchCenter(station,fork.id);points.push({...renderer.local(station,center,fork.id),edge:renderer.road.edge(station,fork.id)});}
      if(last>first&&(last-first)%5)points.push({...renderer.local(last,renderer.road.branchCenter(last,fork.id),fork.id),edge:renderer.road.edge(last,fork.id)});
      view.strips[0].mesh.material=material(renderer.level===2?SECOND_LEVEL_SCENE.shoulder:0x8195a0);view.strips[1].mesh.material=renderer.level===2?renderer.dirtMaterial:material(0x293e50);
      for(const strip of view.strips){
        const positions=strip.mesh.geometry.attributes.position.array;
        for(let i=0;i<points.length;i++)for(let side=0;side<2;side++){
          const p=points[i],d=strip.bounds(p.edge)[side],n=i*6+side*3;strip.mesh.geometry.attributes.uv.array[i*4+side*2]=d*.15;strip.mesh.geometry.attributes.uv.array[i*4+side*2+1]=(first+i*5)*.15;
          positions[n]=p.x+Math.cos(p.heading)*d;positions[n+1]=p.y+strip.y;positions[n+2]=p.z+Math.sin(p.heading)*d;
        }
        strip.mesh.geometry.setDrawRange(0,Math.max(0,points.length-1)*6);strip.mesh.geometry.attributes.position.needsUpdate=true;strip.mesh.geometry.attributes.uv.needsUpdate=true;
      }
      let index=0;
      for(let station=Math.ceil(first/12)*12;station<=last;station+=12){
        const center=renderer.road.branchCenter(station,fork.id);
        if(Math.abs(center)<renderer.road.edge(station,fork.id)*1.8)continue;
        for(const sign of [-1,1])for(let lane=1;lane<3;lane++){
          if(lane>=Math.min(fork.lanes,renderer.road.lanes(station))-.01)continue;
          const p=renderer.local(station,center+sign*(.4+lane*3.6),fork.id);
          renderer.instance(view.lines,index++,p.x,p.y+.045,p.z,1,1,1,p.heading);
        }
      }
      view.lines.count=index;view.lines.instanceMatrix.needsUpdate=true;
      let rail=0,marker=0;
      for(let station=Math.ceil(first/20)*20;station<=last;station+=20)for(const sign of [-1,1]){
        if(sign===-fork.side&&renderer.road.junction(station,fork.side))continue;
        const p=renderer.local(station,renderer.road.branchCenter(station,fork.id)+sign*(renderer.road.edge(station,fork.id)+.85),fork.id);
        renderer.instance(view.rails,rail,p.x,p.y+.7,p.z,1,1,1,p.heading);
        renderer.instance(view.posts,rail++,p.x,p.y+.4,p.z,1,1,1,p.heading);
      }
      for(let station=Math.ceil(first/12)*12;station<=last;station+=12)for(const sign of [-1,1]){
        if(sign===-fork.side&&renderer.road.junction(station,fork.side))continue;
        const p=renderer.local(station,renderer.road.branchCenter(station,fork.id)+sign*(renderer.road.edge(station,fork.id)+.7),fork.id);
        renderer.instance(view.markers,marker++,p.x,p.y+.32,p.z,1,1,1,p.heading);
      }
      for(const [mesh,count]of [[view.rails,rail],[view.posts,rail],[view.markers,marker]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
    }
    for(let i=count;i<this.views.length;i++)this.views[i].group.visible=false;
  }
}
