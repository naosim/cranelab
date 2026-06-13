import * as THREE from "three";
import { PrizeBlueprint, PrizePart, TagConfig } from "./PrizeData";

export class PrizeBuilder {
  readonly group = new THREE.Group();
  private tagObjects: THREE.Object3D[] = [];

  build(blueprint: PrizeBlueprint): void {
    this.clear();
    for (const part of blueprint.parts) {
      this.addPart(part);
    }
    if (blueprint.tag?.enabled) {
      this.buildTag(blueprint.tag);
    }
  }

  updateTag(config: TagConfig): void {
    this.clearTag();
    if (config.enabled) {
      this.buildTag(config);
    }
  }

  private buildTag(config: TagConfig): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x44bbff,
      roughness: 0.4,
      metalness: 0.3,
    });
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.024, 12, 20),
      mat,
    );
    torus.position.set(config.px, config.py, config.pz);
    torus.rotation.x = Math.PI / 2;
    torus.rotation.y = config.ry;
    torus.rotation.order = "YXZ";
    torus.castShadow = true;
    this.group.add(torus);
    this.tagObjects.push(torus);

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.4 });
    for (let i = 0; i < 6; i++) {
      const phi = i * Math.PI / 3;
      const phiNext = (i + 1) * Math.PI / 3;
      const r = 0.1;
      const cx = (r * Math.cos(phi) + r * Math.cos(phiNext)) / 2;
      const cz = (r * Math.sin(phi) + r * Math.sin(phiNext)) / 2;
      const dx = r * Math.cos(phiNext) - r * Math.cos(phi);
      const dz = r * Math.sin(phiNext) - r * Math.sin(phi);
      const halfLen = Math.sqrt(dx * dx + dz * dz) / 2;
      const angle = Math.atan2(dz, dx);
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.006, 0.006),
        edgeMat,
      );
      seg.scale.x = halfLen;
      seg.position.set(config.px + cx, config.py, config.pz + cz);
      seg.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), config.ry);
      seg.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle + config.ry);
      this.group.add(seg);
      this.tagObjects.push(seg);
    }
  }

  private clearTag(): void {
    for (const obj of this.tagObjects) {
      this.group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
    this.tagObjects = [];
  }

  addPart(part: PrizePart): THREE.Mesh {
    const geo = new THREE.BoxGeometry(part.hw * 2, part.hh * 2, part.hd * 2);
    const mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.partId = part.id;
    mesh.position.set(part.px, part.py, part.pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private clear(): void {
    this.clearTag();
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.group.remove(child);
    }
  }

  dispose(): void {
    this.clear();
  }
}
