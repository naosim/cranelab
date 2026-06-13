import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { SceneManager } from "../rendering/SceneManager";
import { SyncSystem } from "../rendering/SyncSystem";

const PIVOT_Y = 0.7;
const LO_DENSITY = 0.05;
const S = 2;

const GROUP_ARM = 1;
const GROUP_PRIZE = 1 << 1;
const PRIZE_COLLISION_GROUPS = (GROUP_ARM << 16) | GROUP_PRIZE;

export type PrizeType = "dog" | "sitting_bear";

export class PrizeFactory {
  static create(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    mass: number,
    type?: PrizeType,
  ): void {
    if (!type) {
      const types: PrizeType[] = ["dog", "sitting_bear"];
      type = types[Math.floor(Math.random() * types.length)];
    }
    const rotY = Math.random() * Math.PI * 2;
    if (type === "sitting_bear") {
      this.createSittingBear(physicsWorld, sceneManager, syncSystem, mass, rotY);
    } else {
      this.createDog(physicsWorld, sceneManager, syncSystem, mass, rotY);
    }
    const body = physicsWorld.getBody("prize_bear")!;
    const pivot = sceneManager.getMesh("prize_bear") as THREE.Group;
    const tagZ = type === "sitting_bear"
      ? -(0.06 * S + 0.05 * S)
      : -(0.1 * S + 0.05 * S);
    this.buildTagOnBody(physicsWorld, body, pivot, tagZ);
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

  private static createSittingBear(
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

    const DENSITY = 0.05;
    const FRICTION = 0.6;

    // all colliders are cuboids (四角柱)
    // body (torso) — 胴体の横幅は半分
    const bHW = 0.04 * S, bHH = 0.08 * S, bHD = 0.06 * S;
    const bodyY = -0.02 * S;
    physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(bHW, bHH, bHD)
        .setTranslation(0, bodyY, 0)
        .setDensity(DENSITY).setFriction(FRICTION)
        .setCollisionGroups(PRIZE_COLLISION_GROUPS),
      body,
    );

    // head
    const hHW = 0.05 * S, hHH = 0.05 * S, hHD = 0.05 * S;
    physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hHW, hHH, hHD)
        .setTranslation(0, 0.06 * S, 0.01 * S)
        .setDensity(DENSITY).setFriction(FRICTION)
        .setCollisionGroups(PRIZE_COLLISION_GROUPS),
      body,
    );

    // arms (left/right) — 体の側面から前方へ
    const aHW = 0.02 * S, aHH = 0.05 * S, aHD = 0.03 * S;
    const armX = bHW, armZ = bHD;
    physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(aHW, aHH, aHD)
        .setTranslation(-armX, bodyY + aHH * 0.3, armZ)
        .setDensity(DENSITY).setFriction(FRICTION)
        .setCollisionGroups(PRIZE_COLLISION_GROUPS),
      body,
    );
    physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(aHW, aHH, aHD)
        .setTranslation(armX, bodyY + aHH * 0.3, armZ)
        .setDensity(DENSITY).setFriction(FRICTION)
        .setCollisionGroups(PRIZE_COLLISION_GROUPS),
      body,
    );

    // legs (left/right) — 体の下から前方へ
    const lHW = 0.03 * S, lHH = 0.04 * S, lHD = 0.035 * S;
    const legX = 0.04 * S, legY = -(bHH - lHH * 0.5), legZ = bHD;
    physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(lHW, lHH, lHD)
        .setTranslation(-legX, bodyY + legY, legZ)
        .setDensity(DENSITY).setFriction(FRICTION)
        .setCollisionGroups(PRIZE_COLLISION_GROUPS),
      body,
    );
    physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(lHW, lHH, lHD)
        .setTranslation(legX, bodyY + legY, legZ)
        .setDensity(DENSITY).setFriction(FRICTION)
        .setCollisionGroups(PRIZE_COLLISION_GROUPS),
      body,
    );

    body.setAdditionalMass(mass, true);

    // visual — all boxes
    const pivot = new THREE.Group();
    pivot.position.set(0, PIVOT_Y, 0);
    pivot.quaternion.set(q.x, q.y, q.z, q.w);
    sceneManager.addMesh("prize_bear", pivot);
    syncSystem.addPair(body, pivot);

    const brown = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.9 });
    const lightBrown = new THREE.MeshStandardMaterial({ color: 0xa0724e, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 });
    const eyesMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });

    // body
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(bHW * 2, bHH * 2, bHD * 2), brown);
    bodyMesh.position.set(0, bodyY, 0);
    bodyMesh.castShadow = true;
    pivot.add(bodyMesh);

    // belly patch
    const belly = new THREE.Mesh(new THREE.BoxGeometry(bHW * 1.2, bHH * 0.5, bHD * 0.6), lightBrown);
    belly.position.set(0, bodyY - bHH * 0.15, bHD * 0.5);
    pivot.add(belly);

    // head
    const head = new THREE.Mesh(new THREE.BoxGeometry(hHW * 2, hHH * 2, hHD * 2), brown);
    head.position.set(0, 0.06 * S, 0.01 * S);
    head.castShadow = true;
    pivot.add(head);

    // ears (small cubes on top of head)
    const earHW = 0.02 * S, earHH = 0.015 * S, earHD = 0.02 * S;
    const earMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 });
    const earL = new THREE.Mesh(new THREE.BoxGeometry(earHW * 2, earHH * 2, earHD * 2), earMat);
    earL.position.set(-0.04 * S, 0.09 * S, 0.01 * S);
    pivot.add(earL);
    const earR = new THREE.Mesh(new THREE.BoxGeometry(earHW * 2, earHH * 2, earHD * 2), earMat);
    earR.position.set(0.04 * S, 0.09 * S, 0.01 * S);
    pivot.add(earR);

    // eyes (small black boxes)
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.01 * S, 0.01 * S, 0.005 * S), eyesMat);
    eyeL.position.set(-0.02 * S, 0.075 * S, 0.06 * S);
    pivot.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.01 * S, 0.01 * S, 0.005 * S), eyesMat);
    eyeR.position.set(0.02 * S, 0.075 * S, 0.06 * S);
    pivot.add(eyeR);

    // nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.012 * S, 0.008 * S, 0.006 * S), noseMat);
    nose.position.set(0, 0.065 * S, 0.07 * S);
    pivot.add(nose);

    // arms
    const armMeshL = new THREE.Mesh(new THREE.BoxGeometry(aHW * 2, aHH * 2, aHD * 2), brown);
    armMeshL.position.set(-armX, bodyY + aHH * 0.3, armZ);
    armMeshL.castShadow = true;
    pivot.add(armMeshL);
    const armMeshR = new THREE.Mesh(new THREE.BoxGeometry(aHW * 2, aHH * 2, aHD * 2), brown);
    armMeshR.position.set(armX, bodyY + aHH * 0.3, armZ);
    armMeshR.castShadow = true;
    pivot.add(armMeshR);

    // legs
    const legMeshL = new THREE.Mesh(new THREE.BoxGeometry(lHW * 2, lHH * 2, lHD * 2), dark);
    legMeshL.position.set(-legX, bodyY + legY, legZ);
    legMeshL.castShadow = true;
    pivot.add(legMeshL);
    const legMeshR = new THREE.Mesh(new THREE.BoxGeometry(lHW * 2, lHH * 2, lHD * 2), dark);
    legMeshR.position.set(legX, bodyY + legY, legZ);
    legMeshR.castShadow = true;
    pivot.add(legMeshR);
  }

  private static buildTagOnBody(
    physicsWorld: PhysicsWorld,
    body: RAPIER.RigidBody,
    pivot: THREE.Group,
    tagZ: number,
  ): void {
    const tagX = 0;
    const tagY = 0.03 * S;

    // hexagonal ring of 6 cuboids — horizontal (XZ plane)
    const hexR = 0.05 * S;
    const halfThick = 0.025;
    const halfLen = hexR * 0.45;
    for (let i = 0; i < 6; i++) {
      const phi = i * Math.PI / 3;
      const phiNext = (i + 1) * Math.PI / 3;
      const vx = hexR * Math.cos(phi);
      const vz = hexR * Math.sin(phi);
      const vxNext = hexR * Math.cos(phiNext);
      const vzNext = hexR * Math.sin(phiNext);
      const cx = (vx + vxNext) / 2;
      const cz = (vz + vzNext) / 2;
      const angle = Math.atan2(vzNext - vz, vxNext - vx);
      physicsWorld.world.createCollider(
        RAPIER.ColliderDesc.cuboid(halfLen, halfThick, halfThick)
          .setTranslation(cx + tagX, tagY, cz + tagZ)
          .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
          .setFriction(1.0)
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
    tagMesh.position.set(tagX, tagY, tagZ);
    tagMesh.rotation.x = Math.PI / 2; // lay flat (XZ plane)
    tagMesh.castShadow = true;
    pivot.add(tagMesh);
  }

  static updateMass(physicsWorld: PhysicsWorld, mass: number): void {
    const body = physicsWorld.getBody("prize_bear");
    if (body) body.setAdditionalMass(Math.max(0, mass), true);
  }
}
