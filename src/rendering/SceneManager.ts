import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  private meshes = new Map<string, THREE.Object3D>();
  private dirLight!: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222233);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 50);
    this.camera.position.set(0, 1.4, 4.5);
    this.camera.lookAt(0, 0.5, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 6;

    this.setupLights();
    this.setupHelpers();

    window.addEventListener("resize", () => this.onResize(container));
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    this.scene.add(ambient);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.dirLight.position.set(0, 5, 0);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    const warm = new THREE.DirectionalLight(0xffcc88, 0.7);
    warm.position.set(-3, 2, 2);
    this.scene.add(warm);

    const cool = new THREE.DirectionalLight(0x88ccff, 0.5);
    cool.position.set(3, 1, -3);
    this.scene.add(cool);
  }

  private setupHelpers(): void {
    const grid = new THREE.GridHelper(6, 20, 0x888888, 0x444444);
    this.scene.add(grid);
  }

  addMesh(name: string, mesh: THREE.Object3D): void {
    this.meshes.set(name, mesh);
    this.scene.add(mesh);
  }

  getMesh(name: string): THREE.Object3D | undefined {
    return this.meshes.get(name);
  }

  removeMesh(name: string): void {
    const mesh = this.meshes.get(name);
    if (mesh) {
      this.scene.remove(mesh);
      this.meshes.delete(name);
    }
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setLightweight(enabled: boolean): void {
    if (enabled) {
      this.dirLight.shadow.mapSize.set(256, 256);
      this.dirLight.shadow.map?.dispose();
      this.dirLight.shadow.map = null;
      this.renderer.setPixelRatio(1);
    } else {
      this.dirLight.shadow.mapSize.set(512, 512);
      this.dirLight.shadow.map?.dispose();
      this.dirLight.shadow.map = null;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
