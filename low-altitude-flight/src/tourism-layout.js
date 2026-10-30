import { TOURISM } from './config.js';
import { heritageHall, heritagePagoda } from './heritage-models.js';

export { sceneryShape, scenerySolid } from './scenery-primitives.js';

export function tourismParts(city) {
  const parts=[],side=city.side??Math.sign(city.x),cx=city.x,cz=city.z;
  const add=(name,x,y,z,width,height,depth,color,shape='box',heading=0,finish)=>parts.push({name,x:cx+x,y,z:cz+z,width,height,depth,color,shape,heading,finish});
  const stone=0xb5b29e,red=0x92533d,roof=0x4d665e,water=0x478b9b;
  const hall=(...args)=>heritageHall(add,...args);
  const pagoda=(name,x,z,levels=4)=>{
    for(const p of heritagePagoda({name,x,z,levels}))add(p.name,p.x,p.y,p.z,p.width,p.height,p.depth,p.color,p.shape,0,p.finish);
  };
  const statue=(name,x,z,scale=1)=>{
    const bronze=city.id==='luoyang'?0xb8ad8e:0xae8c59;
    const piece=(dx,y,dz,w,h,d,color=bronze,shape='sphere',finish=city.id==='luoyang'?'sculpture':'bronze')=>add(name,x+dx*scale,y*scale,z+dz*scale,w*scale,h*scale,d*scale,color,shape,0,finish);
    piece(0,55,0,920,110,800,0xa7a18a,'cylinder','stone');piece(0,130,0,800,45,700,stone,'cylinder','stone');
    for(let row=0;row<2;row++)for(let i=0;i<16;i++){
      const angle=(i+row*.5)/16*Math.PI*2;
      piece(Math.cos(angle)*(345-row*22),160+row*28,Math.sin(angle)*(270-row*18),125,55,90,bronze,'sphere');
    }
    for(const side of [-1,1]){
      piece(side*175,275,90,400,235,350);piece(side*175,350,60,160,170,155);
      piece(side*205,565,5,125,250,145);piece(side*224,430,78,105,155,125);
      piece(side*185,370,170,130,55,90);for(let i=0;i<4;i++)piece(side*185+(i-1.5)*19,357,198,15,17,60);
    }
    piece(0,470,0,430,490,320);piece(0,620,-5,480,200,315);
    for(let i=-3;i<=3;i++)piece(i*33,435-Math.abs(i)*18,145,18,285-Math.abs(i)*20,24,0x947f60);
    piece(0,747,0,145,120,150);piece(0,858,8,222,270,215);
    piece(0,994,-5,174,100,175,0x777963);
    for(let row=0;row<4;row++)for(let i=0;i<9;i++){
      const a=i/9*Math.PI*2;piece(Math.cos(a)*(85-row*8),944+row*21,Math.sin(a)*(83-row*8)-7,26,25,26,0x777963);
    }
    for(const side of [-1,1]){
      piece(side*117,850,8,35,155,58);piece(side*38,889,100,66,16,23);piece(side*38,878,109,52,9,7,0x675e4e);
      piece(side*27,824,111,26,12,15);piece(side*40,916,94,68,18,19);
    }
    piece(0,852,119,29,66,37);piece(0,803,107,64,13,18,0x806c51);piece(0,785,95,49,21,22);
    piece(0,918,112,12,12,9,0xd0bc8b);
  };
  const spacing=(step,extent)=>extent+(step-extent)*TOURISM.passages.scale;
  const feature=(kind,name,x,z)=>{
    if(kind==='buddha'){statue(name,x,z);return;}
    if(kind==='grotto'){
      add(name,x,480,z-300,2500,960,260,0x999783,'box',0,'rock');
      for(let i=-3;i<=3;i++){const h=1100+((i+3)%3)*95;add(name,x+i*350,h/2,z-370-(i%2)*35,470,h,480,0xa7a18a,'rock',i*.025,'rock');}
      for(const side of [-1,1])add(name,x+side*1190,520,z-130,200,1040,470,0x9b9a83,'rock',side*.12,'rock');
      add(name,x,1050,z-35,2550,140,270,0xa6a088,'box',0,'rock');
      for(const dx of [-1220,-1070,-710,-285,285,710,1070,1220])add(name,x+dx,490,z-60,110,980,270,0xa09c86,'box',0,'rock');
      for(const [dx,scale]of [[-900,.22],[-480,.33],[0,.68],[480,.33],[900,.22]]){
        // 大窟前的中央立柱移到侧翼，避免遮住主尊面部。
        add(name,x+dx,500*scale,z-140,650*scale,1000*scale,8,0x424b42,'niche');
        add(name,x+dx,620*scale,z-25,880*scale,820*scale,200*scale,0xc1b295,'arch');
        statue(name,x+dx,z+50,scale);
      }
      for(let row=0;row<2;row++)for(let col=0;col<9;col++){
        const dx=(col-4)*275,dy=815+row*135;
        add(name,x+dx,dy,z+107,125,108,10,0x515d51,'niche');
        add(name,x+dx,dy+18,z+119,168,96,18,0xbab097,'arch');
        add(name,x+dx,dy-5,z+128,40,65,24,0xb3a485,'sphere');
        add(name,x+dx,dy+34,z+129,20,23,18,0xb3a485,'sphere');
      }
      for(let i=0;i<6;i++)add(name,x,6+i*8,z+520-i*60,2350-i*70,12,120,stone);
      return;
    }
    if(kind==='peaks'||kind==='terrace'){
      for(let i=0;i<5;i++){
        const dx=(i-2)*450,h=kind==='peaks'?1550+(i%3)*370:600+(2-Math.abs(i-2))*230;
        add(name,x+dx,h/2,z+(i%2)*360,620,h,850,0xa99f8a,'rock');
        add(name,x+dx,h*.73,z+(i%2)*360,265,h*.08,360,0x687c54,'cone');
      }
      hall(name,x,z-650,420,140,250);return;
    }
    if(kind==='brick-pagoda'){
      const levels=city.id==='kaifeng'?13:7,height=city.id==='kaifeng'?100:165,brick=city.id==='kaifeng'?0x88735a:0xb19370;
      for(let i=0;i<levels;i++){
        const w=580*(1-i/(levels*1.8)),bottom=i*height;
        const shape=city.id==='kaifeng'?'octagon':'box';
        add(name,x,bottom+height/2,z,w,height,w,brick,shape,0,'brick');add(name,x,bottom+height,z,w*1.12,22,w*1.12,brick,shape,0,'brick');
        for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const dx=Math.sin(angle)*w*.47,dz=Math.cos(angle)*w*.47;
          add(name,x+dx,bottom+height*.55,z+dz,w*.17,height*.7,10,0x353d35,'box',angle,'lattice');
          add(name,x+dx,bottom+height*.85,z+dz,w*.22,height*.21,18,0xbba17b,'arch',angle,'brick');
        }
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
      for(let row=0;row<3;row++)for(let col=0;col<4;col++)pagoda(name,x+(col-1.5)*spacing(600,380*1.35),z+(row-1)*spacing(600,380*1.35),2+(row+col)%3);
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
        const h=800+(i%3)*210;add(name,x+side*(490+(i%2)*70),h/2,z+(i-2)*480,500,h,520,0xa16f51,'rock');
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
      for(let row=0;row<3;row++)for(let col=0;col<4;col++)hall(name,x+(col-1.5)*spacing(600,430*1.2),z+(row-1)*spacing(650,330*1.25),430,100,330);
      return;
    }
    if(kind==='terracotta'){
      add(name,x,8,z,2200,16,1700,0x9b8f78);
      for(let row=0;row<6;row++)for(let col=0;col<9;col++){
        const dx=(col-4)*190,dz=(row-2.5)*190;
        const clay=0xa28663;
        add(name,x+dx,79,z+dz,58,95,43,clay,'cone',0,'sculpture');add(name,x+dx,139,z+dz,34,39,33,0x998160,'sphere',0,'sculpture');
        add(name,x+dx,162,z+dz-4,25,13,24,0x655c49,'sphere');add(name,x+dx,140,z+dz+16,7,12,9,clay,'sphere');
        for(const side of [-1,1]){
          add(name,x+dx+side*14,31,z+dz,17,55,20,0x887357);add(name,x+dx+side*14,8,z+dz+8,20,12,37,0x74674e);
          add(name,x+dx+side*34,83,z+dz,18,72,21,clay,'cylinder');add(name,x+dx+side*34,48,z+dz+6,18,19,18,clay,'sphere');
          add(name,x+dx+side*24,117,z+dz,25,18,35,0xb09878,'sphere');
        }
        add(name,x+dx,61,z+dz,59,8,45,0x71634b);
        for(let j=0;j<4;j++)for(let k=-1;k<=1;k++)add(name,x+dx+k*16,76+j*11,z+dz+21,14,9,3,0xb19c7a);
        add(name,x+dx,119,z+dz+13,20,14,8,0x9d8764);
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
        add(name,x,255,z+side*1000,440,60,180,0x878d84);
        add(name,x,200,z+side*1000,380,80,160,stone,'arch');
        const start=parts.length;hall(name,x,z+side*1000,440,160,180);for(let j=start;j<parts.length;j++)parts[j].y+=240;
        for(let i=-8;i<=8;i++)if(Math.abs(i)>2)add(name,x+i*120,175,z+side*970,85,18,25,0xc0b39a);
        for(let i=-8;i<=8;i++){const dx=i*120;if(Math.abs(dx)>220)add(name,x+dx,195,z+side*1000,70,30,70,stone);add(name,x+side*1100,195,z+i*110,70,30,60,stone);}
        for(const dx of [-1000,1000])hall(name,x+dx,z+side*900,240,160,200);
      }
      return;
    }

    if(kind==='pagoda'){pagoda(name,x,z,city.id==='yueyang'?3:5);return;}
    if(kind==='museum'){
      for(let i=0;i<5;i++)add(name,x,10+i*12,z,2000-i*100,20,1050-i*50,stone);
      add(name,x,170,z,1300,260,650,0xb2ad98);add(name,x,340,z,1500,80,800,0xbcb39a,'roof');
      for(const side of [-1,1])for(let i=-4;i<=4;i++){add(name,x+i*140,165,z+side*335,34,250,34,0x918b75,'cylinder');add(name,x+i*140,180,z+side*327,90,190,6,0x3d5a62,'box',0,'glass');}
      for(const dx of [-850,850]){add(name,x+dx,120,z+130,300,200,600,0x9eaa9f);add(name,x+dx,245,z+130,320,50,640,0xa7b9b6);}
      return;
    }
    if(kind==='temple'){
      hall(name,x,z,kind==='museum'?850:620,240,420);hall(name,x-670,z+260,380,130,280);hall(name,x+670,z+260,380,130,280);
      for(const dx of [-480,480])hall(name,x+dx,z+850,300,120,250);
      add(name,x,1,z+500,210,2,1200,stone);
      for(const dx of [-240,240]){add(name,x+dx,45,z+620,60,90,60,0x9b8c65,'cylinder');add(name,x+dx,92,z+620,90,16,90,0x9b8c65,'cylinder');}
      add(name,x,40,z+270,140,70,100,0x8f7550,'cylinder');for(const dx of [-55,55])add(name,x+dx,96,z+270,12,60,12,0x8f7550,'cylinder');
      return;
    }
    if(kind==='garden'||kind==='spring'){
      for(let i=0;i<5;i++){const dx=(i%3-1)*430,dz=(Math.floor(i/3)-.5)*500;add(name,x+dx,1.2,z+dz,300,2,210,water,'cylinder');
        for(const edge of [-1,1])add(name,x+dx+edge*164,12,z+dz,26,24,230,stone);}
      hall(name,x,z-780,460,130,260);pagoda(name,x+650,z-680,2);return;
    }
    if(kind==='cliff'){
      for(let i=0;i<7;i++){const dx=(i%4-1.5)*440,dz=Math.floor(i/4)*600,h=330+(i%3)*180;
        add(name,x+dx,h/2,z+dz,300,h,380,0xb26f4a,'rock');}
      hall(name,x,z-700,420,120,260);return;
    }
    if(kind==='arch'){
      for(const dx of [-520,520])add(name,x+dx,650,z,520,1300,630,0x9d9f8d,'rock');
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
      const offset=9+(90-9)*TOURISM.passages.scale,step=offset*2+18+(280-180-18)*TOURISM.passages.scale;
      for(let i=0;i<5;i++){const dx=(i-2)*step;for(const edge of [-1,1])add(name,x+dx+edge*offset,110,z,18,220,180,0x715b43);
        const start=parts.length;hall(name,x+dx,z,240,110,200);for(let j=start;j<parts.length;j++)parts[j].y+=200;}
      return;
    }
    for(const dx of [-520,520]){add(name,x+dx,150,z,240,300,340,stone);add(name,x+dx,330,z,320,70,420,roof,'roof');}
    add(name,x,330,z,1120,120,340,red);add(name,x,420,z,1250,80,480,roof,'roof');
    if(kind==='fort'){
      for(const side of [-1,1]){
        add(name,x+side*700,90,z+260,140,180,850,0x969c88,'box',0,'brick');
        const start=parts.length;hall(name,x+side*700,z-140,230,130,220);for(let i=start;i<parts.length;i++)parts[i].y+=180;
        for(let i=0;i<8;i++)add(name,x+side*700,195,z-100+i*100,160,30,55,stone);
      }
      for(let i=0;i<9;i++)add(name,x-560+i*140,105,z+640,90,210,150,stone);
      add(name,x,215,z,870,110,250,stone,'arch');
    }
  };
  // 独立门洞、峡谷和桥洞只加宽横向截面；显示与碰撞消费同一份构件变换。
  const addFeature=(kind,name,x,z)=>{
    const start=parts.length;feature(kind,name,x,z);
    if(TOURISM.passages.kinds.includes(kind))for(let i=start;i<parts.length;i++){
      const part=parts[i];part.x=cx+x+(part.x-cx-x)*TOURISM.passages.scale;
      if(!part.heading)part.width*=TOURISM.passages.scale;
    }
  };
  // 主景点在面向航路的内侧广场；副景点位于城区中心，路网与普通楼房共同避让。
  addFeature(city.kind,city.landmark,-side*3400,0);
  addFeature(city.theme,city.second,0,0);
  if(city.extra)addFeature(city.extra,city.third,0,-3500);
  for(const offset of [-1,1]){
    const x=side*1800,z=offset*4700;
    hall(city.name+'车站',x,z,600,90,220);
    for(let i=0;i<4;i++){add(city.name+'站台',x+(i-1.5)*130,20,z+390,90,40,500,0x9daaaa);}
  }
  return parts;
}

export function tourismSettings(route) {
  return route.cities.map(city=>{
    const side=city.side??Math.sign(city.x),plaza=city.plaza??TOURISM.plaza;
    const exclusions=scale=>[
      ...(city.extra?[{minX:city.x-1500*scale,maxX:city.x+1500*scale,minZ:city.z-5000,maxZ:city.z-2100}]:[]),
      {minX:city.x+side*1800-900,maxX:city.x+side*1800+900,minZ:city.z-5500,maxZ:city.z-3800},
      {minX:city.x+side*1800-900,maxX:city.x+side*1800+900,minZ:city.z+3800,maxZ:city.z+5500},
      {minX:city.x-plaza[0]*scale/2,maxX:city.x+plaza[0]*scale/2,minZ:city.z-plaza[1]/2,maxZ:city.z+plaza[1]/2},
      {minX:city.x-side*3400-1500*scale,maxX:city.x-side*3400+1500*scale,minZ:city.z-1400,maxZ:city.z+1400}
    ];
    return {...city,columns:city.columns??TOURISM.columns,rows:city.rows??TOURISM.rows,spacing:TOURISM.spacing,
      plaza:[plaza[0]*TOURISM.passages.scale,plaza[1]],exclusions:exclusions(TOURISM.passages.scale),layoutExclusions:exclusions(1)};
  });
}
