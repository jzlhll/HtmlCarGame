import * as THREE from 'three';
import { random } from './config.js';

const seasons=[
  {field:0x967449,crop:0x83aa43,roof:0x625e58},
  {field:0x8b6a3e,crop:0xb6bd49,roof:0x625e58},
  {field:0xa68045,crop:0xdbb955,roof:0x766454},
  {field:0xdbe7e6,crop:0xddd5b6,roof:0xecf3f4},
];
const SITE_CHANCE=.18,INSTANCE_CAPACITY=1024;

// 路边小镇、农场和牧场按种子布局，重复部件按材质实例化。
export class RoadsideScenery {
  constructor(scene){
    this.scene=scene;this.batches=new Map();this.materials=new Map();
    this.group=new THREE.Group();scene.add(this.group);this.layouts=new Map();this.animated=[];
    this.geometry={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,10),cone:new THREE.ConeGeometry(1,1,10),roof:new THREE.CylinderGeometry(1,1,1,3,1,false,Math.PI)};
    this.root=new THREE.Matrix4();this.part=new THREE.Object3D();this.matrix=new THREE.Matrix4();this.anchor=new THREE.Object3D();this.color=new THREE.Color();
    for(const key of ['field','crop','roof'])this.materials.set(key,new THREE.MeshStandardMaterial({color:seasons[0][key],roughness:.95}));
  }
  begin(s,d,angle=0,pitch=false){
    const p=this.renderer.road.at(s,d),origin=this.layoutOrigin;
    this.anchor.position.set(p.x-origin.x,this.renderer.road.groundElevation(s)-origin.y,p.z-origin.z);this.anchor.rotation.set(pitch?p.pitch:0,-p.heading+angle,0,'YXZ');this.anchor.scale.setScalar(1);this.anchor.updateMatrix();this.root.copy(this.anchor.matrix);
  }
  add(color,size,position,shape='box',rotation=[0,0,0],animation=null){
    const key=shape+':'+color+':'+Boolean(animation);
    let batch=this.batches.get(key);
    if(!batch){
      let mat=this.materials.get(color);
      if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:.87});this.materials.set(color,mat);}
      const mesh=new THREE.InstancedMesh(this.geometry[shape],mat,INSTANCE_CAPACITY);mesh.instanceMatrix.setUsage(animation?THREE.DynamicDrawUsage:THREE.StaticDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.count=0;
      this.group.add(mesh);batch={mesh,count:0,dynamic:Boolean(animation)};this.batches.set(key,batch);
    }
    this.part.position.set(...position);this.part.rotation.set(...rotation);this.part.scale.set(...size);this.part.updateMatrix();
    this.matrix.multiplyMatrices(this.root,this.part.matrix);
    this.layout.parts.push({batch,matrix:this.matrix.clone(),motion:animation?{...animation,root:this.root.clone(),part:this.part.clone()}:null});
  }
  building(s,d,floors,width,depth,color,barn=false){
    this.begin(s,d);
    const height=floors*2.6;
    this.add(0x9a978b,[width+.3,2,depth+.3],[0,-.7,0]);
    this.add(color,[width,height,depth],[0,height/2,0]);
    if(barn){
      // 三角棱柱平躺，形成真正的双坡屋顶。
      this.add('roof',[width*.64,depth+1,width*.42],[0,height+.8,0],'roof',[Math.PI/2,0,0]);
      this.add(0xf3e7cf,[width*.39,2.8,.12],[0,1.4,-depth/2-.07]);
      for(const sign of [-1,1])this.add(0x9d4134,[width*.17,2.5,.16],[sign*width*.10,1.3,-depth/2-.16]);
      for(const sign of [-1,1])this.add(0xf6e8d2,[.12,3.1,.15],[sign*width*.17,1.6,-depth/2-.19]);
    }else{
      this.add('roof',[width+.6,.45,depth+.6],[0,height+.23,0]);
      this.add(0xe2d6bb,[width*.48,.8,depth*.45],[0,height+.75,0]);
      this.add(0x665a4c,[1.1,2.3,.12],[0,1.15,-depth/2-.07]);
      for(let floor=0;floor<floors;floor++)for(const side of [-1,1]){
        for(let k=0;k<3;k++){
          this.add(0xc1dfdb,[.85,1,.1],[(k-1)*width*.28,1.6+floor*2.6,side*(depth/2+.06)]);
          this.add(0xe8d8b7,[1,.12,.24],[(k-1)*width*.28,1.02+floor*2.6,side*(depth/2+.13)]);
        }
        for(let k=0;k<2;k++)this.add(0xc1dfdb,[.1,1,.85],[side*(width/2+.06),1.6+floor*2.6,(k-.5)*depth*.45]);
      }
    }
  }
  cow(s,d,angle,scale,time,seed){
    this.begin(s,d,angle);this.anchor.scale.setScalar(scale);this.anchor.updateMatrix();this.root.copy(this.anchor.matrix);
    this.add(0xf5f1df,[1.1,1.15,2.1],[0,1.35,0]);
    this.add(0xf5f1df,[.8,.85,.85],[0,1.68,-1.25]);
    this.add(0xd7a4a1,[.84,.42,.4],[0,1.4,-1.78]);
    for(const side of [-1,1]){
      this.add(0x292e2c,[.04,.58,.65],[side*.57,1.44,.35]);
      this.add(0x292e2c,[.04,.45,.55],[side*.57,1.24,-.46]);
      this.add(0xf5f1df,[.36,.18,.4],[side*.51,1.98,-1.22], 'box',[0,0,side*.35]);
      this.add(0xddd0a8,[.10,.35,.10],[side*.28,2.16,-1.18],'cone');
      this.add(0x292e2c,[.04,.10,.10],[side*.42,1.81,-1.48]);
      for(const end of [-1,1]){
        this.add(0xf5f1df,[.24,.85,.25],[side*.35,.47,end*.73],'box',[0,0,0],{frequency:.9,phase:seed+side*end,amplitude:.05});
        this.add(0x292e2c,[.29,.16,.32],[side*.35,.08,end*.73]);
      }
    }
    this.add(0xd7a4a1,[.5,.23,.5],[0,.74,.27]);
    this.add(0xf5f1df,[.10,.8,.10],[0,1.04,1.14],'box',[0,0,0],{frequency:.7,phase:seed,amplitude:.18});
    this.add(0x292e2c,[.16,.23,.16],[0,.62,1.15]);
  }
  fence(s,d,width,depth){
    for(let i=0;i<=Math.floor(depth/4);i++)for(const side of [-1,1]){
      this.begin(s-depth/2+i*4,d+side*width/2);this.add(0xd3b587,[.2,1.4,.2],[0,.7,0]);
      if(i<Math.floor(depth/4))for(const height of [.5,1.05])this.add(0xe2c8a0,[.13,.12,4.15],[0,height,-2]);
    }
    for(const end of [-1,1])for(let x=-width/2;x<width/2;x+=4){
      this.begin(s+end*depth/2,d+x+2);for(const height of [.5,1.05])this.add(0xe2c8a0,[4.1,.12,.13],[0,height,0]);
    }
  }
  field(s,d,width,depth,rng){
    this.begin(s,d,0,true);this.add('field',[width,.07,depth],[0,.045,0]);
    for(let row=0;row<4;row++){
      this.add(0x6d563a,[.26,.1,depth*.92],[(row-1.5)*width/5,.11,0]);
      for(let k=0;k<5;k++){
        const height=.55+rng()*.35,x=(row-1.5)*width/5,z=(k-2)*depth/6;
        this.add('crop',[.2,height,.2],[x,height/2+.12,z]);
        this.add('crop',[.6,.16,.35],[x,height*.7,z],'box',[0,0,.28]);
      }
    }
  }
  createLayout(block,plots,spacing){
    const station=(block+.5)*spacing,local=block%plots;
    const layout={origin:this.renderer.road.at(station),parts:[]};
    if(this.renderer.road.forksRange(station-65,station+65).length)return layout;
    this.layout=layout;this.layoutOrigin=layout.origin;
    const rng=random(this.renderer.road.seed^(local*197));
    if(rng()>=SITE_CHANCE){this.layout=null;return layout;}
    const theme=(local+this.renderer.road.seed%3)%3;
    const side=rng()<.5?-1:1;
    const d=side*(this.renderer.road.edge(station)+18);
    if(theme===0){
      const colors=[0xd7bd94,0xc38d6d,0x8da5a6,0xd9d0ad];
      this.building(station-24,d,2+Math.floor(rng()*3),5+rng()*2,7,colors[Math.floor(rng()*4)]);
      this.building(station+6,d+side*10,4+Math.floor(rng()*3),7,9,colors[Math.floor(rng()*4)]);
    }else if(theme===1){
      this.building(station-22,d,2,7,10,0xb95740,true);
      this.begin(station-20,d+side*9);this.add(0xc4c7bc,[2.3,7,2.3],[0,3.5,0],'cylinder');this.add('roof',[2.6,2,2.6],[0,8,0],'cone');
      this.field(station+16,d+side*8,15,23,rng);
      for(let i=0;i<2;i++)this.cow(station+14+i*7,d-side*4,rng()*Math.PI*2,1.05+rng()*.25,0,i+local);
    }else{
      this.fence(station,d,20,40);
      for(let i=0;i<3;i++)this.cow(station-14+rng()*28,d+(rng()-.5)*14,rng()*Math.PI*2,.9+rng()*.4,0,i+local);
      for(let i=0;i<2;i++){this.begin(station-24,d+side*(7+i*2));this.add(0xd8b967,[1.2,1.2,1.2],[0,.7,0],'cylinder',[0,0,Math.PI/2]);}
      this.building(station+28,d+side*11,1,5,6,0xccb18b,true);
    }
    this.layout=null;return layout;
  }
  reset(){
    this.layouts.clear();this.animated=[];this.visibleKey=null;this.road=null;
    for(const batch of this.batches.values()){batch.count=0;batch.mesh.count=0;batch.mesh.visible=false;}
  }
  rebuild(blocks,s){
    this.cacheOrigin=this.renderer.road.at(s);this.animated=[];
    for(const batch of this.batches.values())batch.count=0;
    for(const block of blocks){
      const layout=this.layouts.get(block),offset=new THREE.Vector3(layout.origin.x-this.cacheOrigin.x,layout.origin.y-this.cacheOrigin.y,layout.origin.z-this.cacheOrigin.z);
      for(const item of layout.parts){
        const batch=item.batch;if(batch.count>=INSTANCE_CAPACITY)continue;
        const index=batch.count++;
        if(item.motion)this.animated.push({batch,index,motion:item.motion,offset});
        else{this.matrix.copy(item.matrix);this.matrix.elements[12]+=offset.x;this.matrix.elements[13]+=offset.y;this.matrix.elements[14]+=offset.z;batch.mesh.setMatrixAt(index,this.matrix);}
      }
    }
    for(const {mesh,count,dynamic}of this.batches.values()){mesh.visible=count>0;mesh.count=count;if(count&&!dynamic)mesh.instanceMatrix.needsUpdate=true;}
  }
  draw(renderer,s,season,time){
    this.renderer=renderer;this.group.visible=renderer.level!==2;if(renderer.level===2)return;
    if(this.road!==renderer.road){this.reset();this.road=renderer.road;}
    if(this.seasonIndex!==season.index||this.seasonBlend!==season.blend){
      for(const key of ['field','crop','roof'])this.materials.get(key).color.setHex(seasons[season.index][key]).lerp(this.color.setHex(seasons[(season.index+1)%4][key]),season.blend);
      this.seasonIndex=season.index;this.seasonBlend=season.blend;
    }
    const plots=Math.round(renderer.road.length/90),spacing=renderer.road.length/plots,first=Math.floor((s-90)/spacing),blocks=[];
    for(let block=Math.max(0,first);block<=first+7;block++)if((block+.5)*spacing<=s+420){
      blocks.push(block);if(!this.layouts.has(block))this.layouts.set(block,this.createLayout(block,plots,spacing));
    }
    const nearby=new Set(blocks);
    for(const block of this.layouts.keys())if(!nearby.has(block))this.layouts.delete(block);
    const key=blocks.join(',');if(this.visibleKey!==key){this.visibleKey=key;this.rebuild(blocks,s);}
    // 静态实例只在区块进出时改写，当前玩家参考系由一个父节点转换。
    const origin=renderer.origin,cos=Math.cos(origin.heading),sin=Math.sin(origin.heading),dx=this.cacheOrigin.x-origin.x,dz=this.cacheOrigin.z-origin.z;
    this.group.position.set(cos*dx+sin*dz,this.cacheOrigin.y-origin.y,-sin*dx+cos*dz);this.group.rotation.y=origin.heading;
    for(const {batch,index,motion,offset}of this.animated){
      motion.part.rotation.x=Math.sin(time*motion.frequency+motion.phase)*motion.amplitude;motion.part.updateMatrix();
      this.matrix.multiplyMatrices(motion.root,motion.part.matrix);this.matrix.elements[12]+=offset.x;this.matrix.elements[13]+=offset.y;this.matrix.elements[14]+=offset.z;
      batch.mesh.setMatrixAt(index,this.matrix);
    }
    for(const {mesh,count,dynamic}of this.batches.values())if(dynamic&&count)mesh.instanceMatrix.needsUpdate=true;
  }
}
