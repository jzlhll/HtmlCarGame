import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDSCAPE } from './config.js';

// 仅合并静态、不透明的普通网格；空间分桶保留裁剪，阴影和顶点属性分别分组。
export function batchStaticMeshes(root,cellSize=LANDSCAPE.staticBatchCell) {
  const iterator=batchStaticMeshSteps(root,cellSize);while(!iterator.next().done){}
}

export function* batchStaticMeshSteps(root, cellSize = LANDSCAPE.staticBatchCell) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), batches = new Map(), center = new THREE.Vector3();
  const sourceGeometries = new Set();
  const objects=[];root.traverse(mesh=>objects.push(mesh));
  for(const mesh of objects) {
    if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(mesh.material) || mesh.material.transparent) continue;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const transform = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    geometry.boundingBox.getCenter(center).applyMatrix4(transform);
    const attributes = Object.entries(geometry.attributes).map(([name, value]) => `${name}:${value.itemSize}:${value.normalized}`).sort().join(',');
    const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${attributes}:${Math.floor(center.x / cellSize)},${Math.floor(center.z / cellSize)}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push({mesh, transform});
    sourceGeometries.add(geometry);yield;
  }
  for (const entries of batches.values()) {
    if (entries.length < 2) continue;
    // 全索引分组保留共享顶点；混合分组才统一展开，避免合并属性不兼容。
    const indexed=entries.every(({mesh})=>mesh.geometry.index!==null),parts=[];
    for(const {mesh,transform}of entries){
      const geometry=!indexed&&mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      parts.push(geometry.applyMatrix4(transform));yield;
    }
    const source = entries[0].mesh, geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const combined = new THREE.Mesh(geometry, source.material);
    combined.castShadow = source.castShadow; combined.receiveShadow = source.receiveShadow;
    root.add(combined);
    for (const {mesh} of entries) mesh.removeFromParent();yield;
  }
  const live = new Set();
  root.traverse(mesh => { if (mesh.isMesh) live.add(mesh.geometry); });
  for (const geometry of sourceGeometries) if (!live.has(geometry)) geometry.dispose();
}
