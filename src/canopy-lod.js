import * as THREE from 'three';

// 大树的可见树冠远离地面原点，按整片树冠范围计算距离，避免贴近时仍是简模。
export class CanopyLOD extends THREE.LOD {
  constructor(bounds){super();this.isCanopyLOD=true;this.localBounds=bounds?.clone()||new THREE.Box3();this.worldBounds=new THREE.Box3();}
  update(camera) {
    const distance=this.worldBounds.copy(this.localBounds).applyMatrix4(this.matrixWorld).distanceToPoint(camera.position)/camera.zoom;
    let level=0;
    for(let i=1;i<this.levels.length;i++){
      const item=this.levels[i],threshold=item.distance*(item.object.visible?1-item.hysteresis:1);
      if(distance<threshold)break;level=i;
    }
    this._currentLevel=level;
    for(let i=0;i<this.levels.length;i++)this.levels[i].object.visible=i===level;
  }
}
