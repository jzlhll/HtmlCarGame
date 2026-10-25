import * as THREE from 'three';

export const SCENERY_FINISH={stone:0,brick:1,wood:2,tile:3,bronze:4,water:5,glass:6,rock:7,gold:8,lattice:9,plaster:10,sculpture:11};

// 共享材质用实例参数区分砖、石、木、琉璃瓦和金属；世界米控制纹理尺度与远景过滤。
export function createSceneryMaterial(){
  const material=new THREE.MeshStandardMaterial({roughness:.74,metalness:.08});
  material.customProgramCacheKey=()=> 'scenery-crafted-surfaces-v3';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec4 scenerySurface;varying vec3 vCraftPosition;varying vec3 vCraftNormal;varying vec4 vCraftSurface;varying float vCraftLevel;`);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 craftPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      craftPosition=instanceMatrix*craftPosition;
      #endif
      vCraftPosition=(modelMatrix*craftPosition).xyz;
      mat3 craftMatrix=mat3(instanceMatrix);
      vec3 craftScale=vec3(dot(craftMatrix[0],craftMatrix[0]),dot(craftMatrix[1],craftMatrix[1]),dot(craftMatrix[2],craftMatrix[2]));
      vCraftNormal=normalize(mat3(modelMatrix)*craftMatrix*(objectNormal/craftScale));
      vCraftSurface=scenerySurface;vCraftLevel=position.y+.5;
      #include <project_vertex>`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vCraftPosition;varying vec3 vCraftNormal;varying vec4 vCraftSurface;varying float vCraftLevel;
      float craftHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float craftNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(craftHash(i),craftHash(i+vec2(1,0)),f.x),mix(craftHash(i+vec2(0,1)),craftHash(i+vec2(1,1)),f.x),f.y);}
      float craftLine(float x,float width,float derivative){return 1.0-smoothstep(width,width+derivative,abs(x));}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      float craftFinish=vCraftSurface.x;
      vec3 craftN=normalize(vCraftNormal);
      vec2 craftUv=abs(craftN.y)>.7?vCraftPosition.xz:(abs(craftN.x)>abs(craftN.z)?vCraftPosition.zy:vCraftPosition.xy);
      float craftDistance=length(vViewPosition),craftFade=1.0-smoothstep(4500.0,14000.0,craftDistance);
      float craftFootprint=max(length(dFdx(craftUv)),length(dFdy(craftUv)));
      float craftFine=craftFade*(1.0-smoothstep(4.0,18.0,craftFootprint));
      float craftWeather=craftNoise(craftUv*.008+vCraftSurface.y);
      float craftHeight=.5,craftShade=.92+craftWeather*.14;
      float craftMetal=.03,craftRough=.86;
      if(craftFinish<1.5){
        vec2 cell=craftUv/(craftFinish>.5?vec2(30,12):vec2(90,45));cell.x+=mod(floor(cell.y),2.0)*.5;
        vec2 edge=abs(fract(cell)-.5),aa=max(fwidth(cell),vec2(.002));
        float mortar=max(smoothstep(.455-aa.x,.48+aa.x,edge.x),smoothstep(.44-aa.y,.48+aa.y,edge.y));
        float stone=.86+.22*craftHash(floor(cell));craftHeight=1.0-mortar;
        craftShade*=mix(1.0,mix(stone,.49,mortar*.8),craftFine);
      }else if(craftFinish<2.5){
        float grain=sin(craftUv.y*.09+craftNoise(craftUv*.035)*4.0);craftHeight=grain*.08;
        craftShade*=1.0+grain*.06*craftFine;craftRough=.58;
      }else if(craftFinish<3.5||abs(craftFinish-8.0)<.1){
        vec2 tile=craftUv/vec2(16,30),aa=max(fwidth(tile),vec2(.004));
        float rib=cos(tile.x*6.28318),joint=craftLine(fract(tile.y)-.08,.035,aa.y);
        craftHeight=rib*.18-joint*.15;craftShade*=mix(1.0,.9+rib*.12-joint*.2,craftFine);craftRough=craftFinish>7.5?.34:.5;craftMetal=craftFinish>7.5?.55:.06;
      }else if(craftFinish<4.5){
        float patina=craftNoise(craftUv*.035);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.6,.9,.78),smoothstep(.6,.9,patina)*.3);craftRough=.56;craftMetal=.38;craftHeight=patina*.08;
      }else if(craftFinish<5.5){
        float ripple=sin(craftUv.x*.032+sin(craftUv.y*.017)*1.8);craftHeight=ripple*.05;craftShade=1.0+ripple*.08*craftFine;craftRough=.21;craftMetal=.25;
      }else if(craftFinish<6.5){craftRough=.2;craftMetal=.32;
      }else if(craftFinish<7.5){
        float strata=sin(craftUv.y*.038+craftWeather*4.0),pore=craftNoise(craftUv*.12);craftHeight=craftWeather*.3+pore*.13;
        craftShade*=1.0+strata*.085+(.5-pore)*.16*craftFine;
      }else if(craftFinish>8.5&&craftFinish<9.5){
        vec2 cell=craftUv/vec2(20,28);vec2 edge=abs(fract(cell)-.5);vec2 aa=max(fwidth(cell),vec2(.01));
        float lattice=max(smoothstep(.4-aa.x,.48+aa.x,edge.x),smoothstep(.4-aa.y,.48+aa.y,edge.y));
        craftShade=mix(.34,1.45,lattice*craftFine);craftHeight=lattice*.15;craftRough=.65;
      }
      if(craftFinish>10.5){craftHeight=craftNoise(craftUv*.16)*.06;craftShade*=1.0+(craftNoise(craftUv*.09)-.5)*.06*craftFine;}
      diffuseColor.rgb*=craftShade*(.77+.23*smoothstep(0.0,.22,vCraftLevel));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=craftRough;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=craftMetal;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 craftQx=dFdx(-vViewPosition),craftQy=dFdy(-vViewPosition),craftRx=cross(craftQy,normal),craftRy=cross(normal,craftQx);
      float craftDet=dot(craftQx,craftRx);
      vec3 craftGradient=sign(craftDet)*(dFdx(craftHeight)*craftRx+dFdy(craftHeight)*craftRy);
      normal=normalize(abs(craftDet)*normal-.45*craftFine*craftGradient);`);
  };
  return material;
}

export function sceneryFinish(part){
  if(part.finish)return SCENERY_FINISH[part.finish];
  if(part.shape==='roof')return SCENERY_FINISH.tile;
  if([0x478b9b,0x8ebec5].includes(part.color))return SCENERY_FINISH.water;
  if([0x92533d,0x964d38,0x715b43].includes(part.color))return SCENERY_FINISH.wood;
  if([0x394d4c,0x414f4d,0x3f4945].includes(part.color))return SCENERY_FINISH.lattice;
  if([0x88735a,0xb19370,0x878d84].includes(part.color))return SCENERY_FINISH.brick;
  if([0x9d8061,0x91795e,0x806951,0x826f59].includes(part.color))return SCENERY_FINISH.bronze;
  if(part.shape==='cone'||part.shape==='rock')return SCENERY_FINISH.rock;
  return SCENERY_FINISH.stone;
}
