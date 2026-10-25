// 航路距离使用实际世界米；圆弧在武汉后平滑转向西北，不改变飞机的操纵与速度。
export function arcPoint(arc,distance,offset=0,out={}) {
  const start=-arc.startZ;
  if(distance<=start){out.x=offset;out.z=-distance;out.heading=0;return out;}
  const angle=Math.min(arc.angle,(distance-start)/arc.radius),extra=Math.max(0,distance-start-arc.radius*arc.angle);
  out.heading=-angle;out.x=arc.radius*(Math.cos(angle)-1)-Math.sin(angle)*extra+Math.cos(angle)*offset;
  out.z=arc.startZ-arc.radius*Math.sin(angle)-Math.cos(angle)*extra-Math.sin(angle)*offset;
  return out;
}

export function prepareRoutePath(route,step=2000) {
  const length=route.arc?-route.arc.startZ+route.arc.radius*route.arc.angle:-route.destination.threshold;
  route.length=length;if(route.arc)route.sectors.at(-1).distance=length;
  const end=length+route.destination.length,points=[];
  for(let distance=0;distance<end;distance+=step)points.push({...routePoint(route,distance),distance});
  points.push({...routePoint(route,end),distance:end});route.path=points;
  route.pathSegments=points.slice(1).map((b,i)=>{const a=points[i],dx=b.x-a.x,dz=b.z-a.z;return {a,b,dx,dz,squared:dx*dx+dz*dz};});
  if(route.arc){
    const cells=new Map(),size=route.cellSize,half=size/2;
    const include=(minX,maxX,minZ,maxZ)=>{
      for(let x=Math.floor((minX+half)/size);x<=Math.floor((maxX+half)/size);x++)for(let z=Math.floor((minZ+half)/size);z<=Math.floor((maxZ+half)/size);z++)cells.set(`${x},${z}`,{column:x,row:z});
    };
    for(const p of points)include(p.x-half,p.x+half,p.z-half,p.z+half);
    for(const city of route.cities)include(city.x-city.columns*city.spacing/2,city.x+city.columns*city.spacing/2,city.z-city.rows*city.spacing/2,city.z+city.rows*city.spacing/2);
    route.fixedCells=cells;
  }
  return route;
}

export function routePoint(route,distance,offset=0,out={}) {
  if(route.arc)return arcPoint(route.arc,distance,offset,out);
  out.x=offset;out.z=-distance;out.heading=0;return out;
}

export function projectRoute(route,position,out={}) {
  let best=Infinity,progress=0;
  for(const segment of route.pathSegments){
    const {a,b,dx,dz,squared}=segment,t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/squared));
    const distance=(position.x-a.x-dx*t)**2+(position.z-a.z-dz*t)**2;
    if(distance<best){best=distance;progress=a.distance+(b.distance-a.distance)*t;}
  }
  out.deviation=Math.sqrt(best);out.progress=progress;out.remaining=route.length-progress;return out;
}
