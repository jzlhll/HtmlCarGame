import * as THREE from 'three';
import { SCENERY_DETAIL } from './config.js';

export const SCENERY_SHAPES=['box','roof','cylinder','cone','sphere','octagon','arch','rock','sphere-far','roof-far','niche'];
const shapes=new Map();
const boxFaces=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]];
function combine(volumes){
  const vertices=[],faces=[];
  for(const volume of volumes){const offset=vertices.length;vertices.push(...volume.vertices);for(const face of volume.faces)faces.push(face.map(i=>i+offset));}
  return {vertices,faces,volumes};
}

// 非凸屋面和拱券由凸体拼合，渲染三角面与碰撞体使用完全相同的顶点。
export function sceneryShape(kind='box') {
  if(shapes.has(kind))return shapes.get(kind);
  let shape;
  if(kind==='niche'){
    const outline=[[-.5,-.5],[.5,-.5]];
    for(let i=0;i<=16;i++){const a=i/16*Math.PI;outline.push([Math.cos(a)*.5,-.05+Math.sin(a)*.55]);}
    const n=outline.length,vertices=[...outline.map(([x,y])=>[x,y,-.5]),...outline.map(([x,y])=>[x,y,.5])];
    const faces=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i)];for(let i=0;i<n;i++)faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);shape={vertices,faces};
  }else if(kind==='roof-far'){
    shape={vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[-.3,.5,0],[.3,.5,0]],faces:[[0,1,5,4],[3,4,5,2],[0,4,3],[1,2,5],[0,3,2,1]]};
  }else if(kind==='sphere-far'){
    const t=(1+Math.sqrt(5))/2,k=1/(2*t);
    shape={vertices:[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(p=>p.map(v=>v*k)),faces:[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]],smooth:true};
  }else if(kind==='rock'){
    const n=9,vertices=[],faces=[];
    for(const [y,r,lean]of [[-.5,.44,0],[-.15,.5,.02],[.5,.3,.08]])for(let i=0;i<n;i++){
      const angle=i/n*Math.PI*2,spread=.94+.06*Math.cos(angle*3);vertices.push([Math.cos(angle)*r*spread+lean,y,Math.sin(angle)*r*spread]);
    }
    faces.push(Array.from({length:n},(_,i)=>n-i-1),Array.from({length:n},(_,i)=>n*2+i));
    for(let ring=0;ring<2;ring++)for(let i=0;i<n;i++){const a=ring*n+i,b=ring*n+(i+1)%n;faces.push([a,b,b+n,a+n]);}shape={vertices,faces};
  }else if(kind==='roof'){
    const volumes=[],xs=[-.5,-.32,.32,.5],n=SCENERY_DETAIL.roofSegments;
    const top=(x,z)=>{const t=Math.max(Math.abs(z)*2,Math.max(0,(Math.abs(x)-.32)/.18));return .5-.94*t+.34*t*t*t*t;};
    for(let ix=0;ix<xs.length-1;ix++)for(let iz=0;iz<n;iz++){
      const a=[xs[ix],iz/n- .5],b=[xs[ix+1],iz/n-.5],c=[xs[ix+1],(iz+1)/n-.5],d=[xs[ix],(iz+1)/n-.5];
      for(const points of [[a,b,c],[a,c,d]])volumes.push({vertices:[...points.map(([x,z])=>[x,-.5,z]),...points.map(([x,z])=>[x,top(x,z),z])],faces:[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]});
    }
    shape=combine(volumes);
  }else if(kind==='arch'){
    const volumes=[],n=SCENERY_DETAIL.archSegments;
    for(let i=0;i<n;i++){
      const vertices=[];
      for(const z of [-.5,.5])for(const [angle,r] of [[i/n*Math.PI,.5],[(i+1)/n*Math.PI,.5],[(i+1)/n*Math.PI,.38],[i/n*Math.PI,.38]])vertices.push([Math.cos(angle)*r,-.5+Math.sin(angle)*r*2,z]);
      volumes.push({vertices,faces:boxFaces});
    }
    shape=combine(volumes);
  }else if(kind==='sphere'){
    const vertices=[[0,-.5,0]],faces=[],n=SCENERY_DETAIL.roundSegments,rings=SCENERY_DETAIL.sphereRings;
    for(let ring=1;ring<rings;ring++)for(let i=0;i<n;i++){
      const latitude=-Math.PI/2+ring/rings*Math.PI,angle=i/n*Math.PI*2;
      vertices.push([Math.cos(angle)*Math.cos(latitude)*.5,Math.sin(latitude)*.5,Math.sin(angle)*Math.cos(latitude)*.5]);
    }
    const end=vertices.length;vertices.push([0,.5,0]);
    for(let i=0;i<n;i++){const next=(i+1)%n;faces.push([0,1+i,1+next],[end,1+(rings-2)*n+next,1+(rings-2)*n+i]);}
    for(let r=0;r<rings-2;r++)for(let i=0;i<n;i++){const a=1+r*n+i,b=1+r*n+(i+1)%n;faces.push([a,b,b+n,a+n]);}
    shape={vertices,faces,smooth:true};
  }else if(['cylinder','cone','octagon'].includes(kind)){
    const n=kind==='octagon'?8:SCENERY_DETAIL.roundSegments,vertices=[];
    for(const y of [-.5,.5])for(let i=0;i<n;i++){const a=(i/n+(kind==='octagon'?.0625:0))*Math.PI*2,r=kind==='cone'&&y>0?.08:.5;vertices.push([Math.cos(a)*r,y,Math.sin(a)*r]);}
    const faces=[Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>n+i)];
    for(let i=0;i<n;i++)faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);shape={vertices,faces};
  }else shape={vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],faces:boxFaces};
  shapes.set(kind,shape);return shape;
}

export function* sceneryGeometry(kind){
  const shape=sceneryShape(kind),positions=[],normals=[],center=shape.volumes?null:shape.vertices.reduce((a,p)=>a.map((v,i)=>v+p[i]/shape.vertices.length),[0,0,0]);
  for(const [index,face]of shape.faces.entries()){
    for(let i=1;i<face.length-1;i++){
      let [a,b,c]=[shape.vertices[face[0]],shape.vertices[face[i]],shape.vertices[face[i+1]]];
      const u=b.map((v,k)=>v-a[k]),v=c.map((n,k)=>n-a[k]);let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      if(center&&normal.reduce((sum,n,k)=>sum+n*(a[k]-center[k]),0)<0){[b,c]=[c,b];normal=normal.map(n=>-n);}
      const length=Math.hypot(...normal);normal=normal.map(n=>n/length);
      for(const p of [a,b,c]){positions.push(...p);const size=Math.hypot(...p);normals.push(...(shape.smooth?p.map(n=>n/size):normal));}
    }
    if(index%32===0)yield;
  }
  // 复合体逐体校正绕序，不能用整座屋顶的中心推断内部面的方向。
  if(shape.volumes){
    let offset=0;
    for(const volume of shape.volumes){
      const center=volume.vertices.reduce((a,p)=>a.map((v,i)=>v+p[i]/volume.vertices.length),[0,0,0]);
      for(const face of volume.faces)for(let i=1;i<face.length-1;i++){
        const normal=normals.slice(offset,offset+3),a=positions.slice(offset,offset+3);
        if(normal.reduce((sum,n,k)=>sum+n*(a[k]-center[k]),0)<0){const b=positions.slice(offset+3,offset+6);positions.splice(offset+3,3,...positions.slice(offset+6,offset+9));positions.splice(offset+6,3,...b);for(let j=0;j<9;j++)normals[offset+j]*=-1;}
        offset+=9;
      }
      yield;
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

const collisionShapes=new WeakMap();
function collisionShape(shape){
  if(collisionShapes.has(shape))return collisionShapes.get(shape);
  const min=[],max=[],planes=[],center=[0,0,0];
  for(let i=0;i<3;i++){min[i]=Math.min(...shape.vertices.map(v=>v[i]));max[i]=Math.max(...shape.vertices.map(v=>v[i]));center[i]=shape.vertices.reduce((sum,v)=>sum+v[i],0)/shape.vertices.length;}
  const result={min,max,planes};collisionShapes.set(shape,result);
  if(shape.volumes){result.parts=shape.volumes.map(collisionShape);return result;}
  for(const face of shape.faces){
    const [a,b,d]=face.map(i=>shape.vertices[i]),u=b.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
    let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);normal=normal.map(n=>n/length);
    if(normal.reduce((sum,n,i)=>sum+n*(a[i]-center[i]),0)<0)normal=normal.map(n=>-n);
    planes.push({normal,distance:normal.reduce((sum,n,i)=>sum+n*a[i],0)});
  }
  return result;
}

// 实例仅保存变换与共享单位平面，避免数万个构件复制百万个平面对象触发集中GC。
export function scenerySolid(part) {
  const shape=collisionShape(sceneryShape(part.shape)),c=Math.cos(part.heading||0),s=Math.sin(part.heading||0);
  const pose={x:part.x,y:part.y,z:part.z,c,s,ix:1/part.width,iy:1/part.height,iz:1/part.depth};
  const transform=shape=>{
    const xs=[],zs=[];
    for(const x of [shape.min[0],shape.max[0]])for(const z of [shape.min[2],shape.max[2]]){xs.push(part.x+x*part.width*c+z*part.depth*s);zs.push(part.z-x*part.width*s+z*part.depth*c);}
    const result={min:{x:Math.min(...xs),y:part.y+shape.min[1]*part.height,z:Math.min(...zs)},max:{x:Math.max(...xs),y:part.y+shape.max[1]*part.height,z:Math.max(...zs)},name:part.name};
    if(shape.parts)result.parts=shape.parts.map(transform);else {result.localPlanes=shape.planes;result.pose=pose;}
    return result;
  };
  return transform(shape);
}
