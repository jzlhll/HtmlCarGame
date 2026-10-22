import { displayHeight } from './config.js';
import { setText, setHTML } from './dom.js';
import { trafficDistanceLabel } from './traffic-labels.js';

const degrees = angle => angle * 180 / Math.PI;

function setAttribute(element, name, value) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

// 静态航图与雷达网格仅创建一次，轨迹增量格式化，目标节点按稳定标识复用。
export class NavigationUI {
  constructor(game) {
    this.game = game;
    this.panel = document.getElementById('navigation-panel');
    this.route = document.getElementById('route-map');
    this.radar = document.getElementById('traffic-radar');
    this.radarCard=this.radar.closest('.radar-card');
    this.clock = document.getElementById('mission-clock');
    this.status = document.getElementById('route-status');
    this.warning = document.getElementById('radar-status');
    document.getElementById('route-heading').innerHTML = `Shenzhen → ${game.route.destinationEnglish}<small>深圳 → ${game.route.destinationName}</small>`;
    const target=this.mapPoint(game.route.destination.x,game.route.destination.threshold-game.route.destination.length/2).split(',').map(Number);
    const start=this.mapPoint(0,0).split(',').map(Number),planned=game.route.path.filter(p=>p.distance<game.route.length+game.route.destination.length/2).map((p,i)=>(i?'L':'M')+this.mapPoint(p.x,p.z)).join(' ')+` L${target.join(',')}`;
    const wuhan=game.route.arc?this.mapPoint(0,-190000).split(',').map(Number):null;
    this.route.innerHTML = `<path class="planned-route" d="${planned}"/><text x="${target[0]+9}" y="${target[1]-8}">${game.route.destinationEnglish}</text><text x="${start[0]+9}" y="132">Shenzhen</text>${wuhan?`<circle cx="${wuhan[0]}" cy="${wuhan[1]}" r="2"/><text x="${wuhan[0]-8}" y="${wuhan[1]+3}" text-anchor="end">Wuhan</text>`:''}<text class="destination-star" x="${target[0]}" y="${target[1]+3}" text-anchor="middle">★</text><polyline class="flown-route"/><g class="route-player"><path class="own-aircraft" d="M0 -7L5 5L0 2L-5 5Z"/></g>`;
    this.path = this.route.querySelector('.flown-route'); this.player = this.route.querySelector('.route-player');
    this.radar.innerHTML = '<g class="radar-grid"><circle cx="90" cy="90" r="75"/><circle cx="90" cy="90" r="38"/><path d="M15 90H165M90 15V165"/></g><path class="own-aircraft" d="M90 82L95 95L90 92L85 95Z"/>';
    this.contactNodes = new Map(); this.distanceLabels = [];
  }

  mapPoint(x, z) {
    if(this.game.route.arc){const b=this.game.route.boundary;return `${(20+(x-(b.centerX-b.halfWidth))/(b.halfWidth*2)*180).toFixed(1)},${(130+z/-b.back*110).toFixed(1)}`;}
    return `${(110 + x / this.game.route.mapHalfWidth * 95).toFixed(1)},${(130 + z / -(this.game.route.destination.threshold-this.game.route.destination.length) * 110).toFixed(1)}`;
  }

  update() {
    const game = this.game, mission = game.mission, a = game.aircraft;
    const hidden = game.view !== 'COCKPIT';
    if (this.panel.hidden !== hidden) this.panel.hidden = hidden;
    if (this.radarCard.hidden !== hidden) this.radarCard.hidden = hidden;
    const tick = `${game.runId}:${game.phase}:${a.systems.avionics}:${Math.floor(game.activeSeconds * 8)}`;
    if (tick === this.tick) return;
    this.tick = tick;
    if (this.pathRun !== game.runId || this.pathSource !== mission.path) {
      this.pathRun = game.runId; this.pathSource = mission.path; this.pathLength = 0; this.pathPoints = '';
      setAttribute(this.path, 'points', '');
      for (const item of this.contactNodes.values()) item.element.remove();
      this.contactNodes.clear();
    }
    const remaining = Math.ceil(mission.remaining);
    setText(this.clock, `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`);
    this.clock.classList.toggle('is-warning', remaining < 30);
    if (this.pathLength !== mission.path.length) {
      for (; this.pathLength < mission.path.length; this.pathLength++) {
        const point = mission.path[this.pathLength];
        this.pathPoints += (this.pathLength ? ' ' : '') + this.mapPoint(point[0], point[1]);
      }
      setAttribute(this.path, 'points', this.pathPoints);
    }
    setAttribute(this.player, 'transform', `translate(${this.mapPoint(a.position.x, a.position.z)}) rotate(${degrees(a.heading).toFixed(1)})`);
    const distance = Math.max(0, mission.runwayDistance);
    setHTML(this.status, a.landed ? `Parking ${Math.round(a.airspeed)} km/h<small>避让障碍 · 跑道内停稳 1 秒</small>` : `${mission.sector.english??mission.sector.name} · ${(distance / 1000).toFixed(1)} km<small>${mission.sector.chinese??mission.sector.name} · 海拔 ${Math.round(displayHeight(a.position.y))} / ${displayHeight(game.route.ceiling)} m</small>`);
    const contacts = a.systems.avionics && game.weather.radarAvailable ? mission.contacts.filter(c => Math.hypot(c.position.x - a.position.x, c.position.z - a.position.z) < game.route.radarRange) : [];
    const alert = contacts.some(c => c.danger || c.age < game.route.radarLead), flash = Math.floor(mission.elapsed * 4) % 2 === 0;
    this.radarCard.classList.toggle('has-alert', alert && flash);
    this.distanceLabels.length = 0;
    const visible = new Set(), cosine = Math.cos(a.heading), sine = Math.sin(a.heading);
    for (const contact of contacts) {
      visible.add(contact.id);
      let item = this.contactNodes.get(contact.id);
      if (!item) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        element.innerHTML = '<g><path d="M0 16V-4M-4 1L0 -5L4 1"/></g><text x="6" y="5"></text>';
        item = {element, direction: element.firstElementChild, distance: element.lastElementChild};
        this.radar.append(element); this.contactNodes.set(contact.id, item);
      }
      const dx = contact.position.x - a.position.x, dz = contact.position.z - a.position.z;
      const x = 90 + (dx * cosine + dz * sine) / game.route.radarRange * 75;
      const y = 90 - (dx * sine - dz * cosine) / game.route.radarRange * 75;
      setAttribute(item.element, 'class', `radar-contact ${contact.kind}${contact.danger ? ' danger' : ''}`);
      setAttribute(item.element, 'opacity', (contact.danger || contact.age < game.route.radarLead) && !flash ? '0.3' : '1');
      setAttribute(item.element, 'transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      setAttribute(item.direction, 'transform', `rotate(${degrees(contact.heading - a.heading).toFixed(1)})`);
      const copy = trafficDistanceLabel(Math.hypot(dx, contact.position.y - a.position.y, dz));
      const width = copy.length * 10;
      const left = Math.max(2, Math.min(178 - width, x < 90 ? x - width - 6 : x + 6));
      const baseLine = Math.max(18, Math.min(164, y + 5));
      let baseline = baseLine;
      for (let attempt = 0; attempt <= this.distanceLabels.length * 2; attempt++) {
        const candidate = baseLine + Math.ceil(attempt / 2) * 20 * (attempt % 2 ? -1 : 1);
        if (candidate < 18 || candidate > 164) continue;
        if (!this.distanceLabels.some(label => left < label.left + label.width && left + width > label.left && Math.abs(candidate - label.baseline) < 20)) {
          baseline = candidate; break;
        }
      }
      item.left = left; item.baseline = baseline; item.width = width; this.distanceLabels.push(item);
      setAttribute(item.distance, 'x', (left - x).toFixed(1));
      setAttribute(item.distance, 'y', (baseline - y).toFixed(1));
      setText(item.distance, copy);
    }
    for (const [id, item] of this.contactNodes) if (!visible.has(id)) { item.element.remove(); this.contactNodes.delete(id); }
    const urgent = contacts.find(c => c.danger) || contacts[0];
    setHTML(this.warning, !a.systems.avionics ? 'Avionics OFF<small>A 开启雷达</small>' : !game.weather.radarAvailable ? 'Radar unavailable<small>白云干扰 · 离开云层恢复</small>' : urgent ? `${urgent.kind === 'geese' ? 'Geese' : 'Traffic'} · ${trafficDistanceLabel(Math.hypot(urgent.position.x - a.position.x, urgent.position.y - a.position.y, urgent.position.z - a.position.z))}<small>箭头为航向 · 数字为距离</small>` : `Clear · ${(game.route.radarRange/1000).toFixed(1)} km<small>雷达范围内无交通目标</small>`);
  }
}
