import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class ColliderDebug {
  private group = new THREE.Group();
  private meshMap = new Map<number, THREE.LineSegments>();
  private _enabled = false;

  get enabled(): boolean {
    return this._enabled;
  }

  constructor(private scene: THREE.Scene) {}

  toggle(): void {
    this._enabled = !this._enabled;
    if (this._enabled) {
      this.scene.add(this.group);
    } else {
      this.clear();
      this.scene.remove(this.group);
    }
  }

  update(world: RAPIER.World): void {
    if (!this._enabled) return;
    const seen = new Set<number>();
    world.forEachCollider((collider: RAPIER.Collider) => {
      seen.add(collider.handle);
      const t = collider.translation();
      const r = collider.rotation();
      this.addOrUpdate(collider.handle, collider.shape, t, r);
    });
    for (const [handle, mesh] of this.meshMap) {
      if (!seen.has(handle)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        this.meshMap.delete(handle);
      }
    }
  }

  private addOrUpdate(handle: number, shape: RAPIER.Shape, t: RAPIER.Vector, r: RAPIER.Rotation): void {
    let mesh = this.meshMap.get(handle);
    if (!mesh) {
      const m = this.createMesh(shape);
      if (!m) return;
      this.meshMap.set(handle, m);
      this.group.add(m);
      mesh = m;
    }
    mesh.position.set(t.x, t.y, t.z);
    mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }

  private createMesh(shape: RAPIER.Shape): THREE.LineSegments | null {
    const edgeMat = () => new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });

    const shapeType = (shape as unknown as { type: number }).type;

    if (shapeType === 0) {
      // Ball
      const radius = (shape as unknown as { radius: number }).radius;
      const geo = new THREE.SphereGeometry(radius, 12, 8);
      const edges = new THREE.EdgesGeometry(geo);
      geo.dispose();
      return new THREE.LineSegments(edges, edgeMat());
    }

    if (shapeType === 1) {
      // Cuboid
      const he = (shape as unknown as { halfExtents: { x: number; y: number; z: number } }).halfExtents;
      const geo = new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2);
      const edges = new THREE.EdgesGeometry(geo);
      geo.dispose();
      return new THREE.LineSegments(edges, edgeMat());
    }

    if (shapeType === 2) {
      // Capsule
      const hh = (shape as unknown as { halfHeight: number; radius: number }).halfHeight;
      const r = (shape as unknown as { halfHeight: number; radius: number }).radius;
      const totalH = (hh + r) * 2;
      const geo = new THREE.CylinderGeometry(r, r, totalH - r * 2, 8, 1);
      const edges = new THREE.EdgesGeometry(geo);
      geo.dispose();
      return new THREE.LineSegments(edges, edgeMat());
    }

    return null;
  }

  private clear(): void {
    for (const [, mesh] of this.meshMap) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshMap.clear();
  }
}
