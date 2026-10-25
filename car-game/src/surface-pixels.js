import { random } from './config.js';

const cowSpots=[[.16,.27,.13,.18],[.46,.61,.16,.22],[.77,.35,.18,.15],[.91,.78,.12,.18]];
// 固定种子和行顺序保持图案一致，每四行允许让出主线程。
export function* generateSurfacePixels(kind,size){
  const data=new Uint8Array(size*size*4);
  const seed=7319+[...kind].reduce((sum,c)=>sum+c.charCodeAt(0),0),rng=random(seed);
  const cells=kind==='skin'||kind==='foam'?32:8,sites=['skin','stone','lava','foam'].includes(kind)?Array.from({length:cells*cells},(_,i)=>[(i%cells+.2+rng()*.6)/cells,(Math.floor(i/cells)+.2+rng()*.6)/cells]):null;
  // 周期噪声在贴图边缘连续；大尺度结构、颗粒与细沟分别控制，不靠提高凹凸强度制造质感。
  const noise=(x,y,frequency)=>{
    const px=x*frequency,py=y*frequency,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,tx=fx*fx*(3-2*fx),ty=fy*fy*(3-2*fy);
    const hash=(a,b)=>{let h=Math.imul((a%frequency+frequency)%frequency+seed,374761393)^Math.imul((b%frequency+frequency)%frequency,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
    const top=hash(ix,iy)*(1-tx)+hash(ix+1,iy)*tx,bottom=hash(ix,iy+1)*(1-tx)+hash(ix+1,iy+1)*tx;return top*(1-ty)+bottom*ty;
  };
  for(let y=0;y<size;y++){
  for(let x=0;x<size;x++){
    const u=x/size,v=y/size,angle=u*Math.PI*2,phase=v*Math.PI*2;
    const broad=noise(u,v,4),medium=noise(u,v,16),fine=noise(u,v,64),grain=rng();
    let value=217+(broad-.5)*22+(fine-.5)*18,r=1,g=1,b=1;
    if(kind==='asphalt'){value=108+(broad-.5)*15+(medium-.5)*20+(grain-.5)*53;if(grain>.97)value+=55;r=.95;g=.98;}
    if(kind==='ground'){value=185+(broad-.5)*34+(medium-.5)*32+(grain-.5)*37;r=1.02;g=.99;b=.91;}
    if(kind==='foliage'){
      const midrib=Math.exp(-Math.abs(u-.5)*110),veins=Math.max(0,Math.cos((v-Math.abs(u-.5)*.65)*Math.PI*20))**12;
      value=204+(medium-.5)*27+midrib*24+veins*13;r=.93;g=1;b=.88;
    }
    if(kind==='bark'){const furrow=Math.sin(angle*19+Math.sin(phase*2)*.9+medium*1.3);value=158+furrow*30+(fine-.5)*27-(furrow<-.65?28:0);r=1.02;g=.97;b=.91;}
    if(kind==='wood'){value=191+Math.sin(phase*25+Math.sin(angle)*1.6+medium*.8)*16+(fine-.5)*20;}
    if(kind==='hide'||kind==='cow'){value=229+(broad-.5)*9+(fine-.5)*12+Math.sin(angle*79+phase*7)*3;}
    if(kind==='cow')for(const [cx,cy,rx,ry]of cowSpots){const dx=u-cx+Math.sin(phase*5+angle*3)*.018,dy=v-cy+Math.sin(angle*6-phase*2)*.023;if((dx/rx)**2+(dy/ry)**2<1)value=39+(fine-.5)*13;}
    if(kind==='rubber'){const tread=Math.sin(angle*23+Math.abs(Math.sin(phase*2))*2);value=156+(fine-.5)*18-(tread>.65?34:0);}
    if(kind==='water'){value=212+Math.sin(angle*9+Math.sin(phase*4))*12+Math.sin(phase*17-angle*3)*6+(fine-.5)*9;r=.96;b=1.02;}
    if(kind==='ice'){value=222+(broad-.5)*25+(medium-.5)*10+Math.max(0,Math.sin(angle*7+Math.sin(phase*5)*2))**25*24;r=.94;g=.99;}
    if(sites){
      let first=Infinity,second=Infinity;
      for(let row=-1;row<=1;row++)for(let column=-1;column<=1;column++){const [sx,sy]=sites[((Math.floor(v*cells)+row+cells)%cells)*cells+(Math.floor(u*cells)+column+cells)%cells];const ax=Math.abs(u-sx),ay=Math.abs(v-sy),dx=Math.min(ax,1-ax),dy=Math.min(ay,1-ay),distance=dx*dx+dy*dy;if(distance<first){second=first;first=distance;}else if(distance<second)second=distance;}
      const edge=Math.sqrt(second)-Math.sqrt(first);
      if(kind==='foam'){const walls=Math.exp(-edge*2400);value=38+walls*180+Math.max(0,broad-.34)*115+(fine-.5)*18;}
      if(kind==='skin'){const groove=Math.exp(-edge*3000);value=215+(broad-.5)*28+(fine-.5)*10-groove*19+Math.min(1,edge*150)*9;}
      if(kind==='stone'){value=177+(broad-.5)*48+(medium-.5)*23+(fine-.5)*30-Math.exp(-edge*1200)*23;r=1.01;g=.99;b=.96;}
      if(kind==='lava'){const heat=Math.exp(-edge*430);value=48+heat**1.7*205+(broad-.5)*16;}
    }
    const i=(y*size+x)*4;data[i]=Math.max(0,Math.min(255,Math.round(value*r)));data[i+1]=Math.max(0,Math.min(255,Math.round(value*g)));data[i+2]=Math.max(0,Math.min(255,Math.round(value*b)));data[i+3]=255;
  }
  if(y%4===3)yield;
  }
  return {data,width:size,height:size};
}
