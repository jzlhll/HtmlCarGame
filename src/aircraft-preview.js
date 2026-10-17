import * as THREE from 'three';
import { AIRCRAFT, AIRCRAFT_PREVIEW } from './config.js';
import { createAircraft } from './models.js';
import { PreviewTraffic } from './preview-traffic.js';
import { setText } from './dom.js';
import { relativeHeightLabel } from './traffic-labels.js';

// 同一渲染器中的机外姿态、交通及高度差视口；安全指引统一放在顶部。
export class AircraftPreview {
  constructor(element,route) {
    this.element = element;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(AIRCRAFT_PREVIEW.background);
    this.scene.add(new THREE.HemisphereLight(0xeaf4fa, 0x788a90, 3));
    const light = new THREE.DirectionalLight(0xfff2d9, 3); light.position.set(-20, 50, 40); this.scene.add(light);
    this.aircraft = createAircraft();
    this.aircraft.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = false; } });
    this.scene.add(this.aircraft);
    this.traffic=new PreviewTraffic(route);this.scene.add(this.traffic);
    this.trafficLegend=document.getElementById('preview-traffic-legend');
    this.trafficLabels = new Map(); this.placedLabels = []; this.labelPoint = new THREE.Vector3();
    const labels = document.createElement('div'); labels.className = 'preview-traffic-labels';
    labels.setAttribute('aria-label', '交通目标相对本机高度差'); this.element.append(labels);
    route.encounters.forEach((spec, id) => {
      const label = document.createElement('span');
      label.className = 'preview-traffic-label' + (spec.kind === 'geese' ? ' is-geese' : '');
      label.dataset.contactId = id; label.hidden = true; labels.append(label);
      this.trafficLabels.set(id, {element: label, symbol: spec.kind === 'geese' ? 'V' : '✈'});
    });
    this.skinMaterials=this.aircraft.userData.skinMaterials;
    this.skinColors=this.skinMaterials.map(material=>material.color.clone());
    this.landingColors=Object.fromEntries(Object.entries(AIRCRAFT_PREVIEW.landingColors).map(([state,color])=>[state,new THREE.Color(color)]));
    this.landingSeverity=null;
    const grid = new THREE.GridHelper(AIRCRAFT_PREVIEW.gridSize, AIRCRAFT_PREVIEW.gridDivisions, AIRCRAFT_PREVIEW.gridColor, AIRCRAFT_PREVIEW.groundColor);
    grid.position.y = AIRCRAFT_PREVIEW.gridHeight; this.scene.add(grid);
    this.camera = new THREE.PerspectiveCamera(AIRCRAFT_PREVIEW.fov, 1, 1, 400);
    this.camera.position.set(...AIRCRAFT_PREVIEW.camera); this.camera.lookAt(...AIRCRAFT_PREVIEW.target);
    this.bounds = null;
    this.size = new THREE.Vector2();
  }

  // 标签按实际显示位置计算高度差，贴随同一交通符号；节点在准备阶段创建。
  updateTrafficLabels(pose, models) {
    this.camera.updateMatrixWorld();
    const {width, height} = this.bounds;
    this.placedLabels.length = 0;
    for (const [id, label] of this.trafficLabels) {
      const entry = this.traffic.entries.get(id), world = models.get(id);
      if (!entry.model.visible || !world) { label.element.hidden = true; continue; }
      this.labelPoint.copy(entry.model.position).project(this.camera);
      const point = this.labelPoint;
      if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) {
        label.element.hidden = true; continue;
      }
      label.element.hidden = false;
      label.element.classList.toggle('is-danger', entry.danger);
      const x = Math.max(38, Math.min(width - 38, (point.x + 1) * width / 2));
      const baseY = Math.max(14, Math.min(height - 30, (1 - point.y) * height / 2 - 7));
      let y = baseY;
      // 从目标附近交替向上、向下找空位，避免多个标签在边缘来回挤占。
      for (let attempt = 0; attempt <= this.placedLabels.length * 2; attempt++) {
        const candidate = baseY + Math.ceil(attempt / 2) * 18 * (attempt % 2 ? -1 : 1);
        if (candidate < 14 || candidate > height - 30) continue;
        if (!this.placedLabels.some(placed => Math.abs(x - placed.x) < 76 && Math.abs(candidate - placed.y) < 18)) {
          y = candidate; break;
        }
      }
      label.x = x; label.y = y; this.placedLabels.push(label);
      const left = x.toFixed(1), top = y.toFixed(1);
      if (label.left !== left) { label.element.style.left = left + 'px'; label.left = left; }
      if (label.top !== top) { label.element.style.top = top + 'px'; label.top = top; }
      setText(label.element, `${label.symbol} ${relativeHeightLabel(world.position.y, pose.position.y)}`);
    }
  }

  draw(renderer, game, pose, refreshBounds, models) {
    if (refreshBounds || !this.bounds) {
      this.bounds = this.element.getBoundingClientRect();
      this.camera.aspect = this.bounds.width / Math.max(1, this.bounds.height); this.camera.updateProjectionMatrix();
    }
    const bounds = this.bounds;
    if (!bounds.width || !bounds.height) return;
    const landing=game.mission.approaching || game.aircraft.landed;
    const severity=landing ? game.flight.landingStatus().severity : null;
    if (severity!==this.landingSeverity) {
      this.landingSeverity=severity;
      this.skinMaterials.forEach((material,index)=>material.color.copy(severity?this.landingColors[severity]:this.skinColors[index]));
    }
    const referenceHeading=landing?0:pose.heading;
    const trafficVisible=this.traffic.update(game,pose,models,referenceHeading);
    if (this.trafficVisible!==trafficVisible) {
      this.trafficVisible=trafficVisible;this.trafficLegend.hidden=!trafficVisible;
      this.element.parentElement.classList.toggle('has-traffic',trafficVisible);
      this.aircraft.scale.setScalar(trafficVisible?AIRCRAFT_PREVIEW.traffic.ownScale:1);
      this.camera.position.set(...(trafficVisible?AIRCRAFT_PREVIEW.traffic.camera:AIRCRAFT_PREVIEW.camera));
      this.camera.lookAt(...AIRCRAFT_PREVIEW.target);
      this.camera.fov=trafficVisible?AIRCRAFT_PREVIEW.traffic.fov:AIRCRAFT_PREVIEW.fov;this.camera.updateProjectionMatrix();
    }
    const heading=landing ? Math.atan2(Math.sin(pose.heading),Math.cos(pose.heading)) : 0;
    this.aircraft.rotation.set(pose.pitch, -heading, -pose.bank, 'YXZ');
    this.aircraft.userData.navigationLights.visible = game.aircraft.systems.lights;
    for (const flap of this.aircraft.userData.flaps) flap.rotation.x = game.aircraft.systems.flapsPosition * AIRCRAFT.flapAngle;
    for (const leg of this.aircraft.userData.gearLegs) {
      const progress = game.aircraft.systems.gearPosition;
      leg.position.x = leg.userData.baseX * (0.5 + progress * 0.5); leg.position.y = (1 - progress) * AIRCRAFT.gearRetractHeight;
    }
    this.updateTrafficLabels(pose, models);
    const size = renderer.getSize(this.size);
    renderer.setViewport(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
    renderer.setScissor(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
    renderer.setScissorTest(true); renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
  }
}
