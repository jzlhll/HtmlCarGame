import { LANDSCAPE, terrainElevation } from './config.js';

const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

export function shorelineX(z) {
  const points=LANDSCAPE.coast.shoreline;
  for(let i=1;i<points.length;i++)if(z>=points[i][0]){
    const a=points[i-1],b=points[i],t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0])));
    return a[1]+(b[1]-a[1])*t;
  }
  return points.at(-1)[1];
}

export function coastalLandWeight(x,z) {
  const settings=LANDSCAPE.coast,a=settings.airport,c=settings.causeway;
  if(z<settings.endZ)return 1;
  const mainland=smooth((x-shorelineX(z))/settings.shoreBlend);
  const island=smooth(Math.min(a.halfWidth-Math.abs(x-a.x),a.halfLength-Math.abs(z-a.z))/a.edge);
  const connection=smooth(Math.min(x-c.minX,c.maxX-x,z-c.minZ,c.maxZ-z)/c.edge);
  return Math.max(mainland,island,connection);
}

export function createCoastalSurface(endDistance) {
  const s=LANDSCAPE.coast,xs=new Set([-s.width/2,s.width/2]),zs=new Set([s.startZ,s.endZ]);
  for(let x=-s.width/2;x<=s.width/2;x+=2500)xs.add(x);
  for(let x=-900;x<=3000;x+=s.shoreGrid)xs.add(x);
  for(let x=-s.width/2;x<=-3000;x+=1500)xs.add(x);
  for(let z=s.endZ;z<=s.startZ;z+=s.alongGrid)zs.add(z);
  for(let z=-3900;z<=800;z+=s.airportGrid)zs.add(z);
  for(const [z] of s.shoreline)zs.add(z);
  for(const x of [s.airport.x-s.airport.halfWidth,s.airport.x+s.airport.halfWidth,s.airport.x,s.causeway.minX,s.causeway.maxX,0])xs.add(x);
  for(const z of [s.airport.z-s.airport.halfLength,s.airport.z+s.airport.halfLength,s.causeway.minZ,s.causeway.maxZ])zs.add(z);
  const x=[...xs].sort((a,b)=>a-b),z=[...zs].sort((a,b)=>a-b),positions=new Float32Array(x.length*z.length*3),heights=new Float32Array(x.length*z.length);
  for(let row=0;row<z.length;row++)for(let col=0;col<x.length;col++){
    const weight=coastalLandWeight(x[col],z[row]),height=terrainElevation(z[row],endDistance)*weight+s.seabed*(1-weight),i=row*x.length+col;
    heights[i]=height;positions.set([x[col],height,z[row]],i*3);
  }
  return {x,z,positions,heights};
}

function interval(values,value) {
  let low=0,high=values.length-1;
  while(high-low>1){const mid=(low+high)>>1;if(value<values[mid])high=mid;else low=mid;}
  return low;
}

// 地面显示和查高读取同一非均匀网格的三角形；水下地面由可见海平面覆盖。
export function coastalHeight(surface,x,z) {
  const col=interval(surface.x,x),row=interval(surface.z,z),n=surface.x.length,i=row*n+col,h=surface.heights;
  const u=Math.max(0,Math.min(1,(x-surface.x[col])/(surface.x[col+1]-surface.x[col]))),v=Math.max(0,Math.min(1,(z-surface.z[row])/(surface.z[row+1]-surface.z[row])));
  return u+v<=1?h[i]*(1-u-v)+h[i+1]*u+h[i+n]*v:h[i+1]*(1-v)+h[i+n]*(1-u)+h[i+n+1]*(u+v-1);
}
