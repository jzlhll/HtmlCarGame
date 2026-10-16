import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAircraft } from './models.js';

// 遭遇模型读取任务同源位置；雁群用共享几何和实例保留近景轮廓与扑翼。
export class TrafficView extends THREE.Group {
  constructor(route) {
    super();
    this.route = route; this.models = new Map();
    this.birdPose = new THREE.Object3D(); this.wingPose = new THREE.Matrix4(); this.wingMatrix = new THREE.Matrix4();
    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.08, -0.45, 1.2, 0.04, -0.05, 2.4, -0.12, 1.05, 1.6, -0.1, 0.85, 0.55, -0.08, 0.6, 0, -0.08, 0.4], 3));
    wingGeometry.setIndex([0, 1, 5, 1, 4, 5, 1, 2, 4, 2, 3, 4]); wingGeometry.computeVertexNormals();
    const wingColors = [0xd4c5ab, 0x65503d, 0x302b27, 0x302b27, 0x846e50, 0xd4c5ab].flatMap(hex => { const color = new THREE.Color(hex); return [color.r, color.g, color.b]; });
    wingGeometry.setAttribute('color', new THREE.Float32BufferAttribute(wingColors, 3));
    const leftWingGeometry = wingGeometry.clone().scale(-1, 1, 1);
    leftWingGeometry.setIndex([0, 5, 1, 1, 5, 4, 1, 4, 2, 2, 4, 3]); leftWingGeometry.computeVertexNormals();
    const parts = [new THREE.CapsuleGeometry(0.38, 1.3, 3, 8).rotateX(Math.PI / 2),
      new THREE.CylinderGeometry(0.12, 0.2, 1.15, 6).rotateX(-Math.PI / 2 + 0.12).translate(0, 0.18, -1.1),
      new THREE.SphereGeometry(0.23, 8, 6).translate(0, 0.28, -1.75),
      new THREE.ConeGeometry(0.28, 0.7, 5).rotateX(Math.PI / 2).translate(0, 0, 1.15)];
    const pieces = parts.map((geometry, index) => {
      const piece = geometry.toNonIndexed(), color = new THREE.Color(index === 0 ? 0xcfc6b1 : 0x352b24);
      const colors = new Float32Array(piece.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      piece.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return piece;
    });
    const bodyGeometry = mergeGeometries(pieces);
    [...parts, ...pieces].forEach(geometry => geometry.dispose());
    const beakGeometry = new THREE.ConeGeometry(0.12, 0.5, 5).rotateX(-Math.PI / 2).translate(0, 0.28, -2.1);
    const feathers = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide});
    const body = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: 0.9});
    const beak = new THREE.MeshStandardMaterial({color: 0xd8903f, roughness: 0.8});
    route.encounters.forEach((spec, index) => {
      const group = new THREE.Group(); group.visible = false;
      if (spec.kind === 'aircraft') {
        const plane = createAircraft(); plane.scale.multiplyScalar(route.trafficScale);
        plane.userData.navigationLights.visible = true; group.add(plane);
      } else {
        for (const [geometry, material] of [[bodyGeometry, body], [beakGeometry, beak], [wingGeometry, feathers], [leftWingGeometry, feathers]]) {
          const mesh = new THREE.InstancedMesh(geometry, material, route.birdCount);
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(mesh);
        }
      }
      this.models.set(index, group); this.add(group);
    });
  }

  update(game, mix) {
    if (this.runId === game.runId && (game.paused || ['COMPLETE', 'RESULT'].includes(game.phase))) return;
    this.runId = game.runId;
    for (const model of this.models.values()) model.visible = false;
    for (const contact of game.mission.contacts) {
      const model = this.models.get(contact.id); model.visible = true;
      model.position.set(THREE.MathUtils.lerp(contact.previous.x, contact.position.x, mix), THREE.MathUtils.lerp(contact.previous.y, contact.position.y, mix), THREE.MathUtils.lerp(contact.previous.z, contact.position.z, mix));
      if (contact.kind === 'aircraft') { model.rotation.y = -contact.heading; continue; }
      const offsets = game.mission.birdOffsets(contact), changed = model.userData.runId !== game.runId || model.userData.heading !== contact.heading;
      const [bodies, beaks, right, left] = model.children;
      offsets.forEach((offset, i) => {
        const pose = this.birdPose; pose.position.set(...offset); pose.rotation.set(0, -contact.heading, 0); pose.scale.setScalar(this.route.birdScale); pose.updateMatrix();
        if (changed) { bodies.setMatrixAt(i, pose.matrix); beaks.setMatrixAt(i, pose.matrix); }
        const angle = Math.sin(game.mission.elapsed * this.route.birdFlapRate + i * 0.7) * this.route.birdFlapAngle;
        this.wingPose.makeRotationZ(angle); right.setMatrixAt(i, this.wingMatrix.multiplyMatrices(pose.matrix, this.wingPose));
        this.wingPose.makeRotationZ(-angle); left.setMatrixAt(i, this.wingMatrix.multiplyMatrices(pose.matrix, this.wingPose));
      });
      if (changed) {
        bodies.instanceMatrix.needsUpdate = true; beaks.instanceMatrix.needsUpdate = true;
        const min = contact.offsetMin, max = contact.offsetMax;
        const center = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
        const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 + this.route.birdScale * 3;
        for (const mesh of model.children) mesh.boundingSphere = new THREE.Sphere(center, radius);
        model.userData.runId = game.runId; model.userData.heading = contact.heading;
      }
      right.instanceMatrix.needsUpdate = true; left.instanceMatrix.needsUpdate = true;
    }
  }
}
