import { tourismSettings, tourismParts, scenerySolid } from './tourism-layout.js';
import { prepareWeatherWorld, varyWeather } from './weather-world.js';
import { prepareCityStreetLayout, streetCarBox } from './city-street-layout.js';
import { AIRCRAFT, LANDSCAPE, JOURNEY, terrainElevation, clusterZ, LOOP_WORLD, WORLD_BOUNDARY } from './config.js';
import { createCoastalSurface, coastalHeight, shorelineX, coastalLandWeight } from './coastal-terrain.js';
import { boundaryHeightAt } from './world-boundary.js';
import { buildingParts, cityBuildingSites } from './building-layout.js';
import { createRegionalWater, regionalWaterAt, boxTouchesRegionalWater, regionalWaterExclusions } from './regional-water.js';
import { TreeField } from './tree-contact.js';
import { varyBuildingSites, attachBuildingShift, moveBuildingBox } from './world-variation.js';
import { harborParts, parkingParts } from './district-layout.js';
import { createMountainSurfaceSteps, sampleMountain, createRockFootprint } from './terrain.js';

export function transformPoint(point, pose) {
  const [x, y, z] = point, cb = Math.cos(pose.bank), sb = Math.sin(pose.bank);
  const xp = x * cb + y * sb, yp = (-x * sb + y * cb) * Math.cos(pose.pitch) - z * Math.sin(pose.pitch);
  const zp = (-x * sb + y * cb) * Math.sin(pose.pitch) + z * Math.cos(pose.pitch);
  return { x: pose.position.x + xp * Math.cos(pose.heading) - zp * Math.sin(pose.heading),
    y: pose.position.y + yp, z: pose.position.z + xp * Math.sin(pose.heading) + zp * Math.cos(pose.heading) };
}

export function segmentBox(a, b, box, radius = 0) {
  let near = 0, far = 1;
  for (const axis of ['x', 'y', 'z']) {
    const delta = b[axis] - a[axis], low = box.min[axis] - radius, high = box.max[axis] + radius;
    if (Math.abs(delta) < 1e-10) { if (a[axis] < low || a[axis] > high) return false; continue; }
    let t0 = (low - a[axis]) / delta, t1 = (high - a[axis]) / delta;
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0); far = Math.min(far, t1);
    if (near > far) return false;
  }
  return true;
}

// 渲染与碰撞共用确定性的建筑尺寸和山体网格，避免看见的山与碰撞高度不同。
export class RouteWorld {
  constructor(route,{defer=false}={}) {
    this.route = route;this.variationViews=[];this.movingBoxes=[];this.trees=new TreeField();
    this.cacheStreetLayouts=defer;
    this.coastalSurface=createCoastalSurface(-route.destination.threshold);
    this.solids = []; this.waterfalls = [];
    this.buildings = []; this.mountainSurfaces = []; this.boxCells = new Map();
    this.preparation=this.build();
    if(!defer)while(!this.preparation.next().done){}
  }

  *build() {
    const route=this.route;this.regionalWater=createRegionalWater(route.id);
    yield {task:'weather-layout'};this.weather=yield* prepareWeatherWorld(route,this.cacheStreetLayouts);yield 'boundary';
    let seed = LANDSCAPE.seed;
    this.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const city = LANDSCAPE.city, random = this.random;
    for(const site of cityBuildingSites(city,(x,z)=>(Math.abs(x-4200)<600&&Math.abs(z-city.center[1])<650)
      ||LANDSCAPE.landmarks.some(t=>Math.hypot(x-t.position[0],z-t.position[1])<city.landmarkClearance))) {
      this.addBuilding(site.x,site.z,site.width,site.depth,site.height,site.color,'城市楼房',site.profile,site.shift);
      if(this.buildings.length%32===0)yield;
    }
    if(this.route.id===1)for (let row = 0; row < 35; row++) for (let column = 0; column < 10; column++) {
      const x = (column - 4.5) * 90, z = clusterZ('village', -11100) - row * 85;
      if (Math.abs(x) < 110) continue;
      this.addBuilding(x, z, 24 + random() * 14, 28 + random() * 14, 9 + random() * 10, column % 2 ? 0xb9b094 : 0xd2c6a9, '村庄房屋');
    }
    for (const building of JOURNEY.courseBuildings) {
      if (route.id < building.level) continue;
      this.addBuilding(building.x, building.z, building.width, building.depth, building.height, building.color, building.name);
    }
    for (const zOffset of [0, this.route.destination.threshold - 100]) {
      for (const [x, y, z, w, h, d] of [[215, 6, 140, 120, 12, 28], [200, 6.5, 10, 42, 13, 45], [255, 6.5, 10, 42, 13, 45], [310, 6.5, 10, 42, 13, 45], [135, 18, -210, 21, 36, 19]]) {
        // 目的地机坪东侧留出跑道与滑行空间。
        const bx = zOffset ? x + 280 + route.destination.x : x;
        this.addBox(bx, y, z + zOffset, w, h, d, '机场建筑', zOffset ? this.route.destination.elevation : 0);
      }
    }
    for (const tower of LANDSCAPE.landmarks) {
      if (tower.kind === 'gateway') {
        const w = tower.radius * 2, lower = tower.height * 0.82, upper = tower.height * 0.94;
        this.addBox(tower.position[0], lower / 2, tower.position[1], w, lower, w * 0.48, tower.name);
        for (const side of [-1, 1]) this.addBox(tower.position[0] + side * w * 0.42, (lower + upper) / 2, tower.position[1], w * 0.16, upper - lower, w * 0.48, tower.name);
        this.addBox(tower.position[0], (upper + tower.height) / 2, tower.position[1], w, tower.height - upper, w * 0.48, tower.name);
      } else {
        for (let i = 0; i < 24; i++) {
          const t = (i + 0.5) / 24;
          const r = tower.kind === 'canton' ? (t > 0.75 ? 4 : tower.radius * (0.36 + 2.4 * (t / 0.75 - 0.53) ** 2)) : tower.kind === 'bamboo' ? tower.radius * (1 - t ** 2.5) + 1 : tower.radius * (1 - t * 0.5) * 1.12;
          this.addBox(tower.position[0], t * tower.height, tower.position[1], r * 2, tower.height / 24, r * 2, tower.name);
        }
      }
    }
    yield {task:'regional-layout'};this.makeChangsha();yield 'boundary';
    this.tourismParts=[];
    for(const settings of tourismSettings(route)){
      const sites=[],half=(settings.spacing-LANDSCAPE.city.passageWidth)/2+60;
      for(const site of cityBuildingSites(settings,(x,z)=>settings.exclusions.some(b=>x+half>b.minX&&x-half<b.maxX&&z+half>b.minZ&&z-half<b.maxZ))){
        this.addBuilding(site.x,site.z,site.width,site.depth,site.height,site.color,settings.name+'城市楼房',site.profile,site.shift);sites.push(this.buildings.at(-1));
        if(sites.length%24===0)yield;
      }
      this.regionalCities.push({...settings,sites});
      for(const part of tourismParts(settings)){
        part.y+=this.baseHeightAt(part.x,part.z);this.tourismParts.push(part);
        const solid=scenerySolid(part);this.index(this.boxCells,solid,solid.min.x,solid.max.x,solid.min.z,solid.max.z);
      }
      yield;
    }
    this.districts=[...harborParts(),...parkingParts(4200,LANDSCAPE.city.center[1])];
    for(const part of this.districts)if(part.role!=='parking')this.addBox(part.x,part.y,part.z,part.width,part.height,part.depth,part.name,0);
    this.cityStreets=[];
    const landmarkExclusions=LANDSCAPE.landmarks.map(t=>({minX:t.position[0]-t.radius*1.2,maxX:t.position[0]+t.radius*1.2,minZ:t.position[1]-t.radius*1.2,maxZ:t.position[1]+t.radius*1.2}));
    for(const [index,settings]of [city,...this.regionalCities].entries()){
      const exclusions=index===0?landmarkExclusions:[...(settings.exclusions||[]),...regionalWaterExclusions(this.regionalWater),{minX:settings.x-settings.plaza[0]/2,maxX:settings.x+settings.plaza[0]/2,minZ:settings.z-settings.plaza[1]/2,maxZ:settings.z+settings.plaza[1]/2}];
      const network=yield* prepareCityStreetLayout(settings,exclusions,index===0?'guangzhou':settings.id,this.cacheStreetLayouts);this.cityStreets.push(network);
      for(const [i,car]of network.cars.entries()){const box=streetCarBox(car);this.addBox(car.x,(box.min.y+box.max.y)/2,car.z,box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z,box.name,0);if(i%64===0)yield;}
    }
    this.loopStreets=yield* prepareCityStreetLayout({...city,center:[0,0],rows:city.loopRows},landmarkExclusions.map(b=>({...b,minZ:b.minZ-city.center[1],maxZ:b.maxZ-city.center[1]})),'loop-city',this.cacheStreetLayouts);
    this.makeCoastalRoad();yield 'boundary';
    this.makeTransitions();yield 'boundary';
    yield {task:'height-surfaces'};yield* this.makeMountains();
    yield {task:'rock-solids'};yield* this.addRegionalFeatures();
    this.bodyPoints = [];
    for (let z = -17; z <= 17; z += 3) this.bodyPoints.push({ point: [0, AIRCRAFT.bodyHeight, z], radius: this.route.bodyRadius });
    for (let x = -17; x <= 17; x += 3) this.bodyPoints.push({ point: [x, 3, 1 + Math.abs(x) * 0.3], radius: 0.6 });
    this.bodyPoints.push({ point: [0, 9, 17], radius: 0.6 }, ...AIRCRAFT.bodyContactPoints.map(point => ({point, radius: 0.45})));
    this.bodySweep = this.bodyPoints.map(sample => ({radius: sample.radius, from: {x: 0, y: 0, z: 0}, to: {x: 0, y: 0, z: 0}}));
    this.sweepBounds = {min: {x: 0, y: 0, z: 0}, max: {x: 0, y: 0, z: 0}};
    this.collisionBoxes = new Set(); this.collisionMountains = [];
    if(this.runSeed!==undefined)this.setRunSeed(this.runSeed);
  }

  setRunSeed(seed) {
    this.runSeed=seed;
    if(this.weather)varyWeather(this.weather,seed);
    varyBuildingSites(this.buildings,seed);
    for(const box of this.movingBoxes)moveBuildingBox(box);
    this.loop?.updateVariation();
    for(const update of this.variationViews)update();
  }

  makeChangsha() {
    this.regionalCities=[];
    if(this.route.id<2)return;
    for(const c of [JOURNEY.changsha,JOURNEY.changshaWest]){
      const sites=[],half=(c.spacing-LANDSCAPE.city.passageWidth)/2+60;
      for(const site of cityBuildingSites(c,(x,z)=>Math.abs(x-c.x)<c.plaza[0]/2+200&&Math.abs(z-c.z)<c.plaza[1]/2+200
        ||boxTouchesRegionalWater(this.regionalWater,{minX:x-half,maxX:x+half,minZ:z-half,maxZ:z+half}))){
        this.addBuilding(site.x,site.z,site.width,site.depth,site.height,site.color,'长沙城市楼房',site.profile,site.shift);sites.push(this.buildings.at(-1));
      }
      this.regionalCities.push({...c,sites});this.addBox(c.x,55,c.z,45,110,45,c.name+'雕塑',0);
    }
  }

  regionalWaterAt(x,z){return regionalWaterAt(this.regionalWater,x,z);}

  baseHeightAt(x, z) {
    if(this.loop?.activeAt(x,z))return Math.max(LOOP_WORLD.seaLevel,this.loop.heightAt(x,z));
    if(z>=LANDSCAPE.coast.endZ)return Math.max(LANDSCAPE.coast.seaLevel,coastalHeight(this.coastalSurface,x,z));
    return terrainElevation(z, -this.route.destination.threshold);
  }

  isSeaAt(x,z) {if(this.loop?.activeAt(x,z))return this.loop.heightAt(x,z)<0;return z>=LANDSCAPE.coast.endZ&&this.baseHeightAt(x,z)<=LANDSCAPE.coast.seaLevel+1e-6;}

  // 凸岩体的同一组顶点生成可见三角面和碰撞平面，悬空部分不计入地面高度。
  addRock(x, z, bottom, top, radius, color, name, lean = 0, form) {
    const outline=createRockFootprint(LANDSCAPE.terrain.rockSides,form?.width===undefined?undefined:form);
    if(form?.depthScale)for(const point of outline)point[1]*=form.depthScale;
    const vertices = [], faces = [], segments = outline.length, rows = LANDSCAPE.terrain.rockRings, floor = this.baseHeightAt(x, z);
    for (let row = 0; row < rows; row++) {
      const t = row / (rows - 1), height = bottom + (top - bottom) * t;
      // 径向剖面保持凹函数，实体仍为凸体；增加层数不会生成错误的封闭碰撞平面。
      const scale = bottom === 0 ? 1 + 0.15 * t - 0.33 * t * t : 0.3 + 2.28 * t - 1.76 * t * t;
      for (let i = 0; i < segments; i++) {
        vertices.push([x + outline[i][0] * radius * scale + lean * t, floor + height, z + outline[i][1] * radius * scale]);
      }
    }
    for (let row = 0; row < rows - 1; row++) for (let i = 0; i < segments; i++) {
      const a = row * segments + i, b = row * segments + (i + 1) % segments;
      faces.push([a, a + segments, b], [b, a + segments, b + segments]);
    }
    const last = (rows - 1) * segments;
    for (let i = 1; i < segments - 1; i++) faces.push([0, i, i + 1], [last, last + i + 1, last + i]);
    const min = {}, max = {}, center = {};
    ['x', 'y', 'z'].forEach((axis, i) => {
      min[axis] = Math.min(...vertices.map(v => v[i])); max[axis] = Math.max(...vertices.map(v => v[i])); center[axis] = vertices.reduce((sum,point)=>sum+point[i],0)/vertices.length;
    });
    const planes = [], positions = [];
    for (const face of faces) {
      let [a, b, c] = face.map(i => vertices[i]);
      const u = b.map((v, i) => v - a[i]), v = c.map((value, i) => value - a[i]);
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const length = Math.hypot(...n); if (length < 1e-8) continue;
      n = n.map(value => value / length);
      if (n.reduce((sum, value, i) => sum + value * (a[i] - center[['x', 'y', 'z'][i]]), 0) < 0) { n = n.map(value => -value); [b, c] = [c, b]; }
      planes.push({ normal: n, distance: n.reduce((sum, value, i) => sum + value * a[i], 0) });
      positions.push(...a, ...b, ...c);
    }
    const solid = { min, max, planes, positions, color, name, cap: {x, z, top, radius, lean, floor, outline: vertices.slice(last).map(point=>[point[0],point[2]])} };
    this.solids.push(solid); this.index(this.boxCells, solid, min.x, max.x, min.z, max.z);
  }

  *addRegionalFeatures() {
    if (this.route.id < 2) return;
    const p = JOURNEY.pillars;
    // 岩柱使用独立固定种子，山面细节调整不改变既有障碍布局。
    let seed = p.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < p.count; i++) {
      const side = i % 2 ? -1 : 1;
      random();const height=p.minHeight+random()**p.heightBias*p.heightRange,radius=p.minRadius+random()*p.radiusRange;
      const form={...p.forms[i%p.forms.length],seed:(p.seed^Math.imul(i+1,0x9e3779b9))>>>0,variation:p.shapeVariation,depthScale:p.depthScale};
      const outline=createRockFootprint(LANDSCAPE.terrain.rockSides,form),maxX=Math.max(...outline.map(point=>Math.abs(point[0])))*radius*1.02;
      const lane=Math.floor(i/2)%2,inner=lane?3050:650,outer=lane?4350:1950;
      const x=side*((inner+outer)/2+(random()-.5)*Math.max(0,outer-inner-maxX*2));
      this.addRock(x,p.startZ-Math.floor(i/2)*p.spacing,0,height,radius,JOURNEY.rockColors.pillars,'张家界石柱',0,form);yield;
    }
    const rock = JOURNEY.skyRock;
    this.addRock(rock.x, rock.z, rock.bottom, rock.top, rock.radius, rock.color, '空中圆形山',0,{depthScale:p.depthScale});yield;
    const slanted = JOURNEY.slantedRock;
    this.addRock(slanted.x, slanted.z, slanted.bottom, slanted.top, slanted.radius, slanted.color, '斜伸岩柱', slanted.lean,{depthScale:p.depthScale});yield;
    for (const fall of JOURNEY.skyFalls) {
      const floor = this.baseHeightAt(fall.x, fall.z);
      const source = fall.id === 'sky-falls' ? rock : slanted;
      this.waterfalls.push({ ...fall, bottom: floor + fall.bottom, top: floor + fall.top,
        source: {x: source.x + (source.lean || 0), y: this.baseHeightAt(source.x, source.z) + source.top + 0.3, z: source.z + source.radius * p.depthScale * 0.82} });
    }
    const island = JOURNEY.island, h = island.statueHeight;
    this.addRock(island.x, island.z, 3, 22, 145, 0x979c8a, '橘子洲雕像基座');
    this.addRock(island.x, island.z, 22, h, 90, 0xa1a394, '青年毛泽东石像');
    this.addBox(island.x, 103, island.z + 76, 18, 38, 34, '青年毛泽东石像');
    for (let i = 0; i < 6; i++) this.addBox(island.x - 68 + i * 25, 149 + Math.sin(i * 0.7) * 12, island.z - 12, 80, 70, 96, '青年毛泽东石像');
    if (this.route.id >= 3) {
      this.pagodas=[];
      const hero=JOURNEY.pagoda,ridge=JOURNEY.pagodaRidge;
      const heroFloor=this.heightAt(hero.x,hero.z),heroTop=heroFloor+hero.height+45;
      this.pagodas.push({...hero,floor:heroFloor,name:'黄鹤楼',hero:true});
      for(let i=0;i<ridge.satellites;i++){
        const angle=i*2.399963,x=hero.x+Math.cos(angle)*(1100+(i%3)*440),z=hero.z+Math.sin(angle)*(600+(i%4)*260)*5;
        const floor=this.heightAt(x,z),height=Math.min(700+(i%4)*230,heroTop-floor-220);
        this.pagodas.push({x,z,floor,height,width:135+(i%3)*38,levels:5+i%3,eaves:1.45,name:'山中古塔',hero:false});
      }
      for(const tower of this.pagodas){const floor=tower.floor;
        const half=tower.width*.575;let low=floor;
        for(const x of [-half,0,half])for(const z of [-half,0,half])low=Math.min(low,this.heightAt(tower.x+x,tower.z+z));
        tower.supportHeight=Math.max(12,floor-low+12);
        this.addBox(tower.x,-tower.supportHeight/2,tower.z,tower.width*1.15,tower.supportHeight,tower.width*1.15,tower.name+'石台基座',floor);
        this.addBox(tower.x,-3,tower.z,tower.width*1.2,6,tower.width*1.2,tower.name+'石台台沿',floor);
      this.addBox(tower.x, tower.height + 22.5, tower.z, 16, 45, 16, tower.name+'塔尖', floor);
      for (let i = 0; i < tower.levels; i++) {
        const y = tower.height * i / tower.levels, height = tower.height / tower.levels;
        const width = tower.width * (1 - i * 0.07);
        this.addBox(tower.x, y + height * 0.43, tower.z, width, height * 0.86, width, tower.name, floor);
        this.addBox(tower.x, y + height * 0.91, tower.z, width * tower.eaves, height * 0.18, width * tower.eaves, tower.name+'飞檐', floor);
      }
      yield;
      }
    }
  }

  solidHit(from, to, solid, radius) {
    if (!segmentBox(from, to, solid, radius)) return false;
    if (!solid.planes) return true;
    let near = 0, far = 1;
    for (const plane of solid.planes) {
      const n = plane.normal, distance = plane.distance + radius;
      const a = n[0] * from.x + n[1] * from.y + n[2] * from.z - distance;
      const b = n[0] * to.x + n[1] * to.y + n[2] * to.z - distance;
      if (a > 0 && b > 0) return false;
      if (a > 0) near = Math.max(near, a / (a - b));
      else if (b > 0) far = Math.min(far, a / (a - b));
      if (near > far) return false;
    }
    return true;
  }

  cellKey(x, z) { return `${Math.floor(x / this.route.collisionCell)},${Math.floor(z / this.route.collisionCell)}`; }

  index(map, value, minX, maxX, minZ, maxZ) {
    for (let x = Math.floor(minX / this.route.collisionCell); x <= Math.floor(maxX / this.route.collisionCell); x++) {
      for (let z = Math.floor(minZ / this.route.collisionCell); z <= Math.floor(maxZ / this.route.collisionCell); z++) {
        const key = `${x},${z}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(value);
      }
    }
  }

  addBox(x, y, z, width, height, depth, name, floor = this.baseHeightAt(x, z), shift) {
    y += floor;
    const box = { min: {x: x - width / 2, y: y - height / 2, z: z - depth / 2}, max: {x: x + width / 2, y: y + height / 2, z: z + depth / 2}, name };
    // 索引一次覆盖全部允许偏移，重开只移动实际包围盒，不重建空间网格。
    this.index(this.boxCells, box, box.min.x-(shift?.maxX||0), box.max.x+(shift?.maxX||0), box.min.z-(shift?.maxZ||0), box.max.z+(shift?.maxZ||0));
    if(shift){attachBuildingShift(box,shift);this.movingBoxes.push(box);moveBuildingBox(box);}
  }

  addBuilding(x, z, width, depth, height, color, name = '城市楼房', profile, shift) {
    const site={x,z,width,depth,height,color,name,profile,shift};this.buildings.push(site);
    for(const part of buildingParts(site))this.addBox(part.x,part.y,part.z,part.width,part.height,part.depth,name,this.baseHeightAt(x,z),shift);
  }

  makeCoastalRoad() {
    const s=LANDSCAPE.coast,road=s.highway;this.coastalRoad=[];
    const part=(kind,x,y,z,width,height,length,heading=0)=>{
      const c=Math.cos(heading),n=Math.sin(heading),hx=width/2,hz=length/2;
      const extentX=Math.abs(c)*hx+Math.abs(n)*hz,extentZ=Math.abs(n)*hx+Math.abs(c)*hz;
      const center={x,y,z},planes=[];
      for(const [normal,half] of [[[c,0,-n],hx],[[n,0,c],hz],[[0,1,0],height/2]])for(const side of [-1,1]){
        const direction=normal.map(v=>v*side);planes.push({normal:direction,distance:direction[0]*x+direction[1]*y+direction[2]*z+half});
      }
      const solid={min:{x:x-extentX,y:y-height/2,z:z-extentZ},max:{x:x+extentX,y:y+height/2,z:z+extentZ},planes,name:'沿江高速'};
      this.index(this.boxCells,solid,solid.min.x,solid.max.x,solid.min.z,solid.max.z);
      this.coastalRoad.push({kind,center,width,height,length,heading});
    };
    const path=[];
    for(let z=road.startZ;z>=road.endZ;z-=road.step){
      const airport=s.airport,distance=Math.abs(z-airport.z)-airport.halfLength-road.airportClearance;
      const t=Math.max(0,Math.min(1,1-distance/road.airportBlend)),blend=t*t*(3-2*t);
      const shore=shorelineX(z)-road.waterOffset,bypass=airport.x-airport.halfWidth-road.airportClearance-road.width/2;
      path.push({x:shore+(Math.min(shore,bypass)-shore)*blend,z});
    }
    const addPath=points=>{
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),heading=Math.atan2(dx,dz),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
        part('deck',x,road.height,z,road.width,road.thickness,length+.5,heading);
        for(const side of [-1,0,1]){
          const offset=side*(road.width/2-road.railWidth/2);
          part('rail',x+Math.cos(heading)*offset,road.height+road.thickness/2+road.railHeight/2,z-Math.sin(heading)*offset,road.railWidth,road.railHeight,length+.5,heading);
        }
        const bottom=s.seaLevel+s.seabed,height=road.height-road.thickness/2-bottom;
        part('pier',a.x,bottom+height/2,a.z,road.pierWidth,height,road.pierLength,heading);
      }
    };
    addPath(path);
  }

  // 过渡带独立随机流，不改变景点群内部布局；小丘避开中央航线和机场。
  makeTransitions() {
    const settings=JOURNEY.transitions;
    this.transitions=[];this.transitionHills=[];
    for(const zone of this.route.transitions){
      let seed=settings.seed;
      for(const character of zone.id)seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const points=Array.from({length:9},(_,i)=>({x:(i/8-.5)*settings.meadowWidth,z:zone.z+Math.sin(i*1.1+random())*zone.length*.2}));
      this.transitions.push({...zone,points});
      for(let i=0;i<(zone.hills===0?4:zone.hills??settings.hills);i++){
        const radius=settings.hillRadius[0]+random()*(settings.hillRadius[1]-settings.hillRadius[0]);
        this.transitionHills.push({position:[(i%2?1:-1)*(radius+settings.corridor+random()*450),zone.z+(i/Math.max(1,settings.hills-1)-.5)*zone.length*.55],
          radius:[radius,Math.min(zone.length*.36,300+random()*180)],height:zone.hills===0?30+random()*48:settings.hillHeight[0]+random()*(settings.hillHeight[1]-settings.hillHeight[0]),kind:'rolling',segments:settings.segments});
      }
    }
  }

  *makeMountains() {
    // 田野本身也有低缓连绵起伏，中央通道与机场仍保持平坦。
    for(let i=0;i<12;i++)this.transitionHills.push({position:[(i%2?-1:1)*(1200+(i%3)*700),clusterZ('fields')+(Math.floor(i/2)-2.5)*650],radius:[850+(i%3)*180,900+(i%4)*120],height:35+(i%5)*13,kind:'rolling',segments:64});
    this.transitionHills=this.transitionHills.filter(hill=>coastalLandWeight(...hill.position)>.98&&!(Math.abs(hill.position[0])-hill.radius[0]<LANDSCAPE.city.columns*LANDSCAPE.city.spacing/2+100&&Math.abs(hill.position[1]-LANDSCAPE.city.center[1])-hill.radius[1]<LANDSCAPE.city.rows*LANDSCAPE.city.spacing/2+100));
    const ridges=[];
    if(this.route.id>=3){const p=JOURNEY.pagoda,r=JOURNEY.pagodaRidge;
      for(let i=-2;i<=2;i++)ridges.push({position:[p.x+i*1150,p.z+Math.sin(i*1.8)*2750],radius:r.radius,height:r.height-Math.abs(i)*90,kind:'rolling',segments:96});
    }
    for(const mountain of [...this.route.mountains,...this.transitionHills,...ridges]){this.mountainSurfaces.push(yield* createMountainSurfaceSteps(mountain,(x,z)=>this.baseHeightAt(x,z)));yield;}
  }

  heightAt(x, z) {
    let height = Math.max(this.baseHeightAt(x, z),boundaryHeightAt(x,z,this.route.boundary));
    for (const surface of this.mountainSurfaces) height = Math.max(height, sampleMountain(surface, x, z));
    return height;
  }

  // 固定步内只变换一次接触点；世界碰撞与交通碰撞复用同一组端点和扫掠包围盒。
  prepareBodySweep(aircraft, previous) {
    const bounds = this.sweepBounds;
    bounds.min.x = bounds.min.y = bounds.min.z = Infinity;
    bounds.max.x = bounds.max.y = bounds.max.z = -Infinity;
    for (let pass = 0; pass < 2; pass++) {
      const pose = pass ? aircraft : previous, field = pass ? 'to' : 'from';
      const cb = Math.cos(pose.bank), sb = Math.sin(pose.bank), cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
      const ch = Math.cos(pose.heading), sh = Math.sin(pose.heading);
      for (let i = 0; i < this.bodyPoints.length; i++) {
        const [x, y, z] = this.bodyPoints[i].point, sample = this.bodySweep[i], target = sample[field];
        const xp = x * cb + y * sb, yp = (-x * sb + y * cb) * cp - z * sp;
        const zp = (-x * sb + y * cb) * sp + z * cp;
        target.x = pose.position.x + xp * ch - zp * sh;
        target.y = pose.position.y + yp;
        target.z = pose.position.z + xp * sh + zp * ch;
        bounds.min.x = Math.min(bounds.min.x, target.x - sample.radius); bounds.max.x = Math.max(bounds.max.x, target.x + sample.radius);
        bounds.min.y = Math.min(bounds.min.y, target.y - sample.radius); bounds.max.y = Math.max(bounds.max.y, target.y + sample.radius);
        bounds.min.z = Math.min(bounds.min.z, target.z - sample.radius); bounds.max.z = Math.max(bounds.max.z, target.z + sample.radius);
      }
    }
    return this.bodySweep;
  }

  treeContact() {return this.trees.touch(this.bodySweep)||Boolean(this.loop?.treeContact(this.bodySweep));}

  collision(aircraft, previous) {
    const sweep = this.prepareBodySweep(aircraft, previous), bounds = this.sweepBounds, boundary=this.route.boundary;
    for(const {from,to,radius} of sweep){
      const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/this.route.sweepStep));
      if(Math.max(Math.abs(from.x-(boundary.centerX||0)),Math.abs(to.x-(boundary.centerX||0)))<boundary.halfWidth-radius&&Math.min(from.z,to.z)>boundary.back+radius&&Math.max(from.z,to.z)<boundary.front-radius)continue;
      for(let i=0;i<=steps;i++){const t=i/steps,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
        const h=boundaryHeightAt(x,z,this.route.boundary);if(h>0&&from.y+(to.y-from.y)*t-radius<=h)return WORLD_BOUNDARY.name;
      }
    }
    const boxes = this.collisionBoxes, mountains = this.collisionMountains, cell = this.route.collisionCell;
    boxes.clear(); mountains.length = 0;
    for (let x = Math.floor(bounds.min.x / cell); x <= Math.floor(bounds.max.x / cell); x++) {
      for (let z = Math.floor(bounds.min.z / cell); z <= Math.floor(bounds.max.z / cell); z++) {
        for (const box of this.boxCells.get(`${x},${z}`) || []) {
          if (bounds.min.y <= box.max.y && bounds.max.y >= box.min.y && bounds.min.x <= box.max.x && bounds.max.x >= box.min.x && bounds.min.z <= box.max.z && bounds.max.z >= box.min.z) boxes.add(box);
        }
      }
    }
    for (const surface of this.mountainSurfaces) {
      if (bounds.min.y <= surface.maxY + 0.001 && bounds.min.x <= surface.maxX && bounds.max.x >= surface.minX && bounds.min.z <= surface.maxZ && bounds.max.z >= surface.minZ) mountains.push(surface);
    }
    if(this.loop){const hit=this.loop.collision(sweep,segmentBox);if(hit)return hit;}
    if (!boxes.size && !mountains.length) return null;
    for (const {from, to, radius} of sweep) {
      for (const box of boxes) if (this.solidHit(from, to, box, radius)) return box.name;
      if (!mountains.length) continue;
      // 保留原有半米空间采样，只查询与完整扫掠范围相交的山块。
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / this.route.sweepStep));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
        const base = this.baseHeightAt(x, z);
        let ground = base;
        for (const surface of mountains) ground = Math.max(ground, sampleMountain(surface, x, z));
        if (ground > base + 0.1 && from.y + (to.y - from.y) * t - radius <= ground) return '山体';
      }
    }
    return null;
  }
}
