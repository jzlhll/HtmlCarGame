import * as THREE from 'three';
import { CanopyLOD } from './canopy-lod.js';
import { TREE_MODELS, COUNTRYSIDE, VIEW_DISTANCE } from './config.js';

// 中远景保留大块合批，仅靠近的块展开为更细的近／中景子组。
export function* createForestLOD(record,trees,centerZ=0,{treeNear=COUNTRYSIDE.treeNear,treeFar=COUNTRYSIDE.treeFar,treeField}={}) {
  const root=new THREE.Group(),chunks=new Map(),size=TREE_MODELS.chunkSize,matrix=new THREE.Matrix4(),color=new THREE.Color(),tint=new THREE.Color();
  root.name='Forest chunks';const rangeBounds=new THREE.Box3(),visibleDistance=Math.max(treeFar,TREE_MODELS.visibleDistance)*VIEW_DISTANCE.scale;
  for(let i=0;i<record.count;i++){
    const offset=i*16,x=record.matrices[offset+12],z=record.matrices[offset+14],key=Math.floor(x/size)+':'+Math.floor((z-centerZ)/size);
    let chunk=chunks.get(key);if(!chunk)chunks.set(key,chunk=Array.from({length:TREE_MODELS.species.length},()=>[]));
    chunk[record.species[i]].push(i);if(i%128===0)yield;
  }
  for(const byType of chunks.values()){
    const levels=[new THREE.Group(),new THREE.Group(),new THREE.Group()],bounds=new THREE.Box3();
    for(const [type,ids]of byType.entries()){
      if(!ids.length)continue;
      const model=trees.bank[type],mid=yield* instances(ids,model.midGeometry,model.midMaterial,type);
      levels[1].add(mid);bounds.union(mid.boundingBox);
      const far=shared(mid,model.farGeometry,model.farMaterial);levels[2].add(far);bounds.union(far.boundingBox);
      const patches=new Map();
      for(const id of ids){
        const offset=id*16,key=Math.floor(record.matrices[offset+12]/TREE_MODELS.nearChunkSize)+':'+Math.floor((record.matrices[offset+14]-centerZ)/TREE_MODELS.nearChunkSize);
        if(!patches.has(key))patches.set(key,[]);patches.get(key).push(id);
      }
      for(const patch of patches.values()){
        const near=yield* instances(patch,model.geometry,model.material,type),medium=shared(near,model.midGeometry,model.midMaterial);
        const patchBounds=near.boundingBox.clone().union(medium.boundingBox);bounds.union(patchBounds);
        let leafSize=0;
        for(const id of patch){
          const offset=id*16,m=record.matrices;
          leafSize=Math.max(leafSize,(model.leafSize||0)*Math.max(Math.hypot(m[offset],m[offset+1],m[offset+2]),Math.hypot(m[offset+4],m[offset+5],m[offset+6]),Math.hypot(m[offset+8],m[offset+9],m[offset+10])));
        }
        patchBounds.min.z-=centerZ;patchBounds.max.z-=centerZ;
        const detail=new CanopyLOD(patchBounds,leafSize);detail.name='Forest detail';detail.userData.detailKind='forestDetail';detail.addLevel(near,0,.12);detail.addLevel(medium,treeNear*TREE_MODELS.nearDistanceScale,.12);levels[0].add(detail);yield;
      }
    }
    rangeBounds.union(bounds);bounds.min.z-=centerZ;bounds.max.z-=centerZ;
    const lod=new CanopyLOD(bounds);lod.position.z=centerZ;lod.addLevel(levels[0],0,.12);lod.addLevel(levels[1],treeNear*TREE_MODELS.nearDistanceScale,.12);lod.addLevel(levels[2],TREE_MODELS.midDistance*VIEW_DISTANCE.scale,.12);lod.addLevel(new THREE.Group(),visibleDistance,.12);root.add(lod);yield;
  }
  // 接触索引只登记原始记录一次，不能随显示子组重复添加。
  if(treeField)yield* treeField.addMatrices(record.matrices,record.count,record.species);
  if(rangeBounds.isEmpty())return root;
  const range=new CanopyLOD(rangeBounds);range.name='Forest range';range.addLevel(root,0,.12);range.addLevel(new THREE.Group(),visibleDistance,.12);return range;

  function* instances(ids,geometry,material,type){
    const mesh=new THREE.InstancedMesh(geometry,material,ids.length);tint.setHex(TREE_MODELS.species[type].color);
    for(const [index,id]of ids.entries()){
      matrix.fromArray(record.matrices,id*16);mesh.setMatrixAt(index,matrix);
      color.fromArray(record.colors,id*3).lerp(tint,.65).multiplyScalar(1.13);mesh.setColorAt(index,color);
      if(index%64===0)yield;
    }
    mesh.position.z=-centerZ;mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
  }

  function shared(source,geometry,material){
    const mesh=new THREE.InstancedMesh(geometry,material,0);mesh.count=source.count;mesh.instanceMatrix=source.instanceMatrix;mesh.instanceColor=source.instanceColor;mesh.position.z=-centerZ;mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
  }
}
