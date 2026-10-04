import { VEHICLES, SIDE_REAR_FRACTION } from './config.js';

const dot=(a,b)=>a.x*b.x+a.y*b.y;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
function box(car,road) {
  const p=road.at(car.s,car.d),v=car.dimensions||VEHICLES[car.rank];
  return {center:{x:p.x,y:p.z},side:{x:Math.cos(p.heading),y:Math.sin(p.heading)},front:{x:Math.sin(p.heading),y:-Math.cos(p.heading)},width:v.width/2,length:v.length*Math.cos(p.pitch||0)/2};
}
const radius=(b,axis)=>Math.abs(dot(b.side,axis))*b.width+Math.abs(dot(b.front,axis))*b.length;
// 连续检测首次接触；侧碰按双方车头位置和目标后半段分类。
export function sweep(player,next,target,targetNext,road) {
  const a=box(player,road), b=box(target,road), an=box(next,road),bn=box(targetNext,road);
  const relative=sub(b.center,a.center),motion=sub(sub(bn.center,b.center),sub(an.center,a.center));
  let enter=0,exit=1,axisIndex=-1;
  const axes=[a.side,a.front,b.side,b.front];
  for(let i=0;i<4;i++) {
    const axis=axes[i],p=dot(relative,axis),v=dot(motion,axis),r=radius(a,axis)+radius(b,axis);
    if(Math.abs(v)<1e-10) { if(Math.abs(p)>r) return null; continue; }
    const t1=(-r-p)/v,t2=(r-p)/v,start=Math.min(t1,t2),end=Math.max(t1,t2);
    if(start>enter+1e-7) {enter=start;axisIndex=i;}
    // 斜向同时触及侧面与端面时，保留侧面接触，再由车头区间决定是否可吞吃。
    else if(Math.abs(start-enter)<1e-7&&start>=0&&(axisIndex<0||Math.abs(dot(axis,a.side))>Math.abs(dot(axes[axisIndex],a.side))))axisIndex=i;
    exit=Math.min(exit,end);
    if(enter>exit+1e-8) return null;
  }
  if(enter>1 || exit<0) return null;
  const t=Math.max(0,enter), contact={x:relative.x+motion.x*t,y:relative.y+motion.y*t};
  const q=dot(contact,a.front),epsilon=.001;
  // 对向车的实际车头与车尾交换，仍按其自身后半段计算。
  const halfLength=dot(b.front,a.front)*b.length*(target.direction<0?-1:1);
  const targetFront=q+halfLength,targetRear=q-halfLength;
  const rearBoundary=targetRear+(targetFront-targetRear)*SIDE_REAR_FRACTION;
  const ahead=a.length>targetFront+epsilon;
  const inRear=a.length>=Math.min(targetRear,rearBoundary)-epsilon&&a.length<=Math.max(targetRear,rearBoundary)+epsilon;
  const side=axisIndex>=0 && Math.abs(dot(axes[axisIndex],a.side))>=.85;
  return {time:t,kind:side&&(ahead||inRear) ? 'side' : 'straight',direction:Math.sign(dot(contact,a.side))||1};
}
export function classify(rank,target,event) {
  if(event.kind==='side') return target.rank<=rank ? 'eat' : 'sideFatal';
  if(target.rank>=rank) return 'frontFatal';
  return target.rank===rank-1 ? 'downgrade' : 'slow';
}
