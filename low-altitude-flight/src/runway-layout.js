// 米字机场的可见轮廓、接地范围和归正航向共用四条交叉跑道。
const straight=[0];
export function runwayCenter(runway){return {x:runway.x??0,z:(runway.threshold??runway.startOffset)-runway.length/2};}

export function isWithinRunway(position,runway,margin=0){
  const centerZ=(runway.threshold??runway.startOffset)-runway.length/2,dx=position.x-(runway.x??0),dz=position.z-centerZ;
  const halfLength=runway.length/2+margin,halfWidth=runway.width/2+margin;
  if(Math.abs(dx)>halfLength+halfWidth||Math.abs(dz)>halfLength+halfWidth)return false;
  for(const heading of runway.headings??straight){
    const c=Math.cos(heading),s=Math.sin(heading);
    if(Math.abs(c*dx+s*dz)<=halfWidth+1e-9&&Math.abs(-s*dx+c*dz)<=halfLength+1e-9)return true;
  }
  return false;
}

export function nearestRunway(position,runway,heading=0){
  const center=runwayCenter(runway),dx=position.x-center.x,dz=position.z-center.z;
  let best,bestDistance=Infinity,score=Infinity;
  for(const axis of runway.headings??straight){
    const c=Math.cos(axis),s=Math.sin(axis),across=c*dx+s*dz,along=-s*dx+c*dz;
    const side=Math.max(0,Math.abs(across)-runway.width/2),end=Math.max(0,Math.abs(along)-runway.length/2);
    const distance=Math.hypot(side,end);
    for(const direction of [axis,axis+Math.PI]){
      // 从跑道外臂接地时朝中央归正，避免被自动带向近在身后的跑道端。
      if(Math.abs(along)>runway.width/2/Math.tan(Math.PI/8)&&along*(direction===axis?1:-1)<0)continue;
      const delta=Math.atan2(Math.sin(direction-heading),Math.cos(direction-heading)),value=Math.abs(delta);
      if(distance<bestDistance-1e-9||Math.abs(distance-bestDistance)<1e-9&&value<score-1e-9){bestDistance=distance;score=value;best={heading:heading+delta,delta,across,along,side,end,distance};}
    }
  }
  return best;
}

// 相邻45度跑道边缘相交于凹角，24点轮廓精确等于四个矩形的并集。
export function runwayOutline(runway,width=runway.width,length=runway.length){
  const points=[],half=width/2,reach=length/2,corner=half/Math.tan(Math.PI/8);
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,c=Math.cos(angle),s=Math.sin(angle);
    for(const [along,across]of [[reach,-half],[reach,half],[corner,half]])points.push({x:c*along-s*across,z:s*along+c*across});
  }
  return points;
}
