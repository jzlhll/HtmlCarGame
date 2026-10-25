import * as THREE from 'three';
import { AIRCRAFT, DESTRUCTION } from './config.js';

const vertexShader = `
  attribute vec3 velocity;
  attribute vec3 timing;
  uniform float elapsed;
  uniform float pixelScale;
  uniform float smoke;
  uniform float gravity;
  varying float age;
  varying float vAlive;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    float time=max(0.0,elapsed-timing.x);
    age=clamp(time/timing.y,0.0,1.0);
    vAlive=step(timing.x,elapsed)*(1.0-step(1.0,age));
    vec3 point=position+velocity*time;
    point.y+=(smoke>0.5?2.2:-gravity*0.5)*time*time;
    vec4 mvPosition=modelViewMatrix*vec4(point,1.0);
    gl_Position=projectionMatrix*mvPosition;
    gl_PointSize=clamp(timing.z*(smoke>0.5?0.5+age*2.5:1.0+age)*pixelScale/max(1.0,-mvPosition.z),1.0,220.0);
    #include <logdepthbuf_vertex>
  }`;
const fragmentShader = `
  uniform vec3 tint;
  uniform float smoke;
  varying float age;
  varying float vAlive;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float radius=length(gl_PointCoord-0.5)*2.0;
    float opacity=(1.0-smoothstep(0.12,1.0,radius))*(1.0-smoothstep(0.35,1.0,age))*vAlive;
    if(opacity<0.01) discard;
    vec3 color=smoke>0.5?tint:mix(vec3(1.0,0.65,0.16),tint,clamp(age+radius*0.6,0.0,1.0));
    gl_FragColor=vec4(color,opacity*(smoke>0.5?0.42:0.88));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// 开局预分配并预热；碰撞时仅更新统一时间和已有碎片矩阵，不生成新资源。
export class ImpactEffects extends THREE.Group {
  constructor() {
    super();
    this.visible=false; this.particleLayers=[]; this.pose=new THREE.Object3D();
    let seed=DESTRUCTION.seed;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for (const [count,kind,color] of [[DESTRUCTION.fireCount,'fire',DESTRUCTION.fireColor],
      [DESTRUCTION.smokeCount,'smoke',DESTRUCTION.smokeColor],[DESTRUCTION.sparkCount,'spark',DESTRUCTION.sparkColor]]) {
      const position=new Float32Array(count*3),velocity=new Float32Array(count*3),timing=new Float32Array(count*3);
      for (let i=0;i<count;i++) {
        const angle=random()*Math.PI*2,spread=kind==='spark'?18+random()*27:kind==='smoke'?3+random()*6:5+random()*13;
        position.set([(random()-0.5)*10,(random()-0.5)*3,(random()-0.5)*22],i*3);
        velocity.set([Math.cos(angle)*spread,kind==='smoke'?3+random()*6:5+random()*18,Math.sin(angle)*spread],i*3);
        const delay=kind==='smoke'?random()*0.5:random()*0.18;
        const life=kind==='smoke'?DESTRUCTION.seconds-delay:kind==='spark'?0.6+random()*0.9:0.4+random()*0.65;
        timing.set([delay,life,kind==='smoke'?6+random()*5:kind==='spark'?0.15+random()*0.25:3+random()*4],i*3);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
      geometry.setAttribute('velocity',new THREE.BufferAttribute(velocity,3));
      geometry.setAttribute('timing',new THREE.BufferAttribute(timing,3));
      const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{elapsed:{value:0.4},pixelScale:{value:500},
        smoke:{value:kind==='smoke'?1:0},gravity:{value:DESTRUCTION.gravity},tint:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,
        blending:kind==='spark'?THREE.AdditiveBlending:THREE.NormalBlending});
      const points=new THREE.Points(geometry,material); points.frustumCulled=false;points.renderOrder=kind==='smoke'?2:3;
      this.particleLayers.push(points);this.add(points);
    }
    this.flash=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:0xffbb58,
      transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.add(this.flash);
    this.debris=new THREE.InstancedMesh(new THREE.BoxGeometry(1,0.15,1.5),new THREE.MeshStandardMaterial({color:0x413c36,roughness:0.8,metalness:0.4,transparent:true}),DESTRUCTION.debrisCount);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.debris.frustumCulled=false;
    this.debrisData=Array.from({length:DESTRUCTION.debrisCount},()=>({x:(random()-0.5)*34,y:8+random()*16,z:(random()-0.5)*34,
      turn:random()*6,size:0.4+random()*1.5}));
    for(let i=0;i<DESTRUCTION.debrisCount;i++)this.debris.setMatrixAt(i,this.pose.matrix);
    this.add(this.debris);
  }

  update(game,camera,pixelHeight) {
    const impact=game.destruction,time=game.completionElapsed;
    this.visible=Boolean(impact)&&game.phase==='CRASH'&&time<DESTRUCTION.seconds;
    if(!this.visible)return;
    this.position.set(impact.position.x,impact.position.y+AIRCRAFT.bodyHeight,impact.position.z);
    for(const layer of this.particleLayers) {
      layer.material.uniforms.elapsed.value=time;
      layer.material.uniforms.pixelScale.value=pixelHeight/(2*Math.tan(camera.fov*Math.PI/360));
    }
    this.flash.scale.setScalar(1+Math.sin(Math.min(1,time/0.6)*Math.PI/2)*10);
    this.flash.material.opacity=Math.max(0,1-time/0.55)*0.65;
    const pose=this.pose;
    this.debrisData.forEach((part,index)=>{
      pose.position.set(part.x*time,Math.max(-AIRCRAFT.bodyHeight,part.y*time-DESTRUCTION.gravity*time*time/2),part.z*time);
      pose.rotation.set(time*(part.turn+2),time*(part.turn-3),time*part.turn);
      pose.scale.setScalar(part.size*(1-0.75*time/DESTRUCTION.seconds));pose.updateMatrix();
      this.debris.setMatrixAt(index,pose.matrix);
    });
    this.debris.material.opacity=1-THREE.MathUtils.smoothstep(time/DESTRUCTION.seconds,0.75,1);
    this.debris.instanceMatrix.needsUpdate=true;
  }
}
