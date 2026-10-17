import * as THREE from '../node_modules/three/build/three.module.js';
import { cachedGeometrySet } from './model-assets.js';
import { mergeGeometries } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { random } from './config.js';

// 枝干、叶簇与针叶在后台生成，场景只使用三件共享几何。
export function treeGeometry(){return cachedGeometrySet('trees',()=>{
  const rng=random(81371),normal=new THREE.Vector3();
  const merge=pieces=>{const sources=pieces.map(part=>{if(!part.index)return part;const result=part.toNonIndexed();part.dispose();return result;});const geometry=mergeGeometries(sources);for(const part of sources)part.dispose();return geometry;};
  const tint=(geometry,brightness)=>{
    const colors=[],p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const value=brightness*(.88+.12*Math.sin(p.getX(i)*12+p.getZ(i)*9))*(.86+.14*Math.max(0,p.getY(i)+.3));colors.push(value*.97,value,value*.93);}
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;
  };
  const leaf=new THREE.BufferGeometry();
  leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.14,-.055,.018,-.045,-.07,.02,.035,0,.035,.15,.07,.02,.035,.055,.018,-.045,0,.045,0],3));
  leaf.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,.25,0,.65,.5,1,1,.65,1,.25,.5,.5],2));
  leaf.setIndex([0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0,6]);leaf.computeVertexNormals();
  const sprig=(pieces,x,y,z,brightness,scale=1)=>{
    const geometry=leaf.clone();geometry.scale(scale,scale,scale);geometry.rotateX((rng()-.5)*1.6);geometry.rotateY(rng()*Math.PI*2);geometry.rotateZ((rng()-.5)*1.2);geometry.translate(x,y,z);pieces.push(tint(geometry,brightness));
  };
  const leaves=[];
  for(let cluster=0;cluster<15;cluster++){
    const angle=cluster*2.399963,radius=.26+rng()*.23,reach=cluster<11?.30+rng()*.35:.12;
    const x=Math.cos(angle)*reach,y=-.25+rng()*.90+(cluster>=11?.25:0),z=Math.sin(angle)*reach,brightness=.80+rng()*.26;
    const geometry=new THREE.IcosahedronGeometry(radius*.86,2),p=geometry.attributes.position,n=geometry.attributes.normal;
    for(let i=0;i<p.count;i++){
      const a=p.getX(i),b=p.getY(i),c=p.getZ(i),r=1+.14*Math.sin(a*29+c*19)*Math.cos(b*23);p.setXYZ(i,a*r,b*r,c*r);
      normal.set(a,b,c).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    leaves.push(tint(geometry.translate(x,y,z),brightness));
    for(let i=0;i<46;i++){
      const theta=i*2.399963,up=1-2*(i+.5)/46,radial=Math.sqrt(1-up*up),r=radius*(.82+rng()*.27);
      sprig(leaves,x+Math.cos(theta)*radial*r,y+up*r,z+Math.sin(theta)*radial*r,brightness,.42+rng()*.32);
    }
  }
  const needles=[];
  for(let layer=0;layer<9;layer++){
    const radius=.92-layer*.091,height=.43,y=-.24+layer*.18;
    for(let branch=0;branch<9;branch++){
      const a=branch*Math.PI*2/9+layer*1.7,reach=radius*(.76+rng()*.22),length=.65+layer*.015;
      const foliage=new THREE.ConeGeometry(.28,height,7,2);foliage.scale(reach*1.5,length,reach*.6);foliage.rotateZ(.63);foliage.rotateY(-a);foliage.translate(Math.cos(a)*reach*.48,y,Math.sin(a)*reach*.48);needles.push(tint(foliage,.69+layer*.035));
      for(let i=0;i<4;i++)sprig(needles,Math.cos(a)*reach*(.55+i*.12),y-height*.24,Math.sin(a)*reach*(.55+i*.12),.78+layer*.025,.37);
    }
  }
  const branches=[new THREE.CylinderGeometry(.047,.14,1,12,5).translate(.018,.5,0)];
  for(let i=0;i<7;i++){
    const branch=new THREE.CylinderGeometry(.012,.050,.62,8,2).rotateZ(.55+rng()*.25).translate(-.14,.67+rng()*.19,0).rotateY(i*2.399963);branches.push(branch);
  }
  leaf.dispose();return {broadleaf:merge(leaves),conifer:merge(needles),trunk:merge(branches)};
});}
