import * as THREE from 'three';
import { LANDSCAPE } from './config.js';
import { shorelineX } from './coastal-terrain.js';

// 海面只更新既有材质时间；海岸、高速桥面、护栏和桥墩在开放操控前准备。
export class CoastalView extends THREE.Group {
  constructor(world) {super();this.world=world;this.time={value:0};}

  *build() {
    const s=LANDSCAPE.coast,road=s.highway;
    const sea=new THREE.PlaneGeometry(s.width,s.startZ-s.endZ,...s.waterSegments);sea.rotateX(-Math.PI/2);sea.translate(0,s.seaLevel,(s.startZ+s.endZ)/2);
    const p=sea.attributes.position,colors=[],deep=new THREE.Color(s.deepColor),shallow=new THREE.Color(s.shallowColor),color=new THREE.Color();
    for(let i=0;i<p.count;i++){
      const distance=Math.abs(p.getX(i)-shorelineX(p.getZ(i)));
      color.copy(deep).lerp(shallow,Math.exp(-distance/1800));colors.push(color.r,color.g,color.b);
    }
    sea.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));yield 'boundary';
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.34,metalness:.18});
    material.customProgramCacheKey=()=> 'flight-coastal-water-v1';
    material.onBeforeCompile=shader=>{
      shader.uniforms.coastTime=this.time;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCoastPosition;');
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','vCoastPosition=(modelMatrix*vec4(transformed,1.0)).xz;\n#include <project_vertex>');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float coastTime;varying vec2 vCoastPosition;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float coastA=sin(vCoastPosition.x*${s.waveScale[0]}+vCoastPosition.y*.019-coastTime*${s.waveRate[0]});
        float coastB=cos(vCoastPosition.y*${s.waveScale[1]}-vCoastPosition.x*.012-coastTime*${s.waveRate[1]});
        diffuseColor.rgb*=.96+.04*coastA*coastB;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        normal=normalize(normal+vec3(coastA,0.0,coastB)*${s.waveNormal});`);
    };
    const water=new THREE.Mesh(sea,material);this.add(water);yield 'boundary';
    const cube=new THREE.BoxGeometry(1,1,1),pose=new THREE.Object3D();
    for(const kind of ['deck','rail','pier']){
      const parts=this.world.coastalRoad.filter(part=>part.kind===kind);
      const mesh=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({color:kind==='deck'?road.asphaltColor:road.concreteColor,roughness:.9}),parts.length);
      for(const [i,part] of parts.entries()){
        pose.position.set(part.center.x,part.center.y,part.center.z);pose.rotation.set(0,part.heading,0);pose.scale.set(part.width,part.height,part.length);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
      }
      mesh.computeBoundingSphere();mesh.receiveShadow=true;this.add(mesh);yield 'boundary';
    }
    const marks=[];
    for(const deck of this.world.coastalRoad.filter(part=>part.kind==='deck')){
      const c=Math.cos(deck.heading),n=Math.sin(deck.heading);
      for(let along=-deck.length/2+road.dashLength;along<deck.length/2-road.dashLength;along+=road.dashSpacing)for(const side of [-1,1]){
        const across=side*road.width/4;
        marks.push({x:deck.center.x+n*along+c*across,z:deck.center.z+c*along-n*across,heading:deck.heading});
      }
    }
    const marking=new THREE.InstancedMesh(cube,new THREE.MeshBasicMaterial({color:road.markingColor}),marks.length);
    for(const [i,mark] of marks.entries()){
      pose.position.set(mark.x,road.height+road.thickness/2+.03,mark.z);pose.rotation.set(0,mark.heading,0);pose.scale.set(.26,.04,road.dashLength);pose.updateMatrix();marking.setMatrixAt(i,pose.matrix);
    }
    marking.computeBoundingSphere();this.add(marking);yield 'boundary';
  }

  update(seconds) {this.time.value=seconds;}
}
