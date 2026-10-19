// 每局只改变既有对象的位置；模板、实例和碰撞索引在准备阶段建立并复用。
export function freshRunSeed() {
  if(globalThis.crypto?.getRandomValues)return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random()*4294967296);
}

export function varyBuildingSites(sites,seed) {
  for(const site of sites){
    if(!site.shift)continue;
    let state=(Math.imul(Math.round(site.x),73856093)^Math.imul(Math.round(site.z),19349663)^seed)>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    site.shift.x=(random()*2-1)*site.shift.maxX;site.shift.z=(random()*2-1)*site.shift.maxZ;
  }
}

export function attachBuildingShift(box,shift) {
  if(shift){box.shift=shift;box.baseMinX=box.min.x;box.baseMaxX=box.max.x;box.baseMinZ=box.min.z;box.baseMaxZ=box.max.z;}
  return box;
}

export function moveBuildingBox(box) {
  if(!box.shift)return;
  box.min.x=box.baseMinX+box.shift.x;box.max.x=box.baseMaxX+box.shift.x;
  box.min.z=box.baseMinZ+box.shift.z;box.max.z=box.baseMaxZ+box.shift.z;
}
