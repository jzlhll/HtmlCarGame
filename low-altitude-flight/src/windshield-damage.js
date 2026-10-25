import * as THREE from 'three';
import { DESTRUCTION } from './config.js';

// 两块风挡的完整裂纹在准备期创建；损伤仅改变绘制范围、可见性和冲击亮度。
export class WindshieldDamage extends THREE.Group {
  constructor() {
    super();
    const settings=DESTRUCTION.glass;
    let seed=settings.seed;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    this.panes=[];
    for (let index=0;index<2;index++) {
      const pane=new THREE.Group(), center=[index ? 0.48 : -0.43,index ? 0.27 : 0.11];
      const left=index ? 0.035 : -0.93, right=index ? 0.93 : -0.035, bottom=-0.40, top=0.92;
      const rays=[], lines=[], facets=[], colors=[];
      for(let i=0;i<settings.spokes;i++) {
        const angle=(i+(random()-0.5)*0.38)/settings.spokes*Math.PI*2;
        const dx=Math.cos(angle),dy=Math.sin(angle);
        const limit=Math.min(dx>0?(right-center[0])/dx:(left-center[0])/dx,dy>0?(top-center[1])/dy:(bottom-center[1])/dy);
        const points=[[center[0]+dx*0.008,center[1]+dy*0.008]];
        for(let ring=1;ring<=settings.rings;ring++) {
          const fraction=ring===settings.rings?1:Math.pow(ring/settings.rings,1.65)*(0.85+random()*0.15);
          points.push([center[0]+dx*limit*fraction,center[1]+dy*limit*fraction]);
        }
        rays.push(points);
      }
      const segment=(a,b)=>lines.push(a[0],a[1],0,b[0],b[1],0);
      for(let i=0;i<rays.length;i++) {
        const ray=rays[i],next=rays[(i+1)%rays.length];
        for(let ring=0;ring<settings.rings;ring++) {
          segment(ray[ring],ray[ring+1]);
          if(ring>0 && random()>0.12) segment(ray[ring],next[ring]);
          if(ring>0 && random()>0.6) {
            const tip=[ray[ring][0]*0.65+next[ring+1][0]*0.35,ray[ring][1]*0.65+next[ring+1][1]*0.35];
            segment(ray[ring],tip);
          }
          if(ring<2 || random()>0.7) {
            const a=ray[ring],b=ray[ring+1],c=next[ring+1];
            facets.push(a[0],a[1],0,b[0],b[1],0,c[0],c[1],0);
            const shade=0.65+random()*0.35;
            for(let v=0;v<3;v++)colors.push(shade,shade,shade);
          }
        }
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
      const edgeMaterial=new THREE.LineBasicMaterial({color:settings.edgeColor,transparent:true,opacity:0.5,depthTest:false,depthWrite:false,fog:false,toneMapped:false});
      const crackMaterial=new THREE.LineBasicMaterial({color:settings.lineColor,transparent:true,opacity:settings.opacity,depthTest:false,depthWrite:false,fog:false,toneMapped:false});
      const edge=new THREE.LineSegments(geometry,edgeMaterial);edge.position.set(0.0016,-0.0016,0);edge.renderOrder=30;
      const cracks=new THREE.LineSegments(geometry,crackMaterial);cracks.renderOrder=31;
      const pieces=new THREE.BufferGeometry();pieces.setAttribute('position',new THREE.Float32BufferAttribute(facets,3));pieces.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      const facetMaterial=new THREE.MeshBasicMaterial({color:settings.facetColor,vertexColors:true,transparent:true,opacity:0.055,side:THREE.DoubleSide,depthTest:false,depthWrite:false,fog:false,toneMapped:false});
      const glass=new THREE.Mesh(pieces,facetMaterial);glass.renderOrder=29;
      pane.add(glass,edge,cracks);pane.traverse(part=>{part.frustumCulled=false;});pane.visible=false;
      this.panes.push({pane,geometry,pieces,crackMaterial,facetMaterial});this.add(pane);
    }
    this.position.z=-settings.distance;
  }

  resize(aspect,fov) {
    const height=Math.tan(fov*Math.PI/360)*DESTRUCTION.glass.distance;
    this.scale.set(height*aspect,height,1);
  }

  update(game) {
    const damage=game.aircraft.glassDamage;
    const clock=game.activeSeconds+(game.glassFailure?game.completionElapsed:0);
    const flash=Math.max(0,1-(clock-game.glassImpactAt)/DESTRUCTION.glass.flashSeconds);
    for(let index=0;index<this.panes.length;index++) {
      const {pane,geometry,pieces,crackMaterial,facetMaterial}=this.panes[index];
      const progress=Math.max(0,Math.min(1,(damage-index*50)/50));pane.visible=progress>0;
      geometry.setDrawRange(0,Math.ceil(geometry.attributes.position.count*progress/2)*2);
      pieces.setDrawRange(0,Math.ceil(pieces.attributes.position.count*progress/3)*3);
      const impact=index===Math.min(Math.ceil(damage/50),this.panes.length)-1?flash:0;
      crackMaterial.opacity=.45+(DESTRUCTION.glass.opacity-.45)*progress+(1-DESTRUCTION.glass.opacity)*impact;
      facetMaterial.opacity=.025+.055*progress+.16*impact;
    }
  }
}
