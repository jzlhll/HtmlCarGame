import { TREE_CONTACT, TREE_MODELS, WORLD_HEIGHT } from './config.js';

import { treeProfiles, branchSamples } from './tree-species.js';

const stride=8,addressStride=1048576,empty=[];
const contactBranches=treeProfiles.map(profile=>profile.branches.filter(branch=>branch.solid).flatMap(branch=>{const points=branchSamples(branch,6);return points.slice(1).map((p,i)=>({a:points[i],b:p,r:branch.radius}));}));

// 固定哈希选择树种、高度和冠幅，同一数据用于近远实例、持久矩阵及接触体。
export function treeDimensions(x,z,seed,floor=0) {
  let state=(Math.imul(Math.round(x),73856093)^Math.imul(Math.round(z),19349663)^seed)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const tall=random()<TREE_CONTACT.tallRatio;
  const type=tall?(random()<.56?0:3):Math.floor(random()*TREE_MODELS.species.length),profile=TREE_MODELS.species[type];
  const range=tall?TREE_CONTACT.tallHeight:profile.height.map(v=>v/WORLD_HEIGHT.displayScale);
  const height=Math.min(range[0]+random()**(tall?1:1.35)*(range[1]-range[0]),Math.max(2,WORLD_HEIGHT.objectMax-floor));
  return {type,height,y:height/TREE_CONTACT.unitHeight,width:height*(profile.width[0]+random()*(profile.width[1]-profile.width[0]))};
}

function ellipsoidHit(ax,ay,az,bx,by,bz,x,y,z,rx,ry,rz) {
  const px=(ax-x)/rx,py=(ay-y)/ry,pz=(az-z)/rz,dx=(bx-ax)/rx,dy=(by-ay)/ry,dz=(bz-az)/rz;
  const length=dx*dx+dy*dy+dz*dz,t=length?Math.max(0,Math.min(1,-(px*dx+py*dy+pz*dz)/length)):0;
  return (px+dx*t)**2+(py+dy*t)**2+(pz+dz*t)**2<=1;
}

function touchesTree(sample,data,i,type) {
  const {from,to,radius}=sample,x=data[i],y=data[i+1],z=data[i+2],sx=data[i+3],sy=data[i+4],c=data[i+5],s=data[i+6];
  const ax=(c*(from.x-x)-s*(from.z-z))/sx,az=(s*(from.x-x)+c*(from.z-z))/sx,ay=(from.y-y)/sy;
  const bx=(c*(to.x-x)-s*(to.z-z))/sx,bz=(s*(to.x-x)+c*(to.z-z))/sx,by=(to.y-y)/sy;
  const r=radius/sx,ry=radius/sy;
  const profile=treeProfiles[type];
  for(const p of profile.leaves)if(ellipsoidHit(ax,ay,az,bx,by,bz,p.x,p.y,p.z,p.rx*1.07+r,p.ry*1.07+ry,p.rz*1.07+r))return true;
  // 只给主体枝干建立接触；细丝和小枝为装饰，拱洞仍可穿过。
  for(const part of contactBranches[type]){
    const cx=(part.a[0]+part.b[0])/2,cy=(part.a[1]+part.b[1])/2,cz=(part.a[2]+part.b[2])/2;
    const rx=Math.abs(part.a[0]-part.b[0])/2+part.r+r,h=Math.abs(part.a[1]-part.b[1])/2+part.r+ry,rz=Math.abs(part.a[2]-part.b[2])/2+part.r+r;
    if(ellipsoidHit(ax,ay,az,bx,by,bz,cx,cy,cz,rx,h,rz))return true;
  }
  return false;
}

export class TreeField {
  constructor(){this.batches=[];this.species=[];this.cells=new Map();this.candidates=new Set();this.count=0;}

  *addMatrices(matrices,count,species) {
    const data=new Float32Array(count*stride),batch=this.batches.length,cell=TREE_CONTACT.cell;this.batches.push(data);const types=species||new Uint8Array(count).fill(3);this.species.push(types);
    for(let index=0;index<count;index++){
      const offset=index*16,i=index*stride,sx=Math.hypot(matrices[offset],matrices[offset+2]),sy=matrices[offset+5];
      if(!(sx>0&&sy>0))continue;
      const x=matrices[offset+12],y=matrices[offset+13],z=matrices[offset+14],radius=sx*TREE_MODELS.species[types[index]].radius;
      data.set([x,y,z,sx,sy,matrices[offset]/sx,-matrices[offset+2]/sx,radius],i);
      const address=batch*addressStride+index;
      for(let cx=Math.floor((x-radius)/cell);cx<=Math.floor((x+radius)/cell);cx++)for(let cz=Math.floor((z-radius)/cell);cz<=Math.floor((z+radius)/cell);cz++){
        const key=cx+':'+cz;let bucket=this.cells.get(key);if(!bucket)this.cells.set(key,bucket=[]);bucket.push(address);
      }
      this.count++;if(index%128===0)yield;
    }
  }

  touch(sweep) {
    const candidates=this.candidates,cell=TREE_CONTACT.cell;candidates.clear();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const {from,to,radius}of sweep){minX=Math.min(minX,from.x-radius,to.x-radius);maxX=Math.max(maxX,from.x+radius,to.x+radius);minY=Math.min(minY,from.y-radius,to.y-radius);maxY=Math.max(maxY,from.y+radius,to.y+radius);minZ=Math.min(minZ,from.z-radius,to.z-radius);maxZ=Math.max(maxZ,from.z+radius,to.z+radius);}
    for(let x=Math.floor(minX/cell);x<=Math.floor(maxX/cell);x++)for(let z=Math.floor(minZ/cell);z<=Math.floor(maxZ/cell);z++)for(const id of this.cells.get(x+':'+z)||empty)candidates.add(id);
    for(const id of candidates){
      const data=this.batches[Math.floor(id/addressStride)],i=(id%addressStride)*stride;
      if(maxX<data[i]-data[i+7]||minX>data[i]+data[i+7]||maxZ<data[i+2]-data[i+7]||minZ>data[i+2]+data[i+7])continue;
      if(maxY<data[i+1]||minY>data[i+1]+data[i+4]*TREE_CONTACT.unitHeight)continue;
      for(const sample of sweep){
        if(touchesTree(sample,data,i,this.species[Math.floor(id/addressStride)][id%addressStride]))return true;
      }
    }
    return false;
  }
}
