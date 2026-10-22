import * as THREE from 'three';
import { TREE_MODELS } from './config.js';

// 同一相机的一轮场景提交共用视锥；切换小视口或投影变化时立即重算。
const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),view=new THREE.Matrix4(),projectionView=new THREE.Matrix4(),eye=new THREE.Vector3();
let frustumCamera,coordinateSystem,reversedDepth;
// 按相机记录各LOD的历史，弱引用不延长相机或已回收场景的生命周期。
const cameraLevels=new WeakMap();

// 大树的可见树冠远离地面原点，按整片树冠范围计算距离，避免贴近时仍是简模。
export class CanopyLOD extends THREE.LOD {
  constructor(bounds,leafSize=0){super();this.leafSize=leafSize;this.isCanopyLOD=true;this.localBounds=bounds?.clone()||new THREE.Box3();this.worldBounds=new THREE.Box3();this.boundsMatrix=new THREE.Matrix4();this.boundsReady=false;this.worldOrigin=new THREE.Vector3();}
  updateMatrixWorld(force) {
    // 静止树林的世界矩阵已准备；循环槽移动时会先重新开放世界矩阵更新。
    if(!this.matrixWorldAutoUpdate&&!this.matrixWorldNeedsUpdate)return;
    super.updateMatrixWorld(force);
  }
  update(camera) {
    if(frustumCamera!==camera||!projection.equals(camera.projectionMatrix)||!view.equals(camera.matrixWorldInverse)||coordinateSystem!==camera.coordinateSystem||reversedDepth!==camera.reversedDepth){
      frustumCamera=camera;coordinateSystem=camera.coordinateSystem;reversedDepth=camera.reversedDepth;
      projection.copy(camera.projectionMatrix);view.copy(camera.matrixWorldInverse);eye.setFromMatrixPosition(camera.matrixWorld);
      frustum.setFromProjectionMatrix(projectionView.multiplyMatrices(projection,view),coordinateSystem,reversedDepth);
    }
    if(!this.boundsReady||!this.boundsMatrix.equals(this.matrixWorld)){
      this.boundsReady=true;this.boundsMatrix.copy(this.matrixWorld);
      this.worldBounds.copy(this.localBounds).applyMatrix4(this.matrixWorld);this.worldOrigin.setFromMatrixPosition(this.matrixWorld);
    }
    if(!frustum.intersectsBox(this.worldBounds)){
      // 保留LOD自身及已选档位，转回视野或切换相机时仍可恢复并沿用滞回。
      for(const item of this.levels)item.object.visible=false;
      return;
    }
    let history=cameraLevels.get(camera);
    if(!history)cameraLevels.set(camera,history=new WeakMap());
    const previousLevel=history.get(this)??0;
    const distance=(this.userData.distanceFromOrigin?eye.distanceTo(this.worldOrigin):this.worldBounds.distanceToPoint(eye))/camera.zoom;
    const height=camera.userData.detailViewportHeight;
    const leafDistance=this.leafSize&&height?this.leafSize*height*camera.projectionMatrix.elements[5]/(2*TREE_MODELS.leafMinPixels*camera.zoom):Infinity;
    let level=0;
    for(let i=1;i<this.levels.length;i++){
      const item=this.levels[i],threshold=Math.min(item.distance,i===1?leafDistance:Infinity)*(previousLevel===i?1-item.hysteresis:1);
      if(distance<threshold)break;level=i;
    }
    const minimum=camera.userData.detailBudget?.[this.userData.detailKind]||0;
    if(level<minimum)level=Math.min(minimum,this.levels.length-1);
    history.set(this,level);this._currentLevel=level;
    for(let i=0;i<this.levels.length;i++)this.levels[i].object.visible=i===level;
  }
}
