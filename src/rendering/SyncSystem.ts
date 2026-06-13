import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

export class SyncSystem {
  private pairs: Array<{ body: RAPIER.RigidBody; mesh: THREE.Object3D }> = [];

  addPair(body: RAPIER.RigidBody, mesh: THREE.Object3D): void {
    this.pairs.push({ body, mesh });
  }

  removePair(body: RAPIER.RigidBody): void {
    this.pairs = this.pairs.filter(p => p.body !== body);
  }

  sync(): void {
    for (const { body, mesh } of this.pairs) {
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
}
