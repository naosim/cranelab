import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { SceneManager } from "../rendering/SceneManager";
import { SyncSystem } from "../rendering/SyncSystem";
import type { PrizeBlueprint } from "../editor/PrizeData";

const PIVOT_Y = 0.7;
const LO_DENSITY = 0.05;
const S = 2;

const GROUP_ARM = 1;
const GROUP_PRIZE = 1 << 1;
const PRIZE_COLLISION_GROUPS = (GROUP_ARM << 16) | GROUP_PRIZE;

export class PrizeFactory {
  static create(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    mass: number,
  ): void {
    const rotY = Math.random() * Math.PI * 2;
    this.createDog(physicsWorld, sceneManager, syncSystem, mass, rotY);
    const body = physicsWorld.getBody("prize_bear")!;
    const pivot = sceneManager.getMesh("prize_bear") as THREE.Group;
    const tagZ = -(0.1 * S + 0.05 * S);
    this.buildTagOnBody(physicsWorld, body, pivot, 0, 0.03 * S, tagZ, 0);
  }

  static createFromBlueprint(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    mass: number,
    blueprint: PrizeBlueprint,
  ): void {
    const rotY = Math.random() * Math.PI * 2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, PIVOT_Y, 0)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(2.0)
      .setAngularDamping(1.5)
      .setCcdEnabled(true);
    const body = physicsWorld.addBody("prize_bear", bodyDesc);

    for (const part of blueprint.parts) {
      physicsWorld.world.createCollider(
        RAPIER.ColliderDesc.cuboid(part.hw, part.hh, part.hd)
          .setTranslation(part.px, part.py, part.pz)
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
    sceneManager.addMesh("prize_bear", pivot);
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
      this.buildTagOnBody(physicsWorld, body, pivot, tagCfg.px, tagCfg.py, tagCfg.pz, tagCfg.ry ?? 0);
    }
  }

  private static sphereCol(
    r: number,
    x: number,
    y: number,
    z: number,
    friction = 0.6,
  ): RAPIER.ColliderDesc {
    return RAPIER.ColliderDesc.ball(r)
      .setTranslation(x, y, z)
      .setDensity(LO_DENSITY)
      .setFriction(friction)
      .setCollisionGroups(PRIZE_COLLISION_GROUPS);
  }

  private static legCol(
    x: number,
    y: number,
    z: number,
  ): RAPIER.ColliderDesc {
    return RAPIER.ColliderDesc.capsule(0.04 * S, 0.015 * S)
      .setTranslation(x, y, z)
      .setDensity(LO_DENSITY)
      .setFriction(0.6)
      .setCollisionGroups(PRIZE_COLLISION_GROUPS);
  }

  private static createDog(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    mass: number,
    rotY: number,
  ): void {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, PIVOT_Y, 0)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(2.0)
      .setAngularDamping(1.5)
      .setCcdEnabled(true);
    const body = physicsWorld.addBody("prize_bear", bodyDesc);

    // body sphere (larger so legs are inside it)
    physicsWorld.world.createCollider(this.sphereCol(0.1 * S, 0, 0, 0), body);
    // head sphere at front of body
    physicsWorld.world.createCollider(this.sphereCol(0.045 * S, 0, 0.02 * S, 0.12 * S), body);

    // 4 legs — slightly inset from body edge so they appear attached
    const legY = -(0.1 * S * 0.8 + 0.03 * S);
    physicsWorld.world.createCollider(this.legCol(-0.04 * S, legY, 0.055 * S), body);
    physicsWorld.world.createCollider(this.legCol(0.04 * S, legY, 0.055 * S), body);
    physicsWorld.world.createCollider(this.legCol(-0.04 * S, legY, -0.055 * S), body);
    physicsWorld.world.createCollider(this.legCol(0.04 * S, legY, -0.055 * S), body);

    // tail
    physicsWorld.world.createCollider(this.sphereCol(0.012 * S, 0, -0.02 * S, -0.14 * S), body);

    body.setAdditionalMass(mass, true);

    // visual
    const pivot = new THREE.Group();
    pivot.position.set(0, PIVOT_Y, 0);
    pivot.quaternion.set(q.x, q.y, q.z, q.w);
    sceneManager.addMesh("prize_bear", pivot);
    syncSystem.addPair(body, pivot);

    const fur = new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.9 });
    const furLight = new THREE.MeshStandardMaterial({ color: 0xd4b078, roughness: 0.9 });
    const furDark = new THREE.MeshStandardMaterial({ color: 0x8a6030, roughness: 0.9 });
    const eyesMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const earMat = new THREE.MeshStandardMaterial({ color: 0x8a6030, roughness: 0.9 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe8d4a0, roughness: 0.9 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xd4b078, roughness: 0.9 });

    // body
    const bodyG = new THREE.Mesh(new THREE.SphereGeometry(0.1 * S, 20, 20), fur);
    bodyG.scale.set(1, 0.8, 1.2);
    bodyG.castShadow = true;
    pivot.add(bodyG);

    // belly patch
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.06 * S, 12, 12), bellyMat);
    belly.scale.set(0.8, 0.5, 1.3);
    belly.position.set(0, -0.03 * S, 0);
    pivot.add(belly);

    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045 * S, 20, 20), furLight);
    head.position.set(0, 0.02 * S, 0.12 * S);
    head.castShadow = true;
    pivot.add(head);

    // ears (floppy)
    const earG = new THREE.SphereGeometry(0.015 * S, 10, 10);
    const earL = new THREE.Mesh(earG, earMat);
    earL.position.set(-0.04 * S, 0.05 * S, 0.09 * S);
    earL.scale.set(1, 0.6, 0.7);
    pivot.add(earL);
    const earR = new THREE.Mesh(earG, earMat);
    earR.position.set(0.04 * S, 0.05 * S, 0.09 * S);
    earR.scale.set(1, 0.6, 0.7);
    pivot.add(earR);

    // eyes
    const eyeG = new THREE.SphereGeometry(0.008 * S, 8, 8);
    const eyeL = new THREE.Mesh(eyeG, eyesMat);
    eyeL.position.set(-0.02 * S, 0.035 * S, 0.15 * S);
    pivot.add(eyeL);
    const eyeR = new THREE.Mesh(eyeG, eyesMat);
    eyeR.position.set(0.02 * S, 0.035 * S, 0.15 * S);
    pivot.add(eyeR);

    // nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.006 * S, 8, 8), noseMat);
    nose.position.set(0, 0.01 * S, 0.165 * S);
    pivot.add(nose);

    // legs (4) — inset from body edge
    const legGeo = new THREE.CapsuleGeometry(0.015 * S, 0.12 * S, 6, 6);
    const legPositions = [
      [-0.04 * S, legY, 0.055 * S],
      [0.04 * S, legY, 0.055 * S],
      [-0.04 * S, legY, -0.055 * S],
      [0.04 * S, legY, -0.055 * S],
    ];
    for (const p of legPositions) {
      const m = new THREE.Mesh(legGeo, furDark);
      m.position.set(p[0], p[1], p[2]);
      m.castShadow = true;
      pivot.add(m);
    }

    // tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.012 * S, 8, 8), tailMat);
    tail.position.set(0, -0.02 * S, -0.14 * S);
    pivot.add(tail);
  }

  private static buildTagOnBody(
    physicsWorld: PhysicsWorld,
    body: RAPIER.RigidBody,
    pivot: THREE.Group,
    tagPx: number,
    tagPy: number,
    tagPz: number,
    tagRy: number,
  ): void {
    const hexR = 0.05 * S;
    const halfThick = 0.01;
    const halfLen = hexR * 0.5;
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
          .setTranslation(rp.x + tagPx, tagPy, rp.z + tagPz)
          .setRotation({ x: rQ.x, y: rQ.y, z: rQ.z, w: rQ.w })
          .setFriction(2.0)
          .setDensity(LO_DENSITY)
          .setCollisionGroups(PRIZE_COLLISION_GROUPS),
        body,
      );
    }

    // visual — horizontal torus ring
    const tagMat = new THREE.MeshStandardMaterial({
      color: 0x44bbff,
      roughness: 0.4,
      metalness: 0.3,
    });
    const tagMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.05 * S, 0.012 * S, 12, 20),
      tagMat,
    );
    tagMesh.position.set(tagPx, tagPy, tagPz);
    tagMesh.rotation.x = Math.PI / 2;
    tagMesh.rotation.y = tagRy;
    tagMesh.castShadow = true;
    pivot.add(tagMesh);
  }

  static updateMass(physicsWorld: PhysicsWorld, mass: number): void {
    const body = physicsWorld.getBody("prize_bear");
    if (body) body.setAdditionalMass(Math.max(0, mass), true);
  }
}
