import * as THREE from 'three';
import { AIRCRAFT, AIRCRAFT_PREVIEW } from './config.js';
import { createAircraft } from './models.js';
import { PreviewTraffic } from './preview-traffic.js';

// 同一渲染器中的机外姿态视口，只显示飞机、交通与状态色，文字指引统一放在顶部。
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
    const size = renderer.getSize(this.size);
    renderer.setViewport(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
    renderer.setScissor(bounds.left, size.y - bounds.bottom, bounds.width, bounds.height);
    renderer.setScissorTest(true); renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
  }
}
