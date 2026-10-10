import * as THREE from 'three';

// 系统车辆与吞吃、撞飞动画共用部件实例批次，保留独立车轮、灯光和车辆变换。
export class TrafficView {
  constructor(scene){
    this.scene=scene;this.batches=new Map();this.parts=new WeakMap();this.tintParts=new WeakMap();this.tintMaterials=new Map();this.bounds=new WeakMap();this.cameraFrustum=new THREE.Frustum();this.shadowFrustum=new THREE.Frustum();
    this.castShadows=true;this.shadowDistance=Infinity;this.matrix=new THREE.Matrix4();this.sphere=new THREE.Sphere();
    this.collect=part=>{
      if(!part.isMesh)return;
      const source=part.material;
      const tinted=this.tintTraffic&&source.isMeshStandardMaterial&&!source.map&&!source.vertexColors&&!source.transparent&&source.emissive.getHex()===0;
      const parts=tinted?this.tintParts:this.parts;
      let variants=parts.get(part);if(!variants){variants=new Map();parts.set(part,variants);}
      const shadow=part.castShadow&&this.castShadows;let batch=variants.get(shadow);
      if(!batch){
        const materialKey=tinted?'tint:'+source.roughness+':'+source.metalness+':'+source.side:source.id;
        const key=part.geometry.id+':'+materialKey+':'+shadow+':'+part.receiveShadow;
        batch=this.batches.get(key);
        if(!batch){
          let material=source;
          if(tinted){
            material=this.tintMaterials.get(materialKey);
            if(!material){material=source.clone();material.color.setHex(0xffffff);this.tintMaterials.set(materialKey,material);}
          }
          batch={mesh:this.mesh(part,128,material,tinted,shadow),count:0,tinted};this.batches.set(key,batch);
        }
        variants.set(shadow,batch);
      }
      if(batch.count===batch.mesh.instanceMatrix.count){
        const previous=batch.mesh,next=this.mesh(previous,previous.instanceMatrix.count*2,previous.material,batch.tinted);
        next.instanceMatrix.array.set(previous.instanceMatrix.array);
        if(batch.tinted)next.instanceColor.array.set(previous.instanceColor.array);
        this.scene.remove(previous);previous.dispose();batch.mesh=next;
      }
      if(batch.tinted)batch.mesh.setColorAt(batch.count,source.color);
      batch.mesh.setMatrixAt(batch.count++,part.matrixWorld);
    };
  }
  mesh(part,capacity,material=part.material,tinted=false,castShadow=part.castShadow){
    const mesh=new THREE.InstancedMesh(part.geometry,material,capacity);
    if(tinted){mesh.setColorAt(0,new THREE.Color(0xffffff));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);}
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;
    mesh.castShadow=castShadow;mesh.receiveShadow=part.receiveShadow;this.scene.add(mesh);return mesh;
  }
  prewarm(view,objects){
    this.tintTraffic=true;
    view.updateMatrixWorld(true);
    for(const shadow of [false,true]){
      this.castShadows=shadow;
      for(const batch of this.batches.values())batch.count=0;
      view.traverseVisible(this.collect);
      for(const batch of this.batches.values()){
        const required=batch.count*objects,previous=batch.mesh;
        if(required<=previous.instanceMatrix.count)continue;
        let capacity=previous.instanceMatrix.count;while(capacity<required)capacity*=2;
        const next=this.mesh(previous,capacity,previous.material,batch.tinted);
        next.instanceMatrix.array.set(previous.instanceMatrix.array);
        if(batch.tinted)next.instanceColor.array.set(previous.instanceColor.array);
        this.scene.remove(previous);previous.dispose();batch.mesh=next;
      }
    }
  }

  begin(camera,light,tintTraffic=false,shadowDistance=Infinity){
    this.tintTraffic=tintTraffic;this.shadowEnabled=light.castShadow;this.shadowDistance=shadowDistance;
    for(const batch of this.batches.values())batch.count=0;
    camera.updateMatrixWorld();
    this.cameraFrustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    light.updateMatrixWorld();light.target.updateMatrixWorld();light.shadow.updateMatrices(light);
    this.shadowFrustum.copy(light.shadow.getFrustum());
  }
  visibleAt(point,radius){
    this.sphere.center.set(point.x,point.y,point.z);this.sphere.radius=radius;
    return this.cameraFrustum.intersectsSphere(this.sphere)||this.shadowEnabled&&Math.hypot(point.x,point.z)<=this.shadowDistance+radius&&this.shadowFrustum.intersectsSphere(this.sphere);
  }
  add(view,animate=null){
    if(!view.visible)return false;
    view.updateWorldMatrix(true,false);
    let sphere=this.bounds.get(view);
    if(!sphere){
      const cached=view.userData.batchBounds;
      if(cached){sphere=new THREE.Sphere(new THREE.Vector3().fromArray(cached.center),cached.radius);this.bounds.set(view,sphere);}
      else{
        view.updateMatrixWorld(true);
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
    }
    this.sphere.copy(sphere).applyMatrix4(view.matrixWorld);
    this.castShadows=this.shadowEnabled&&Math.hypot(this.sphere.center.x,this.sphere.center.z)<=this.shadowDistance+this.sphere.radius&&this.shadowFrustum.intersectsSphere(this.sphere);
    if(!this.cameraFrustum.intersectsSphere(this.sphere)&&!this.castShadows)return false;
    if(animate)animate();
    view.updateMatrixWorld(true);
    view.traverseVisible(this.collect);
    return true;
  }
  finish(){
    for(const {mesh,count}of this.batches.values()){
      mesh.count=count;mesh.visible=count>0;
      if(count){mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor){mesh.instanceColor.clearUpdateRanges();mesh.instanceColor.addUpdateRange(0,count*3);mesh.instanceColor.needsUpdate=true;}
      }
    }
  }
}
