import * as THREE from 'three';
import { vehicleModel } from './models.js';
import { dinosaurModel, animateDinosaur } from './dinosaur-models.js';
import { coinModel, rocketModel } from './arsenal-models.js';

// 通关说明使用游戏实际模型，只在首次展示时生成三张预览，不增加常驻 WebGL 上下文。
export function levelGuideImages(renderer){
  const dinosaur=dinosaurModel('chaser');animateDinosaur(dinosaur,0,true,.125);
  const treasure=new THREE.Group(),small=coinModel(),large=coinModel(true),rocket=rocketModel(true);
  small.position.set(-1,0,0);large.position.set(.8,0,0);rocket.position.set(0,-1,0);rocket.rotation.y=Math.PI/2;treasure.add(small,large,rocket);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x152e29);scene.add(new THREE.HemisphereLight(0xe3f0ff,0x566b42,2.2));const light=new THREE.DirectionalLight(0xfff1cb,3);light.position.set(-5,8,-6);scene.add(light);
  const target=new THREE.WebGLRenderTarget(240,160),camera=new THREE.PerspectiveCamera(35,1.5,.1,250),previous=renderer.getRenderTarget(),pixels=new Uint8Array(240*160*4),images=[];
  target.texture.colorSpace=THREE.SRGBColorSpace;
  try{
    renderer.setRenderTarget(target);
    for(const model of [dinosaur,vehicleModel(6),treasure]){
      scene.add(model);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),sphere=bounds.getBoundingSphere(new THREE.Sphere());
      camera.position.copy(center).add(new THREE.Vector3(1,.7,-1).normalize().multiplyScalar(sphere.radius*3.7));camera.lookAt(center);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,240,160,pixels);
      const canvas=document.createElement('canvas');canvas.width=240;canvas.height=160;const ctx=canvas.getContext('2d'),data=ctx.createImageData(240,160);
      for(let y=0;y<160;y++)data.data.set(pixels.subarray((159-y)*240*4,(160-y)*240*4),y*240*4);
      ctx.putImageData(data,0,0);images.push(canvas.toDataURL('image/png'));scene.remove(model);
    }
  }finally{renderer.setRenderTarget(previous);target.dispose();}
  return images;
}
