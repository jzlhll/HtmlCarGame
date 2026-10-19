import { JOURNEY, REGIONAL_WATER } from './config.js';

export function pointInRing(x,z,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }return inside;
}
export function ringBounds(ring){return {minX:Math.min(...ring.map(p=>p.x)),maxX:Math.max(...ring.map(p=>p.x)),minZ:Math.min(...ring.map(p=>p.z)),maxZ:Math.max(...ring.map(p=>p.z))};}
const overlap=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const bounded=(x,z,b)=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;

export function riverSection(z){
  const s=JOURNEY.island,t=(z-s.z)/s.riverLength;
  const center=s.x+240*Math.sin(t*Math.PI*2)+105*Math.sin(t*Math.PI*5),half=s.riverWidth/2*(1+.085*Math.sin(t*13)+.035*Math.sin(t*31));
  return {x:center,z,left:center-half,right:center+half};
}
export function islandSection(z){
  const s=JOURNEY.island,t=Math.max(0,Math.min(1,(z-s.z)/s.length+.5));
  const half=s.width/2*Math.sin(t*Math.PI)**.62*(.92+.08*Math.sin(t*19));
  return {x:s.x+40*Math.sin((t-.5)*Math.PI*2),z,half};
}
function isleOutline(x,z,width,length,seed=0){
  const points=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=.87+.08*Math.sin(a*3+seed)+.05*Math.sin(a*7+seed);points.push({x:x+Math.cos(a)*width*.5*r,z:z+Math.sin(a)*length*.5*r});}return points;
}
function lakeOutline(){
  const s=JOURNEY.lake,knots=[[-.12,-.50],[-.30,-.47],[-.43,-.39],[-.31,-.31],[-.46,-.23],[-.51,-.10],[-.35,-.03],[-.44,.08],[-.48,.22],[-.32,.26],[-.37,.39],[-.19,.44],[-.08,.50],[.10,.48],[.18,.41],[.34,.43],[.43,.32],[.29,.25],[.49,.16],[.46,.04],[.32,-.03],[.50,-.16],[.43,-.29],[.26,-.28],[.32,-.41],[.12,-.46]];
  const result=[];
  for(let i=0;i<knots.length;i++)for(let j=0;j<REGIONAL_WATER.lakeSubdivisions;j++){
    const a=knots[i],b=knots[(i+1)%knots.length],t=j/REGIONAL_WATER.lakeSubdivisions,edge=Math.sin(t*Math.PI)*.008*Math.sin(i*2.4);
    result.push({x:s.x+(a[0]+(b[0]-a[0])*t+edge)*s.width,z:s.z+(a[1]+(b[1]-a[1])*t)*s.length});
  }return result;
}

function mergeWaterRings(first,second){
  const orientation=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.x*q.z-q.x*p.z;},0);
  const a=orientation(first)<0?first:[...first].reverse(),b=orientation(second)<0?second:[...second].reverse(),cutsA=a.map(()=>[0,1]),cutsB=b.map(()=>[0,1]);
  const cross=(x,z,u,v)=>x*v-z*u;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length],dx=q.x-p.x,dz=q.z-p.z,ux=s.x-r.x,uz=s.z-r.z,d=cross(dx,dz,ux,uz);
    if(Math.abs(d)<1e-9)continue;
    const t=cross(r.x-p.x,r.z-p.z,ux,uz)/d,u=cross(r.x-p.x,r.z-p.z,dx,dz)/d;
    if(t>1e-8&&t<1-1e-8&&u>1e-8&&u<1-1e-8){cutsA[i].push(t);cutsB[j].push(u);}
  }
  const edges=[];
  for(const [ring,other,cuts]of [[a,b,cutsA],[b,a,cutsB]])for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length],at=t=>({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t}),ts=cuts[i].sort((x,y)=>x-y);
    for(let j=1;j<ts.length;j++){const mid=at((ts[j-1]+ts[j])/2);if(!pointInRing(mid.x,mid.z,other))edges.push({a:at(ts[j-1]),b:at(ts[j])});}
  }
  const result=[],used=new Set();let edge=edges[0];
  while(edge&&!used.has(edge)){
    used.add(edge);result.push(edge.a);const end=edge.b;
    edge=edges.find(e=>!used.has(e)&&Math.hypot(e.a.x-end.x,e.a.z-end.z)<.001);
    if(!edge&&Math.hypot(result[0].x-end.x,result[0].z-end.z)>.001)throw new Error('Regional water boundary does not close');
  }
  if(used.size!==edges.length)throw new Error('Regional water boundary has multiple loops');
  return result;
}

// 江岸、岛屿、湖岸由一份闭合轮廓驱动显示、避水与触地分类。
export function createRegionalWater(level){
  const bodies=[];
  if(level>=2){
    const s=JOURNEY.island,left=[],right=[],a=[],b=[];
    for(let i=0;i<=REGIONAL_WATER.riverSamples;i++){const p=riverSection(s.z+(i/REGIONAL_WATER.riverSamples-.5)*s.riverLength);left.push({x:p.left,z:p.z});right.push({x:p.right,z:p.z});}
    for(let i=0;i<=REGIONAL_WATER.islandSamples;i++){const p=islandSection(s.z+(i/REGIONAL_WATER.islandSamples-.5)*s.length);a.push({x:p.x-p.half,z:p.z});b.push({x:p.x+p.half,z:p.z});}
    const island=[...a,...b.slice(1,-1).reverse()],outline=[...left,...right.reverse()];
    bodies.push({id:'xiang-river',name:'湘江',outline,holes:[island],islands:[island],bounds:ringBounds(outline)});
  }
  if(level>=3){
    const s=JOURNEY.lake,outline=lakeOutline(),islands=[isleOutline(-1500,s.z+3800,650,1500,1),isleOutline(1750,s.z-800,780,1800,3),isleOutline(-2100,s.z-4600,500,1100,5)];
    bodies.push({id:'dongting-lake',name:'洞庭湖',outline,holes:islands,islands,bounds:ringBounds(outline)});
  }
  const renderBodies=bodies.length===2?[{id:'xiang-dongting',name:'湘江与洞庭湖',outline:mergeWaterRings(bodies[0].outline,bodies[1].outline),holes:bodies.flatMap(b=>b.holes),islands:bodies.flatMap(b=>b.islands)}]:bodies;
  return {bodies,renderBodies};
}
export function regionalWaterAt(water,x,z){
  for(const body of water?.bodies||[])if(bounded(x,z,body.bounds)&&pointInRing(x,z,body.outline)&&!body.holes.some(r=>pointInRing(x,z,r)))return body.name;
  return null;
}
function edgeHitsBox(a,b,box){
  let lo=0,hi=1;for(const axis of ['x','z']){const delta=b[axis]-a[axis],min=axis==='x'?box.minX:box.minZ,max=axis==='x'?box.maxX:box.maxZ;
    if(Math.abs(delta)<1e-9){if(a[axis]<min||a[axis]>max)return false;continue;}
    const t0=(min-a[axis])/delta,t1=(max-a[axis])/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
  }return true;
}
export function boxTouchesRegionalWater(water,box){
  for(const body of water?.bodies||[]){
    if(!overlap(body.bounds,box))continue;
    for(const x of [box.minX,box.maxX])for(const z of [box.minZ,box.maxZ])if(pointInRing(x,z,body.outline)&&!body.holes.some(r=>pointInRing(x,z,r)))return true;
    for(const ring of [body.outline,...body.holes])for(let i=0;i<ring.length;i++)if(edgeHitsBox(ring[i],ring[(i+1)%ring.length],box))return true;
  }return false;
}
// 道路沿用已有矩形裁剪器；每条岸带覆盖相邻轮廓顶点之间的全部水域。
export function regionalWaterExclusions(water){
  const boxes=[];
  for(const body of water.bodies){
    const zs=[...new Set(body.outline.map(p=>p.z))].sort((a,b)=>a-b);
    for(let i=1;i<zs.length;i++){
      const minZ=zs[i-1],maxZ=zs[i],xs=[];
      for(let j=0;j<body.outline.length;j++){
        const a=body.outline[j],b=body.outline[(j+1)%body.outline.length];if(Math.max(a.z,b.z)<minZ||Math.min(a.z,b.z)>maxZ)continue;
        for(const z of [minZ,maxZ])if(z>=Math.min(a.z,b.z)&&z<=Math.max(a.z,b.z))xs.push(a.z===b.z?a.x:a.x+(b.x-a.x)*(z-a.z)/(b.z-a.z));
      }
      if(xs.length)boxes.push({minX:Math.min(...xs)-REGIONAL_WATER.shoreWidth,maxX:Math.max(...xs)+REGIONAL_WATER.shoreWidth,minZ:minZ-1,maxZ:maxZ+1});
    }
  }return boxes;
}
export function distanceToShore(x,z,body){
  let distance=Infinity;
  for(const ring of [body.outline,...body.holes])for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
    distance=Math.min(distance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
  }return distance;
}
