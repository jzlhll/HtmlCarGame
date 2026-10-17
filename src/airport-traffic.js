import { AIRCRAFT, AIRPORT_TRAFFIC, FLIGHT, worldHorizontalSpeed } from './config.js';
import { segmentBox, transformPoint } from './route-world.js';

const box = (x, y, z, width, height, length) => ({min: {x: x-width/2, y: y-height/2, z: z-length/2}, max: {x: x+width/2, y: y+height/2, z: z+length/2}});

// 独立种子保持同一机场布局可复现；不会消耗地景或空中遭遇的随机流。
export function createAirportTraffic(route) {
  const settings=AIRPORT_TRAFFIC, runway=route.destination, count=settings.planes+settings.trucks;
  let seed=(settings.seed ^ Math.imul(route.id, 2654435761))>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const spacing=(runway.length-settings.entryClearance-settings.endClearance)/count;
  const kinds=Array(settings.planes).fill('aircraft').concat(Array(settings.trucks).fill('truck'));
  for(let i=kinds.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
  return kinds.map((kind,i)=>{
    const heading=(random()-.5)*settings.headingJitter+(random()<.5?0:Math.PI);
    const x=runway.x+(i%2?1:-1)*runway.width*settings.laneFraction+(random()-.5)*runway.width*settings.lateralJitter;
    const position={x,y:runway.elevation,z:runway.threshold-settings.entryClearance-(i+.2+random()*.6)*spacing};
    const size=settings.truckSize;
    // 机身、主翼、尾翼、垂尾与双引擎分开，保留机翼前后可通行的空间。
    const boxes=kind==='truck'?[box(0,size.height/2,0,size.width,size.height,size.length)]:[
      box(0,AIRCRAFT.bodyHeight,0,4.4,4.3,AIRCRAFT.length),
      box(0,3.05,2.1,AIRCRAFT.wingspan,.7,10.2),box(0,4.65,15,13,.7,6),box(0,7.8,16,.5,6.6,7),
      box(-6.2,2.5,-1.2,3.2,3.2,5),box(6.2,2.5,-1.2,3.2,3.2,5)];
    return {id:`airport-${i}`,kind,position,heading,boxes,hit:false,hitAt:0,launch:{x:0,z:0},side:x<runway.x?-1:1};
  });
}

export function airportTrafficHit(actor, world) {
  if(actor.hit)return false;
  const p=actor.position, bound=actor.kind==='truck'?AIRPORT_TRAFFIC.truckSize.length:AIRCRAFT.length;
  const range=world.sweepBounds;
  if(p.x+bound<range.min.x||p.x-bound>range.max.x||p.z+bound<range.min.z||p.z-bound>range.max.z||p.y+12<range.min.y)return false;
  const c=Math.cos(actor.heading),s=Math.sin(actor.heading);
  const local=point=>({x:(point.x-p.x)*c+(point.z-p.z)*s,y:point.y-p.y,z:-(point.x-p.x)*s+(point.z-p.z)*c});
  for(const sample of world.bodySweep){
    const from=local(sample.from),to=local(sample.to);
    for(const part of actor.boxes)if(segmentBox(from,to,part,sample.radius))return true;
  }
  return false;
}

export function hitAirportTruck(actor, aircraft, elapsed) {
  actor.hit=true;actor.hitAt=elapsed;
  const kick=AIRPORT_TRAFFIC.truckLaunch, horizontal=Math.hypot(aircraft.velocity.x,aircraft.velocity.z);
  actor.launch.x=worldHorizontalSpeed(aircraft.velocity.x)*kick.speedTransfer+(horizontal?aircraft.velocity.x/horizontal:0)*kick.forward+actor.side*kick.side;
  actor.launch.z=worldHorizontalSpeed(aircraft.velocity.z)*kick.speedTransfer+(horizontal?aircraft.velocity.z/horizontal:-1)*kick.forward;
  for(const axis of ['x','y','z'])aircraft.velocity[axis]*=AIRPORT_TRAFFIC.truckSpeedRetention;
  aircraft.airspeed=Math.hypot(aircraft.velocity.x,aircraft.velocity.y,aircraft.velocity.z)*FLIGHT.kmhPerMps;
  aircraft.verticalSpeed=aircraft.velocity.y*FLIGHT.kmhPerMps;
}

export function stoppedOnRunway(aircraft, route) {
  if(!aircraft.landed||!aircraft.onGround||aircraft.airspeed>route.parkedSpeed)return false;
  const runway=route.destination;
  for(const x of [-AIRCRAFT.wingspan/2,AIRCRAFT.wingspan/2])for(const z of [-AIRCRAFT.length/2,AIRCRAFT.length/2]){
    const p=transformPoint([x,0,z],aircraft);
    if(Math.abs(p.x-runway.x)>runway.width/2||p.z>runway.threshold||p.z<runway.threshold-runway.length)return false;
  }
  return true;
}
