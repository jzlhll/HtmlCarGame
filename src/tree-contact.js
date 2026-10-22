import { TREE_CONTACT, TREE_MODELS, TREE_HEIGHTS, WORLD_HEIGHT, LOOP_WORLD } from './config.js';

import { terrainNoise, smoothRange } from './terrain.js';
import { treeProfiles, branchSamples } from './tree-species.js';

const stride=8,addressStride=1048576,empty=[];
const contactBranches=treeProfiles.map(profile=>profile.branches.filter(branch=>branch.solid).flatMap(branch=>{const points=branchSamples(branch,6);return points.slice(1).map((p,i)=>({a:points[i],b:p,r:branch.radius}));}));

// 高度和冠幅按世界坐标连续起伏；循环模板的两端也使用周期连续采样。
function canopyNoise(x,z,scale,seed,periodic){
  if(!periodic)return terrainNoise(x/scale,z/scale,seed);
  const cells=Math.max(2,Math.round(LOOP_WORLD.tileSize/scale)),step=LOOP_WORLD.tileSize/cells,ix=Math.floor(x/step),iz=Math.floor(z/step);
  const wrap=i=>(i%cells+cells)%cells,u=smoothRange(0,1,x/step-ix),v=smoothRange(0,1,z/step-iz);
  const a=terrainNoise(wrap(ix),wrap(iz),seed),b=terrainNoise(wrap(ix+1),wrap(iz),seed),c=terrainNoise(wrap(ix),wrap(iz+1),seed),d=terrainNoise(wrap(ix+1),wrap(iz+1),seed);
  return a+(b-a)*u+(c-a)*v*(1-u)+(d-b)*u*v;
}
// 用高度场分位点控制占比，分段平滑插值，不把相邻树独立抽成高低档。
function flatCanopyHeight(noise,periodic){
  const s=TREE_HEIGHTS,knots=periodic?s.periodicNoiseKnots:s.noiseKnots;
  for(let i=1;i<knots.length;i++)if(noise<=knots[i]||i===knots.length-1){
    return s.heightKnots[i-1]+(s.heightKnots[i]-s.heightKnots[i-1])*smoothRange(knots[i-1],knots[i],noise);
  }
}

export function treeDimensions(x,z,seed,floor=0,{mountain=false,periodic=false}={}) {
  const s=TREE_HEIGHTS,noise=.72*canopyNoise(x,z,s.scale,s.seed,periodic)+.28*canopyNoise(x,z,s.detailScale,s.seed+19,periodic);
  const wave=smoothRange(.18,.82,noise),flat=flatCanopyHeight(noise,periodic);
  const short=s.mountain[0]+(s.mountain[1]-s.mountain[0])*wave,mix=mountain?1:smoothRange(...s.mountainFloor,floor);
  const height=Math.min(flat+(short-flat)*mix,Math.max(0,WORLD_HEIGHT.objectMax-floor));
  // 树种使用独立坐标随机流，既不偏向噪声中段，也不影响树高曲线或种植位置。
  const size=LOOP_WORLD.tileSize,tx=Math.floor(periodic?(x%size+size)%size:x),tz=Math.floor(periodic?(z%size+size)%size:z);
  const type=height<=s.shrubMax?5:height>=s.poplarMin?0:Math.min(4,Math.floor(terrainNoise(tx,tz,s.seed+37)*5));
  const profile=TREE_MODELS.species[type],widthMix=canopyNoise(x,z,s.scale,s.seed+71,periodic);
  return {type,height,y:height/TREE_CONTACT.unitHeight,width:height*(profile.width[0]+widthMix*(profile.width[1]-profile.width[0]))};
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
