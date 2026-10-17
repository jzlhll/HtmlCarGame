import * as THREE from 'three';
import { coastalLandWeight } from './coastal-terrain.js';
import { batchStaticMeshes } from './static-batch.js';
import { RUNWAY, SCENERY, SURFACE_APPEARANCE } from './config.js';
import { surfaceTexture, modelGeometry } from './surface-assets.js';

export class AirportView extends THREE.Group {
  constructor(route, destination = false) {
    super();
    this.position.y = destination ? route.destination.elevation : 0;
    const runway = destination ? {...RUNWAY, ...route.destination, startOffset: route.destination.threshold} : RUNWAY;
    const offset = destination ? route.destination.threshold - RUNWAY.startOffset : 0;
    const colors = SCENERY.colors;
    // 地表与标线按固定层级偏移深度，避免远处毫米级间距失去精度而闪烁。
    const surface = (color, layer, roughness = 1) => new THREE.MeshStandardMaterial({
      color, roughness, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer,
    });
    const pavement = surface(0xffffff, SCENERY.surfaceLayers.pavement);
    pavement.map = surfaceTexture('asphalt-color'); pavement.roughnessMap = surfaceTexture('asphalt-detail');
    pavement.bumpMap = surfaceTexture('asphalt-detail'); pavement.bumpScale = SURFACE_APPEARANCE.asphaltBump;
    const shoulder = surface(colors.runwayShoulder, SCENERY.surfaceLayers.shoulder);
    shoulder.map = surfaceTexture('concrete-color');
    const marking = surface(colors.marking, SCENERY.surfaceLayers.marking, 0.9);
    const building = new THREE.MeshStandardMaterial({ color: colors.terminal, roughness: 0.85, map: surfaceTexture('concrete-color') });
    const roof = new THREE.MeshStandardMaterial({ color: 0x697f86, roughness: 0.75 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, map: surfaceTexture('facade-color'), bumpMap: surfaceTexture('facade-detail'), bumpScale: SURFACE_APPEARANCE.facadeBump, roughnessMap: surfaceTexture('facade-detail'), metalness: 0.4, roughness: 0.6 });
    const slab = (width, length, y, z, material, x = 0) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
      if (material === pavement || material === shoulder) {
        const uv = mesh.geometry.attributes.uv, scale = material === pavement ? SURFACE_APPEARANCE.asphaltTileMetres : SURFACE_APPEARANCE.concreteTileMetres;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width / scale, uv.getY(i) * length / scale);
      }
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      this.add(mesh);
      return mesh;
    };
    const box = (size, position, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      if (material === building || material === glass) {
        const uv = mesh.geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          const face = Math.floor(i / 4), width = face < 2 ? size[2] : size[0], height = face === 2 || face === 3 ? size[2] : size[1];
          uv.setXY(i, uv.getX(i) * width / (material === glass ? 32 : 8), uv.getY(i) * height / (material === glass ? 48 : 8));
        }
      }
      mesh.position.set(position[0] + (destination ? 280 : 0), position[1], position[2] + offset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.add(mesh);
      return mesh;
    };
    const center = runway.startOffset - runway.length / 2;
    slab(runway.width + 12, runway.length + 30, -0.015, center, shoulder);
    const runwayMesh = slab(runway.width, runway.length, 0, center, pavement);
    const runwayGeometry = new THREE.PlaneGeometry(runway.width, runway.length, 20, 100);
    runwayMesh.geometry.dispose(); runwayMesh.geometry = runwayGeometry;
    const position = runwayGeometry.attributes.position, uv = runwayGeometry.attributes.uv, tireColors = [];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), along = position.getY(i) + runway.length / 2;
      const tread = Math.exp(-(((Math.abs(x) - 3) / 1.8) ** 2));
      const landing = Math.exp(-(((along - 400) / 260) ** 2)) + Math.exp(-(((along - runway.length + 400) / 260) ** 2));
      const shade = 1 - 0.32 * tread * landing;
      tireColors.push(shade, shade, shade);
      uv.setXY(i, uv.getX(i) * runway.width / SURFACE_APPEARANCE.asphaltTileMetres, uv.getY(i) * runway.length / SURFACE_APPEARANCE.asphaltTileMetres);
    }
    runwayGeometry.setAttribute('color', new THREE.Float32BufferAttribute(tireColors, 3));
    const runwayMaterial = pavement.clone(); runwayMaterial.vertexColors = true; runwayMesh.material = runwayMaterial;
    if (destination) {
      const apron = route.destination.apron;
      slab(apron.width, apron.length, 0.005, apron.z, shoulder, apron.x);
    } else {
      slab(210, 700, 0.005, -140, shoulder, 180);
      slab(140, 24, 0.01, -85, pavement, 85);
    }
    for (const side of [-1, 1]) slab(0.35, runway.length - 20, 0.015, center, marking, side * (runway.width / 2 - 1.8));
    const dashCount = Math.floor(runway.length / (runway.stripeLength + runway.stripeGap));
    const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, runway.stripeLength), marking, dashCount);
    const dummy = new THREE.Object3D();
    dummy.rotation.x = -Math.PI / 2;
    for (let i = 0; i < dashCount; i++) {
      dummy.position.set(0, 0.02, runway.startOffset - 120 - i * (runway.stripeLength + runway.stripeGap));
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    }
    dashes.computeBoundingSphere();
    this.add(dashes);
    for (const end of [runway.startOffset - 18, runway.startOffset - runway.length + 18]) {
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) slab(1.6, 26, 0.022, end, marking, side * (6 + i * 3.2));
    }
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) slab(3, 28, 0.021, -230 - i * 180 + offset, marking, side * 19);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f0eee0';
    context.font = 'bold 190px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(runway.designator, 128, 128);
    const numberTexture = new THREE.CanvasTexture(canvas);
    numberTexture.colorSpace = THREE.SRGBColorSpace;
    slab(13, 16, 0.025, 35 + offset, new THREE.MeshStandardMaterial({ map: numberTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -SCENERY.surfaceLayers.marking, polygonOffsetUnits: -SCENERY.surfaceLayers.marking }));
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xd8b97e, roughness: 0.6 });
    const lightGeometry = new THREE.CylinderGeometry(0.22, 0.32, 0.5, 8);
    const lightRows = Math.ceil(runway.length / 50);
    const lights = new THREE.InstancedMesh(lightGeometry, lightMaterial, lightRows * 2);
    dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < lightRows; i++) {
      for (let side = 0; side < 2; side++) {
        dummy.position.set((side ? 1 : -1) * (runway.width / 2 + 2), 0.25, runway.startOffset - 20 - i * 50);
        dummy.updateMatrix(); lights.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    }
    lights.computeBoundingSphere(); this.add(lights);
    box([120, 12, 28], [215, 6, 140], building);
    box([124, 1.4, 32], [215, 12.2, 140], roof);
    box([118, 5.5, 0.2], [215, 7.2, 125.8], glass);
    for (let i=0; i<15; i++) box([0.32,5.8,0.5],[157+i*8.3,7.2,125.55],roof);
    for (let i=0; i<5; i++) {
      box([8,1.1,5],[170+i*22,13.4,140],roof);
      for (let rib=0; rib<4; rib++) box([0.18,0.3,5.2],[167+i*22+rib*2,14.1,140],building);
    }
    for (let i = 0; i < 3; i++) {
      box([42, 13, 45], [200 + i * 55, 6.5, 10], building);
      box([44, 1.8, 48], [200 + i * 55, 13, 10], roof);
      box([30, 9, 0.3], [200 + i * 55, 4.5, -12.6], glass);
      for (let rib=0; rib<7; rib++) box([0.22,9,0.6],[186+i*55+rib*4.6,4.5,-12.8],roof);
    }
    box([9, 30, 9], [135, 15, -210], building);
    box([18, 7, 16], [135, 32, -210], glass);
    box([21, 1, 19], [135, 36, -210], roof);
    const trunk = new THREE.MeshStandardMaterial({ color: 0x6c7565, roughness: 1 });
    const crown = new THREE.MeshStandardMaterial({ color: 0x627f70, roughness: 1 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.8, 5, 5), trunk, 80);
    const crowns = new THREE.InstancedMesh(modelGeometry('tree-crown'), crown, 80);
    const crownCenterZ = 250 - 19.5 * 105 + offset;
    let treeCount=0;
    for (let i = 0; i < 80; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (350 + Math.sin(i * 2.1) * 90), z = 250 - Math.floor(i / 2) * 105 + offset;
      if(!destination&&coastalLandWeight(x,z)<.99)continue;
      dummy.position.set(x, 2.5, z); dummy.updateMatrix(); trunks.setMatrixAt(treeCount, dummy.matrix);
      dummy.position.y = 0; dummy.position.z -= crownCenterZ; dummy.updateMatrix(); crowns.setMatrixAt(treeCount++, dummy.matrix);
    }
    trunks.count=crowns.count=treeCount;
    trunks.computeBoundingSphere(); crowns.computeBoundingSphere();
    const farCrowns = new THREE.InstancedMesh(modelGeometry('tree-crown-far'), crown, 80);
    farCrowns.count=treeCount;
    farCrowns.instanceMatrix = crowns.instanceMatrix; farCrowns.computeBoundingSphere();
    const foliage = new THREE.LOD(); foliage.position.set(0, 8, crownCenterZ);
    foliage.addLevel(crowns, 0); foliage.addLevel(farCrowns, SURFACE_APPEARANCE.airportTreeLodMetres, SURFACE_APPEARANCE.airportTreeLodHysteresis);
    this.add(trunks, foliage);
    this.batchSurfaces();
  }

  batchSurfaces() {
    // 每座机场独立合批，长跑道标线沿用完整批次。
    batchStaticMeshes(this, Infinity);
  }
}
