import * as THREE from 'three';
import { LANDSCAPE } from './config.js';
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
  material.customProgramCacheKey = () => 'flight-terrain-strata-v3';
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
      vec3 landTriplanar(vec3 point, vec3 weights) {
        return texture2D(landDetail, point.yz).rgb * weights.x
          + texture2D(landDetail, point.xz).rgb * weights.y
          + texture2D(landDetail, point.xy).rgb * weights.z;
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 landWeights = pow(abs(normalize(vLandNormal)), vec3(4.0));
      landWeights /= max(dot(landWeights, vec3(1.0)), 0.001);
      vec3 landCoarse = landTriplanar((vLandPosition + vec3(sin(vLandPosition.z * 0.0009) * 70.0, 0.0, cos(vLandPosition.x * 0.0008) * 70.0)) * landScale, landWeights);
      vec3 landFine = landTriplanar(vLandPosition * landFineScale, landWeights);
      float landCover = vLandBiome.x;
      float landBand = sin(vLandPosition.y * 0.18 + landCoarse.r * 8.0);
      float landStrata = mix(0.96 + landBand * 0.04, 0.88 + landBand * 0.12, vLandBiome.y);
      float landFracture = 1.0 - smoothstep(0.015, 0.075, abs(landFine.g - 0.46));
      float landRock = (0.65 + landCoarse.r * 0.7 + (landFine.r - 0.5) * 0.3) * landStrata * (1.0 - landFracture * 0.16);
      float landPatch=landNoise(vLandPosition.xz*.003)*.7+landNoise(vLandPosition.xz*.017+27.0)*.3;
      float landCanopy=.72+landPatch*.55+(landFine.r-.5)*.06;
      diffuseColor.rgb *= mix(1.0, mix(landRock, landCanopy, landCover) * (1.0 - vLandBiome.z * 0.16), vLandBiome.w);
      float landHeight = mix(landCoarse.r * 0.55 + landFine.r * 0.12, landPatch * .18, landCover);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor *= mix(0.78 + landFine.r * 0.2, 1.0, landCover);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 landQx = dFdx(-vViewPosition), landQy = dFdy(-vViewPosition);
      vec3 landRx = cross(landQy, normal), landRy = cross(normal, landQx);
      float landDet = dot(landQx, landRx);
      vec3 landGradient = sign(landDet) * (dFdx(landHeight) * landRx + dFdy(landHeight) * landRy);
      float landAttenuation = 1.0 - smoothstep(1200.0, 6000.0, length(vViewPosition));
      normal = normalize(abs(landDet) * normal - landBump * landAttenuation * vLandBiome.w * landGradient);
    `);
  };
  return material;
}
