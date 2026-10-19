import { RUNWAY, isWithinRunway, LANDSCAPE, REGION_BLEND } from './config.js';
import { coastalLandWeight } from './coastal-terrain.js';

export function regionLandAt(world,x,z) {
  if(coastalLandWeight(x,z)<.98)return false;
  if(world.pagodas?.some(tower=>Math.abs(x-tower.x)<tower.width*.7&&Math.abs(z-tower.z)<tower.width*.7))return false;
  const airport=world.route.destination;
  if(isWithinRunway({x,z},airport,800)||isWithinRunway({x,z},RUNWAY,200))return false;
  if(Math.abs(x-airport.x)<REGION_BLEND.airportHalfWidth&&z<airport.threshold+REGION_BLEND.approachClearance&&z>airport.threshold-airport.length-800)return false;
  const city=LANDSCAPE.city;
  if(Math.abs(x)<city.columns*city.spacing/2&&Math.abs(z-city.center[1])<city.rows*city.spacing/2)return false;
  for(const c of world.regionalCities||[])if(Math.abs(x-c.x)<c.columns*c.spacing/2&&Math.abs(z-c.z)<c.rows*c.spacing/2)return false;
  if(world.regionalWaterAt?.(x,z))return false;
  return true;
}

export function regionBelts(route) {
  const end=route.destination.threshold-route.destination.length;
  const belts=[];
  for(let z=-6000;z>end;z-=REGION_BLEND.length)belts.push({z:z-Math.min(REGION_BLEND.length,z-end)/2,length:Math.min(REGION_BLEND.length,z-end),seed:REGION_BLEND.seed+Math.round(-z)});
  return belts;
}
