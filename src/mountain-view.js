import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDSCAPE, JOURNEY, SCENERY, SURFACE_APPEARANCE, WORLD_HEIGHT, TREE_CONTACT } from './config.js';
import { prepareTreeModels } from './tree-models.js';
import { createForestLOD } from './forest-view.js';
import { treeDimensions } from './tree-contact.js';
import { mountainIndices, sampleMountain, smoothRange, terrainNoise } from './terrain.js';
import { createTerrainDetail, createTerrainMaterial, createTerrainLOD } from './terrain-material.js';
import { surfaceTexture } from './surface-assets.js';

// 只消费世界山面；细节切换、岩纹和树冠不改变逻辑地形或悬空岩体。
export class MountainView extends THREE.Group {
  constructor(world) {
    super();
    this.world = world;
    this.settings = LANDSCAPE.terrain;
    this.detail = createTerrainDetail();
    this.materials=[0,1,2].map(level=>createTerrainMaterial(this.detail,level));
    this.rollingMaterials=[0,1,2].map(level=>{
      const material=createTerrainMaterial(this.detail,level);material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;return material;
    });
    this.textures = [this.detail];
  }

  *buildRolling() {
    for(const solid of this.world.solids){yield* this.addRock(solid);yield;}
    for(const surface of this.world.mountainSurfaces){
      yield {task:'mountain-surface'};yield* this.addMountain(surface);yield 'boundary';
    }
  }

  *makeTreeResources() {
    this.treeBank=yield* prepareTreeModels();
    this.textures.push(surfaceTexture('foliage-color'));
    const first=this.treeBank[0];this.treeGeometry=first.geometry;this.treeSpriteGeometry=first.farGeometry;this.treeMaterial=first.material;this.treeSpriteMaterial=first.farMaterial;
    const warmup=new THREE.Group();warmup.visible=false;
    for(const model of this.treeBank)warmup.add(new THREE.Mesh(model.geometry,model.material),new THREE.Mesh(model.midGeometry,model.midMaterial),new THREE.Mesh(model.farGeometry,model.farMaterial));this.add(warmup);yield;
  }

  *addMountain(surface) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(surface.positions, 3));
    geometry.setIndex(mountainIndices(surface.n)); geometry.computeVertexNormals();
    const settings = this.settings, positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const rolling=surface.kind==='rolling',uv=[];
    const colors = [], biomes = [], vegetation = new Float32Array(positions.count);
    const rock = new THREE.Color(settings.rockColor), soil = new THREE.Color(settings.soilColor), green = new THREE.Color(settings.lowColor);
    const red = new THREE.Color(settings.danxiaColor), snow = new THREE.Color(settings.snowColor), ground = new THREE.Color(SCENERY.colors.ground), color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), slope = normals.getY(i);
      const patch = terrainNoise(x * 0.0025, z * 0.0025, surface.seed);
      const cover = smoothRange(...settings.vegetationSlope, slope) * (1 - smoothRange(settings.treeLine - settings.treeTransition, settings.treeLine, y));
      const relief = y - this.world.baseHeightAt(x, z), edge = smoothRange(0, 24, relief);
      const plants = cover * (0.48 + patch * 0.52);
      vegetation[i] = plants * smoothRange(0.35, 0.65, slope);
      color.copy(surface.kind === 'danxia' ? red : rock).lerp(soil, smoothRange(0.55, 0.9, slope) * 0.28).lerp(green, plants);
      color.multiplyScalar(0.84 + terrainNoise(x * 0.008, z * 0.008, surface.seed + 2) * 0.28);
      const snowCover = smoothRange(settings.snowHeight, settings.snowHeight + settings.snowTransition, y) * smoothRange(0.2, 0.7, slope);
      color.lerp(snow, snowCover);
      color.lerp(ground, 1 - edge);
      // 静态山谷遮蔽在建图时计算，避免每帧为整条航线重绘巨大阴影贴图。
      let occlusion = 0;
      for (const distance of [70, 200, 550]) {
        const [sx, sy, sz] = settings.sunDirection;
        if (sampleMountain(surface, x + sx / sy * distance, z + sz / sy * distance) > y + distance + 2) { occlusion = 0.8; break; }
      }
      // 小丘与平地共用世界UV和草纹，边缘不露出浅色矩形底座。
      if(rolling)color.copy(ground).lerp(green,edge*.45).multiplyScalar(.86+patch*.2);
      uv.push(x/SURFACE_APPEARANCE.grassTileMetres,z/SURFACE_APPEARANCE.grassTileMetres);
      colors.push(color.r, color.g, color.b); biomes.push(plants, surface.kind === 'danxia' ? 1 : 0, occlusion, edge);
      if(i%256===0)yield;
    }
    if(rolling)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('biome', new THREE.Float32BufferAttribute(biomes, 4));
    const geometries=[geometry,this.reduceGeometry(geometry,surface.n,2),this.reduceGeometry(geometry,surface.n,4)];
    const bounds=new THREE.Box3(new THREE.Vector3(surface.minX,surface.minY,surface.minZ),new THREE.Vector3(surface.maxX,surface.maxY,surface.maxZ));
    this.add(createTerrainLOD(geometries,rolling?this.rollingMaterials:this.materials,bounds,{receiveShadow:true}));
    if(surface.kind!=='rolling')yield* this.plantMountain(surface, vegetation);
  }

  reduceGeometry(source, n, step) {
    const geometry = new THREE.BufferGeometry();
    // 顶点和法线共享，仅切换索引；远山不重新生成轮廓或分配缓冲区。
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(mountainIndices(n, step)); return geometry;
  }

  *plantMountain(surface, vegetation) {
    const spacing = this.settings.forestSpacing, chunks = new Map(), selected = [], n = surface.n;
    let seed = surface.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    let count = 0, visited=0;
    for (let z = surface.minZ + spacing / 2; z < surface.maxZ; z += spacing) for (let x = surface.minX + spacing / 2; x < surface.maxX; x += spacing) {
      if(visited++%64===0)yield;
      const px = x + (random() - 0.5) * spacing * 0.85, pz = z + (random() - 0.5) * spacing * 0.85;
      const gx = Math.round((px - surface.minX) / surface.dx), gz = Math.round((pz - surface.minZ) / surface.dz);
      const cover = vegetation[gz * (n + 1) + gx];
      const y = sampleMountain(surface, px, pz);
      if (random() > cover * 0.88 || y < this.world.baseHeightAt(px, pz) + 3 || this.world.heightAt(px, pz) > y + 1) continue;
      random();
      const tree = {x: px, y: y - 0.3, z: pz, yaw: random() * Math.PI * 2, color: this.settings.canopyColors[Math.floor(random() * this.settings.canopyColors.length)]};
      count++;
      if (selected.length < this.settings.maxTrees) selected.push(tree);
      else { const replace = Math.floor(random() * count); if (replace < selected.length) selected[replace] = tree; }
    }
    for (const tree of selected) {
      const key = `${Math.floor(tree.x / this.settings.forestCell)},${Math.floor(tree.z / this.settings.forestCell)}`;
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key).push(tree);
    }
    for (const trees of chunks.values()){yield* this.addForestChunk(trees,{mountain:true});yield;}
  }

  *addForestChunk(trees,{mountain=false}={}) {
    trees=trees.filter(tree=>tree.y<WORLD_HEIGHT.objectMax-.1);
    if(!trees.length)return;
    const matrices=new Float32Array(trees.length*16),colors=new Float32Array(trees.length*3),species=new Uint8Array(trees.length),pose=new THREE.Object3D(),color=new THREE.Color();
    for(const [i,tree]of trees.entries()){
      const size=treeDimensions(tree.x,tree.z,LANDSCAPE.seed,tree.y,{mountain});pose.position.set(tree.x,tree.y,tree.z);pose.rotation.y=tree.yaw;pose.scale.set(size.width,size.y,size.width);pose.updateMatrix();
      matrices.set(pose.matrix.elements,i*16);color.setHex(tree.color).toArray(colors,i*3);species[i]=size.type;if(i%128===0)yield;
    }
    const record={count:trees.length,matrices,colors,species};
    this.add(yield* createForestLOD(record,{bank:this.treeBank},0,{treeNear:this.settings.treeNear,treeFar:this.settings.treeFar,treeField:this.world.trees}));
  }

  *addRock(solid) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(solid.positions, 3)); geometry.computeVertexNormals();
    const cap = ['张家界石柱', '空中圆形山', '斜伸岩柱'].includes(solid.name), colors = [], biomes = [], color = new THREE.Color();
    const appearance=JOURNEY.pillarSurface, light=new THREE.Color(appearance.light), weathered=new THREE.Color(appearance.weathered), capLight=new THREE.Color(appearance.capLight);
    const positions=geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const top = cap && geometry.attributes.normal.getY(i) > 0.65;
      color.setHex(top ? JOURNEY.rockColors.cap : solid.color);
      if (cap) {
        const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
        const patch=terrainNoise(x*appearance.patchScale,z*appearance.patchScale+y*appearance.heightScale,JOURNEY.pillars.seed);
        if (top) color.lerp(capLight,patch*appearance.lightBlend);
        else {
          const streak=terrainNoise(x*appearance.streakScale+y*appearance.streakDrift,z*appearance.streakScale,JOURNEY.pillars.seed+1);
          color.lerp(light,patch*appearance.lightBlend).lerp(weathered,smoothRange(...appearance.weatherThreshold,streak)*appearance.weathering);
        }
      }
      colors.push(color.r, color.g, color.b); biomes.push(top ? 0.95 : 0, cap&&!top?appearance.strataStrength:0, 0, 1);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('biome', new THREE.Float32BufferAttribute(biomes, 4));
    geometry.computeBoundingBox();
    this.add(createTerrainLOD([geometry],this.materials,geometry.boundingBox,{receiveShadow:true}));
    if (!cap) return;
    const trees = [], {top, radius, floor, outline} = solid.cap;
    const center=outline.reduce((point,next)=>[point[0]+next[0]/outline.length,point[1]+next[1]/outline.length],[0,0]);
    if(floor+top>WORLD_HEIGHT.objectMax-32)return;
    const count=Math.min(24,Math.round(radius*0.08));
    for (let i=0;i<count;i++) {
      const along=(i*(Math.sqrt(5)-1)/2%1)*outline.length,index=Math.floor(along),a=outline[index],b=outline[(index+1)%outline.length];
      const fraction=along-index,inset=Math.sqrt((i+0.5)/count)*JOURNEY.pillars.crownInset;
      const x=center[0]+(a[0]+(b[0]-a[0])*fraction-center[0])*inset;
      const z=center[1]+(a[1]+(b[1]-a[1])*fraction-center[1])*inset;
      trees.push({x,y:floor+top-0.2,z,yaw:i*2.399963,color:this.settings.canopyColors[i%this.settings.canopyColors.length]});
    }
    yield* this.addForestChunk(trees,{mountain:true});
  }

}
