import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 树冠各层烘焙到共享几何，细节不增加逐棵对象或每帧更新。
export function treeGeometry(){
  const crown=(pieces)=>{
    const merged=mergeGeometries(pieces);
    for(const piece of pieces)piece.dispose();
    return merged;
  };
  const tint=(geometry,brightness)=>{
    const colors=new Float32Array(geometry.attributes.position.count*3);
    colors.fill(brightness);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    return geometry;
  };
  const leaves=[];
  for(const [x,y,z,radius,brightness] of [
    [-.42,-.12,-.24,.76,.88],[.43,-.04,-.12,.79,.98],
    [-.15,.06,.40,.82,.94],[.06,.49,-.02,.74,1.08],
  ])leaves.push(tint(new THREE.DodecahedronGeometry(radius,0).translate(x,y,z),brightness));
  const needles=[];
  for(const [radius,height,y,brightness] of [[1,.94,0,.88],[.77,1,.49,.98],[.48,.88,1,1.08]]){
    needles.push(tint(new THREE.ConeGeometry(radius,height,8).translate(0,y,0),brightness));
  }
  const branches=[new THREE.CylinderGeometry(.085,.16,1,7).translate(0,.5,0)];
  for(const side of [-1,1])branches.push(new THREE.CylinderGeometry(.035,.07,.48,5).rotateZ(side*.7).translate(-side*.14,.77,side*.05));
  return {broadleaf:crown(leaves),conifer:crown(needles),trunk:crown(branches)};
}
