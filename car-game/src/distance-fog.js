import * as THREE from 'three';
import { WEATHER } from './config.js';

// 大雾按片元到玩家的水平距离渐变，前后共用边界，实例车辆与道路表面保持一致。
export class DistanceFog {
  constructor(scene,camera){
    this.scene=scene;this.camera=camera;this.materials=new WeakSet();this.objects=new WeakSet();
    this.uniforms={
      vehicleFogEnabled:{value:0},vehicleFogCenter:{value:new THREE.Vector2()},
      vehicleFogCameraWorld:{value:camera.matrixWorld},vehicleFogColor:{value:new THREE.Color()},
      vehicleFogNear:{value:WEATHER.fogNear},vehicleFogFar:{value:WEATHER.fogFar},
    };
    this.registerObject=object=>{
      if(!this.objects.has(object)){this.objects.add(object);object.addEventListener('childadded',this.childAdded);}
      const materials=object.material;
      if(Array.isArray(materials)){for(const material of materials)this.bind(material);}
      else if(materials)this.bind(materials);
    };
    this.childAdded=event=>event.child.traverse(this.registerObject);
    scene.traverse(this.registerObject);
  }
  bind(material){
    if(this.materials.has(material))return;
    this.materials.add(material);
    const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey;
    material.onBeforeCompile=(shader,renderer)=>{
      compile.call(material,shader,renderer);
      if(!shader.vertexShader.includes('#include <fog_vertex>')||!shader.fragmentShader.includes('#include <fog_fragment>'))return;
      Object.assign(shader.uniforms,this.uniforms);
      // mvPosition 已包含实例及父节点变换，逆相机变换后得到玩家所在渲染坐标系。
      shader.vertexShader='uniform mat4 vehicleFogCameraWorld;\nvarying vec2 vVehicleFogPosition;\n'+shader.vertexShader.replace('#include <fog_vertex>',`
        #include <fog_vertex>
        vVehicleFogPosition = (vehicleFogCameraWorld * mvPosition).xz;
      `);
      shader.fragmentShader=`
        uniform float vehicleFogEnabled;
        uniform vec2 vehicleFogCenter;
        uniform vec3 vehicleFogColor;
        uniform float vehicleFogNear;
        uniform float vehicleFogFar;
        varying vec2 vVehicleFogPosition;
      `+shader.fragmentShader.replace('#include <fog_fragment>',`
        if (vehicleFogEnabled > 0.5) {
          float distanceToVehicle = length(vVehicleFogPosition - vehicleFogCenter);
          float concentration = smoothstep(vehicleFogNear, vehicleFogFar, distanceToVehicle);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vehicleFogColor, concentration);
        } else {
          #include <fog_fragment>
        }
      `);
    };
    material.customProgramCacheKey=()=>cacheKey.call(material)+'|vehicle-distance-fog-v1';
    material.needsUpdate=true;
  }
  draw(renderer,game,enabled){
    this.uniforms.vehicleFogEnabled.value=enabled?1:0;
    const p=renderer.local(game.player.s,game.player.d,game.player.route);
    this.uniforms.vehicleFogCenter.value.set(p.x,p.z);
    this.camera.updateMatrixWorld();
    this.scene.fog.color.getRGB(this.uniforms.vehicleFogColor.value,renderer.renderer.outputColorSpace);
    // 新材质随场景节点加入时注册，每帧只更新共享雾参数。
  }
}
