import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { SceneManager } from "../rendering/SceneManager";
import { SyncSystem } from "../rendering/SyncSystem";
import type { PrizeBlueprint } from "../editor/PrizeData";

const PIVOT_Y = 0.7;
const LO_DENSITY = 0.05;

const GROUP_ARM = 1;
const GROUP_PRIZE = 1 << 1;
const PRIZE_COLLISION_GROUPS = (GROUP_ARM << 16) | GROUP_PRIZE;

export class PrizeFactory {
  static currentBlueprint: PrizeBlueprint | null = null;

  static createFromBlueprint(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    mass: number,
    blueprint: PrizeBlueprint,
    prizeScale: number = 1.0,
  ): void {
    PrizeFactory.currentBlueprint = blueprint;
    const rotY = Math.random() * Math.PI * 2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, PIVOT_Y, 0)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(2.0)
      .setAngularDamping(1.5)
      .setCcdEnabled(true);
    const body = physicsWorld.addBody("prize", bodyDesc);

    for (const part of blueprint.parts) {
      physicsWorld.world.createCollider(
        RAPIER.ColliderDesc.cuboid(part.hw * prizeScale, part.hh * prizeScale, part.hd * prizeScale)
          .setTranslation(part.px * prizeScale, part.py * prizeScale, part.pz * prizeScale)
          .setDensity(LO_DENSITY)
          .setFriction(0.6)
          .setCollisionGroups(PRIZE_COLLISION_GROUPS),
        body,
      );
    }

    body.setAdditionalMass(mass, true);

    const pivot = new THREE.Group();
    pivot.position.set(0, PIVOT_Y, 0);
    pivot.quaternion.set(q.x, q.y, q.z, q.w);
    pivot.scale.set(prizeScale, prizeScale, prizeScale);
    sceneManager.addMesh("prize", pivot);
    syncSystem.addPair(body, pivot);

    for (const part of blueprint.parts) {
      const mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.9 });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(part.hw * 2, part.hh * 2, part.hd * 2),
        mat,
      );
      mesh.position.set(part.px, part.py, part.pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
    }

    const tagCfg = blueprint.tag;
    if (tagCfg?.enabled) {
      this.buildTagOnBody(physicsWorld, body, pivot, tagCfg.px, tagCfg.py, tagCfg.pz, tagCfg.ry ?? 0, prizeScale);
    }
  }

  private static buildTagOnBody(
    physicsWorld: PhysicsWorld,
    body: RAPIER.RigidBody,
    pivot: THREE.Group,
    tagPx: number,
    tagPy: number,
    tagPz: number,
    tagRy: number,
    prizeScale: number = 1.0,
  ): void {
    const hexR = 0.1 * prizeScale;
    const halfThick = 0.02 * prizeScale;
    const halfLen = hexR * 0.6;
    const _v3 = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _xAxis = new THREE.Vector3(1, 0, 0);
    const _yAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 6; i++) {
      const phi = i * Math.PI / 3;
      const phiNext = (i + 1) * Math.PI / 3;
      const vx = hexR * Math.cos(phi);
      const vz = hexR * Math.sin(phi);
      const vxNext = hexR * Math.cos(phiNext);
      const vzNext = hexR * Math.sin(phiNext);
      const cx = (vx + vxNext) / 2;
      const cz = (vz + vzNext) / 2;
      const dir = _v3.set(vxNext - vx, 0, vzNext - vz).normalize();
      _q.setFromUnitVectors(_xAxis, dir);
      const rot = new THREE.Quaternion().setFromAxisAngle(_yAxis, tagRy);
      const rp = new THREE.Vector3(cx, 0, cz).applyQuaternion(rot);
      const rDir = dir.clone().applyQuaternion(rot);
      const rQ = new THREE.Quaternion().setFromUnitVectors(_xAxis, rDir);
      physicsWorld.world.createCollider(
        RAPIER.ColliderDesc.cuboid(halfLen, halfThick, halfThick)
          .setTranslation(rp.x + tagPx * prizeScale, tagPy * prizeScale, rp.z + tagPz * prizeScale)
          .setRotation({ x: rQ.x, y: rQ.y, z: rQ.z, w: rQ.w })
          .setFriction(2.0)
          .setDensity(LO_DENSITY)
          .setCollisionGroups(PRIZE_COLLISION_GROUPS),
        body,
      );
    }

    const tagMat = new THREE.MeshStandardMaterial({
      color: 0x44bbff,
      roughness: 0.4,
      metalness: 0.3,
    });
    const tagMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.024, 12, 20),
      tagMat,
    );
    tagMesh.position.set(tagPx, tagPy, tagPz);
    tagMesh.rotation.x = Math.PI / 2;
    tagMesh.rotation.y = tagRy;
    tagMesh.castShadow = true;
    pivot.add(tagMesh);
  }

  static updateMass(physicsWorld: PhysicsWorld, mass: number): void {
    const body = physicsWorld.getBody("prize");
    if (body) body.setAdditionalMass(Math.max(0, mass), true);
  }

  static updateScale(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    prizeScale: number,
    prizeMass: number,
  ): void {
    const body = physicsWorld.getBody("prize");
    const pivot = sceneManager.getMesh("prize") as THREE.Group | undefined;
    if (!body || !pivot) return;

    pivot.scale.set(prizeScale, prizeScale, prizeScale);

    const pos = body.translation();
    const rot = body.rotation();

    syncSystem.removePair(body);
    physicsWorld.removeBody("prize");
    sceneManager.removeMesh("prize");

    if (PrizeFactory.currentBlueprint) {
      PrizeFactory.createFromBlueprint(physicsWorld, sceneManager, syncSystem, prizeMass, PrizeFactory.currentBlueprint, prizeScale);
    }

    const newBody = physicsWorld.getBody("prize");
    if (newBody) {
      newBody.setTranslation(pos, true);
      newBody.setRotation(rot, true);
    }
  }
}
