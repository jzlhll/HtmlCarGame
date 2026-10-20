import * as THREE from 'three';
import { LANDSCAPE, ROCK_SURFACE } from './config.js';
import { surfaceTexture } from './surface-assets.js';

// 岩纹在浏览器空闲时分行生成，三关共用同一配方。
export function createTerrainDetail() {
  return surfaceTexture('terrain-detail');
}

export function createTerrainMaterial(detail) {
  const settings = LANDSCAPE.terrain;
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.96});
  material.userData.detailTexture = detail;
  material.userData.landUniforms = new Set();
  material.customProgramCacheKey = () => 'flight-terrain-strata-v5';
  material.onBeforeCompile = shader => {
    shader.uniforms.landDetail = {value: material.userData.detailTexture};
    material.userData.landUniforms.add(shader.uniforms.landDetail);
    shader.uniforms.landScale = {value: settings.rockScale};
    shader.uniforms.landFineScale = {value: settings.detailScale};
    shader.uniforms.landBump = {value: settings.bumpStrength};
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 biome;
      varying vec3 vLandPosition;
      varying vec3 vLandNormal;
      varying vec4 vLandBiome;`);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vLandPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vLandNormal = normalize(mat3(modelMatrix) * objectNormal);
      vLandBiome = biome;
      #include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D landDetail;
      uniform float landScale;
      uniform float landFineScale;
      uniform float landBump;
      varying vec3 vLandPosition;
      varying vec3 vLandNormal;
      varying vec4 vLandBiome;
      float landNoise(vec2 point) {
        vec2 cell=floor(point), blend=fract(point); blend=blend*blend*(3.0-2.0*blend);
        vec4 corners=fract(sin(vec4(dot(cell,vec2(127.1,311.7)),dot(cell+vec2(1,0),vec2(127.1,311.7)),dot(cell+vec2(0,1),vec2(127.1,311.7)),dot(cell+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
        return mix(mix(corners.x,corners.y,blend.x),mix(corners.z,corners.w,blend.x),blend.y);
      }
      vec3 landTriplanar(vec3 point, vec3 weights, float bias) {
        return texture2D(landDetail, point.yz,bias).rgb * weights.x
          + texture2D(landDetail, point.xz,bias).rgb * weights.y
          + texture2D(landDetail, point.xy,bias).rgb * weights.z;
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 landWeights = pow(abs(normalize(vLandNormal)), vec3(4.0));
      landWeights /= max(dot(landWeights, vec3(1.0)), 0.001);
      float landDistance=length(vViewPosition),landMip=smoothstep(${ROCK_SURFACE.blurDistance[0].toFixed(1)},${ROCK_SURFACE.blurDistance[1].toFixed(1)},landDistance)*1.5;
      vec3 landCoarse = landTriplanar((vLandPosition + vec3(sin(vLandPosition.z * 0.0009) * 70.0, 0.0, cos(vLandPosition.x * 0.0008) * 70.0)) * landScale, landWeights,landMip);
      vec3 landFine = landTriplanar(vLandPosition * landFineScale, landWeights,landMip);
      float landCover = vLandBiome.x;
      float landNear=1.0-smoothstep(${ROCK_SURFACE.fineFade[0].toFixed(1)},${ROCK_SURFACE.fineFade[1].toFixed(1)},length(vViewPosition));
      float landBand=sin(vLandPosition.y*${ROCK_SURFACE.bandScale.toFixed(3)}+landCoarse.r*4.0+landCoarse.b*2.4);
      float landStrata=mix(.97+landBand*.035,.94+landBand*.075,vLandBiome.y);
      float landFracture=mix(landCoarse.g,landFine.g,.65*landNear);
      float landRock=(.76+landCoarse.r*.52+(landFine.r-.5)*.18*landNear)*landStrata*(1.0-landFracture*${ROCK_SURFACE.fractureStrength.toFixed(2)});
      vec3 landMineral=mix(vec3(.83,.89,.91),vec3(1.12,1.045,.88),landCoarse.b);
      float landPatch=landNoise(vLandPosition.xz*.003)*.7+landNoise(vLandPosition.xz*.017+27.0)*.3;
      float landCanopy=.72+landPatch*.55+(landFine.r-.5)*.06;
      vec3 landSurface=mix(landRock*landMineral,vec3(landCanopy),landCover)*(1.0-vLandBiome.z*.16);
      diffuseColor.rgb*=mix(vec3(1.0),landSurface,vLandBiome.w);
      float landHeight = mix(landCoarse.r * 0.55 + landFine.r * 0.12, landPatch * .18, landCover);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor *= mix(0.78 + landFine.r * 0.2, 1.0, landCover);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 landQx = dFdx(-vViewPosition), landQy = dFdy(-vViewPosition);
      vec3 landRx = cross(landQy, normal), landRy = cross(normal, landQx);
      float landDet = dot(landQx, landRx);
      vec3 landGradient = sign(landDet) * (dFdx(landHeight) * landRx + dFdy(landHeight) * landRy);
      float landAttenuation = 1.0 - smoothstep(${ROCK_SURFACE.fineFade[0].toFixed(1)}, ${ROCK_SURFACE.fineFade[1].toFixed(1)}, length(vViewPosition));
      normal = normalize(abs(landDet) * normal - landBump * landAttenuation * vLandBiome.w * landGradient);
    `);
  };
  return material;
}
