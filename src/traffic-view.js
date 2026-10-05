import * as THREE from 'three';

// 系统车辆与吞吃、撞飞动画共用部件实例批次，保留独立车轮、灯光和车辆变换。
export class TrafficView {
  constructor(scene){
    this.scene=scene;this.batches=new Map();this.parts=new WeakMap();this.bounds=new WeakMap();this.cameraFrustum=new THREE.Frustum();this.shadowFrustum=new THREE.Frustum();
    this.matrix=new THREE.Matrix4();this.sphere=new THREE.Sphere();
    this.collect=part=>{
      if(!part.isMesh)return;
      let batch=this.parts.get(part);
      if(!batch){
        const key=part.geometry.id+':'+part.material.id+':'+part.castShadow+':'+part.receiveShadow;
        batch=this.batches.get(key);
        if(!batch){
          batch={mesh:this.mesh(part,128),count:0};this.batches.set(key,batch);
        }
        this.parts.set(part,batch);
      }
      if(batch.count===batch.mesh.instanceMatrix.count){
        const previous=batch.mesh,next=this.mesh(previous,previous.instanceMatrix.count*2);
        next.instanceMatrix.array.set(previous.instanceMatrix.array);
        this.scene.remove(previous);previous.dispose();batch.mesh=next;
      }
      batch.mesh.setMatrixAt(batch.count++,part.matrixWorld);
    };
  }
  mesh(part,capacity){
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;
    mesh.castShadow=part.castShadow;mesh.receiveShadow=part.receiveShadow;this.scene.add(mesh);return mesh;
  }
  begin(camera,light){
    for(const batch of this.batches.values())batch.count=0;
    camera.updateMatrixWorld();
    this.cameraFrustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    light.updateMatrixWorld();light.target.updateMatrixWorld();light.shadow.updateMatrices(light);
    this.shadowFrustum.copy(light.shadow.getFrustum());
  }
  add(view){
    if(!view.visible)return;
    view.updateMatrixWorld(true);
    let sphere=this.bounds.get(view);
    if(!sphere){
      const box=new THREE.Box3();
      // 边界使用车辆局部坐标，额外留出转向灯移到车侧的空间。
      view.updateMatrix();this.matrix.copy(view.matrixWorld).invert();
      view.traverse(part=>{
        if(!part.isMesh)return;
        if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
        const bounds=part.geometry.boundingBox.clone();
        bounds.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix,part.matrixWorld));box.union(bounds);
      });
      sphere=box.getBoundingSphere(new THREE.Sphere());sphere.radius+=1;this.bounds.set(view,sphere);
    }
    this.sphere.copy(sphere).applyMatrix4(view.matrixWorld);
    if(!this.cameraFrustum.intersectsSphere(this.sphere)&&!this.shadowFrustum.intersectsSphere(this.sphere))return;
    view.traverseVisible(this.collect);
  }
  finish(){
    for(const {mesh,count}of this.batches.values()){
      mesh.count=count;mesh.visible=count>0;
      if(count){mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;}
    }
  }
}
