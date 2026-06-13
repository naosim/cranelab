import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export interface SelectionEvent {
  partId: string | null;
}

export interface TransformEvent {
  partId: string;
  position: { x: number; y: number; z: number };
}

export class EditorScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly orbit: OrbitControls;
  readonly transform: TransformControls;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown = new THREE.Vector2();
  private onClick: (e: SelectionEvent) => void;
  private onTransform: (e: TransformEvent) => void;

  constructor(
    container: HTMLElement,
    onClick: (e: SelectionEvent) => void,
    onTransform: (e: TransformEvent) => void,
  ) {
    this.onClick = onClick;
    this.onTransform = onTransform;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x222233);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      10,
    );
    this.camera.position.set(0.4, 0.3, 0.6);
    this.camera.lookAt(0, 0.05, 0);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.05, 0);
    this.orbit.update();

    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setMode("translate");
    this.transform.setSize(0.5);
    this.scene.add(this.transform.getHelper());

    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !e.value;
    });

    this.transform.addEventListener("objectChange", () => {
      const obj = this.transform.object;
      if (obj) {
        this.onTransform({
          partId: obj.userData.partId as string,
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        });
      }
    });

    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      this.pointerDown.set(e.clientX, e.clientY);
      this.pointer.x = (e.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
    });

    this.renderer.domElement.addEventListener("pointerup", (e) => {
      const dx = e.clientX - this.pointerDown.x;
      const dy = e.clientY - this.pointerDown.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) return;
      this.handleClick();
    });

    this.setupLights();
    this.setupGrid();

    window.addEventListener("resize", () => this.resize(container));
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 3);
    dir.position.set(1, 2, 1);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;
    dir.shadow.mapSize.height = 1024;
    const d = 1;
    dir.shadow.camera.left = -d;
    dir.shadow.camera.right = d;
    dir.shadow.camera.top = d;
    dir.shadow.camera.bottom = -d;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 3;
    this.scene.add(dir);

    const fill = new THREE.DirectionalLight(0x8888ff, 0.5);
    fill.position.set(-0.5, 0.5, -1);
    this.scene.add(fill);
  }

  private setupGrid(): void {
    const grid = new THREE.GridHelper(1, 10, 0x446688, 0x334466);
    grid.position.y = -0.35;
    this.scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.3 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.35;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private handleClick(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes: THREE.Mesh[] = [];
    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.partId) {
        meshes.push(child);
      }
    });
    const hits = this.raycaster.intersectObjects(meshes, false);
    const partId = hits.length > 0 ? (hits[0].object.userData.partId as string) : null;
    this.onClick({ partId });
  }

  detachTransform(): void {
    this.transform.detach();
  }

  selectPart(partId: string | null): void {
    const prev = this.transform.object;
    if (prev && prev instanceof THREE.Mesh && prev.material instanceof THREE.MeshStandardMaterial) {
      prev.material.emissive.setHex(0x000000);
      prev.material.emissiveIntensity = 0;
    }
    if (partId) {
      const mesh = this.findMesh(partId);
      if (mesh && mesh instanceof THREE.Mesh) {
        this.transform.attach(mesh);
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.emissive.setHex(0x4488ff);
          mesh.material.emissiveIntensity = 0.3;
        }
        return;
      }
    }
    this.transform.detach();
  }

  private findMesh(partId: string): THREE.Object3D | null {
    let result: THREE.Object3D | null = null;
    this.scene.traverse((child) => {
      if (child.userData.partId === partId) {
        result = child;
      }
    });
    return result;
  }

  addGroup(group: THREE.Group): void {
    this.scene.add(group);
  }

  resize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  animate(): void {
    const loop = (): void => {
      requestAnimationFrame(loop);
      this.render();
    };
    loop();
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
