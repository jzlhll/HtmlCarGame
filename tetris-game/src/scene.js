import * as THREE from 'three';
import { WIDTH, HEIGHT, cellsOf } from './config.js';

export class BoardView {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.dirty = true;
    this.lastRevision = -1;
    this.lastBlink = -1;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setClearColor('#c5d0aa');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 10, -10, 0.1, 50);
    this.camera.position.set(0, 0, 15);
    this.scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xfff7da, 2.5);
    light.position.set(-4, 8, 10);
    this.scene.add(light);
    this.matrix = new THREE.Matrix4();
    this.color = new THREE.Color();
    this.geometry = new THREE.BoxGeometry(0.88, 0.88, 0.15);
    this.innerGeometry = new THREE.BoxGeometry(0.59, 0.59, 0.04);
    const gridMaterial = new THREE.MeshBasicMaterial({ color: '#b6c39b' });
    this.grid = new THREE.InstancedMesh(this.geometry, gridMaterial, WIDTH * HEIGHT);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      this.matrix.makeTranslation(x - 4.5, 9.5 - y, -0.25);
      this.grid.setMatrixAt(y * WIDTH + x, this.matrix);
    }
    this.grid.computeBoundingSphere();
    this.scene.add(this.grid);
    this.blockMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    this.innerMaterial = new THREE.MeshBasicMaterial({ color: '#9dab83' });
    this.blocks = new THREE.InstancedMesh(this.geometry, this.blockMaterial, 210);
    this.inners = new THREE.InstancedMesh(this.innerGeometry, this.innerMaterial, 210);
    this.blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inners.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blocks.frustumCulled = false;
    this.inners.frustumCulled = false;
    this.scene.add(this.blocks, this.inners);
    this.ghost = new THREE.InstancedMesh(this.geometry, new THREE.MeshBasicMaterial({ color: '#64774e', transparent: true, opacity: 0.21, depthWrite: false }), 5);
    this.ghost.frustumCulled = false;
    this.scene.add(this.ghost);

    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? 0.23 : 0.48;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
    }
    shape.closePath();
    this.star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 1 }), new THREE.MeshBasicMaterial({ color: '#a46816' }));
    this.scene.add(this.star);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  async prepare() {
    // 所有材质在准备窗口编译并首次提交，bonus 出现时复用现成资源。
    this.blocks.count = 1; this.inners.count = 1; this.ghost.count = 1;
    this.star.visible = true;
    this.blocks.setColorAt(0, this.color.set('#3f5539'));
    this.matrix.identity();
    this.blocks.setMatrixAt(0, this.matrix);
    this.inners.setMatrixAt(0, this.matrix);
    this.ghost.setMatrixAt(0, this.matrix);
    await this.renderer.compileAsync(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.dirty = true;
    this.draw();
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.width === width && this.height === height && this.dpr === dpr) return;
    this.width = width; this.height = height; this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.left = -5; this.camera.right = 5;
    this.camera.top = 5 * height / width; this.camera.bottom = -this.camera.top;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    this.draw();
  }

  setGame(game) { this.game = game; this.lastRevision = -1; this.dirty = true; }

  draw() {
    const s = this.game.state;
    const blinking = s.active.kind === 'bonus' && s.status === 'playing' ? Math.floor(s.elapsed / 170) % 2 : 0;
    if (this.lastRevision !== this.game.revision || this.dirty) {
      let index = 0;
      const block = (x, y, color) => {
        this.matrix.makeTranslation(x - 4.5, 9.5 - y, 0);
        this.blocks.setMatrixAt(index, this.matrix);
        this.blocks.setColorAt(index, this.color.set(color));
        this.matrix.makeTranslation(x - 4.5, 9.5 - y, 0.11);
        this.inners.setMatrixAt(index, this.matrix);
        index++;
      };
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        if (s.board[y][x]) block(x, y, s.board[y][x] === 'G' ? '#69755a' : '#405638');
      }
      if (s.active.kind !== 'bonus' && s.status !== 'gameOver') {
        for (const [x, y] of cellsOf(s.active)) block(s.active.x + x, s.active.y + y, '#334b2e');
      }
      this.blocks.count = index; this.inners.count = index;
      this.blocks.instanceMatrix.needsUpdate = true;
      this.blocks.instanceColor.needsUpdate = true;
      this.inners.instanceMatrix.needsUpdate = true;
      const landing = this.game.landingY();
      let ghostCount = 0;
      if (landing !== null && landing !== s.active.y && !['gameOver', 'completed'].includes(s.status)) {
        for (const [x, y] of cellsOf(s.active)) {
          this.matrix.makeTranslation(s.active.x + x - 4.5, 9.5 - landing - y, -0.05);
          this.ghost.setMatrixAt(ghostCount++, this.matrix);
        }
      }
      this.ghost.count = ghostCount;
      this.ghost.instanceMatrix.needsUpdate = true;
      this.star.position.set(s.active.x - 4.5, 9.5 - s.active.y, 0.4);
      this.lastRevision = this.game.revision;
      this.dirty = true;
    }
    if (this.lastBlink !== blinking) { this.lastBlink = blinking; this.dirty = true; }
    this.star.visible = s.active.kind === 'bonus' && blinking === 0 && s.status !== 'gameOver';
    if (this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; }
  }
}
