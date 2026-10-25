import * as THREE from 'three';
import { AIRCRAFT, CAMERA } from './config.js';

// 轨迹只读取有效时间；以驾驶舱眼位为收拢中心，沿飞机左侧单向绕入。
export class CameraSequence {
  constructor() {
    this.eye = new THREE.Vector3(AIRCRAFT.eye.x, AIRCRAFT.eye.y, AIRCRAFT.eye.z);
    this.start = new THREE.Vector3(...CAMERA.exterior.position);
    const offset = this.start.clone().sub(this.eye);
    this.radius = Math.hypot(offset.x, offset.z);
    this.startAngle = Math.atan2(offset.x, offset.z);
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(this.start);
    camera.lookAt(...CAMERA.exterior.target);
    this.startRotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  }

  apply(camera, seconds) {
    const progress = THREE.MathUtils.clamp(seconds / CAMERA.introSeconds, 0, 1);
    // 共用连续进度，首尾速度为零；极角和朝向只向前推进，不在分段间选取相反旋转方向。
    const travel = THREE.MathUtils.smootherstep(progress, 0, 1);
    const remaining = 1 - travel;
    const angle = this.startAngle * remaining;
    const radius = this.radius * remaining;
    camera.position.set(
      this.eye.x + Math.sin(angle) * radius,
      THREE.MathUtils.lerp(this.start.y, this.eye.y, travel),
      this.eye.z + Math.cos(angle) * radius,
    );
    camera.rotation.set(THREE.MathUtils.lerp(this.startRotation.x, -CAMERA.cockpitLookDown, travel), this.startRotation.y * remaining, 0, 'YXZ');
    camera.fov = THREE.MathUtils.lerp(CAMERA.exterior.fov, CAMERA.cockpitFov, travel);
    return progress;
  }
}
