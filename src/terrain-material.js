import * as THREE from 'three';
import { LANDSCAPE } from './config.js';
import { smoothRange } from './terrain.js';

// 可平铺的共享岩纹在启动时生成，三关复用同一配方，不下载大幅地形图片。
export function createTerrainDetail() {
  const size = LANDSCAPE.terrain.textureSize, data = new Uint8Array(size * size * 4);
  let seed = LANDSCAPE.seed;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const layers = [4, 8, 16, 32, 64, 128].map(period => ({ period, values: Float32Array.from({length: period * period}, random) }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let noise = 0, weight = 0.5;
    for (const {period, values} of layers) {
      const u = x / size * period, v = y / size * period, ix = Math.floor(u), iy = Math.floor(v);
      const a = values[iy * period + ix], b = values[iy * period + (ix + 1) % period];
      const c = values[(iy + 1) % period * period + ix], d = values[(iy + 1) % period * period + (ix + 1) % period];
      const fx = smoothRange(0, 1, u - ix), fy = smoothRange(0, 1, v - iy);
      noise += (a + (b - a) * fx + (c - a) * fy * (1 - fx) + (d - b) * fx * fy) * weight;
      weight *= 0.5;
    }
    const i = (y * size + x) * 4, ridge = 1 - Math.abs(noise * 2 - 1);
    data[i] = Math.round(noise * 255); data[i + 1] = Math.round(ridge * 255);
    data[i + 2] = Math.round(random() * 255); data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export function createTerrainMaterial(detail) {
  const settings = LANDSCAPE.terrain;
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.96});
  material.userData.detailTexture = detail;
  material.customProgramCacheKey = () => 'flight-terrain-strata-v1';
  material.onBeforeCompile = shader => {
    shader.uniforms.landDetail = {value: detail};
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
      float landRock = (0.65 + landCoarse.r * 0.7 + (landFine.r - 0.5) * 0.3) * landStrata;
      float landCanopy = pow(landCoarse.g, 2.0) * 0.7 + 0.48 + landFine.r * 0.22;
      diffuseColor.rgb *= mix(1.0, mix(landRock, landCanopy, landCover) * (1.0 - vLandBiome.z * 0.16), vLandBiome.w);
      float landHeight = mix(landCoarse.r * 0.55 + landFine.r * 0.12, landCoarse.g * 1.5, landCover);
    `);
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
