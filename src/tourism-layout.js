import { TOURISM } from './config.js';

// 共享凸原型既生成可见几何，也定义实体平面，桥下和门洞保持真正的空隙。
export function sceneryShape(kind='box') {
  if(kind==='roof')return {vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[0,.5,-.5],[0,.5,.5]],faces:[[0,1,4],[3,5,2],[0,4,5,3],[1,2,5,4],[0,3,2,1]]};
  if(kind==='cylinder'||kind==='cone'){
    const n=12,vertices=[];
    for(const y of [-.5,.5])for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=kind==='cone'&&y>0?.08:.5;vertices.push([Math.cos(a)*r,y,Math.sin(a)*r]);}
    const faces=[Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>n+i)];
    for(let i=0;i<n;i++)faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);
    return {vertices,faces};
  }
  return {vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],faces:[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]]};
}

export function scenerySolid(part) {
  const shape=sceneryShape(part.shape),c=Math.cos(part.heading||0),s=Math.sin(part.heading||0);
  const vertices=shape.vertices.map(([x,y,z])=>[part.x+x*part.width*c+z*part.depth*s,part.y+y*part.height,part.z-x*part.width*s+z*part.depth*c]);
  const min={},max={},planes=[];
  for(const [i,axis]of ['x','y','z'].entries()){min[axis]=Math.min(...vertices.map(v=>v[i]));max[axis]=Math.max(...vertices.map(v=>v[i]));}
  for(const face of shape.faces){
    const [a,b,d]=face.map(i=>vertices[i]),u=b.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
    let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);
    normal=normal.map(n=>n/length);
    if(normal[0]*(a[0]-part.x)+normal[1]*(a[1]-part.y)+normal[2]*(a[2]-part.z)<0)normal=normal.map(n=>-n);
    planes.push({normal,distance:normal.reduce((sum,n,i)=>sum+n*a[i],0)});
  }
  return {min,max,planes,name:part.name};
}

export function tourismParts(city) {
  const parts=[],side=Math.sign(city.x),cx=city.x,cz=city.z;
  const add=(name,x,y,z,width,height,depth,color,shape='box',heading=0)=>parts.push({name,x:cx+x,y,z:cz+z,width,height,depth,color,shape,heading});
  const stone=0xb5b29e,red=0x92533d,roof=0x4d665e,water=0x478b9b;
  const hall=(name,x,z,w=480,h=190,d=320)=>{
    add(name,x,h/2,z,w,h,d,stone);add(name,x,h+55,z,w*1.2,110,d*1.25,roof,'roof');
    for(const dx of [-.4,-.2,0,.2,.4])add(name,x+dx*w,h*.48,z+d*.51,12,h*.9,18,red);
  };
  const pagoda=(name,x,z,levels=4)=>{
    for(let step=0;step<3;step++)add(name,x,step*10+5,z,520-step*45,10,520-step*45,stone);
    for(let i=0;i<levels;i++){
      const w=380-i*42,y=30+i*180;add(name,x,y+78,z,w,156,w,stone);add(name,x,y+180,z,w*1.35,68,w*1.35,roof,'roof');
      for(const side of [-1,1]){
        for(const dx of [-.4,-.2,0,.2,.4])add(name,x+dx*w,y+80,z+side*w*.51,12,148,14,red);
        for(const dx of [-.25,0,.25])add(name,x+dx*w,y+82,z+side*w*.505,w*.12,78,4,0x394d4c);
        add(name,x,y+28,z+side*w*.58,w*1.18,10,12,red);
      }
    }
    add(name,x,levels*180+95,z,70,130,70,roof,'cone');
  };
  const feature=(kind,name,x,z)=>{
    if(kind==='pagoda'){pagoda(name,x,z,city.id==='yueyang'?3:5);return;}
    if(kind==='temple'||kind==='museum'){
      hall(name,x,z,kind==='museum'?850:620,240,420);hall(name,x-670,z+260,380,130,280);hall(name,x+670,z+260,380,130,280);
      for(const dx of [-480,480])hall(name,x+dx,z+850,300,120,250);return;
    }
    if(kind==='garden'||kind==='spring'){
      for(let i=0;i<5;i++){const dx=(i%3-1)*430,dz=(Math.floor(i/3)-.5)*500;add(name,x+dx,1.2,z+dz,300,2,210,water,'cylinder');
        for(const edge of [-1,1])add(name,x+dx+edge*164,12,z+dz,26,24,230,stone);}
      hall(name,x,z-780,460,130,260);pagoda(name,x+650,z-680,2);return;
    }
    if(kind==='cliff'){
      for(let i=0;i<7;i++){const dx=(i%4-1.5)*440,dz=Math.floor(i/4)*600,h=330+(i%3)*180;
        add(name,x+dx,h/2,z+dz,300,h,380,city.id==='zhaoqing'?0x8e9985:0xb26f4a,'cone');}
      hall(name,x,z-700,420,120,260);return;
    }
    if(kind==='arch'){
      for(const dx of [-520,520])add(name,x+dx,650,z,520,1300,630,0x9d9f8d,'cone');
      add(name,x,1210,z,1400,260,620,0x9d9f8d);return;
    }
    if(kind==='sail'){
      for(let i=0;i<8;i++){const w=1000-Math.abs(i-3.5)*155;add(name,x,65+i*70,z,w,68,580,0xc1d0cb);}
      for(const dx of [-650,650])add(name,x+dx,450,z,240,900,240,0x809da7,'cone');return;
    }
    if(kind==='bridge'){
      // 两层桥面、桥墩、桁架分开，不能用大盒填满桥下空间。
      for(const y of [160,220])add(name,x,y,z,2300,20,150,0x939e99);
      for(const dx of [-950,-320,320,950]){add(name,x+dx,75,z,65,150,110,stone);add(name,x+dx,340,z,110,240,150,stone);}
      for(let i=0;i<18;i++)for(const dz of [-72,72])add(name,x-1080+i*127,282,z+dz,12,110,12,0x5f7b78, 'box',(i%2?1:-1)*.65);return;
    }
    if(kind==='marina'){
      add(name,x,.3,z,1900,.5,1900,water);
      for(let i=0;i<6;i++){const dx=(i-2.5)*260;add(name,x+dx,8,z,160,16,550,0x8b8877);
        add(name,x+dx,30,z+360,90,42,220,0x536e7b,'cone',Math.PI/2);add(name,x+dx,170,z+360,8,280,8,stone);add(name,x+dx+60,180,z+360,110,240,10,0xe4dbc0,'roof');}return;
    }
    if(kind==='stilt'){
      for(let i=0;i<5;i++){const dx=(i-2)*280;for(const edge of [-1,1])add(name,x+dx+edge*90,110,z,18,220,180,0x715b43);
        const start=parts.length;hall(name,x+dx,z,240,110,200);for(let j=start;j<parts.length;j++)parts[j].y+=200;}
      return;
    }
    for(const dx of [-520,520]){add(name,x+dx,150,z,240,300,340,stone);add(name,x+dx,330,z,320,70,420,roof,'roof');}
    add(name,x,330,z,1120,120,340,red);add(name,x,420,z,1250,80,480,roof,'roof');
    if(kind==='fort')for(let i=0;i<9;i++)add(name,x-560+i*140,105,z+420,90,210,150,stone);
  };
  // 主景点在面向航路的内侧广场；副景点位于城区中心，路网与普通楼房共同避让。
  feature(city.kind,city.landmark,-side*3400,0);
  feature(city.theme,city.second,0,0);
  for(const offset of [-1,1]){
    const x=side*1800,z=offset*4700;
    hall(city.name+'车站',x,z,600,90,220);
    for(let i=0;i<4;i++){add(city.name+'站台',x+(i-1.5)*130,20,z+390,90,40,500,0x9daaaa);}
  }
  return parts;
}

export function tourismSettings(route) {
  return route.cities.map(city=>({...city,columns:TOURISM.columns,rows:TOURISM.rows,spacing:TOURISM.spacing,plaza:TOURISM.plaza,
    exclusions:[{minX:city.x+Math.sign(city.x)*1800-900,maxX:city.x+Math.sign(city.x)*1800+900,minZ:city.z-5500,maxZ:city.z-3800},
      {minX:city.x+Math.sign(city.x)*1800-900,maxX:city.x+Math.sign(city.x)*1800+900,minZ:city.z+3800,maxZ:city.z+5500},{minX:city.x-TOURISM.plaza[0]/2,maxX:city.x+TOURISM.plaza[0]/2,minZ:city.z-TOURISM.plaza[1]/2,maxZ:city.z+TOURISM.plaza[1]/2},
      {minX:city.x-Math.sign(city.x)*3400-1500,maxX:city.x-Math.sign(city.x)*3400+1500,minZ:city.z-1400,maxZ:city.z+1400}]}));
}
