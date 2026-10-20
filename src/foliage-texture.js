import { FOLIAGE_TEXTURE } from './config.js';
import { foliageSourcePixels } from './foliage-source.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// 四种枝叶图集由同一Worker逐行绘制，背景透明，含叶缘、叶脉与针叶。
export function* foliagePixels(size){
  const source=yield {wait:foliageSourcePixels(size)};
  if(source){
    // 保留照片叶脉和明暗，降低饱和度，交由树种实例色统一季相与色调。
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const i=(y*size+x)*4,light=source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722,value=186+light*.26;
        source[i]=value;source[i+1]=value*1.015;source[i+2]=value*.94;
      }yield;
    }
    return source;
  }
  const data=new Uint8Array(size*size*4),tile=size/2;let state=FOLIAGE_TEXTURE.seed,minX=0,minY=0,maxX=size,maxY=size;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const put=(x,y,r,g,b,alpha)=>{
    if(x<minX||y<minY||x>=maxX||y>=maxY||alpha<=0)return;
    const i=(y*size+x)*4,old=data[i+3]/255,a=clamp(alpha,0,1),next=a+old*(1-a);
    data[i]=(r*a+data[i]*old*(1-a))/next;data[i+1]=(g*a+data[i+1]*old*(1-a))/next;data[i+2]=(b*a+data[i+2]*old*(1-a))/next;data[i+3]=next*255;
  };
  function* stroke(x0,y0,x1,y1,width,value){
    const dx=x1-x0,dy=y1-y0,length=dx*dx+dy*dy;
    for(let y=Math.floor(Math.min(y0,y1)-width-1);y<=Math.ceil(Math.max(y0,y1)+width+1);y++){
      for(let x=Math.floor(Math.min(x0,x1)-width-1);x<=Math.ceil(Math.max(x0,x1)+width+1);x++){
        const t=clamp(((x-x0)*dx+(y-y0)*dy)/(length||1),0,1),distance=Math.hypot(x-x0-t*dx,y-y0-t*dy);
        put(x,y,value*.92,value,value*.72,clamp(width+.6-distance,0,1));
      }yield;
    }
  }
  function* leaf(cx,cy,length,width,angle,fan=false){
    const c=Math.cos(angle),s=Math.sin(angle),shade=185+random()*58,radius=length+width+2;
    for(let y=Math.floor(cy-radius);y<=Math.ceil(cy+radius);y++){
      for(let x=Math.floor(cx-radius);x<=Math.ceil(cx+radius);x++){
        const dx=x-cx,dy=y-cy,u=(dx*c+dy*s)/length,v=-dx*s+dy*c;
        if(u<0||u>1)continue;
        const spread=fan?Math.sin(u*Math.PI*.65)*width:Math.sin(u*Math.PI)**.72*width;
        const edge=spread*(1+.055*Math.sin(u*77+v*.3))-Math.abs(v),alpha=clamp(edge+.6,0,1)*clamp(u*length+.3,0,1)*clamp((1-u)*length+.5,0,1);
        if(alpha<=0)continue;
        const vein=fan?Math.abs(Math.sin(Math.atan2(v,u*length+.1)*19)):Math.min(Math.abs(v)/1.15,Math.abs(Math.sin(u*34+Math.abs(v)*.35)));
        const light=shade+12*(u-.5)+8*Math.cos(v/(width||1)*2)-(vein<.18?16:0);
        put(x,y,light*.96,light,light*.82,alpha);
      }yield;
    }
  }
  for(let kind=0;kind<4;kind++){
    const ox=kind%2*tile,oy=Math.floor(kind/2)*tile;minX=ox+3;minY=oy+3;maxX=ox+tile-3;maxY=oy+tile-3;const px=v=>ox+v*tile,py=v=>oy+v*tile;
    // 主枝有轻微弯曲，分枝避免形成等距直线栅格。
    let previous=[px(.5),py(.08)];
    for(let i=1;i<=8;i++){const p=[px(.5+Math.sin(i*.7)*.025),py(.08+i*.10)];yield* stroke(...previous,...p,Math.max(.65,2-i*.15),105);previous=p;}
    if(kind===3){
      for(let row=0;row<12;row++)for(const side of [-1,1]){
        const y=.18+row*.055,x=.5+Math.sin(row*.7)*.025,tipX=x+side*(.20-(row/12)*.07),tipY=y+.12;
        yield* stroke(px(x),py(y),px(tipX),py(tipY),.8,115);
        for(let j=0;j<7;j++){
          const t=(j+.3)/7,bx=x+(tipX-x)*t,by=y+(tipY-y)*t;
          yield* stroke(px(bx),py(by),px(bx+side*(.04+random()*.055)),py(by+.06+random()*.045),.7+random()*.35,185+random()*52);
        }
      }
    }else{
      const count=kind===1?14:kind===2?30:24;
      for(let i=0;i<count;i++){
        const t=i/count,side=i%2?-1:1,y=.16+t*.66,x=.5+Math.sin(t*8)*.025;
        const reach=kind===1?.07:.045,bx=x+side*reach,by=y+.018;
        const angle=kind===2?(side<0?2.7:.45)+(random()-.5)*.35:(side<0?2.55:.55)+(random()-.5)*.38;
        yield* stroke(px(x),py(y),px(bx),py(by),.75,120);
        yield* leaf(px(bx),py(by),tile*(kind===1?.22:kind===2?.22:.23)*( .78+random()*.30),tile*(kind===1?.16:kind===2?.023:.07),angle,kind===1);
      }
    }yield 'boundary';
  }
  return data;
}
