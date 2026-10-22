// 古建共用台基、廊柱、斗拱、栏杆与曲面屋顶，细节按模型尺寸缩放。
export function heritageHall(add,name,x,z,w=480,h=190,d=320){
  const stone=0xc0b7a3,red=0x874631,roof=0x425d57,wood=0x473e2e;
  const base=Math.min(28,h*.12),columns=7;
  for(let i=0;i<3;i++)add(name,x,base*(i+.5)/3,z,w*(1.08-i*.035),base/3,d*(1.12-i*.04),stone);
  add(name,x,(h+base)/2,z,w*.88,h-base,d*.82,0xb7a58a,'box',0,'plaster');
  for(const side of [-1,1]){
    for(let i=0;i<columns;i++){
      const dx=(i/(columns-1)-.5)*w*.88;
      add(name,x+dx,(h+base)/2,z+side*d*.46,w*.022,h-base,d*.035,red,'cylinder');
      add(name,x+dx,base+5,z+side*d*.46,w*.043,10,d*.065,stone,'cylinder');
      for(let j=0;j<3;j++)add(name,x+dx,h-10+j*9,z+side*(d*.43+j*d*.025),w*(.045+j*.018),8,d*.07,red);
      if(i<columns-1)add(name,x+dx+w*.073,h*.52,z+side*d*.416,w*.105,h*.57,4,wood,'box',0,'lattice');
    }
    add(name,x,h*.83,z+side*d*.47,w*.99,h*.07,d*.05,red);
    for(let i=-2;i<=2;i++)add(name,x+side*w*.445,h*.5,z+i*d*.15,w*.016,h*.7,d*.085,wood,'box',0,'lattice');
  }
  add(name,x,h+55,z,w*1.2,110,d*1.25,roof,'roof');
  add(name,x,h+107,z,w*.72,7,d*.028,0xa39b78,'cylinder',0);
  for(const side of [-1,1]){
    add(name,x+side*w*.37,h+114,z,w*.035,24,d*.05,roof,'sphere');
    for(let i=0;i<4;i++)add(name,x+side*w*(.48-i*.043),h+24+i*7,z+d*.53,w*.018,12,d*.035,0xb6aa82,'sphere');
  }
  for(let i=0;i<6;i++)add(name,x,base*(i+.5)/6,z+d*.47+(5-i)*d*.025,w*.33,base/6,d*.065,stone);
  add(name,x,h*.79,z+d*.448,w*.25,h*.13,5,0x283c35);
  for(let i=0;i<4;i++)add(name,x+(i-1.5)*w*.047,h*.79,z+d*.46,w*.026,h*.056,3,0xc5b176);
}

export function heritagePagoda({x=0,z=0,floor=0,name,levels=5,width=380,height=levels*180,eaves=1.35,hero=false,supportHeight=0}){
  const parts=[],add=(dx,y,dz,w,h,d,color,shape='box',finish)=>parts.push({name,x:x+dx,y:floor+y,z:z+dz,width:w,height:h,depth:d,color,shape,finish});
  const stone=hero?0xc9b88d:0xb4ac93,red=0x8f4934,tile=hero?0xd6aa3e:0x4b645b,levelHeight=height/levels;
  if(supportHeight)add(0,-supportHeight/2,0,width*1.15,supportHeight,width*1.15,0x93978a);
  for(let i=0;i<3;i++)add(0,i*3+1.5,0,width*(1.2-i*.07),3,width*(1.2-i*.07),stone);
  for(let i=0;i<levels;i++){
    const w=width*(1-i*.07),bottom=i*levelHeight,body=levelHeight*(i===levels-1?.84:.9),roofHeight=levelHeight*(i===levels-1?.16:.2);
    add(0,bottom+body*.5,0,w,body,w,stone,'box','plaster');
    for(const side of [-1,1]){
      for(let j=-2;j<=2;j++){
        const dx=j*w*.19;
        add(dx,bottom+body*.5,side*w*.505,w*.022,body*.9,w*.022,red,'cylinder');
        add(side*w*.505,bottom+body*.5,dx,w*.022,body*.9,w*.022,red,'cylinder');
        add(dx,bottom+body*.95,side*w*.56,w*.1,levelHeight*.055,w*.13,red);
        if(j>-2&&j<2){
          add(dx,bottom+body*.51,side*w*.502,w*.115,body*.5,2,0x34453d,'box','lattice');
          add(side*w*.502,bottom+body*.51,dx,2,body*.5,w*.115,0x34453d,'box','lattice');
        }
      }
      add(0,bottom+body*.1,side*w*.575,w*1.17,levelHeight*.025,w*.022,red);
      for(let j=-4;j<=4;j++){
        add(j*w*.13,bottom+body*.19,side*w*.575,w*.018,body*.18,w*.018,red);
        add(side*w*.575,bottom+body*.19,j*w*.13,w*.018,body*.18,w*.018,red);
      }
      add(side*w*.575,bottom+body*.1,0,w*.022,levelHeight*.025,w*1.17,red);
    }
    add(0,bottom+body+roofHeight*.5,0,w*eaves,roofHeight,w*eaves,tile,'roof',hero?'gold':'tile');
    add(0,bottom+body+roofHeight,0,w*.58,levelHeight*.028,w*.045,tile);
    for(const side of [-1,1])add(side*w*.5,bottom+body+roofHeight*.63,side*w*.5,w*.035,levelHeight*.11,w*.035,tile,'sphere');
  }
  add(0,height+13,0,width*.09,26,width*.09,tile,'cone',hero?'gold':'tile');
  for(let i=0;i<3;i++)add(0,height+26+i*6,0,width*(.07-i*.015),4,width*(.07-i*.015),tile,'sphere',hero?'gold':'tile');
  return parts;
}
