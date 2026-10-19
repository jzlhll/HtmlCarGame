import * as THREE from 'three';
import { coastalLandWeight } from './coastal-terrain.js';
import { batchStaticMeshes } from './static-batch.js';
import { RUNWAY, SCENERY, SURFACE_APPEARANCE, isWithinRunway } from './config.js';
import { runwayCenter, runwayOutline } from './runway-layout.js';
import { surfaceTexture, modelGeometry } from './surface-assets.js';

let numberAtlas;
function runwayNumbers(){
  if(numberAtlas)return numberAtlas;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const context=canvas.getContext('2d');context.fillStyle='#f0eee0';context.font='bold 90px sans-serif';context.textAlign='center';context.textBaseline='middle';
  for(let i=0;i<8;i++){const degrees=(i%4)*45+(i>=4?180:0),number=Math.round(degrees/10)%36||36;context.fillText(String(number).padStart(2,'0'),(i%4+.5)*128,(Math.floor(i/4)+.5)*128);}
  numberAtlas=new THREE.CanvasTexture(canvas);numberAtlas.colorSpace=THREE.SRGBColorSpace;return numberAtlas;
}

export class AirportView extends THREE.Group {
  constructor(route,destination=false){
    super();this.position.y=destination?route.destination.elevation:0;
    const runway=destination?{...RUNWAY,...route.destination,startOffset:route.destination.threshold}:RUNWAY;
    const offset=destination?route.destination.threshold-RUNWAY.startOffset:0,colors=SCENERY.colors,center=runwayCenter(runway);
    const surface=(color,layer,roughness=1)=>{
      const material=new THREE.MeshStandardMaterial({color,roughness,polygonOffset:true,polygonOffsetFactor:-layer,polygonOffsetUnits:-layer});
      material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <logdepthbuf_fragment>','#include <logdepthbuf_fragment>\n#ifdef USE_LOGDEPTHBUF\ngl_FragDepth=max(0.0,gl_FragDepth-'+(layer*.00000045).toFixed(9)+');\n#endif');};
      material.customProgramCacheKey=()=> 'airport-layer-v2-'+layer;return material;
    };
    // 米字交叉口只有一份外轮廓路面；没有共面黑色滑行连接带或高频轮胎纹理。
    const pavement=surface(colors.runway,SCENERY.surfaceLayers.pavement),shoulder=surface(colors.runwayShoulder,SCENERY.surfaceLayers.shoulder);
    shoulder.map=surfaceTexture('concrete-color');
    const building=new THREE.MeshStandardMaterial({color:colors.terminal,roughness:.85,map:surfaceTexture('concrete-color')});
    const roof=new THREE.MeshStandardMaterial({color:0x697f86,roughness:.75});
    const glass=new THREE.MeshStandardMaterial({color:0xffffff,map:surfaceTexture('facade-color'),bumpMap:surfaceTexture('facade-detail'),bumpScale:SURFACE_APPEARANCE.facadeBump,roughnessMap:surfaceTexture('facade-detail'),metalness:.4,roughness:.6});
    const slab=(width,length,y,z,material,x=0)=>{
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,length),material);
      if(material===shoulder){const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width/SURFACE_APPEARANCE.concreteTileMetres,uv.getY(i)*length/SURFACE_APPEARANCE.concreteTileMetres);}
      mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.receiveShadow=true;this.add(mesh);return mesh;
    };
    const box=(size,position,material)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
      if(material===building||material===glass){const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),width=face<2?size[2]:size[0],height=face===2||face===3?size[2]:size[1];uv.setXY(i,uv.getX(i)*width/(material===glass?32:8),uv.getY(i)*height/(material===glass?48:8));}}
      mesh.position.set(position[0]+(destination?280:0),position[1],position[2]+offset);mesh.castShadow=true;mesh.receiveShadow=true;this.add(mesh);return mesh;
    };
    const footprint=(width,length,y,material,edgeOnly=false)=>{
      const outline=runwayOutline(runway,width,length),shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x,-p.z)));
      if(edgeOnly){const inner=runwayOutline(runway);shape.holes.push(new THREE.Path(inner.map(p=>new THREE.Vector2(p.x,-p.z))));}
      const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
      const uv=geometry.attributes.uv,position=geometry.attributes.position;
      for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/SURFACE_APPEARANCE.concreteTileMetres,position.getZ(i)/SURFACE_APPEARANCE.concreteTileMetres);
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(center.x,y,center.z);mesh.receiveShadow=true;this.add(mesh);return mesh;
    };
    footprint(runway.width+12,runway.length+30,-.015,shoulder,true);
    footprint(runway.width,runway.length,0,pavement);
    const intersection=runway.width/2/Math.tan(Math.PI/8)+12,previous=pavement.onBeforeCompile;
    pavement.onBeforeCompile=(shader,renderer)=>{
      previous(shader,renderer);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vAirportPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvAirportPoint=position.xz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec2 vAirportPoint;
        float airportLine(float distance,float halfWidth,float footprint){
          float aa=max(.04,footprint*.65);
          return (1.0-smoothstep(max(0.0,halfWidth-aa),halfWidth+aa,abs(distance)))*(1.0-smoothstep(halfWidth*2.0,halfWidth*6.0,footprint));
        }
      `);
      const markings=runway.headings.map(heading=>`{
        float across=dot(vAirportPoint,vec2(${Math.cos(heading).toFixed(9)},${Math.sin(heading).toFixed(9)}));
        float along=dot(vAirportPoint,vec2(${(-Math.sin(heading)).toFixed(9)},${Math.cos(heading).toFixed(9)}));
        float fx=max(fwidth(across),.001),fz=max(fwidth(along),.001),endDistance=${(runway.length/2).toFixed(1)}-abs(along);
        float inStrip=1.0-step(${(runway.width/2).toFixed(1)},abs(across));
        float outsideJunction=smoothstep(${intersection.toFixed(1)},${(intersection+8).toFixed(1)},abs(along));
        float edge=airportLine(abs(across)-${(runway.width/2-1.8).toFixed(1)},.35,fx);
        float dash=airportLine(mod(endDistance-120.0,${(runway.stripeLength+runway.stripeGap).toFixed(1)})-${(runway.stripeLength/2).toFixed(1)},${(runway.stripeLength/2).toFixed(1)},fz);
        float middle=airportLine(across,.35,fx)*dash*step(115.0,endDistance);
        float bars=airportLine(mod(abs(across)-6.0,3.2)-.8,.8,fx)*step(6.0,abs(across))*(1.0-step(24.0,abs(across)))*airportLine(endDistance-18.0,13.0,fz);
        float aim=airportLine(abs(across)-19.0,1.5,fx)*airportLine(endDistance-230.0,14.0,fz);
        airportPaint=max(airportPaint,max(max(edge,middle),max(bars,aim))*inStrip*outsideJunction);
      }`).join('\n');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat airportPaint=0.0;\n'+markings+'\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.87,.86,.76),airportPaint);');
    };
    pavement.customProgramCacheKey=()=> 'airport-mi-filtered-v2-'+runway.width+'-'+runway.length;
    if(destination){const apron=route.destination.apron;slab(apron.width,apron.length,.005,apron.z,shoulder,apron.x);}
    else slab(210,700,.005,-140,shoulder,180);
    const numberMaterial=surface(0xffffff,SCENERY.surfaceLayers.marking,.9);numberMaterial.map=runwayNumbers();numberMaterial.transparent=true;numberMaterial.depthWrite=false;
    const pose=new THREE.Object3D(),lightPositions=[];
    for(const [index,heading]of runway.headings.entries()){
      const c=Math.cos(heading),s=Math.sin(heading),point=(across,along)=>({x:center.x+c*across-s*along,z:center.z+s*across+c*along});
      for(const side of [-1,1]){
        const indexInAtlas=index+(side<0?4:0),number=slab(13,16,.025,0,numberMaterial),uv=number.geometry.attributes.uv;
        for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+indexInAtlas%4)/4,(uv.getY(i)+(indexInAtlas<4?1:0))/2);
        const p=point(0,side*(runway.length/2-65));number.position.set(p.x,.025,p.z);number.rotation.set(-Math.PI/2,0,-heading+(side<0?Math.PI:0));
      }
      for(let along=-runway.length/2+20;along<runway.length/2-20;along+=50){
        if(Math.abs(along)<intersection)continue;
        for(const side of [-1,1])lightPositions.push(point(side*(runway.width/2+2),along));
      }
    }
    const lights=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.32,.5,8),new THREE.MeshStandardMaterial({color:0xd8b97e,roughness:.6}),lightPositions.length);
    for(const [i,p]of lightPositions.entries()){pose.position.set(p.x,.25,p.z);pose.updateMatrix();lights.setMatrixAt(i,pose.matrix);}
    lights.computeBoundingSphere();this.add(lights);
    box([120, 12, 28], [215, 6, 140], building);
    box([124, 1.4, 32], [215, 12.2, 140], roof);
    box([118, 5.5, 0.2], [215, 7.2, 125.8], glass);
    for (let i=0; i<15; i++) box([0.32,5.8,0.5],[157+i*8.3,7.2,125.55],roof);
    for (let i=0; i<5; i++) {
      box([8,1.1,5],[170+i*22,13.4,140],roof);
      for (let rib=0; rib<4; rib++) box([0.18,0.3,5.2],[167+i*22+rib*2,14.1,140],building);
    }
    for (let i = 0; i < 3; i++) {
      box([42, 13, 45], [200 + i * 55, 6.5, 10], building);
      box([44, 1.8, 48], [200 + i * 55, 13, 10], roof);
      box([30, 9, 0.3], [200 + i * 55, 4.5, -12.6], glass);
      for (let rib=0; rib<7; rib++) box([0.22,9,0.6],[186+i*55+rib*4.6,4.5,-12.8],roof);
    }
    box([9, 30, 9], [135, 15, -210], building);
    box([18, 7, 16], [135, 32, -210], glass);
    box([21, 1, 19], [135, 36, -210], roof);
    const trunk = new THREE.MeshStandardMaterial({ color: 0x6c7565, roughness: 1 });
    const crown = new THREE.MeshStandardMaterial({ color: 0x627f70, roughness: 1 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.8, 5, 5), trunk, 80);
    const crowns = new THREE.InstancedMesh(modelGeometry('tree-crown'), crown, 80);
    const dummy=new THREE.Object3D();
    const crownCenterZ = 250 - 19.5 * 105 + offset;
    let treeCount=0;this.treeMatrices=new Float32Array(80*16);const contactPose=new THREE.Object3D();
    for (let i = 0; i < 80; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (350 + Math.sin(i * 2.1) * 90), z = 250 - Math.floor(i / 2) * 105 + offset;
      if(isWithinRunway({x,z},runway,60)||!destination&&coastalLandWeight(x,z)<.99)continue;
      contactPose.position.set(x,this.position.y,z);contactPose.scale.set(10,12.7,10);contactPose.updateMatrix();this.treeMatrices.set(contactPose.matrix.elements,treeCount*16);
      dummy.position.set(x, 2.5, z); dummy.updateMatrix(); trunks.setMatrixAt(treeCount, dummy.matrix);
      dummy.position.y = 0; dummy.position.z -= crownCenterZ; dummy.updateMatrix(); crowns.setMatrixAt(treeCount++, dummy.matrix);
    }
    trunks.count=crowns.count=treeCount;this.treeCount=treeCount;
    trunks.computeBoundingSphere(); crowns.computeBoundingSphere();
    const farCrowns = new THREE.InstancedMesh(modelGeometry('tree-crown-far'), crown, 80);
    farCrowns.count=treeCount;
    farCrowns.instanceMatrix = crowns.instanceMatrix; farCrowns.computeBoundingSphere();
    const foliage = new THREE.LOD(); foliage.position.set(0, 8, crownCenterZ);
    foliage.addLevel(crowns, 0); foliage.addLevel(farCrowns, SURFACE_APPEARANCE.airportTreeLodMetres, SURFACE_APPEARANCE.airportTreeLodHysteresis);
    this.add(trunks, foliage);
    this.batchSurfaces();
  }

  updateMatrixWorld(force) {
    // 完成首轮矩阵更新并冻结后，机场无需逐帧遍历静止构件。
    if(!this.matrixWorldAutoUpdate&&!this.matrixWorldNeedsUpdate)return;
    super.updateMatrixWorld(force);
  }

  batchSurfaces() {
    // 每座机场独立合批，长跑道标线沿用完整批次。
    batchStaticMeshes(this, Infinity);
  }
}
