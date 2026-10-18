import * as THREE from 'three';
import { AIRCRAFT } from './config.js';
import { setText } from './dom.js';
import { relativeHeightLabel, trafficDistanceLabel } from './traffic-labels.js';

// 标记跟随同一显示位置，只辅助辨认；不改动物体尺寸、轨迹或碰撞判定。
export class TrafficIndicators {
  constructor(element) {
    this.element = element; this.items = new Map(); this.point = new THREE.Vector3();
  }

  update(game, camera, models, pose = game.aircraft) {
    const hidden = game.view !== 'COCKPIT' || ['CRASH', 'COMPLETE', 'RESULT'].includes(game.phase);
    if (this.element.hidden !== hidden) this.element.hidden = hidden;
    if (this.runId !== game.runId) {
      this.runId = game.runId;
      for (const item of this.items.values()) item.element.remove();
      this.items.clear();
    }
    if (hidden) return;
    for (const item of this.items.values()) item.visible = false;
    const live = new Set();
    for (const contact of game.mission.contacts) {
      live.add(contact.id);
      const position = models.get(contact.id).position, distance = position.distanceTo(camera.position);
      if (distance < game.route.contactMarkerNear || distance > Math.min(game.route.contactMarkerRange,game.weather.visibility)) continue;
      this.point.copy(position);
      if (contact.kind === 'aircraft') this.point.y += AIRCRAFT.bodyHeight * game.route.trafficScale;
      this.point.project(camera);
      const x = (this.point.x + 1) * 50, y = (1 - this.point.y) * 50;
      if (this.point.z < -1 || this.point.z > 1 || x < 3 || x > 97 || y < 8 || y > 69) continue;
      let item = this.items.get(contact.id);
      if (!item) {
        const element = document.createElement('div'); element.className = 'traffic-marker';
        element.innerHTML = '<span></span><i></i><small></small>';
        item = {element, label: element.firstElementChild, detail: element.lastElementChild};
        this.element.append(element); this.items.set(contact.id, item);
      }
      item.visible = true;
      if (item.danger !== contact.danger) { item.element.classList.toggle('is-danger', contact.danger); item.danger = contact.danger; }
      const screenX = x.toFixed(2), screenY = y.toFixed(2);
      if (item.x !== screenX) { item.element.style.left = screenX + '%'; item.x = screenX; }
      if (item.y !== screenY) { item.element.style.top = screenY + '%'; item.y = screenY; }
      const targetDistance = Math.hypot(position.x - pose.position.x, position.y - pose.position.y, position.z - pose.position.z);
      setText(item.label, `${contact.kind === 'geese' ? 'Geese' : 'Traffic'} · ${trafficDistanceLabel(targetDistance)} · ${relativeHeightLabel(position.y, pose.position.y)}`);
      item.detail.hidden = contact.kind === 'aircraft' && !contact.danger;
      setText(item.detail, contact.danger ? `碰撞风险 · ${Math.ceil(contact.closestSeconds)} 秒` : contact.kind === 'geese' ? '大雁群' : '');
    }
    for (const [id, item] of this.items) {
      if (!live.has(id)) { item.element.remove(); this.items.delete(id); }
      else if (item.element.hidden !== !item.visible) item.element.hidden = !item.visible;
    }
  }
}
