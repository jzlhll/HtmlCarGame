import { VEHICLES, MAX_RANK, ARMORED_RANK, VEHICLE_CONTACT, SIDE_BOUNCE } from './config.js';

const roadPoint={};
const collisionBoxes=Array.from({length:6},()=>({center:{x:0,y:0},side:{x:0,y:0},front:{x:0,y:0},width:0,length:0}));
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const add=(a,b,k=1)=>({x:a.x+b.x*k,y:a.y+b.y*k});
function box(car,road,out) {
  const p=road.at(car.s,car.d,car.route,roadPoint),v=car.dimensions||VEHICLES[car.rank],heading=p.heading+(car.yaw||0);
  out.center.x=p.x;out.center.y=p.z;out.side.x=Math.cos(heading);out.side.y=Math.sin(heading);out.front.x=Math.sin(heading);out.front.y=-Math.cos(heading);
  out.width=v.width/2;out.length=v.length*Math.cos(p.pitch||0)/2;return out;
}
function contactBox(from,to,time,out){
  out.center.x=from.center.x+(to.center.x-from.center.x)*time;out.center.y=from.center.y+(to.center.y-from.center.y)*time;
  out.side.x=from.side.x;out.side.y=from.side.y;out.front.x=from.front.x;out.front.y=from.front.y;out.width=from.width;out.length=from.length;
}
const radius=(b,axis)=>Math.abs(dot(b.side,axis))*b.width+Math.abs(dot(b.front,axis))*b.length;
// 在首次接触面上裁剪另一辆车的边，取得真实接触点，避免用两车中心代替擦角位置。
function contactPoint(a,b,index){
  const reference=index<2?a:b,incident=index<2?b:a,side=index%2===0;
  const axis=side?reference.side:reference.front,tangent=side?reference.front:reference.side;
  const sign=Math.sign(dot(sub(incident.center,reference.center),axis))||1;
  const normal={x:axis.x*sign,y:axis.y*sign};
  const face=add(reference.center,normal,side?reference.width:reference.length),extent=side?reference.length:reference.width;
  const incidentSide=Math.abs(dot(normal,incident.side))>=Math.abs(dot(normal,incident.front));
  const incidentAxis=incidentSide?incident.side:incident.front,incidentTangent=incidentSide?incident.front:incident.side;
  const edge=add(incident.center,incidentAxis,-(Math.sign(dot(normal,incidentAxis))||1)*(incidentSide?incident.width:incident.length));
  const start=add(edge,incidentTangent,-(incidentSide?incident.length:incident.width)),end=add(edge,incidentTangent,incidentSide?incident.length:incident.width);
  const delta=sub(end,start),offset=sub(start,face);
  let low=0,high=1;
  for(const [direction,min,max]of [[tangent,-extent,extent],[normal,-Infinity,1e-6]]){
    const position=dot(offset,direction),speed=dot(delta,direction);
    if(Math.abs(speed)<1e-10){if(position<min-1e-6||position>max+1e-6)return null;continue;}
    const t1=(min-position)/speed,t2=(max-position)/speed;
    low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
    if(low>high+1e-7)return null;
  }
  return add(start,delta,(low+high)/2);
}
function endCoreOverlap(a,b,index){
  const relative=sub(b.center,a.center),axis=index<2?a.side:b.side;
  const aEnd=add(a.center,a.front,(Math.sign(dot(relative,a.front))||1)*a.length);
  const bEnd=add(b.center,b.front,-(Math.sign(dot(relative,b.front))||1)*b.length);
  const distance=Math.abs(dot(sub(bEnd,aEnd),axis));
  const extent=(Math.abs(dot(a.side,axis))*a.width+Math.abs(dot(b.side,axis))*b.width)*VEHICLE_CONTACT.endCoreFraction;
  // 中央区域按端面投影判断，避免倾斜车头先接触的尖角让正对车尾的撞击变成无伤擦过。
  return extent-distance>1e-6;
}
// 连续检测首次接触；侧面、端面中央和擦角分别处理，不再限制车头的纵向位置。
export function sweep(player,next,target,targetNext,road) {
  const a=box(player,road,collisionBoxes[0]),b=box(target,road,collisionBoxes[1]),an=box(next,road,collisionBoxes[2]),bn=box(targetNext,road,collisionBoxes[3]);
  const relative=sub(b.center,a.center),motion=sub(sub(bn.center,b.center),sub(an.center,a.center));
  let enter=0,exit=1,axisIndex=-1,minDepth=Infinity,overlapAxis=0;
  for(let i=0;i<4;i++) {
    const axis=i===0?a.side:i===1?a.front:i===2?b.side:b.front,p=dot(relative,axis),v=dot(motion,axis),r=radius(a,axis)+radius(b,axis),depth=r-Math.abs(p);
    if(depth<minDepth){minDepth=depth;overlapAxis=i;}
    if(Math.abs(v)<1e-10) {if(depth<0)return null;continue;}
    const t1=(-r-p)/v,t2=(r-p)/v,start=Math.min(t1,t2),end=Math.max(t1,t2);
    if(start>enter+1e-7){enter=start;axisIndex=i;}
    // 同时接触侧面和端面时保留侧面候选，随后由实际重叠长度区分侧碰与擦角。
    else if(Math.abs(start-enter)<1e-7&&start>=0&&(axisIndex<0||i%2===0&&axisIndex%2!==0))axisIndex=i;
    exit=Math.min(exit,end);
    if(enter>exit+1e-8)return null;
  }
  if(enter>1||exit<0)return null;
  const time=Math.max(0,enter),relativeContact=add(relative,motion,time);
  const direction=Math.sign(dot(relativeContact,a.side))||1;
  // 已有穿透先分离，不能凭缺失的首次接触面判成追尾或奖励吞吃。
  if(minDepth>1e-7)return {time:0,kind:'overlap',direction};
  if(axisIndex<0)axisIndex=overlapAxis;
  const axis=axisIndex===0?a.side:axisIndex===1?a.front:axisIndex===2?b.side:b.front,normalSign=Math.sign(dot(relativeContact,axis))||1;
  if(-dot(motion,axis)*normalSign<=1e-10)return null;
  const at=collisionBoxes[4],bt=collisionBoxes[5];
  // 接触计算同步完成，包围盒不随事件返回，可安全复用独立的扫掠终点与接触盒。
  contactBox(a,an,time,at);contactBox(b,bn,time,bt);
  const contact=contactPoint(at,bt,axisIndex);
  let kind='graze';
  if(axisIndex%2===0){
    const center=dot(relativeContact,a.front),extent=radius(b,a.front);
    const overlap=Math.min(a.length,center+extent)-Math.max(-a.length,center-extent);
    if(overlap>=Math.min(a.length,b.length)*2*VEHICLE_CONTACT.sideOverlapFraction)kind='side';
  }else if(endCoreOverlap(at,bt,axisIndex))kind='straight';
  return {time,kind,direction,contact};
}
const roadCoordinates={at:(s,d,route,out)=>{out.x=d;out.z=-s;out.heading=0;out.pitch=0;return out;}};
// 施工占用沿道路弧长延伸，避免长矩形在弯道上切入邻道或漏掉封闭区。
export function roadworkContact(start,finish,site){return sweep(start,finish,site,site,roadCoordinates);}
// 仅沿道路横向分离，不增加行驶距离，不改动车流轨迹，也不提供全局无敌。
export function separation(player,target,road,direction){
  const a=box(player,road,collisionBoxes[0]),b=box(target,road,collisionBoxes[1]),heading=road.at(player.s,player.d,player.route,roadPoint).heading;
  const axis={x:Math.cos(heading),y:Math.sin(heading)},distance=dot(sub(b.center,a.center),axis);
  return -(Math.sign(distance)||direction||1)*Math.max(0,radius(a,axis)+radius(b,axis)-Math.abs(distance)+VEHICLE_CONTACT.separationGap);
}
export function classify(rank,target,event,nitroActive=false) {
  if(event.kind==='overlap'||event.kind==='graze')return 'graze';
  if(event.kind==='side')return target.rank>rank?'sideFatal':target.rank===rank&&rank>1&&!nitroActive?'bounce':'eat';
  if(target.rank===ARMORED_RANK&&rank===MAX_RANK&&nitroActive)return 'armorDowngrade';
  if(target.rank>rank)return 'frontFatal';
  if(target.rank<rank&&nitroActive)return 'eat';
  if(target.rank===rank&&nitroActive)return 'knockaway';
  if(target.rank===rank&&rank===1)return 'bicycleRearFatal';
  return target.rank===rank?'downgrade':'knockaway';
}
// 保存初始横向速度与已用时间，主弹开和收尾均线性减速；积分不依赖帧率。
export function startBounce(car,direction){
  const settings=SIDE_BOUNCE,distance=VEHICLES[car.rank].width*settings.widthMultiplier;
  car.sidePush=direction*2*distance/(settings.impactSeconds*(1+settings.settleSpeedRatio));
  car.sidePushTime=0;
}
function bounceIntegral(t){
  const settings=SIDE_BOUNCE,main=Math.min(t,settings.impactSeconds),tail=Math.min(Math.max(0,t-settings.impactSeconds),settings.settleSeconds);
  return main-(1-settings.settleSpeedRatio)*main*main/(2*settings.impactSeconds)
    +settings.settleSpeedRatio*(tail-tail*tail/(2*settings.settleSeconds));
}
export function bounceTravel(car,dt){
  if(!car.sidePush)return 0;
  const time=car.sidePushTime||0;
  return car.sidePush*(bounceIntegral(time+dt)-bounceIntegral(time));
}
export function advanceBounce(car,dt){
  const distance=bounceTravel(car,dt);
  if(car.sidePush){
    car.sidePushTime=(car.sidePushTime||0)+dt;
    if(car.sidePushTime>=SIDE_BOUNCE.impactSeconds+SIDE_BOUNCE.settleSeconds-1e-10){car.sidePush=0;car.sidePushTime=0;}
  }
  return distance;
}
