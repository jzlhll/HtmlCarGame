import { setText, setHTML } from './dom.js';

const degrees = angle => angle * 180 / Math.PI;
const compass = {'head-on': 'Head-on', 'same-way': 'Same-way', crossing: 'Crossing', diagonal: 'Diagonal'};

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
    this.clock = document.getElementById('mission-clock');
    this.status = document.getElementById('route-status');
    this.warning = document.getElementById('radar-status');
    document.getElementById('route-heading').innerHTML = `Shenzhen → ${game.route.destinationEnglish}<small>深圳 → ${game.route.destinationName}</small>`;
    this.route.innerHTML = `<path class="planned-route" d="M110 130V20"/><text x="119" y="18">${game.route.destinationEnglish}</text><text x="119" y="132">Shenzhen</text><text class="destination-star" x="110" y="23" text-anchor="middle">★</text><polyline class="flown-route"/><g class="route-player"><path class="own-aircraft" d="M0 -7L5 5L0 2L-5 5Z"/></g>`;
    this.path = this.route.querySelector('.flown-route'); this.player = this.route.querySelector('.route-player');
    this.radar.innerHTML = '<g class="radar-grid"><circle cx="90" cy="90" r="75"/><circle cx="90" cy="90" r="38"/><path d="M15 90H165M90 15V165"/></g><path class="own-aircraft" d="M90 82L95 95L90 92L85 95Z"/>';
    this.contactNodes = new Map();
  }

  mapPoint(x, z) {
    return `${(110 + x / this.game.route.mapHalfWidth * 95).toFixed(1)},${(130 + z / -this.game.route.destination.park.z * 110).toFixed(1)}`;
  }

  update() {
    const game = this.game, mission = game.mission, a = game.aircraft;
    const hidden = game.view !== 'COCKPIT';
    if (this.panel.hidden !== hidden) this.panel.hidden = hidden;
    const tick = `${game.runId}:${game.phase}:${a.systems.avionics}:${Math.floor(game.activeSeconds * 8)}`;
    if (tick === this.tick) return;
    this.tick = tick;
    if (this.pathRun !== game.runId) {
      this.pathRun = game.runId; this.pathLength = 0; this.pathPoints = '';
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
    setHTML(this.status, a.landed ? `Parking ${Math.round(mission.parkDistance)} m<small>停机圈距离 · 低速滑行</small>` : `${mission.sector.english} · ${(distance / 1000).toFixed(1)} km<small>${mission.sector.chinese} · 海拔 ${Math.round(a.position.y)} / ${game.route.ceiling} m</small>`);
    const contacts = a.systems.avionics ? mission.contacts.filter(c => Math.hypot(c.position.x - a.position.x, c.position.z - a.position.z) < game.route.radarRange) : [];
    const alert = mission.ceilingFault || contacts.some(c => c.danger || c.age < game.route.radarLead), flash = Math.floor(mission.elapsed * 4) % 2 === 0;
    this.panel.classList.toggle('has-alert', alert && flash);
    const visible = new Set(), cosine = Math.cos(a.heading), sine = Math.sin(a.heading);
    for (const contact of contacts) {
      visible.add(contact.id);
      let item = this.contactNodes.get(contact.id);
      if (!item) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        element.innerHTML = '<g><path d="M0 16V-4M-4 1L0 -5L4 1"/></g><text x="6" y="5"></text>';
        item = {element, direction: element.firstElementChild, altitude: element.lastElementChild};
        this.radar.append(element); this.contactNodes.set(contact.id, item);
      }
      const dx = contact.position.x - a.position.x, dz = contact.position.z - a.position.z;
      const x = 90 + (dx * cosine + dz * sine) / game.route.radarRange * 75;
      const y = 90 - (dx * sine - dz * cosine) / game.route.radarRange * 75;
      setAttribute(item.element, 'class', `radar-contact ${contact.kind}${contact.danger ? ' danger' : ''}`);
      setAttribute(item.element, 'opacity', (contact.danger || contact.age < game.route.radarLead) && !flash ? '0.3' : '1');
      setAttribute(item.element, 'transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      setAttribute(item.direction, 'transform', `rotate(${degrees(contact.heading - a.heading).toFixed(1)})`);
      setText(item.altitude, `${Math.round(contact.position.y - a.position.y)} m`);
    }
    for (const [id, item] of this.contactNodes) if (!visible.has(id)) { item.element.remove(); this.contactNodes.delete(id); }
    const urgent = contacts.find(c => c.danger) || contacts[0];
    setHTML(this.warning, mission.ceilingFault ? 'Altitude fault<small>超过 10000 m，降低高度</small>' : !a.systems.avionics ? 'Avionics OFF<small>A 开启雷达</small>' : urgent ? `${urgent.kind === 'geese' ? 'Geese' : 'Traffic'} · ${compass[urgent.course]}<small>箭头表示行动方向 · 数字为相对高度</small>` : 'Clear · 2.6 km<small>雷达范围内无交通目标</small>');
  }
}
