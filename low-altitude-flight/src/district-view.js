import * as THREE from 'three';

// 港口、货箱、停车场和车辆按材质实例化，全部在准备队列中建立。
export function* createDistrict(parts) {
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),pose=new THREE.Object3D(),color=new THREE.Color();
  const roles=[...new Set(parts.map(part=>part.role))];
  for(const role of roles){
    const selected=parts.filter(part=>part.role===role),material=new THREE.MeshStandardMaterial({roughness:role==='glass'?.22:role==='container'?.64:.85,metalness:role==='glass'?.3:role==='container'?.22:0});
    if(role==='container'||role==='warehouse'){
      material.customProgramCacheKey=()=> 'cargo-corrugation-v1';
      material.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCargoUv;');
        shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvCargoUv=uv;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vCargoUv;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          float ribs=.84+.16*smoothstep(-.6,.4,sin(vCargoUv.x*100.53));
          float frame=smoothstep(.015,.035,min(min(vCargoUv.x,1.0-vCargoUv.x),min(vCargoUv.y,1.0-vCargoUv.y)));
          diffuseColor.rgb*=ribs*mix(.62,1.0,frame);`);
      };
    }
    if(role==='parking'){
      material.customProgramCacheKey=()=> 'parking-bays-v1';
      material.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vParkingUv;');
        shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvParkingUv=uv;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vParkingUv;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec2 bay=fract(vParkingUv*vec2(22.5,9.714));
          float line=(1.0-smoothstep(.015,.035,min(bay.x,1.0-bay.x)))*step(.2,bay.y)*step(bay.y,.78);
          line=max(line,(1.0-smoothstep(.012,.03,abs(bay.y-.2)))*step(.05,bay.x)*step(bay.x,.95));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.65,.59),line);`);
      };
    }
    const mesh=new THREE.InstancedMesh(geometry,material,selected.length);
    selected.forEach((part,index)=>{pose.position.set(part.x,part.y,part.z);pose.scale.set(part.width,part.height,part.depth);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);mesh.setColorAt(index,color.setHex(part.color));});mesh.computeBoundingSphere();group.add(mesh);yield;
  }
  return group;
}
