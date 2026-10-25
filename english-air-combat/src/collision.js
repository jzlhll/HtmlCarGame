// 弹体沿竖直线段扫掠，同时考虑目标本步的纵向运动。
export function sweptHit(projectile,targetX,previousY,targetY,width,height){
  if(Math.abs(projectile.x-targetX)>width/2)return null;
  const from=projectile.previousY-previousY,to=projectile.y-targetY;
  if(Math.abs(from)<=height/2)return 0;
  if(from===to)return null;
  const enter=(from>0?height/2:-height/2),time=(enter-from)/(to-from);
  return time>=0&&time<=1?time:null;
}

// 在相对坐标中扫掠两个移动矩形，避免玩家横移穿过补给时漏领。
export function sweptOverlap(fromX,fromY,toX,toY,halfWidth,halfHeight){
  let enter=0,exit=1;
  for(const [from,to,extent] of [[fromX,toX,halfWidth],[fromY,toY,halfHeight]]){
    const delta=to-from;if(delta===0){if(Math.abs(from)>extent)return false;continue;}
    const a=(-extent-from)/delta,b=(extent-from)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return false;
  }
  return true;
}
