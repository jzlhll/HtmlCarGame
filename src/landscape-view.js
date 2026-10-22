import { createTourismView } from './tourism-view.js';
import { isRouteCell } from './loop-world.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDSCAPE, SCENERY, JOURNEY, SURFACE_APPEARANCE, clusterZ, LOOP_WORLD, REGION_BLEND } from './config.js';
import { surfaceTexture } from './surface-assets.js';
import { coastalLandWeight } from './coastal-terrain.js';
import { RegionalWaterView } from './regional-water-view.js';
import { islandSection, boxTouchesRegionalWater } from './regional-water.js';
import { CoastalView } from './coastal-view.js';
import { GenerationQueue } from './generation-queue.js';
import { MountainView } from './mountain-view.js';
import { regionLandAt, regionBelts } from './region-blend.js';
import { LoopView } from './loop-view.js';
import { createCityBlocks } from './city-blocks.js';
import { createCityStreets } from './city-streets.js';
import { createCountryside } from './countryside-view.js';
import { createDistrict } from './district-view.js';
import { batchStaticMeshSteps } from './static-batch.js';

// 沿压缩航线绘制地景；建筑和山体直接读取逻辑共用数据。
export class LandscapeView extends THREE.Group {
  constructor(world) {
    super();
    let seed = LANDSCAPE.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    this.random = random;
    this.world = world;
    this.route = world.route;
    this.frameSegments = [];
    this.coast=new CoastalView(world);this.add(this.coast);
    this.regionalWaterView=new RegionalWaterView(world);this.add(this.regionalWaterView);
    this.textures=[];
  }

  updateMatrixWorld(force) {
    // 地景队列完成后才跳过静止子树；循环槽重定位仍由LoopView显式解冻并更新。
    if(this.transitionQueue?.state==='complete'&&!this.matrixWorldAutoUpdate&&!this.matrixWorldNeedsUpdate)return;
    super.updateMatrixWorld(force);
  }

  *addGround() {
    const settings=LANDSCAPE.coast,surface=this.world.coastalSurface;
    const material=new THREE.MeshStandardMaterial({color:SCENERY.colors.ground,roughness:1});
    const positions=surface.positions,uv=new Float32Array(positions.length/3*2),normals=new Float32Array(positions.length),indices=[];
    for(let row=0;row<surface.z.length;row++){
      for(let col=0;col<surface.x.length;col++){
        const i=row*surface.x.length+col,left=Math.max(0,col-1),right=Math.min(surface.x.length-1,col+1),back=Math.max(0,row-1),front=Math.min(surface.z.length-1,row+1);
        const dx=(surface.heights[row*surface.x.length+right]-surface.heights[row*surface.x.length+left])/(surface.x[right]-surface.x[left]);
        const dz=(surface.heights[front*surface.x.length+col]-surface.heights[back*surface.x.length+col])/(surface.z[front]-surface.z[back]),length=Math.hypot(dx,1,dz);
        normals.set([-dx/length,1/length,-dz/length],i*3);uv[i*2]=positions[i*3]/SURFACE_APPEARANCE.grassTileMetres;uv[i*2+1]=positions[i*3+2]/SURFACE_APPEARANCE.grassTileMetres;
        if(row&&col){const a=(row-1)*surface.x.length+col-1,b=a+surface.x.length;indices.push(a,b,a+1,b,b+1,a+1);}
      }
      yield;
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);yield 'boundary';
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));yield 'boundary';
    const coastalGround=new THREE.Mesh(geometry,material);coastalGround.position.y=-.04;coastalGround.receiveShadow=true;this.add(coastalGround);
    if(this.route.fixedCells){
      const positions=[],uv=[],indices=[],half=LOOP_WORLD.tileSize/2;
      for(const {column,row}of this.route.fixedCells.values()){
        const x=column*LOOP_WORLD.tileSize,front=Math.min(settings.endZ,row*LOOP_WORLD.tileSize+half),back=row*LOOP_WORLD.tileSize-half;
        if(back>=front)continue;
        const i=positions.length/3;positions.push(x-half,-.04,front,x+half,-.04,front,x-half,-.04,back,x+half,-.04,back);
        for(const [px,pz]of [[x-half,front],[x+half,front],[x-half,back],[x+half,back]])uv.push(px/SURFACE_APPEARANCE.grassTileMetres,pz/SURFACE_APPEARANCE.grassTileMetres);
        indices.push(i,i+1,i+2,i+1,i+3,i+2);if(i%32===0)yield;
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;this.add(mesh);yield;return;
    }
    const half=LOOP_WORLD.tileSize/2,minZ=(Math.floor((this.route.destination.threshold-this.route.destination.length+half)/LOOP_WORLD.tileSize)-.5)*LOOP_WORLD.tileSize,coordinates=new Set([settings.endZ,minZ,this.route.destination.threshold]);
    for(let i=0;i<=JOURNEY.groundSegments;i++){const z=25000-i/JOURNEY.groundSegments*SCENERY.groundSize;if(z<settings.endZ&&z>minZ)coordinates.add(z);}
    const rows=[...coordinates].sort((a,b)=>b-a),landPositions=[],landUV=[],landIndices=[];
    rows.forEach((z,row)=>{
      for(const x of [-half,half]){landPositions.push(x,this.world.baseHeightAt(x,z),z);landUV.push(x/SURFACE_APPEARANCE.grassTileMetres,z/SURFACE_APPEARANCE.grassTileMetres);}
      if(row){const a=(row-1)*2;landIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
    });
    for(const column of [-1,1])for(let row=0;row>=Math.floor(minZ/LOOP_WORLD.tileSize);row--){
      if(!isRouteCell(column,row,this.route))continue;
      const x=column*LOOP_WORLD.tileSize,front=Math.min(settings.endZ,row*LOOP_WORLD.tileSize+half),back=row*LOOP_WORLD.tileSize-half;
      if(back>=front)continue;
      const i=landPositions.length/3;landPositions.push(x-half,0,front,x+half,0,front,x-half,0,back,x+half,0,back);
      for(const [px,pz]of [[x-half,front],[x+half,front],[x-half,back],[x+half,back]])landUV.push(px/SURFACE_APPEARANCE.grassTileMetres,pz/SURFACE_APPEARANCE.grassTileMetres);
      landIndices.push(i,i+1,i+2,i+1,i+3,i+2);yield;
    }
    const inlandGeometry=new THREE.BufferGeometry();inlandGeometry.setAttribute('position',new THREE.Float32BufferAttribute(landPositions,3));inlandGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(landUV,2));inlandGeometry.setIndex(landIndices);inlandGeometry.computeVertexNormals();
    const inland=new THREE.Mesh(inlandGeometry,material);inland.position.y=-.04;inland.receiveShadow=true;this.add(inland);yield 'boundary';
  }

  *addRegionalViews() {
    if (this.route.id < 2) return;
    yield* this.regionalWaterView.build();
    const island=JOURNEY.island,floor=this.world.baseHeightAt(island.x,island.z);
    const stone = new THREE.MeshStandardMaterial({color: 0xa1a394, roughness: 1, flatShading: true});
    const darkStone = new THREE.MeshStandardMaterial({color: 0x737d75, roughness: 1, flatShading: true});
    const face = (size, offset, material = stone) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(island.x + offset[0], floor + offset[1], island.z + offset[2]); this.add(mesh);
    };
    // 用石质面部、眉眼、侧分发块和长基座表现青年头像的轮廓。
    face([18, 38, 34], [0, 103, 76]);
    face([54, 6, 11], [0, 64, 82]);
    face([27, 5, 7], [-28, 125, 73], darkStone); face([27, 5, 7], [28, 125, 73], darkStone);
    face([34, 13, 19], [-31, 135, 66]); face([34, 13, 19], [31, 135, 66]);
    face([27, 40, 34], [-76, 92, 0]); face([27, 40, 34], [76, 92, 0]);
    for (let i = 0; i < 6; i++) {
      const hair = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), darkStone);
      hair.scale.set(40, 35, 48); hair.position.set(island.x - 68 + i * 25, floor + 149 + Math.sin(i * 0.7) * 12, island.z - 12);
      this.add(hair);
    }
    this.islandTreeSites=Array.from({length:40},(_,i)=>{const z=island.z+(i-20)*160,p=islandSection(z);return {x:p.x+(i%2?-1:1)*p.half*.58,y:floor,z,yaw:i*2.399963,color:0x496e50};});
    if(this.route.id<3)return;
    for(const tower of this.world.pagodas){this.addPagoda(tower);yield;}
  }

  addPagoda(tower) {
    const floor=tower.floor;
    const wall = new THREE.MeshStandardMaterial({color: tower.hero?0xe3bb54:0xb8b5a2, roughness: 0.85});
    const red = new THREE.MeshStandardMaterial({color: 0x964d38, roughness: 0.85});
    const gold = new THREE.MeshStandardMaterial({color: tower.hero?0xd9a434:0x4b5d58, roughness: 0.7, side: THREE.DoubleSide});
    const box = (x, y, z, width, height, depth, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(tower.x + x, floor + y, tower.z + z); this.add(mesh);
    };
    const stone=new THREE.MeshStandardMaterial({color:0x92958b,roughness:1});
    box(0,-tower.supportHeight/2,0,tower.width*1.15,tower.supportHeight,tower.width*1.15,stone);
    box(0,-3,0,tower.width*1.2,6,tower.width*1.2,stone);
    for (let i = 0; i < tower.levels; i++) {
      const y = tower.height * i / tower.levels, height = tower.height / tower.levels, width = tower.width * (1 - i * 0.07);
      box(0, y + height * 0.43, 0, width, height * 0.86, width, wall);
      const roofWidth = width * tower.eaves;
      box(0, y + height * 0.83, 0, roofWidth * 0.94, height * 0.02, roofWidth * 0.94, gold);
      const half = roofWidth / 2, rim = [[half, 0.96, half], [0, 0.84, half], [-half, 0.96, half], [-half, 0.84, 0], [-half, 0.96, -half], [0, 0.84, -half], [half, 0.96, -half], [half, 0.84, 0]];
      const positions = [];
      for (let edge = 0; edge < rim.length; edge++) {
        for (const [x, rise, z] of [[0, 1, 0], rim[(edge + 1) % rim.length], rim[edge]]) positions.push(tower.x + x, floor + y + height * rise, tower.z + z);
      }
      const roof = new THREE.BufferGeometry(); roof.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); roof.computeVertexNormals(); this.add(new THREE.Mesh(roof, gold));
      for (const x of [-width * 0.48, width * 0.48]) for (const z of [-width * 0.48, width * 0.48]) box(x, y + height * 0.5, z, 8, height * 0.8, 8, red);
      for (const x of [-width * 0.25, width * 0.25]) box(x, y + height * 0.4, width / 2 + 0.1, width * 0.12, height * 0.35, 0.2, red);
    }
    const finial = new THREE.Mesh(new THREE.ConeGeometry(8, 45, 8), gold);
    finial.position.set(tower.x, floor + tower.height + 22.5, tower.z); this.add(finial);
  }

  surface(geometry, color, layer, y = 0) {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + this.world.baseHeightAt(position.getX(i), position.getZ(i)));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, polygonOffset: true,
      polygonOffsetFactor: -layer, polygonOffsetUnits: -layer });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    this.add(mesh);
    return mesh;
  }

  ribbon(points, width) {
    const positions = [], indices = [];
    for (let i = 0; i < points.length; i++) {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const dx = next.x - previous.x, dz = next.z - previous.z, length = Math.hypot(dx, dz);
      for (const side of [-1, 1]) positions.push(points[i].x - side * dz / length * width / 2, 0, points[i].z + side * dx / length * width / 2);
      if (i > 0) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }

  addRiver() {
    const river = LANDSCAPE.river;
    this.riverPaths = [river.points, river.tributary].map((coordinates, index) => {
      const curve = new THREE.CatmullRomCurve3(coordinates.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const points = curve.getPoints(river.samples);
      const scale = index ? 0.65 : 1,landPoints=points.filter(p=>coastalLandWeight(p.x,p.z)>.08);
      this.surface(this.ribbon(landPoints, river.bankWidth * scale), river.bankColor, SCENERY.surfaceLayers.shoulder, 0.02);
      this.surface(this.ribbon(landPoints, river.width * scale), river.waterColor, SCENERY.surfaceLayers.pavement, 0.05);
      return points;
    });
    const bridgeGeometries = [];
    for (const x of river.bridges) {
      const point = this.riverPaths[0].reduce((best, item) => Math.abs(item.x - x) < Math.abs(best.x - x) ? item : best);
      const deck = new THREE.BoxGeometry(river.bridgeWidth, 4, river.bridgeLength);
      deck.translate(x, river.bridgeHeight, point.z); bridgeGeometries.push(deck);
      for (const z of [-river.width * 0.6, river.width * 0.6]) {
        for (const side of [-1, 1]) {
          const pole = new THREE.BoxGeometry(7, river.pylonHeight, 7);
          pole.translate(x + side * river.bridgeWidth * 0.4, river.pylonHeight / 2, point.z + z);
          bridgeGeometries.push(pole);
          for (const end of [-river.bridgeLength * 0.45, 0, river.bridgeLength * 0.45]) this.frameSegments.push([
            new THREE.Vector3(x + side * river.bridgeWidth * 0.4, this.world.baseHeightAt(x, point.z + z) + river.pylonHeight, point.z + z),
            new THREE.Vector3(x + side * river.bridgeWidth * 0.4, this.world.baseHeightAt(x, point.z + end) + river.bridgeHeight + 2, point.z + end), 1.8,
          ]);
        }
      }
    }
    for (const geometry of bridgeGeometries) {
      const position = geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + this.world.baseHeightAt(position.getX(i), position.getZ(i)));
    }
    const bridge = new THREE.Mesh(mergeGeometries(bridgeGeometries), new THREE.MeshStandardMaterial({color: 0xc1bda4, roughness: 0.8}));
    this.add(bridge); bridgeGeometries.forEach(geometry => geometry.dispose());
  }

  prepare() {
    if(!this.transitionQueue)this.transitionQueue=new GenerationQueue(this.buildScenery(),{urgent:true,name:'route-transitions'});
    this.transitionQueue.resume();return this.transitionQueue.done;
  }

  *buildScenery() {
    yield {task:'landmark-structure'};this.addRiver();yield 'boundary';this.addCity();yield* this.addCityStreets();yield 'boundary';
    yield* this.addLandmarks();yield 'boundary';this.addWaterfall();yield {task:'regional-monuments'};yield* this.addRegionalViews();yield {task:'static-batches'};
    yield* batchStaticMeshSteps(this);yield 'boundary';
    this.mountains=new MountainView(this.world);this.add(this.mountains);yield* this.mountains.makeTreeResources();this.textures.push(...this.mountains.textures);if(this.islandTreeSites)yield* this.mountains.addForestChunk(this.islandTreeSites);yield 'boundary';
    this.loopView=new LoopView(this.world,()=>this.landmarkTemplate.clone(),{bank:this.mountains.treeBank,geometry:this.mountains.treeGeometry,material:this.mountains.treeMaterial,farGeometry:this.mountains.treeSpriteGeometry,farMaterial:this.mountains.treeSpriteMaterial});this.add(this.loopView);yield 'boundary';
    yield* this.addGround();yield* this.addCityBlocks();yield* this.addFarmland();this.add(yield* createDistrict(this.world.districts));this.add(yield* createTourismView(this.world.tourismParts));yield* this.coast.build();yield* this.addTransitions();yield* this.mountains.buildRolling();yield* this.addRegionBelts();yield* this.addRegionalCities();yield* this.loopView.build();
    yield {task:'landscape-horizon'};yield* this.loopView.installHorizonSteps(this);
    yield {task:'landscape-matrices'};
    const stack=[this];let visited=0;
    while(stack.length){
      const object=stack.pop();stack.push(...object.children);
      // 父节点先完成世界矩阵，再分批冻结子树，避免准备结束时集中遍历整池。
      object.matrixWorldAutoUpdate=true;object.updateWorldMatrix(false,false,true);
      object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false;
      if(++visited%64===0)yield;
    }
  }

  *addRegionBelts() {
    const trees={bank:this.mountains.treeBank,geometry:this.mountains.treeGeometry,material:this.mountains.treeMaterial,farGeometry:this.mountains.treeSpriteGeometry,farMaterial:this.mountains.treeSpriteMaterial};
    for(const belt of regionBelts(this.route)){
      yield {task:'region-forest'};
      this.add(yield* createCountryside({width:REGION_BLEND.width,length:belt.length,centerX:belt.x||0,centerZ:belt.z,seed:belt.seed,
        heightAt:(x,z)=>this.world.heightAt(x,z),landAt:(x,z)=>regionLandAt(this.world,x,z),trees,forestOnly:true,treeField:this.world.trees,
        treeArea:REGION_BLEND.treeArea,treeNear:REGION_BLEND.treeNear,treeFar:REGION_BLEND.treeFar}));
    }
  }

  *addRegionalCities() {
    for(const city of this.world.regionalCities){
      const group=new THREE.Group(),width=city.columns*city.spacing,length=city.rows*city.spacing;
      const positions=[],indices=[],step=240;
      for(let x=city.x-width/2;x<city.x+width/2;x+=step)for(let z=city.z-length/2;z<city.z+length/2;z+=step){
        const right=Math.min(city.x+width/2,x+step),front=Math.min(city.z+length/2,z+step);
        if(boxTouchesRegionalWater(this.world.regionalWater,{minX:x,maxX:right,minZ:z,maxZ:front}))continue;
        const i=positions.length/3;positions.push(x,.02,z,x,.02,front,right,.02,z,right,.02,front);indices.push(i,i+1,i+2,i+2,i+1,i+3);
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x777e71,roughness:1})));yield;
      if(city.exclusions){this.add(group);yield 'boundary';continue;}
      const plaza=new THREE.Mesh(new THREE.PlaneGeometry(...city.plaza),new THREE.MeshStandardMaterial({color:0xb2ad98,roughness:.85}));plaza.rotation.x=-Math.PI/2;plaza.position.set(city.x,.12,city.z);group.add(plaza);
      const cube=new THREE.BoxGeometry(1,1,1),monument=new THREE.Mesh(cube,new THREE.MeshStandardMaterial({color:0xa07855,roughness:.7}));monument.scale.set(45,110,45);monument.position.set(city.x,55,city.z);group.add(monument);
      yield* batchStaticMeshSteps(group,30000);this.add(group);yield 'boundary';
    }
  }

  *addTransitions() {
    const settings=JOURNEY.transitions;
    for(const zone of this.world.transitions){
      yield {task:zone.id};
      const group=yield* createCountryside({width:settings.meadowWidth,length:zone.length,centerZ:zone.z,
        seed:settings.seed+Math.round(-zone.z),heightAt:(x,z)=>this.world.heightAt(x,z),
        landAt:(x,z)=>regionLandAt(this.world,x,z),treeField:this.world.trees,trees:{bank:this.mountains.treeBank,geometry:this.mountains.treeGeometry,material:this.mountains.treeMaterial,farGeometry:this.mountains.treeSpriteGeometry,farMaterial:this.mountains.treeSpriteMaterial}});
      this.add(group);
      const curve=new THREE.CatmullRomCurve3(zone.points.map(point=>new THREE.Vector3(point.x,0,point.z))),points=curve.getPoints(settings.streamSamples).filter(p=>coastalLandWeight(p.x,p.z)>.08);
      if(points.length<2)continue;
      this.surface(this.ribbon(points,settings.streamBankWidth),settings.bankColor,SCENERY.surfaceLayers.shoulder,.02);
      this.surface(this.ribbon(points,settings.streamWidth),settings.waterColor,SCENERY.surfaceLayers.pavement,.05);
      yield 'boundary';
    }
  }

  addCity() {
    const city = LANDSCAPE.city, random = this.random;
    const width = city.columns * city.spacing, length = city.rows * city.spacing;
    const cityGround = new THREE.PlaneGeometry(width, length); cityGround.rotateX(-Math.PI / 2);
    cityGround.translate(...[city.center[0], 0, city.center[1]]);
    this.surface(cityGround, city.parkColor, 0.5, 0.005);
    // 保留原装饰随机流的消耗，材质升级不改变后续地景位置。
    for (let cell=0; cell<24*8; cell++) if (random() <= 0.8) random();

  }

  *addCityStreets() {
    const shared={};
    for(const network of this.world.cityStreets){yield {task:'city-streets'};this.add(yield* createCityStreets(network,shared));}
  }

  *addCityBlocks() {
    const chunks=new Map(),size=LANDSCAPE.city.chunkSize,shared={variationViews:this.world.variationViews};
    for(const site of this.world.buildings){
      const key=Math.floor(site.x/size)+':'+Math.floor(site.z/size);
      if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(site);
    }
    for(const sites of chunks.values()){
      yield {task:'city-block'};
      this.add(yield* createCityBlocks(sites,(x,z)=>this.world.baseHeightAt(x,z),shared));yield 'boundary';
    }
  }

  *addLandmarks() {
    this.landmarkObjects=[];
    const frameStart=this.frameSegments.length;
    const detail = LANDSCAPE.towers;
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    for (const tower of LANDSCAPE.landmarks) {
      const group = new THREE.Group(); group.name = tower.name;this.landmarkObjects.push(group);
      group.position.set(tower.position[0], this.world.baseHeightAt(...tower.position), tower.position[1]); this.add(group);
      const material = new THREE.MeshStandardMaterial({color: tower.color, metalness: 0.3, roughness: 0.5});
      const box = (x, y, z, width, height, depth) => {
        const mesh = new THREE.Mesh(boxGeometry, material); mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); group.add(mesh);
      };
      const frame = (a, b, radius = detail.strutRadius) => this.frameSegments.push([
        new THREE.Vector3(...a).add(group.position), new THREE.Vector3(...b).add(group.position), radius,
      ]);
      if (tower.kind === 'gateway') {
        const width = tower.radius * 2, holeBottom = tower.height * 0.82, holeTop = tower.height * 0.94;
        box(0, holeBottom / 2, 0, width, holeBottom, width * 0.48);
        for (const side of [-1, 1]) box(side * width * 0.42, (holeBottom + holeTop) / 2, 0, width * 0.16, holeTop - holeBottom, width * 0.48);
        box(0, (holeTop + tower.height) / 2, 0, width, tower.height - holeTop, width * 0.48);
        for (let i = 0; i < 4; i++) frame([-width / 2, tower.height * i / 4, -width * 0.25], [width / 2, tower.height * i / 4, -width * 0.25]);
        continue;
      }
      const top = tower.kind === 'canton' ? tower.height * 0.75 : tower.height;
      const point = (t, angle) => {
        const radius = tower.kind === 'canton' ? tower.radius * (0.36 + 2.4 * (t - 0.53) ** 2) : tower.kind === 'bamboo' ? tower.radius * (1 - t ** 2.5) + 1 : tower.radius * (1 - t * 0.5) * (1 + 0.12 * Math.cos(angle * 3));
        const twist = tower.kind === 'bamboo' ? 0 : t * Math.PI * 0.7;
        return [Math.cos(angle + twist) * radius, t * top, Math.sin(angle + twist) * radius];
      };
      if (tower.kind === 'canton') {
        const core = new THREE.Mesh(new THREE.CylinderGeometry(10, 15, top, 12), material); core.position.y = top / 2; group.add(core);
        const deck = new THREE.Mesh(new THREE.CylinderGeometry(35, 32, 24, 32), material); deck.position.y = top * 0.96; group.add(deck);
        frame([0, top, 0], [0, tower.height, 0], 3);
      } else {
        const positions = [], indices = [];
        for (let level = 0; level <= detail.levels; level++) for (let side = 0; side <= detail.segments; side++) positions.push(...point(level / detail.levels, side / detail.segments * Math.PI * 2));
        for (let level = 0; level < detail.levels; level++) for (let side = 0; side < detail.segments; side++) {
          const a = level * (detail.segments + 1) + side, b = a + detail.segments + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); group.add(new THREE.Mesh(geometry, material));
      }
      for (let level = 0; level < detail.levels; level++) {
        if(level%4===0)yield;
        const t = level / detail.levels, next = (level + 1) / detail.levels;
        for (let side = 0; side < detail.struts; side++) {
          const angle = side / detail.struts * Math.PI * 2, adjacent = (side + 1) / detail.struts * Math.PI * 2;
          frame(point(t, angle), point(next, tower.kind === 'bamboo' ? adjacent : angle));
          frame(point(t, angle), point(t, adjacent), detail.ringRadius);
        }
      }
    }
    const segments = this.frameSegments, dummy = new THREE.Object3D(), direction = new THREE.Vector3(), center = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const frames = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshStandardMaterial({color: detail.frameColor, roughness: 0.7}), segments.length);
    for(const [index,[a,b,radius]] of segments.entries()) {
      direction.subVectors(b, a); dummy.position.copy(center.addVectors(a, b).multiplyScalar(0.5));
      dummy.scale.set(radius, direction.length(), radius); dummy.quaternion.setFromUnitVectors(up, direction.normalize()); dummy.updateMatrix(); frames.setMatrixAt(index, dummy.matrix);
      if(index%64===0)yield;
    }
    frames.computeBoundingSphere(); this.add(frames);
    // 在主场景合批移除子网格前保存完整模板；桥梁支架只属于原航线。
    this.landmarkTemplate=new THREE.Group();
    for(const object of this.landmarkObjects)this.landmarkTemplate.add(object.clone());
    const landmarkFrames=new THREE.InstancedMesh(frames.geometry,frames.material,segments.length-frameStart);
    landmarkFrames.instanceMatrix.array.set(frames.instanceMatrix.array.subarray(frameStart*16));
    landmarkFrames.computeBoundingSphere();this.landmarkTemplate.add(landmarkFrames);
    yield* batchStaticMeshSteps(this.landmarkTemplate);this.landmarkObjects.length=0;this.frameSegments.length=0;
  }

  *addFarmland() {
    const fields=yield* createCountryside({width:7200,length:4600,centerZ:clusterZ('fields'),seed:462781,
      heightAt:(x,z)=>this.world.heightAt(x,z),treeField:this.world.trees,trees:{bank:this.mountains.treeBank,geometry:this.mountains.treeGeometry,material:this.mountains.treeMaterial,farGeometry:this.mountains.treeSpriteGeometry,farMaterial:this.mountains.treeSpriteMaterial}});
    this.add(fields);
  }

  addWaterfall() {
    if(!this.world.waterfalls.length)return;
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 128;
    const context = canvas.getContext('2d'); context.fillStyle = '#9ddce4'; context.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 36; i++) { context.fillStyle = i % 2 ? '#e5f4ef' : '#70bdd0'; context.fillRect(i * 7 % 32, i * 19 % 128, 2, 16); }
    this.fallTexture = new THREE.CanvasTexture(canvas); this.fallTexture.colorSpace = THREE.SRGBColorSpace;
    this.fallTexture.wrapS = this.fallTexture.wrapT = THREE.RepeatWrapping; this.fallTexture.repeat.set(3, 4);
    for (const fall of this.world.waterfalls) {
      const height = fall.top - fall.bottom, z = fall.z + (fall.passable ? 0 : fall.depth + 0.3);
      const material = new THREE.MeshBasicMaterial({map: this.fallTexture, side: THREE.DoubleSide, transparent: fall.passable, opacity: fall.passable ? 0.72 : 1, depthWrite: !fall.passable});
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(fall.width, height), material);
      mesh.position.set(fall.x, (fall.top + fall.bottom) / 2, z); this.add(mesh);
      if (fall.source) {
        const positions = [], indices = [];
        for (let row = 0; row <= 10; row++) {
          const t = row / 10, x = THREE.MathUtils.lerp(fall.source.x, fall.x, t), y = THREE.MathUtils.lerp(fall.source.y, fall.top, t * t), z = THREE.MathUtils.lerp(fall.source.z, fall.z, t);
          for (const side of [-1, 1]) positions.push(x + side * fall.width * (0.35 + 0.15 * t), y, z);
          if (row) { const a = (row - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const stream = new THREE.BufferGeometry(); stream.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); stream.setIndex(indices); stream.computeVertexNormals(); this.add(new THREE.Mesh(stream, new THREE.MeshBasicMaterial({color: 0xa5dee2, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false})));
      }
      if (!fall.passable) {
        const rock = new THREE.Mesh(new THREE.BoxGeometry(fall.width, height, fall.depth), new THREE.MeshStandardMaterial({color: 0x638477, roughness: 1}));
        rock.position.set(fall.x, fall.bottom + height / 2, fall.z + fall.depth / 2); this.add(rock);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(fall.width * 0.8, 32), new THREE.MeshStandardMaterial({color: LANDSCAPE.river.waterColor}));
        pool.rotation.x = -Math.PI / 2; pool.position.set(fall.x, fall.bottom + 0.08, z + 80); this.add(pool);
      }
      const foam = new THREE.Mesh(new THREE.TorusGeometry(fall.width * 0.48, 6, 5, 24), new THREE.MeshBasicMaterial({color: 0xe3f3ee}));
      foam.rotation.x = Math.PI / 2; foam.position.set(fall.x, fall.bottom + 2, z + 20); this.add(foam);
    }
  }

  update(seconds, camera, position) { if(this.fallTexture)this.fallTexture.offset.y = -seconds * 0.7; this.coast.update(seconds);this.regionalWaterView.update(seconds);this.loopView.update(position,seconds); }
}
