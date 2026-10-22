import { buildingCollisionParts } from './building-details.js';
import { streetCarBox } from './city-street-layout.js';
import { LOOP_WORLD, LANDSCAPE, TREE_CONTACT, TREE_HEIGHTS, WORLD_HEIGHT, TOURISM } from './config.js';
import { terrainNoise, smoothRange } from './terrain.js';
import { TreeField } from './tree-contact.js';
import { treeProfiles } from './tree-species.js';
import { attachBuildingShift, moveBuildingBox } from './world-variation.js';
import { parkingParts } from './district-layout.js';

const sweepSides=['from','to'];
const treeReach=Math.max(...treeProfiles.map(profile=>(profile.tall?TREE_HEIGHTS.flat[1]:profile.height[1]/WORLD_HEIGHT.displayScale)*profile.width[1]*profile.radius));

export function loopRiverZ(x, variant) {
  return Math.sin(x * 0.00047 + variant * 0.9) * 840 + Math.sin(x * 0.00113 + variant) * 210 + (variant === 2 ? 4750 : 0);
}

// 有限模板由准备流程生成并持久缓存；游玩时只查询网格与移动已存在的区块。
export function* loopTerrainData(variant) {
  const n = LOOP_WORLD.segments, size = LOOP_WORLD.tileSize, half = size / 2, seed = LOOP_WORLD.seed + variant * 101;
  const positions = new Float32Array((n + 1) ** 2 * 3), colors = new Float32Array(positions.length), uv = new Float32Array((n + 1) ** 2 * 2), indices = new Uint32Array(n*n*6);
  const peaks=Array.from({length:18},(_,i)=>({x:Math.sin(i*17.31+seed)*4600,z:Math.cos(i*9.17+seed)*4600,rx:280+(i%5)*110,rz:380+(i%4)*150,phase:i*2.399963}));
  for (let row = 0; row <= n; row++) {
    for (let column = 0; column <= n; column++) {
      const x = column / n * size - half, z = row / n * size - half, index = row * (n + 1) + column;
      const warp = terrainNoise(x / 1700, z / 1700, seed) * 0.9;
      const broad = terrainNoise(x / 2200 + warp, z / 2200 - warp, seed + 1);
      const ridge = 1 - Math.abs(terrainNoise(x / 900 + warp, z / 900, seed + 2) * 2 - 1);
      const gullies = terrainNoise(x / 210, z / 210, seed + 3);
      const fine = terrainNoise(x / 70, z / 70, seed + 4);
      const edge = smoothRange(0, LOOP_WORLD.edgeBlend, half - Math.max(Math.abs(x), Math.abs(z)));
      const riverDistance = Math.abs(z - loopRiverZ(x, variant)), bank = smoothRange(95, 520, riverDistance);
      const city = variant === 2 ? smoothRange(5350, 5750, Math.max(Math.abs(x), Math.abs(z))) : 1;
      const relief = variant === 0 ? 340 : variant === 2 ? 2400 : LOOP_WORLD.reliefMax;
      let spines=broad ** 1.5 * (0.35 + ridge * 0.44 + gullies * 0.15 + fine * 0.06);
      if(variant===1)spines=Math.min(1,spines*1.45);
      if (variant === 3) {
        let peak = 0;
        for (const p of peaks) {
          const px = (x-p.x)/p.rx, pz = (z-p.z)/p.rz, angle = Math.atan2(pz, px);
          const outline = 1 + .14*Math.sin(angle*3+p.phase) + .1*Math.cos(angle*5-p.phase);
          const distance = Math.hypot(px, pz)/outline;
          peak = Math.max(peak, Math.exp(-(distance ** (2.7+(p.phase%1)*1.8))) * (.71+ridge*.17+gullies*.12));
        }
        spines = Math.max(spines*.23, peak);
      }
      const height = Math.min(LOOP_WORLD.reliefMax, relief * spines * edge * bank * city) - 4 * (1 - smoothRange(65, 110, riverDistance)) * edge;
      positions.set([x, height, z], index * 3); uv.set([x / 64, z / 64], index * 2);
      if (row && column) { const a = (row - 1) * (n + 1) + column - 1, b = a + n + 1; const offset=((row-1)*n+column-1)*6;indices[offset]=a;indices[offset+1]=b;indices[offset+2]=a+1;indices[offset+3]=a+1;indices[offset+4]=b;indices[offset+5]=b+1; }
    }
    yield;
  }
  const normals=new Float32Array(positions.length),biomes=new Float32Array((n+1)**2*4),rock=[.26,.19,.11],green=[.095,.123,.055],sand=[.37,.31,.16],stride=n+1,spacing=size/n;
  for(let row=0;row<=n;row++){
    for(let column=0;column<=n;column++){
      const left=Math.max(0,column-1),right=Math.min(n,column+1),back=Math.max(0,row-1),front=Math.min(n,row+1);
      const dx=(positions[(row*stride+right)*3+1]-positions[(row*stride+left)*3+1])/((right-left)*spacing);
      const dz=(positions[(front*stride+column)*3+1]-positions[(back*stride+column)*3+1])/((front-back)*spacing),length=Math.hypot(dx,1,dz);
      const index=row*stride+column,cover=smoothRange(.35,.82,1/length);
      normals.set([-dx/length,1/length,-dz/length],index*3);
      biomes.set([cover,variant===3?.7:.2,0,1],index*4);
      const shore=1-smoothRange(110,220,Math.abs(positions[index*3+2]-loopRiverZ(positions[index*3],variant)));
      const patch=.78+terrainNoise(positions[index*3]/800,positions[index*3+2]/800,seed+9)*.4;
      for(let axis=0;axis<3;axis++)colors[index*3+axis]=((rock[axis]*(1-cover)+green[axis]*cover)*(1-shore)+sand[axis]*shore)*patch;

    }
    yield;
  }
  return {positions, colors, normals, biomes, uv, indices};
}

export function loopCell(x, z) {
  return [Math.floor((x + LOOP_WORLD.tileSize / 2) / LOOP_WORLD.tileSize), Math.floor((z + LOOP_WORLD.tileSize / 2) / LOOP_WORLD.tileSize)];
}

export function loopVariant(column, row) {
  let key = Math.imul(column, 73856093) ^ Math.imul(row, 19349663) ^ LOOP_WORLD.seed;
  key = Math.imul(key ^ (key >>> 13), 1274126177);
  return (key >>> 0) % LOOP_WORLD.variants;
}

export function isRouteCell(column, row, route) {
  if(route.fixedCells)return route.fixedCells.has(`${column},${row}`);
  if(column === 0 && row <= 0 && row >= Math.floor((route.destination.threshold - route.destination.length + LOOP_WORLD.tileSize / 2) / LOOP_WORLD.tileSize))return true;
  const half=LOOP_WORLD.tileSize/2,x=column*LOOP_WORLD.tileSize,z=row*LOOP_WORLD.tileSize;
  return route.cities.some(city=>Math.abs(x-city.x)<half+(city.columns??TOURISM.columns)*TOURISM.spacing/2&&Math.abs(z-city.z)<half+(city.rows??TOURISM.rows)*TOURISM.spacing/2);
}

// 查询最高精度三角面，植被落点与飞行碰撞共用。
export function sampleLoopTerrain(geometry, x, z) {
  const n = LOOP_WORLD.segments, size = LOOP_WORLD.tileSize, p = geometry.attributes.position.array;
  const gx = (x / size + 0.5) * n, gz = (z / size + 0.5) * n;
  const column = Math.min(n - 1, Math.floor(gx)), row = Math.min(n - 1, Math.floor(gz));
  const u = gx - column, v = gz - row, i = row * (n + 1) + column;
  const a = p[i * 3 + 1], b = p[(i + 1) * 3 + 1], c = p[(i + n + 1) * 3 + 1], d = p[(i + n + 2) * 3 + 1];
  return u + v <= 1 ? a * (1 - u - v) + b * u + c * v : b * (1 - v) + c * (1 - u) + d * (u + v - 1);
}

// 使用与可见三角形完全相同的插值，外围建筑也使用模板的原始包围盒。
export class LoopWorld {
  constructor(route, geometries, buildings, landmarkBoxes, streets, bodySweep=[]) {
    this.route = route; this.geometries = geometries;
    this.treeFields=Array.from({length:LOOP_WORLD.variants},()=>new TreeField());
    this.treeSweep=bodySweep.map(sample=>({radius:sample.radius,from:{x:0,y:0,z:0},to:{x:0,y:0,z:0}}));
    this.city = buildings.map(site => ({...site, z: site.z - LANDSCAPE.city.center[1]})).filter(site=>Math.abs(site.z)<LANDSCAPE.city.loopRows*LANDSCAPE.city.spacing/2);
    this.landmarks = landmarkBoxes.map(box => ({min: {...box.min, z: box.min.z - LANDSCAPE.city.center[1]}, max: {...box.max, z: box.max.z - LANDSCAPE.city.center[1]}, name: box.name}));
    this.cityBoxes=this.city.flatMap(site=>buildingCollisionParts(site).map(part=>attachBuildingShift({min:{x:part.x-part.width/2,y:part.y-part.height/2,z:part.z-part.depth/2},max:{x:part.x+part.width/2,y:part.y+part.height/2,z:part.z+part.depth/2},name:'外围城市建筑'},site.shift)));
    this.streets=streets;
    if(streets)this.cityBoxes.push(...streets.cars.map(streetCarBox));
    this.parking=parkingParts(4200,0);
    this.cityBoxes.push(...this.parking.filter(p=>p.role!=='parking').map(p=>({min:{x:p.x-p.width/2,y:p.y-p.height/2,z:p.z-p.depth/2},max:{x:p.x+p.width/2,y:p.y+p.height/2,z:p.z+p.depth/2},name:p.name})));
    this.cityCells=new Map();this.candidates=new Set();
    for(const box of [...this.cityBoxes,...this.landmarks]){
      for(let x=Math.floor((box.min.x-(box.shift?.maxX||0))/512);x<=Math.floor((box.max.x+(box.shift?.maxX||0))/512);x++)for(let z=Math.floor((box.min.z-(box.shift?.maxZ||0))/512);z<=Math.floor((box.max.z+(box.shift?.maxZ||0))/512);z++){
        const key=x+':'+z;if(!this.cityCells.has(key))this.cityCells.set(key,[]);this.cityCells.get(key).push(box);
      }
    }
    this.updateVariation();
    this.localFrom={x:0,y:0,z:0};this.localTo={x:0,y:0,z:0};
    this.query = {column: 0, row: 0, x: 0, z: 0, variant: 0};
  }

  treeContact(sweep) {
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const {from,to,radius}of sweep){minX=Math.min(minX,from.x-radius,to.x-radius);maxX=Math.max(maxX,from.x+radius,to.x+radius);minZ=Math.min(minZ,from.z-radius,to.z-radius);maxZ=Math.max(maxZ,from.z+radius,to.z+radius);}
    const size=LOOP_WORLD.tileSize,reach=treeReach;
    // 邻格树冠可以伸进本格，接触范围包含其最大横向半径。
    for(let column=Math.floor((minX-reach+size/2)/size);column<=Math.floor((maxX+reach+size/2)/size);column++)for(let row=Math.floor((minZ-reach+size/2)/size);row<=Math.floor((maxZ+reach+size/2)/size);row++){
      if(isRouteCell(column,row,this.route))continue;
      for(let i=0;i<sweep.length;i++)for(const side of sweepSides){
        const target=this.treeSweep[i][side],source=sweep[i][side];target.x=source.x-column*size;target.y=source.y;target.z=source.z-row*size;
      }
      if(this.treeFields[loopVariant(column,row)].touch(this.treeSweep))return true;
    }
    return false;
  }

  updateVariation() { for(const box of this.cityBoxes)moveBuildingBox(box); }

  locate(x, z) {
    const size = LOOP_WORLD.tileSize, q = this.query;
    q.column = Math.floor((x + size / 2) / size); q.row = Math.floor((z + size / 2) / size);
    q.x = x - q.column * size; q.z = z - q.row * size; q.variant = loopVariant(q.column, q.row);
    return q;
  }

  activeAt(x, z) { const q = this.locate(x, z); return !isRouteCell(q.column, q.row, this.route); }

  heightAt(x, z) {
    const q = this.locate(x, z);
    if (isRouteCell(q.column, q.row, this.route)) return -Infinity;
    return sampleLoopTerrain(this.geometries[q.variant], q.x, q.z);
  }

  // 传入现有扫掠端点；不在飞行帧创建新的地形或碰撞实体。
  collision(sweep, solidHit) {
    const size = LOOP_WORLD.tileSize;
    for (const {from, to, radius} of sweep) {
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / this.route.sweepStep));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, z = from.z + (to.z - from.z) * t;
        if (y - radius <= this.heightAt(x, z)) return '外围山川';
      }
      const q = this.locate(to.x, to.z);
      if (q.variant !== 2 || isRouteCell(q.column, q.row, this.route) || Math.abs(q.x)>5400 || Math.abs(q.z)>5400) continue;
      const dx = q.column * size, dz = q.row * size;
      const localFrom=this.localFrom,localTo=this.localTo;
      localFrom.x=from.x-dx;localFrom.y=from.y;localFrom.z=from.z-dz;
      localTo.x=to.x-dx;localTo.y=to.y;localTo.z=to.z-dz;
      this.candidates.clear();
      for(let x=Math.floor((Math.min(localFrom.x,localTo.x)-radius)/512);x<=Math.floor((Math.max(localFrom.x,localTo.x)+radius)/512);x++)
        for(let z=Math.floor((Math.min(localFrom.z,localTo.z)-radius)/512);z<=Math.floor((Math.max(localFrom.z,localTo.z)+radius)/512);z++)
          for(const box of this.cityCells.get(x+':'+z)||[])this.candidates.add(box);
      const low=Math.min(localFrom.y,localTo.y)-radius,high=Math.max(localFrom.y,localTo.y)+radius;
      for(const box of this.candidates)if(low<=box.max.y&&high>=box.min.y&&solidHit(localFrom,localTo,box,radius))return box.name;
    }
    return null;
  }
}
