import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PhysicsWorld } from "./physics/PhysicsWorld";
import { SceneManager } from "./rendering/SceneManager";
import { SyncSystem } from "./rendering/SyncSystem";
import { SimulationParams } from "./params/simulationParams";
import { PrizeFactory } from "./prize/PrizeFactory";
import { getRandomBlueprint } from "./prize/PrizeLoader";

const W = 0.85 * 1.5;
const D = 0.85 * 1.5;
const WALL_H = 1.2 * 1.5;
const WALL_T = 0.1;

const FLOOR_Y = -0.1;
const FLOOR_COLOR = 0x446688;

export class StageManager {
  private shieldBody: RAPIER.RigidBody;
  private shieldMesh: THREE.Mesh;
  private shieldEdge: THREE.Mesh;

  constructor(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    params: SimulationParams,
  ) {
    this.buildFloor(physicsWorld, sceneManager, syncSystem);
    this.buildWalls(physicsWorld, sceneManager, syncSystem);
    this.buildFrame(physicsWorld, sceneManager, syncSystem);
    const { shieldBody, shieldMesh, shieldEdge } = this.buildShield(physicsWorld, sceneManager, syncSystem, params.shieldHeight);
    this.shieldBody = shieldBody;
    this.shieldMesh = shieldMesh;
    this.shieldEdge = shieldEdge;
    this.buildPrize(physicsWorld, sceneManager, syncSystem, params.prizeMass);
  }

  private addDecoratedBox(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    name: string,
    sx: number,
    sy: number,
    sz: number,
    px: number,
    py: number,
    pz: number,
    color: number,
    roughness = 0.7,
    metalness = 0.1,
  ): void {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz);
    const body = physicsWorld.addBody(name, bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2);
    physicsWorld.world.createCollider(colliderDesc, body);

    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    sceneManager.addMesh(name, mesh);
    syncSystem.addPair(body, mesh);
  }

  private buildFloor(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
  ): void {
    // play area floor (stops just behind the shield so the drop pit is open below)
    const floorEndZ = D + WALL_T / 2 + 0.02;
    this.addDecoratedBox(
      physicsWorld, sceneManager, syncSystem,
      "floor", 4, 0.2, floorEndZ + 2, 0, FLOOR_Y, (-2 + floorEndZ) / 2,
      FLOOR_COLOR, 0.8, 0.05,
    );

    // floor accent grid lines (thin border frame)
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x335577, roughness: 0.9 });
    const frameGeo = new THREE.BoxGeometry(3.8, 0.01, 0.02);
    for (const z of [-D, 0, D]) {
      const m = new THREE.Mesh(frameGeo, accentMat);
      m.position.set(0, 0.01, z);
      sceneManager.scene.add(m);
    }
    const frameGeo2 = new THREE.BoxGeometry(0.02, 0.01, 3.8);
    for (const x of [-W, 0, W]) {
      const m = new THREE.Mesh(frameGeo2, accentMat);
      m.position.set(x, 0.01, 0);
      sceneManager.scene.add(m);
    }

    this.buildDropOff(physicsWorld, sceneManager, syncSystem);
  }

  private buildDropOff(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
  ): void {
    // pit floor (lower than main floor, behind the shield)
    const pitW = W * 2;
    const pitD = 0.8;
    const pitZ = D + WALL_T / 2 + pitD / 2 + 0.05;
    const pitY = -0.35 * 5;
    const wallH = -pitY;

    this.addDecoratedBox(
      physicsWorld, sceneManager, syncSystem,
      "pit_floor", pitW, 0.2, pitD, 0, pitY, pitZ,
      0x334455, 0.9, 0.05,
    );

    // pit walls (full tube — 4 sides, top at y=0)
    const halfH = pitY + wallH / 2;
    this.addDecoratedBox(
      physicsWorld, sceneManager, syncSystem,
      "pit_left", WALL_T, wallH, pitD, -W, halfH, pitZ,
      0x446688, 0.7, 0.1,
    );
    this.addDecoratedBox(
      physicsWorld, sceneManager, syncSystem,
      "pit_right", WALL_T, wallH, pitD, W, halfH, pitZ,
      0x446688, 0.7, 0.1,
    );
    this.addDecoratedBox(
      physicsWorld, sceneManager, syncSystem,
      "pit_back", pitW, wallH, WALL_T, 0, halfH, pitZ + pitD / 2,
      0x446688, 0.7, 0.1,
    );
    this.addDecoratedBox(
      physicsWorld, sceneManager, syncSystem,
      "pit_front", pitW, wallH, WALL_T, 0, halfH, pitZ - pitD / 2,
      0x446688, 0.7, 0.1,
    );

    // warning stripes on the shield edge facing the pit
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(pitW, 0.03, 0.02),
      stripeMat,
    );
    stripe.position.set(0, 0.01, D + WALL_T / 2 + 0.01);
    sceneManager.scene.add(stripe);
  }

  private buildWalls(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
  ): void {
    const wallDefs = [
      { name: "wall_back", sx: W * 2, sy: WALL_H, sz: WALL_T, px: 0, py: WALL_H / 2, pz: -D, back: true },
      { name: "wall_left", sx: WALL_T, sy: WALL_H, sz: D * 2, px: -W, py: WALL_H / 2, pz: 0, back: false },
      { name: "wall_right", sx: WALL_T, sy: WALL_H, sz: D * 2, px: W, py: WALL_H / 2, pz: 0, back: false },
    ];
    for (const w of wallDefs) {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(w.px, w.py, w.pz);
      const body = physicsWorld.addBody(w.name, bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.cuboid(w.sx / 2, w.sy / 2, w.sz / 2);
      physicsWorld.world.createCollider(colliderDesc, body);

      const mat = new THREE.MeshStandardMaterial({
        color: w.back ? 0x5599bb : 0x6688aa,
        roughness: 0.7, metalness: 0.1,
        transparent: true, opacity: w.back ? 0.35 : 0.08, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.sx, w.sy, w.sz), mat);
      mesh.position.set(w.px, w.py, w.pz);
      sceneManager.addMesh(w.name, mesh);
      syncSystem.addPair(body, mesh);

      // visible edge outline
      const edgeMat = new THREE.LineBasicMaterial({
        color: w.back ? 0xaaccee : 0x88bbdd,
        transparent: true, opacity: w.back ? 0.7 : 0.5,
      });
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w.sx, w.sy, w.sz));
      const line = new THREE.LineSegments(edges, edgeMat);
      line.position.copy(mesh.position);
      sceneManager.scene.add(line);
    }
  }

  private buildFrame(
    _physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    _syncSystem: SyncSystem,
  ): void {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.6, metalness: 0.3 });

    // bottom frame around the play area
    const fw = W * 2 + WALL_T;
    const fd = D * 2 + WALL_T;
    const fh = 0.03;

    const f = [
      { sx: fw, sy: fh, sz: 0.02, px: 0, py: 0.01, pz: -D - WALL_T / 2 },
      { sx: 0.02, sy: fh, sz: fd, px: -W - WALL_T / 2, py: 0.01, pz: 0 },
      { sx: 0.02, sy: fh, sz: fd, px: W + WALL_T / 2, py: 0.01, pz: 0 },
    ];
    for (const seg of f) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(seg.sx, seg.sy, seg.sz), frameMat);
      mesh.position.set(seg.px, seg.py, seg.pz);
      sceneManager.scene.add(mesh);
    }
  }

  private buildShield(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    height: number,
  ): { shieldBody: RAPIER.RigidBody; shieldMesh: THREE.Mesh; shieldEdge: THREE.Mesh } {
    const sx = W * 2;
    const sy = Math.max(height, 0.01);
    const sz = WALL_T * 0.5;
    const px = 0;
    const py = sy / 2;
    const pz = D;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz);
    const body = physicsWorld.addBody("shield", bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2);
    physicsWorld.world.createCollider(colliderDesc, body);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xff8844,
      roughness: 0.6,
      metalness: 0.3,
      transparent: true,
      opacity: 0.55,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(px, py, pz);
    sceneManager.addMesh("shield", mesh);
    syncSystem.addPair(body, mesh);

    // edge glow strip on top of shield
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffaa66,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.7,
    });
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(sx, 0.01, sz + 0.01),
      edgeMat,
    );
    edge.position.set(px, py + sy / 2, pz);
    sceneManager.scene.add(edge);

    return { shieldBody: body, shieldMesh: mesh, shieldEdge: edge };
  }

  updateShieldHeight(height: number): void {
    const sy = Math.max(height, 0.01);
    const px = 0;
    const py = sy / 2;
    const pz = D;

    this.shieldBody.setTranslation({ x: px, y: py, z: pz }, true);
    this.shieldMesh.position.set(px, py, pz);
    this.shieldEdge.position.set(px, py + sy / 2, pz);

    const geo = new THREE.BoxGeometry(W * 2, sy, WALL_T);
    this.shieldMesh.geometry.dispose();
    this.shieldMesh.geometry = geo;
  }

  private buildPrize(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    mass: number,
  ): void {
    const blueprint = getRandomBlueprint();
    if (blueprint) {
      PrizeFactory.createFromBlueprint(physicsWorld, sceneManager, syncSystem, mass, blueprint);
    } else {
      PrizeFactory.create(physicsWorld, sceneManager, syncSystem, mass);
    }
  }
}
