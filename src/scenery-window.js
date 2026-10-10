import * as THREE from 'three';
import { TREE_SCENERY, ROAD_RENDER, random, lerp } from './config.js';

// 每块只生成一次世界坐标布局，距离可见性与近远细节独立更新。
export class SceneryWindow {
  constructor(scene,meshes){
    this.group=new THREE.Group();scene.add(this.group);this.meshes=meshes;
    this.group.add(...Object.values(meshes));
    const geometry={trees:new THREE.IcosahedronGeometry(1.15,0).translate(0,.17,0),pines:new THREE.ConeGeometry(1,1.9,5).translate(0,.48,0),trunks:new THREE.CylinderGeometry(.085,.16,1,5).translate(0,.5,0)};
    for(const [name,shape]of Object.entries(geometry)){
      const original=meshes[name],mesh=new THREE.InstancedMesh(shape,original.material,original.instanceMatrix.count);
      if(original.material.vertexColors){const colors=new Float32Array(shape.attributes.position.count*3);colors.fill(1);shape.setAttribute('color',new THREE.BufferAttribute(colors,3));}
      mesh.receiveShadow=original.receiveShadow;mesh.count=0;this.group.add(mesh);meshes[name+'Low']=mesh;
    }
    this.layouts=new Map();this.matrix=new THREE.Matrix4();this.temp=new THREE.Object3D();this.bounds=new THREE.Box3();
    for(const mesh of Object.values(meshes))mesh.geometry.computeBoundingBox();
  }
  create(renderer,block){
    const road=renderer.road,size=ROAD_RENDER.sceneryBlock,station0=block*size,local=((station0%road.length)+road.length)%road.length;
    const rng=random(road.seed^(local*137)),template=road.segment(Math.max(0,station0)).scene;
    const layout={objects:[],sites:[]};
    const add=(name,s,d,height,scale,angle=0,site=null,object=null)=>{
      const p=road.at(s,d);this.temp.position.set(p.x,road.groundElevation(s)+height,p.z);this.temp.rotation.set(0,-angle,0);this.temp.scale.set(...scale);this.temp.updateMatrix();
      if(!object){object={parts:[],bounds:new THREE.Box3()};layout.objects.push(object);}
      object.parts.push({name,matrix:this.temp.matrix.clone(),site});
      for(const mesh of [this.meshes[name],this.meshes[name+'Low']])if(mesh){this.bounds.copy(mesh.geometry.boundingBox).applyMatrix4(this.temp.matrix);object.bounds.union(this.bounds);}
    };
    for(const sign of [-1,1]){
      for(let k=0;k<4;k++){
        const s=station0+rng()*size,d=sign*(road.edge(s)+(k<2?5+rng()*3:48+rng()*24)),height=lerp(TREE_SCENERY.minHeight,TREE_SCENERY.maxHeight,rng());
        if(road.onPavement(s,d,3))continue;
        const radius=lerp(TREE_SCENERY.minRadius,TREE_SCENERY.maxRadius,rng()),angle=rng()*Math.PI*2,pine=rng()<TREE_SCENERY.coniferChance;
        const object={parts:[],bounds:new THREE.Box3()};layout.objects.push(object);
        add('trunks',s,d,0,[renderer.level===2?.5:1,height*(renderer.level===2?.18:.60),renderer.level===2?.5:1],angle,null,object);
        if(renderer.level!==2)add(pine?'pines':'trees',s,d,height*(pine?.55:.72),[radius,height*(pine?.28:.23),radius*(.85+rng()*.3)],angle,null,object);
      }
      // 容量只在合并窗口时裁剪，不影响区块随机序列，避免原地装饰随窗口变化。
      if(template===1&&rng()<.08){
        const s=station0+size/2,d=sign*(road.edge(s)+65),p=road.at(s,d);
        if(Math.abs(p.pitch)<.025)add('lakes',s,d,-.018,[9,1,17],p.heading,renderer.level===2?{id:block*2+(sign>0?1:0),s,d,kind:'diplodocus'}:null);
      }
      if(template===2||renderer.level===2){
        const s=station0+rng()*size,d=sign*(road.edge(s)+4+rng()*3);
        if(!road.onPavement(s,d,3))add('rocks',s,d,.5,renderer.level===2?[2.7,1.5,2.1]:[1.5,.7,1.3]);
      }
      if(renderer.level===2&&block%2===0&&rng()<.4){
        const s=station0+size/2,d=sign*(road.edge(s)+23);
        if(!road.onPavement(s,d,10)&&!road.infrastructure(s).length)layout.sites.push({site:{id:block*2+(sign>0?1:0)+100000,s,d,kind:block%4===0?'triceratops':'stegosaurus'},point:road.at(s,d)});
      }
    }
    for(const object of layout.objects)object.sphere=object.bounds.getBoundingSphere(new THREE.Sphere());
    return layout;
  }
  draw(renderer,s){
    const first=Math.floor((s-80)/ROAD_RENDER.sceneryBlock),last=first+ROAD_RENDER.sceneryBlocks-1;
    if(this.road!==renderer.road||this.revision!==renderer.road.revision||this.level!==renderer.level){
      this.layouts.clear();this.first=null;this.road=renderer.road;this.revision=this.road.revision;this.level=renderer.level;
    }
    const quality=renderer.quality?.settings,qualityLevel=renderer.quality?.detailLevel??0;
    let changed=this.first!==first||this.qualityLevel!==qualityLevel;
    this.first=first;this.qualityLevel=qualityLevel;
    for(const block of this.layouts.keys())if(block<first||block>last)this.layouts.delete(block);
    const current=renderer.origin;
    // 每帧仅检查缓存对象的包围范围，不重新生成布局；树干与树冠共用显示和细节档位。
    for(let block=first;block<=last;block++){
      let layout=this.layouts.get(block);if(!layout){layout=this.create(renderer,block);this.layouts.set(block,layout);changed=true;}
      for(const object of layout.objects){
        const sphere=object.sphere,dx=sphere.center.x-current.x,dz=sphere.center.z-current.z,distanceSquared=dx*dx+dz*dz;
        const range=quality?quality.environmentFar+sphere.radius:Infinity,visible=distanceSquared<=range*range,lowDetail=Boolean(quality&&distanceSquared>quality.environmentDetail*quality.environmentDetail);
        if(object.visible!==visible||visible&&object.lowDetail!==lowDetail)changed=true;
        object.visible=visible;object.lowDetail=lowDetail;
      }
      for(const record of layout.sites){
        const dx=record.point.x-current.x,dz=record.point.z-current.z,visible=!quality||dx*dx+dz*dz<=quality.environmentFar*quality.environmentFar;
        if(record.visible!==visible){record.visible=visible;changed=true;}
      }
    }
    if(changed){
      this.origin=this.road.at(s);renderer.faunaSites=[];
      const counts=Object.fromEntries(Object.keys(this.meshes).map(name=>[name,0]));
      for(let block=first;block<=last;block++){
        const layout=this.layouts.get(block);
        for(const object of layout.objects)if(object.visible)for(const part of object.parts){
          const name=object.lowDetail&&this.meshes[part.name+'Low']?part.name+'Low':part.name;
          const mesh=this.meshes[name],index=counts[name];if(index>=mesh.instanceMatrix.count)continue;
          this.matrix.copy(part.matrix);this.matrix.elements[12]-=this.origin.x;this.matrix.elements[13]-=this.origin.y;this.matrix.elements[14]-=this.origin.z;
          mesh.setMatrixAt(index,this.matrix);counts[name]++;
          if(part.site)renderer.faunaSites.push(part.site);
        }
        for(const record of layout.sites)if(record.visible)renderer.faunaSites.push(record.site);
      }
      for(const [name,mesh]of Object.entries(this.meshes)){
        mesh.count=counts[name];mesh.visible=mesh.count>0;mesh.instanceMatrix.clearUpdateRanges();
        if(mesh.count){mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);mesh.instanceMatrix.needsUpdate=true;}mesh.computeBoundingSphere();
      }
    }
    const dx=this.origin.x-current.x,dz=this.origin.z-current.z,cos=Math.cos(current.heading),sin=Math.sin(current.heading);
    this.group.position.set(cos*dx+sin*dz,this.origin.y-current.y,-sin*dx+cos*dz);this.group.rotation.y=current.heading;
  }
}
