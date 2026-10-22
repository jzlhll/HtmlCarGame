import { TOURISM } from './config.js';

// 共享凸原型既生成可见几何，也定义实体平面，桥下和门洞保持真正的空隙。
export function sceneryShape(kind='box') {
  if(kind==='sphere'){
    const t=(1+Math.sqrt(5))/2,k=1/(2*t);
    return {vertices:[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(p=>p.map(v=>v*k)),faces:[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]]};
  }
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
  const parts=[],side=city.side??Math.sign(city.x),cx=city.x,cz=city.z;
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
  const statue=(name,x,z,scale=1)=>{
    const piece=(dx,y,dz,w,h,d,color,shape='box')=>add(name,x+dx*scale,y*scale,z+dz*scale,w*scale,h*scale,d*scale,color,shape);
    const bronze=0x9d8061;
    piece(0,80,0,960,160,820,0x8b8b7c,'cylinder');piece(0,155,0,780,40,700,stone,'cylinder');
    for(const dx of [-180,180])piece(dx,280,120,400,230,360,bronze,'sphere');
    piece(0,460,0,400,570,300,bronze,'cone');piece(0,650,0,510,240,310,bronze,'sphere');
    piece(0,855,0,230,280,220,bronze,'sphere');piece(0,990,-10,210,130,200,0x5b635b,'sphere');
    for(const side of [-1,1]){piece(side*118,850,0,35,150,75,bronze);piece(side*250,450,160,100,160,130,bronze,'sphere');piece(side*46,884,105,35,10,7,0x4a4840);}
    piece(0,846,115,26,62,30,bronze);piece(0,797,100,60,10,10,0x65523f);
  };
  const feature=(kind,name,x,z)=>{
    if(kind==='buddha'){statue(name,x,z);return;}
    if(kind==='grotto'){
      add(name,x,560,z-180,2550,1120,500,0x8a8978);
      for(const [dx,scale]of [[-850,.22],[-470,.33],[0,.62],[470,.33],[850,.22]]){
        add(name,x+dx,520*scale,z+76,800*scale,1050*scale,12,0x3f4945);statue(name,x+dx,z+190,scale);
      }
      for(let row=0;row<3;row++)for(let col=0;col<9;col++)add(name,x+(col-4)*270,710+row*140,z+73,135,95,16,0x535b51);
      return;
    }
    if(kind==='peaks'||kind==='terrace'){
      for(let i=0;i<5;i++){
        const dx=(i-2)*450,h=kind==='peaks'?1550+(i%3)*370:600+(2-Math.abs(i-2))*230;
        add(name,x+dx,h/2,z+(i%2)*360,620,h,850,0xa99f8a,'cone');
        add(name,x+dx,h*.73,z+(i%2)*360,265,h*.08,360,0x687c54,'cone');
      }
      hall(name,x,z-650,420,140,250);return;
    }
    if(kind==='brick-pagoda'){
      const levels=city.id==='kaifeng'?13:7,height=city.id==='kaifeng'?100:165,brick=city.id==='kaifeng'?0x88735a:0xb19370;
      for(let i=0;i<levels;i++){
        const w=580*(1-i/(levels*1.8)),bottom=i*height;
        add(name,x,bottom+height/2,z,w,height,w,brick);add(name,x,bottom+height,z,w*1.12,22,w*1.12,brick);
        for(const side of [-1,1])add(name,x,bottom+height*.53,z+side*(w/2+2),w*.14,height*.6,8,0x414f4d);
      }
      add(name,x,levels*height+55,z,60,110,60,0x7a6d55,'cone');return;
    }
    if(kind==='palace'||kind==='academy'){
      for(let i=0;i<3;i++)add(name,x,10+i*15,z,1700-i*130,20,1100-i*90,stone);
      hall(name,x,z,kind==='palace'?1050:700,kind==='palace'?320:200,480);
      for(const side of [-1,1]){
        hall(name,x+side*720,z+500,360,140,280);
        for(let i=0;i<3;i++)hall(name,x+side*850,z-600+i*340,220,100,210);
      }
      for(const side of [-1,1])for(let i=0;i<5;i++){add(name,x+side*420,100,z+620+i*110,12,200,12,red);add(name,x+side*420,220,z+620+i*110,50,60,50,0xba8e60,'cylinder');}
      return;
    }
    if(kind==='pagoda-forest'){
      for(let row=0;row<3;row++)for(let col=0;col<4;col++)pagoda(name,x+(col-1.5)*600,z+(row-1)*600,2+(row+col)%3);
      return;
    }
    if(kind==='song-garden'||kind==='lake-garden'){
      add(name,x,.3,z,2200,.5,1900,water);
      for(const dx of [-800,800]){add(name,x+dx,8,z-540,640,16,700,stone);hall(name,x+dx,z-600,380,160,280);}
      for(let i=-7;i<=7;i++){
        const y=75+80*(1-(i/8)**2);add(name,x+i*90,y,z+300,100,20,200,0xa18c6c);
        for(const side of [-1,1]){add(name,x+i*90,y+45,z+300+side*110,12,90,12,red);add(name,x+i*90,y+85,z+300+side*110,100,12,12,red);}
      }
      return;
    }
    if(kind==='tea'){
      for(let row=0;row<6;row++)for(let col=0;col<7;col++){
        const dx=(col-3)*290,dz=(row-2.5)*250;add(name,x+dx,10+row*12,z+dz,280,20+row*24,220,0x8e9573);
        add(name,x+dx,40+row*24,z+dz,250,60,180,0x4e7044,'sphere');
      }
      hall(name,x,z-1050,450,110,240);return;
    }
    if(kind==='canyon'){
      add(name,x,.3,z,210,.5,2400,water);
      for(const side of [-1,1])for(let i=0;i<5;i++){
        const h=800+(i%3)*210;add(name,x+side*(490+(i%2)*70),h/2,z+(i-2)*480,500,h,520,0xa16f51,'cone');
        for(let layer=0;layer<3;layer++)add(name,x+side*490,180+layer*210,z+(i-2)*480,430,35,490,0xb59476);
      }
      return;
    }
    if(kind==='dam'){
      add(name,x,.3,z-350,2200,.5,1500,water);add(name,x,190,z+480,2300,380,260,0x9baba6);
      for(let i=-4;i<=4;i++){add(name,x+i*240,190,z+620,140,350,12,0x8ebec5);add(name,x+i*240,420,z+480,190,80,300,stone);}
      return;
    }
    if(kind==='village'){
      for(let row=0;row<3;row++)for(let col=0;col<4;col++)hall(name,x+(col-1.5)*600,z+(row-1)*650,430,100,330);
      return;
    }
    if(kind==='terracotta'){
      add(name,x,8,z,2200,16,1700,0x9b8f78);
      for(let row=0;row<6;row++)for(let col=0;col<9;col++){
        const dx=(col-4)*190,dz=(row-2.5)*190;
        add(name,x+dx,76,z+dz,55,90,40,0x91795e,'cone');add(name,x+dx,139,z+dz,33,35,33,0x806951,'sphere');
        for(const side of [-1,1])add(name,x+dx+side*13,35,z+dz,15,40,18,0x826f59);
      }
      hall(name,x,z-940,1800,260,260);
      for(const side of [-1,1])for(let i=-2;i<=2;i++)add(name,x+side*1050,150,z+i*330,30,300,30,stone);
      return;
    }
    if(kind==='city-wall'){
      for(const side of [-1,1]){
        add(name,x+side*1100,90,z,60,180,2000,0x878d84);
        for(const dx of [-660,660])add(name,x+dx,90,z+side*1000,880,180,60,0x878d84);
        for(const dx of [-190,190])add(name,x+dx,120,z+side*1000,60,240,150,stone);
        add(name,x,255,z+side*1000,440,60,180,red);add(name,x,335,z+side*1000,600,100,220,roof,'roof');
        for(let i=-8;i<=8;i++){const dx=i*120;if(Math.abs(dx)>220)add(name,x+dx,195,z+side*1000,70,30,70,stone);add(name,x+side*1100,195,z+i*110,70,30,60,stone);}
        for(const dx of [-1000,1000])hall(name,x+dx,z+side*900,240,160,200);
      }
      return;
    }

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
  if(city.extra)feature(city.extra,city.third,0,-3500);
  for(const offset of [-1,1]){
    const x=side*1800,z=offset*4700;
    hall(city.name+'车站',x,z,600,90,220);
    for(let i=0;i<4;i++){add(city.name+'站台',x+(i-1.5)*130,20,z+390,90,40,500,0x9daaaa);}
  }
  return parts;
}

export function tourismSettings(route) {
  return route.cities.map(city=>({...city,columns:city.columns??TOURISM.columns,rows:city.rows??TOURISM.rows,spacing:TOURISM.spacing,plaza:city.plaza??TOURISM.plaza,
    exclusions:[...(city.extra?[{minX:city.x-1500,maxX:city.x+1500,minZ:city.z-5000,maxZ:city.z-2100}]:[]),{minX:city.x+(city.side??Math.sign(city.x))*1800-900,maxX:city.x+(city.side??Math.sign(city.x))*1800+900,minZ:city.z-5500,maxZ:city.z-3800},
      {minX:city.x+(city.side??Math.sign(city.x))*1800-900,maxX:city.x+(city.side??Math.sign(city.x))*1800+900,minZ:city.z+3800,maxZ:city.z+5500},{minX:city.x-(city.plaza??TOURISM.plaza)[0]/2,maxX:city.x+(city.plaza??TOURISM.plaza)[0]/2,minZ:city.z-(city.plaza??TOURISM.plaza)[1]/2,maxZ:city.z+(city.plaza??TOURISM.plaza)[1]/2},
      {minX:city.x-(city.side??Math.sign(city.x))*3400-1500,maxX:city.x-(city.side??Math.sign(city.x))*3400+1500,minZ:city.z-1400,maxZ:city.z+1400}]}));
}
