import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

type LoadCallback = (obj: THREE.Object3D) => void;

const BASE = "./models/";

export class AssetManager {
  private loader: GLTFLoader;
  private cache = new Map<string, THREE.Object3D>();
  private pending = new Map<string, LoadCallback[]>();

  constructor() {
    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    this.loader.setDRACOLoader(draco);
  }

  loadGLTF(_name: string, path: string, cb: LoadCallback): void {
    const url = BASE + path;
    const cached = this.cache.get(url);
    if (cached) {
      cb(cached.clone(true));
      return;
    }

    const pending = this.pending.get(url);
    if (pending) {
      pending.push(cb);
      return;
    }

    this.pending.set(url, [cb]);
    this.loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        this.cache.set(url, root);
        const cbs = this.pending.get(url) || [];
        this.pending.delete(url);
        for (const c of cbs) c(root.clone(true));
      },
      undefined,
      () => {
        const cbs = this.pending.get(url) || [];
        this.pending.delete(url);
        for (const c of cbs) c(new THREE.Group());
      },
    );
  }
}
