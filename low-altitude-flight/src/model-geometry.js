import * as THREE from 'three';
import { SURFACE_APPEARANCE, AIRCRAFT } from './config.js';

const bodyRings = [[-19, 0.04, 0.1], [-18.2, 0.75, 0.05], [-16, 1.7, 0], [-12, 2, 0],
  [9, 2, 0], [13.5, 1.5, 0.3], [17, 0.6, 0.7], [19, 0.03, 1]];

// 单调曲线保留原截面、机长与最大半径，玻璃和舱门共用表面求值。
export function fuselageSection(z) {
  const i = Math.min(bodyRings.length - 2, Math.max(0, bodyRings.findIndex((ring, index) => index < bodyRings.length - 1 && z <= bodyRings[index + 1][0])));
  const a = bodyRings[i], b = bodyRings[i + 1], span = b[0] - a[0], t = Math.max(0, Math.min(1, (z - a[0]) / span));
  const interpolate = component => {
    const slope = (left, right) => (right[component] - left[component]) / (right[0] - left[0]);
    const d = slope(a, b), before = i ? slope(bodyRings[i - 1], a) : d, after = i + 2 < bodyRings.length ? slope(b, bodyRings[i + 2]) : d;
    const tangent = (p, q) => p * q <= 0 ? 0 : Math.sign(p) * Math.min(Math.abs(p), Math.abs(q));
    return (2*t*t*t - 3*t*t + 1)*a[component] + (t*t*t - 2*t*t + t)*span*tangent(before, d)
      + (-2*t*t*t + 3*t*t)*b[component] + (t*t*t - t*t)*span*tangent(d, after);
  };
  return {radius: interpolate(1), rise: interpolate(2)};
}

// 顶点按截面生成，法线和缓冲对象各自设置让出点。
export function* fuselageGeometry() {
  const segments = SURFACE_APPEARANCE.aircraftSegments, positions = [], indices = [], uvs = [], normals = [], rings = [];
  for (let i = 0; i < bodyRings.length - 1; i++) {
    const a = bodyRings[i][0], b = bodyRings[i + 1][0];
    const count = i === 3 ? 2 : Math.ceil((b - a) / SURFACE_APPEARANCE.fuselageStepMetres);
    for (let step = 0; step < count; step++) rings.push(a + (b - a) * step / count);
  }
  rings.push(19);
  for (const [ring, z] of rings.entries()) {
    const {radius, rise} = fuselageSection(z);
    const beforeZ = Math.max(-19, z - 0.001), afterZ = Math.min(19, z + 0.001);
    const before = fuselageSection(beforeZ), after = fuselageSection(afterZ);
    const radiusSlope = (after.radius - before.radius) / (afterZ - beforeZ), riseSlope = (after.rise - before.rise) / (afterZ - beforeZ);
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius + rise, z);
      uvs.push(i / segments * 4, (z + 19) / 38 * 12);
      const normalZ = -radiusSlope - riseSlope * Math.sin(angle), inverseLength = 1 / Math.hypot(1, normalZ);
      normals.push(Math.cos(angle) * inverseLength, Math.sin(angle) * inverseLength, normalZ * inverseLength);
      if (ring && i < segments) {
        const a = (ring - 1) * (segments + 1) + i, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    yield;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); yield 'boundary';
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); yield 'boundary';
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); yield 'boundary';
  return geometry;
}

export function engineGeometry(part) {
  const profiles = {
    shell: [[1.00,-1.98],[1.055,-1.85],[1.08,-1.6],[1.075,-1.1],[1.04,0],[0.97,1.1],[0.89,1.7],[0.78,1.95]],
    duct: [[0.78,1.95],[0.69,1.82],[0.64,1.3],[0.64,0.6],[0.72,-0.7],[0.80,-1.4],[0.87,-1.84],[0.93,-1.98],[1,-1.98]],
    exhaust: [[0.02,1.4],[0.30,1.45],[0.40,1.6],[0.34,1.9],[0.13,2.02],[0.02,2.05]],
  };
  return new THREE.LatheGeometry(profiles[part].map(([r,z]) => new THREE.Vector2(r,z)), SURFACE_APPEARANCE.engineSegments).rotateX(Math.PI / 2);
}

// 弯掠叶片留在进气口内部，整组共享并随金属材质合批。
export function fanGeometry() {
  const positions = [], indices = [], uvs = [], count = SURFACE_APPEARANCE.fanBlades, rows = 8;
  for (let blade = 0; blade < count; blade++) {
    const start = positions.length / 3;
    for (let row = 0; row <= rows; row++) for (let edge = 0; edge < 2; edge++) {
      const t = row / rows, r = 0.20 + t * 0.62;
      const angle = blade / count * Math.PI * 2 + t*t*0.4 + edge * (0.20 - t * 0.10);
      positions.push(Math.cos(angle)*r, Math.sin(angle)*r, -1.60 + Math.sin(t*Math.PI)*0.13 + edge*0.025);
      uvs.push(t, edge);
      if (row && edge === 0) { const a = start + (row - 1)*2, b = a + 2; indices.push(a,a+1,b,a+1,b+1,b); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function treeCrownGeometry(distant = false) {
  const points = distant ? [[0.1,-5.5],[4.5,-4.7],[2.8,-0.4],[0.8,3.5],[0,5.5]] : [[0.1,-5.5],[2.4,-5.3],[4.5,-4.7],[3.4,-2.8],[4.0,-2.6],[2.6,-0.6],[3.1,-0.4],[1.8,1.6],[2.2,1.8],[0.8,4],[0,5.5]];
  const geometry = new THREE.LatheGeometry(points.map(([r,y]) => new THREE.Vector2(r,y)), distant ? 8 : 12);
  const position = geometry.attributes.position;
  for (let i=0; i<position.count; i++) {
    const x=position.getX(i), y=position.getY(i), z=position.getZ(i), variation=1-0.10*(0.5+0.5*Math.sin(Math.atan2(x,z)*5+y*2));
    position.setXYZ(i,x*variation,y,z*variation);
  }
  geometry.computeVertexNormals(); return geometry;
}

// 舱门包边贴合已有机身圆截面，只补充表面轮廓，不改变碰撞外形。
export function aircraftDoorGeometry(side, z) {
  const settings = SURFACE_APPEARANCE, width = settings.doorWidth, height = settings.doorHeight;
  const outline = (path, inset) => {
    const w = width / 2 - inset, h = height / 2 - inset, r = 0.13;
    path.moveTo(-w + r, -h); path.lineTo(w - r, -h); path.quadraticCurveTo(w, -h, w, -h + r);
    path.lineTo(w, h - r); path.quadraticCurveTo(w, h, w - r, h);
    path.lineTo(-w + r, h); path.quadraticCurveTo(-w, h, -w, h - r);
    path.lineTo(-w, -h + r); path.quadraticCurveTo(-w, -h, -w + r, -h);
  };
  const shape = new THREE.Shape(), hole = new THREE.Path();
  outline(shape, 0); outline(hole, settings.doorBorder); shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape, 4), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const along = z + positions.getX(i), y = positions.getY(i) + 3.65;
    const {radius, rise} = fuselageSection(along);
    positions.setXYZ(i, side * (Math.sqrt(Math.max(0, radius * radius - (y - AIRCRAFT.bodyHeight - rise) ** 2)) + 0.012), y, along);
  }
  if (side > 0) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); }
  }
  geometry.computeVertexNormals(); return geometry;
}

// 翼型保留原平面多边形和厚度包络，以弧面表达圆钝前缘、薄后缘及翼尖收薄。
export function* wingGeometry(points, thickness, leadingOnly = false) {
  const side = points.find(([x]) => x !== 0)[0] < 0 ? -1 : 1;
  const outline = points.map(([x,z]) => [Math.abs(x),z]);
  const span = Math.max(...outline.map(([x]) => x)), rows = SURFACE_APPEARANCE.wingSpanSegments, columns = SURFACE_APPEARANCE.wingChordSegments;
  const positions = [], uvs = [], indices = [], surfaceSize = (rows+1)*(columns+1);
  for (let surface=0; surface<2; surface++) for (let row=0; row<=rows; row++) {
    const x = row/rows*span, cuts = [];
    for (let edge=0; edge<outline.length; edge++) {
      const a=outline[edge], b=outline[(edge+1)%outline.length];
      if (Math.abs(a[0]-b[0]) < 1e-8) { if (Math.abs(x-a[0]) < 1e-8) cuts.push(a[1],b[1]); }
      else if (x>=Math.min(a[0],b[0]) && x<=Math.max(a[0],b[0])) cuts.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
    }
    const front=Math.min(...cuts), back=Math.max(...cuts), localThickness=thickness*(1-0.65*row/rows);
    for (let column=0; column<=columns; column++) {
      const t=column/columns*(leadingOnly?0.08:1);
      const half=5*localThickness*(0.2969*Math.sqrt(t)-0.126*t-0.3516*t*t+0.2843*t*t*t-0.1036*t*t*t*t);
      const y=-thickness/2+(surface===0?half:-half);
      positions.push(side*x,y+(leadingOnly?(surface===0?0.003:-0.003):0),front+(back-front)*t);
      uvs.push(row/rows*8,t*4);
      if (row && column<columns) {
        const a=surface*surfaceSize+(row-1)*(columns+1)+column, b=a+columns+1;
        if ((side>0)===(surface===0)) indices.push(a,a+1,b,a+1,b+1,b);
        else indices.push(a,b,a+1,a+1,b,b+1);
      }
    }
    yield;
  }
  if (!leadingOnly) for (const row of [0,rows]) for (let column=0; column<columns; column++) {
    const a=row*(columns+1)+column, b=a+surfaceSize;
    if ((side>0)===(row===0)) indices.push(a,b,a+1,a+1,b,b+1);
    else indices.push(a,a+1,b,a+1,b+1,b);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); yield 'boundary';
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2)); geometry.setIndex(indices); yield 'boundary';
  geometry.computeVertexNormals(); yield 'boundary';
  return geometry;
}
