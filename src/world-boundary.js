import { WORLD_BOUNDARY } from './config.js';
import { smoothRange } from './terrain.js';

function strip(side,B) {
  const lateral=side<2;
  return { lateral, side, start:lateral?B.back-B.width:(B.centerX||0)-B.halfWidth-B.width,
    end:lateral?B.front+B.width:(B.centerX||0)+B.halfWidth+B.width,
    rows:Math.ceil((lateral?B.front-B.back+2*B.width:2*(B.halfWidth+B.width))/B.alongStep) };
}
function vertex(s,column,row,B) {
  const distance=column/B.crossSegments*B.width;
  const along=s.start+(s.end-s.start)*row/s.rows;
  const x=s.lateral?(B.centerX||0)+(s.side===0?-1:1)*(B.halfWidth+distance):along;
  const z=s.lateral?along:s.side===2?B.front+distance:B.back-distance;
  const crest=.84+.16*Math.cos(along*.0011+s.side*.7)**2;
  const shoulder=smoothRange(0,B.width*.7,distance);
  const ribs=1-.075*Math.sin(along*.006+distance*.003)**2*Math.sin(Math.PI*column/B.crossSegments);
  return [x,B.height*crest*shoulder*ribs,z];
}

export function boundaryHeightAt(x,z,B=WORLD_BOUNDARY) {
  if(Math.abs(x-(B.centerX||0))<=B.halfWidth&&z>=B.back&&z<=B.front)return 0;
  let height=0;
  for(let side=0;side<4;side++) {
    const s=strip(side,B),distance=side===0?(B.centerX||0)-x-B.halfWidth:side===1?x-(B.centerX||0)-B.halfWidth:side===2?z-B.front:B.back-z;
    if(distance<=0)continue;
    if(distance>=B.width)return B.height;
    const along=s.lateral?z:x;
    if(along<s.start||along>s.end)continue;
    const gx=distance/B.width*B.crossSegments,gz=(along-s.start)/(s.end-s.start)*s.rows;
    const column=Math.min(B.crossSegments-1,Math.floor(gx)),axis=s.lateral?2:0;
    let row=Math.min(s.rows-1,Math.floor(gz));
    const point=(column,row)=>vertex(s,column,row,B).map(Math.fround);
    let a=point(column,row),c=point(column,row+1);
    if(along<a[axis]&&row>0){row--;a=point(column,row);c=point(column,row+1);}
    else if(along>c[axis]&&row<s.rows-1){row++;a=point(column,row);c=point(column,row+1);}
    const b=point(column+1,row),d=point(column+1,row+1),u=gx-column,v=(along-a[axis])/(c[axis]-a[axis]);
    height=Math.max(height,u+v<=1?a[1]*(1-u-v)+b[1]*u+c[1]*v:b[1]*(1-v)+c[1]*(1-u)+d[1]*(u+v-1));
  }
  return height;
}

export function* boundaryData(side,B=WORLD_BOUNDARY) {
  const s=strip(side,B),stride=B.crossSegments+1,count=stride*(s.rows+1);
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),uv=new Float32Array(count*2),indices=new Uint32Array(s.rows*B.crossSegments*6);
  for(let row=0;row<=s.rows;row++) {
    for(let column=0;column<=B.crossSegments;column++) {
      const i=row*stride+column,p=vertex(s,column,row,B),snow=smoothRange(4000,5700,p[1]),green=1-smoothRange(600,2400,p[1]);
      positions.set(p,i*3);uv.set([p[0]/64,p[2]/64],i*2);
      const shade=.86+.14*Math.cos(p[0]*.013+p[2]*.009);
      colors.set([(0.31+snow*.38-green*.13)*shade,(.28+snow*.42-green*.04)*shade,(.21+snow*.51-green*.1)*shade],i*3);
      if(row&&column){const a=(row-1)*stride+column-1,b=a+stride,o=((row-1)*B.crossSegments+column-1)*6;indices.set([a,b,a+1,a+1,b,b+1],o);}
    }
    yield;
  }
  return {positions,colors,uv,indices};
}
