import * as THREE from 'three';
import { material } from './models.js';
import { ROAD_RENDER } from './config.js';

const capacity=2048;

// 道路结构按区块缓存布局，动态部件独立更新；不同区块仍共用实例批次。
export class InfrastructureView {
  constructor(scene){
    this.group=new THREE.Group();scene.add(this.group);this.dynamicGroup=new THREE.Group();scene.add(this.dynamicGroup);
    this.batches=new Map();this.dynamicBatches=new Map();this.sites=[];this.layouts=new Map();this.matrix=new THREE.Matrix4();this.geometry=new THREE.BoxGeometry(1,1,1);this.temp=new THREE.Object3D();
  }
  box(renderer,s,d,size,height,color,angle=0,pitch=false,castShadow=true,dynamic=false){
    const key=color+':'+castShadow,batches=dynamic?this.dynamicBatches:this.batches;
    let batch=batches.get(key);
    if(!batch){const mesh=new THREE.InstancedMesh(this.geometry,material(color),capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=castShadow;mesh.receiveShadow=true;(dynamic?this.dynamicGroup:this.group).add(mesh);batch={mesh,count:0};batches.set(key,batch);}
    if(batch.count>=capacity&&(!this.layout||dynamic))return;
    const p=renderer.local(s,d),temp=this.temp;
    temp.position.set(p.x,p.y+height,p.z);temp.rotation.set(pitch?p.pitch:0,-p.heading+angle,0,'YXZ');temp.scale.set(...size);temp.updateMatrix();
    if(this.layout&&!dynamic)this.layout.parts.push({batch,matrix:temp.matrix.clone()});else batch.mesh.setMatrixAt(batch.count++,temp.matrix);
  }
  reset(){
    this.sites=[];this.layouts.clear();this.visibleKey=null;
    for(const batches of [this.batches,this.dynamicBatches])for(const batch of batches.values()){
      batch.count=0;batch.mesh.count=0;batch.mesh.visible=false;batch.mesh.instanceMatrix.clearUpdateRanges();
    }
  }
  updateBatches(batches){
    for(const {mesh,count}of batches.values()){
      mesh.count=count;mesh.visible=count>0;
      if(!count)continue;
      mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;
    }
  }
  rebuild(renderer,station){
    const road=renderer.road,size=ROAD_RENDER.infrastructureBlock,first=Math.floor((station-100)/size),last=Math.floor((station+460)/size);
    this.sites=road.infrastructure(station-100,station+460);
    if(this.road!==road||this.revision!==road.revision||this.level!==renderer.level){this.reset();this.road=road;this.revision=road.revision;this.level=renderer.level;this.sites=road.infrastructure(station-100,station+460);}
    const key=first+':'+last;if(this.visibleKey===key)return;this.visibleKey=key;
    for(const block of this.layouts.keys())if(block<first||block>last)this.layouts.delete(block);
    const origin=renderer.origin;
    try{
      for(let block=first;block<=last;block++)if(!this.layouts.has(block)){
        const layout={origin:{...road.at(block*size),heading:0},parts:[]};this.layout=layout;renderer.origin=layout.origin;
        this.buildChunk(renderer,block*size,(block+1)*size);this.layouts.set(block,layout);
      }
    }finally{renderer.origin=origin;this.layout=null;}
    this.cacheOrigin=road.at(station);
    for(const batch of this.batches.values())batch.count=0;
    for(const layout of this.layouts.values())for(const part of layout.parts){
      const batch=part.batch;if(batch.count>=capacity)continue;
      this.matrix.copy(part.matrix);this.matrix.elements[12]+=layout.origin.x-this.cacheOrigin.x;this.matrix.elements[13]+=layout.origin.y-this.cacheOrigin.y;this.matrix.elements[14]+=layout.origin.z-this.cacheOrigin.z;
      batch.mesh.setMatrixAt(batch.count++,this.matrix);
    }
    this.updateBatches(this.batches);
  }
  buildChunk(renderer,first,last){
    const road=renderer.road;
    // 分叉的连接处留出护栏缺口，玩家可从主路驶入另一条道路。
    for(let s=Math.ceil(first/20)*20;s<last;s+=20){
      if(road.infrastructure(s).length)continue;
      const edge=road.edge(s);
      for(const side of [-1,1]){
        if(road.junction(s,side))continue;
        this.box(renderer,s,side*(edge+.85),[.13,.3,19.8],.7,0x93acb6,0,true,false);
        this.box(renderer,s,side*(edge+.85),[.16,.8,.16],.4,0x506772,0,false,false);
      }
      if(s>0&&s%240===0&&!road.fork(s)){
        for(const side of [-1,1])this.box(renderer,s,side*(edge+1.5),[.35,8,.35],4,0x4a7688);
        this.box(renderer,s,0,[edge*2+3,.4,.45],8,0x4a7688);
        this.box(renderer,s,3.8,[6,2,.2],7,0x247e8a);
        for(let lane=0;lane<road.available(s);lane++){
          this.box(renderer,s+.14,.4+(lane+.5)*3.6,[.1,1,.05],7,0xe3e9d4);
          this.box(renderer,s+.14,.4+(lane+.5)*3.6,[.45,.1,.05],6.6,0xe3e9d4);
        }
      }
    }
    for(const site of road.infrastructure(first,last)){
      const from=Math.max(site.start+5,first),to=Math.min(site.end,last);
      for(let s=site.start+5+Math.ceil((from-site.start-5)/10)*10;s<to;s+=10){
        const elevation=road.elevation(s).y,edge=road.edge(s);
        if(site.kind==='viaduct'){
          this.box(renderer,s,0,[edge*2+2.8,.7,10.2],-.4,0x7d8b95,0,true);
          for(const side of [-1,1]){
            this.box(renderer,s,side*(edge+1),[.25,.65,10.2],.55,0xc3d5d9,0,true,false);
            this.box(renderer,s,side*(edge+1),[.2,.13,10.2],1,0x39a6b2,0,true,false);
          }
          if(elevation>3&&Math.floor((s-site.start)/10)%3===0&&Math.abs(s-site.center)>12){
            for(const side of [-1,1])this.box(renderer,s,side*(edge-2),[1.7,elevation-.7,2],-elevation/2-.35,0x9ea7a2);
            this.box(renderer,s,0,[edge*2,.8,2.5],-1.1,0x637681);
          }
        }else for(const side of [-1,1]){
          const height=Math.max(.3,-elevation+.5);
          this.box(renderer,s,side*(edge+1.4),[.7,height,10.2],height/2-.2,0x788d9a);
          this.box(renderer,s,side*(edge+1.4),[.9,.22,10.2],height-.2,0xe8b75d);
        }
      }
      if(site.center<first||site.center>=last)continue;
      const base=site.kind==='viaduct'?-site.height:0;
      if(site.feature==='river'){
        this.box(renderer,site.center,0,[240,.08,site.flat],base+.06,0x248d9e);
        for(const end of [-1,1])this.box(renderer,site.center+end*(site.flat/2+1),0,[240,.45,1.8],base-.12,0xa5b3a4);
      }else if(site.feature==='rail'&&site.kind==='viaduct'&&renderer.level!==2){
        this.box(renderer,site.center,0,[230,.15,4.2],base-.06,0x454c59);
        for(const end of [-1,1])this.box(renderer,site.center+end*1.1,0,[230,.12,.14],base+.12,0xc1c9ce);
        for(let d=-110;d<=110;d+=3)this.box(renderer,site.center,d,[.5,.18,3.4],base+.03,0x887661);
      }
    }
  }
  draw(renderer,game){
    if(this.cacheOrigin){
      const origin=renderer.origin,dx=this.cacheOrigin.x-origin.x,dz=this.cacheOrigin.z-origin.z,cos=Math.cos(origin.heading),sin=Math.sin(origin.heading);
      this.group.position.set(cos*dx+sin*dz,this.cacheOrigin.y-origin.y,-sin*dx+cos*dz);this.group.rotation.y=origin.heading;
    }
    for(const batch of this.dynamicBatches.values())batch.count=0;
    const now=game.activeSeconds;
    for(const site of this.sites){
      const base=site.kind==='viaduct'?-site.height:0;
      if(site.feature==='river'){
        for(let i=0;i<12;i++)this.box(renderer,site.center+(i%3-1)*site.flat*.26,((i*19+now*2)%220)-110,[9,.025,.15],base+.115,0x79d7d7,0,false,true,true);
      }
    }
    if(game.level!==2)for(const train of game.infrastructure.trains){
      const site=train.site,base=site.kind==='viaduct'?-site.height:0;
      for(let car=0;car<6;car++){
        const d=train.d+(car-2.5)*7,color=car===5?0xeeb653:car%2?0x2d6579:0xdb6c53;
        this.box(renderer,train.s,d,[6.6,2.5,2.7],base+1.65,color,0,false,true,true);
        this.box(renderer,train.s,d,[6.9,.25,2.9],base+3,0xd4dbd5,0,false,true,true);
        for(const side of [-1,1]){
          this.box(renderer,train.s+side*1.38,d,[5.4,.8,.08],base+2.1,0x233d50,0,false,true,true);
          for(const offset of [-2.2,2.2])this.box(renderer,train.s+side*1.2,d+offset,[.65,.65,.28],base+.42,0x1b2c38,0,false,true,true);
        }
        if(car===5)this.box(renderer,train.s,d+3.32,[.15,.5,2.1],base+1.2,0xffedb6,0,false,true,true);
      }
    }
    this.updateBatches(this.dynamicBatches);
  }
}
