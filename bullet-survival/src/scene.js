import * as THREE from 'three';
import { WORLD, GAME } from './config.js';

export class FlightScene {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.displayedGame = game;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x071316, 0);
    this.renderer.autoClear = false;
    this.renderer.domElement.setAttribute('aria-label', '飞机与四周来袭的红色子弹');
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-60, 60, 50, -50, 0.1, 100);
    this.camera.position.z = 50;
    this.matrix = new THREE.Object3D();
    this.bulletMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv; void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float core=1.-smoothstep(.22,.42,r);float glow=pow(max(0.,1.-r),2.);gl_FragColor=vec4(mix(vec3(1.,.22,.19),vec3(1.,.78,.52),core),max(core,glow*.6));}',
    }), GAME.maxBullets);
    this.bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bulletMesh.frustumCulled = false;
    this.scene.add(this.bulletMesh);
    this.plane = this.createPlane();
    this.scene.add(this.plane);
    this.hitbox = new THREE.Mesh(new THREE.CircleGeometry(WORLD.playerRadius, 24), new THREE.MeshBasicMaterial({ color: 0xf1ffea }));
    this.hitbox.position.z = 5;
    this.plane.add(this.hitbox);
    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x84eac6, transparent: true, opacity: 0.23 });
    this.halo = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.78, 64), haloMaterial);
    this.scene.add(this.halo);
    this.particlePositions = new Float32Array(48 * 3);
    this.particleVelocity = new Float32Array(48 * 2);
    const particles = new THREE.BufferGeometry();
    particles.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particles = new THREE.Points(particles, new THREE.PointsMaterial({ color: 0xade6c6, size: 0.65, transparent: true, opacity: 0 }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.explosionTime = 1;
    this.preview = Array.from({ length: 72 }, (_, index) => {
      const angle = index * 2.39996;
      const radius = 19 + ((index * 37) % 40);
      return { active: true, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.85 };
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  createPlane() {
    const group = new THREE.Group();
    const silhouette = new THREE.Shape();
    silhouette.moveTo(0, 3.5);
    for (const [x, y] of [[0.8, 0.4], [3.5, -1.3], [3.5, -1.9], [0.7, -1.25], [0.6, -2.5], [1.4, -3], [1.4, -3.35], [0, -2.95], [-1.4, -3.35], [-1.4, -3], [-0.6, -2.5], [-0.7, -1.25], [-3.5, -1.9], [-3.5, -1.3], [-0.8, 0.4]]) silhouette.lineTo(x, y);
    silhouette.closePath();
    group.add(new THREE.Mesh(new THREE.ShapeGeometry(silhouette), new THREE.MeshBasicMaterial({ color: 0x80e5bf })));
    const cockpit = new THREE.Mesh(new THREE.CircleGeometry(0.48, 12), new THREE.MeshBasicMaterial({ color: 0x123b39 }));
    cockpit.scale.y = 2.2;
    cockpit.position.set(0, 1.2, 1);
    group.add(cockpit);
    const exhaust = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.7), new THREE.MeshBasicMaterial({ color: 0xc7f9d6, transparent: true, opacity: 0.7 }));
    exhaust.position.set(0, -3.65, 0);
    group.add(exhaust);
    return group;
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    const scale = Math.max(WORLD.width / width, WORLD.height / height);
    this.width = width;
    this.height = height;
    this.game.setBounds(width * scale, height * scale);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(width, height);
    this.render(this.displayedGame);
  }

  burst(x, y) {
    this.explosionTime = 0;
    this.particles.position.set(x, y, 4);
    for (let i = 0; i < 48; i++) {
      this.particlePositions.fill(0, i * 3, i * 3 + 3);
      const angle = i * 2.39996;
      const speed = 8 + (i % 7) * 3;
      this.particleVelocity[i * 2] = Math.cos(angle) * speed;
      this.particleVelocity[i * 2 + 1] = Math.sin(angle) * speed;
    }
  }

  render(game, dt = 0) {
    this.displayedGame = game;
    if (this.camera.right !== game.bounds.width / 2 || this.camera.top !== game.bounds.height / 2) {
      this.camera.left = -game.bounds.width / 2;
      this.camera.right = game.bounds.width / 2;
      this.camera.top = game.bounds.height / 2;
      this.camera.bottom = -game.bounds.height / 2;
      this.camera.updateProjectionMatrix();
    }
    const preview = game.state === 'ready';
    let count = 0;
    for (const bullet of preview ? this.preview : game.bullets) {
      if (!bullet.active) continue;
      this.matrix.position.set(preview ? bullet.x * game.bounds.width / WORLD.width : bullet.x, preview ? bullet.y * game.bounds.height / WORLD.height : bullet.y, 2);
      this.matrix.scale.set(3.3, 3.3, 1);
      this.matrix.updateMatrix();
      this.bulletMesh.setMatrixAt(count++, this.matrix.matrix);
    }
    this.bulletMesh.count = count;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.plane.position.set(game.player.x, game.player.y, 3);
    this.plane.rotation.z = -game.player.dx * 0.12;
    this.plane.visible = !['over', 'returning'].includes(game.state);
    this.halo.position.set(game.player.x, game.player.y, 1);
    this.halo.visible = this.plane.visible;
    if (this.explosionTime < 1) {
      this.explosionTime += dt;
      for (let i = 0; i < 48; i++) {
        this.particlePositions[i * 3] += this.particleVelocity[i * 2] * dt;
        this.particlePositions[i * 3 + 1] += this.particleVelocity[i * 2 + 1] * dt;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
    this.particles.material.opacity = Math.max(0, 1 - this.explosionTime);
    // 回放保留原对局的场地比例，避免在不同窗口里拉伸轨迹。
    const width = Math.min(this.width, this.height * game.bounds.width / game.bounds.height);
    const height = width * game.bounds.height / game.bounds.width;
    const x = (this.width - width) / 2;
    const y = (this.height - height) / 2;
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.setViewport(x, y, width, height);
    this.renderer.setScissor(x, y, width, height);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
  }
}
