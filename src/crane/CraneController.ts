import RAPIER, { MotorModel } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { SceneManager } from "../rendering/SceneManager";
import { SyncSystem } from "../rendering/SyncSystem";
import { InputState } from "../InputManager";
import { SimulationParams } from "../params/simulationParams";
import { AudioManager } from "../audio/AudioManager";

const HEAD_HE = { x: 0.08, y: 0.04, z: 0.08 };
const ARM_HALF_W = 0.02;
const CLAW_HALF_W = 0.02;
const MOVE_SPEED = 0.5;

const INITIAL_ARM_Y = 1.4;

const CLAMP_MIN = { x: -0.85 * 1.5, y: 0.08, z: -0.85 * 1.5 };
const CLAMP_MAX = { x: 0.85 * 1.5, y: 1.4, z: 2.0 };

const DROP_POS = { x: 0, z: 1.6 };

const GROUP_ARM = 1;
const GROUP_PRIZE = 1 << 1;
const ARM_COLLISION_GROUPS = (GROUP_PRIZE << 16) | GROUP_ARM;

// ドロップゾーン検知システム
export class DropZoneDetector {
  private prizeBody: RAPIER.RigidBody | null = null;
  private wasInZonePreviousFrame = false;
  
  constructor(
    prizeBody: RAPIER.RigidBody | null,
  ) {
    this.prizeBody = prizeBody;
  }
  
  public update(prizeBody: RAPIER.RigidBody | null): boolean {
    this.prizeBody = prizeBody;
    
    if (!this.prizeBody) return false;
    
    const prizePos = this.prizeBody.translation();
    const prizeFeetY = prizePos.y - 0.05;
    
    const dx = DROP_ZONE_CENTER.z - prizePos.z;
    const dy = DROP_ZONE_CENTER.y - prizeFeetY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const isCurrentlyInZone = distance <= DROP_ZONE_RADIUS;
    
    const justEntered = isCurrentlyInZone && !this.wasInZonePreviousFrame;
    
    this.wasInZonePreviousFrame = isCurrentlyInZone;
    
    return justEntered;
  }
}

const DROP_ZONE_RADIUS = 0.1;
const DROP_ZONE_CENTER = { x: 0, y: -0.01, z: 1.6 };  // ドロップゾーンの座標

const enum AutoState {
  IDLE,
  DESCENDING,
  CLOSING,
  ASCENDING,
  MOVING_OUT,
  OPENING,
}

interface ArmData {
  body: RAPIER.RigidBody;
  joint: RAPIER.RevoluteImpulseJoint;
  theta: number;
  upperCollider: RAPIER.Collider;
  forearmCollider: RAPIER.Collider;
  clawCollider: RAPIER.Collider;
  pivot: THREE.Group;
  upperMesh: THREE.Mesh;
  forearmPivot: THREE.Group;
  forearmMesh: THREE.Mesh;
  clawPivot: THREE.Group;
  clawMesh: THREE.Mesh;
}

export class CraneController {
  private headBody!: RAPIER.RigidBody;
  private arms: ArmData[] = [];

  private targetPos = { x: 0, y: INITIAL_ARM_Y, z: DROP_POS.z };
  private currentOpenRatio = 1;

  private maxCloseAngle: number;
  private prevAutoState = AutoState.IDLE;
  private audio = new AudioManager();

  private closingTorque: number;
  private holdTorque: number;
  private maxOpeningAngle: number;
  private clawPitch: number;
  private forearmAngle: number;
  private upperArmLength: number;
  private forearmLength: number;
  private clawLength: number;
  private collisionLimitEnabled: boolean;
  private collisionLimitForce: number;
  private armRotation: number;
  private clawFriction: number;
  private physicsWorld!: PhysicsWorld;
  private sceneManager!: SceneManager;
  private syncSystem!: SyncSystem;
  private armRebuildPending = false;
  private autoState = AutoState.IDLE;
  private autoTimer = 0;
  private contactStartY = 0;
  private fanfarePlayed = false;
  private openingPrizeY = 0;
  private debugLogTimer = 0;
  
  private dropZoneDetectors: DropZoneDetector[] = [];
  
  constructor(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
    params: SimulationParams,
  ) {
    this.physicsWorld = physicsWorld;
    this.sceneManager = sceneManager;
    this.syncSystem = syncSystem;
    this.closingTorque = params.closingTorque;
    this.holdTorque = params.holdTorque;
    this.maxOpeningAngle = params.maxOpeningAngle;
    this.clawPitch = params.clawPitch;
    this.forearmAngle = params.forearmAngle;
    this.upperArmLength = params.upperArmLength;
    this.forearmLength = params.forearmLength;
    this.clawLength = params.clawLength;
    this.collisionLimitEnabled = params.collisionLimitEnabled;
    this.collisionLimitForce = params.collisionLimitForce;
    this.armRotation = params.armRotation;
    this.clawFriction = params.clawFriction ?? 1;
    this.maxCloseAngle = params.maxCloseAngle ?? 0;

    this.createHead(physicsWorld, sceneManager, syncSystem);
    this.createArms(physicsWorld, sceneManager, syncSystem);
    
    this.createDropZoneDetector(physicsWorld);
  }

  private createHead(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
  ): void {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(this.targetPos.x, this.targetPos.y, this.targetPos.z);
    const body = physicsWorld.addBody("crane_head", bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(HEAD_HE.x, HEAD_HE.y, HEAD_HE.z);
    physicsWorld.world.createCollider(colliderDesc, body);
    this.headBody = body;

    const pivot = new THREE.Group();
    pivot.position.set(this.targetPos.x, this.targetPos.y, this.targetPos.z);
    sceneManager.addMesh("crane_head", pivot);
    syncSystem.addPair(body, pivot);

    const metal = new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.3, metalness: 0.7 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x557788, roughness: 0.4, metalness: 0.6 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff8844, roughness: 0.5, metalness: 0.2 });

    const main = new THREE.Mesh(new THREE.BoxGeometry(HEAD_HE.x * 2, HEAD_HE.y * 2, HEAD_HE.z * 2), metal);
    main.castShadow = true;
    pivot.add(main);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.14), darkMetal);
    plate.position.set(0, HEAD_HE.y + 0.01, 0);
    plate.castShadow = true;
    pivot.add(plate);

    const column = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), darkMetal);
    column.position.set(0, HEAD_HE.y + 0.04, 0);
    column.castShadow = true;
    pivot.add(column);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(HEAD_HE.x + 0.01, 0.008, 8, 16), accent);
    ring.position.set(0, -HEAD_HE.y * 0.3, 0);
    pivot.add(ring);
  }

  private createDropZoneDetector(physicsWorld: PhysicsWorld): void {
    const prizeBody = physicsWorld.getBody("prize") || null;
    const detector = new DropZoneDetector(prizeBody);
    this.dropZoneDetectors.push(detector);
  }
  
  private createArms(
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
  ): void {
    const offset = this.armRotation;
    const angles = [offset, offset + (2 * Math.PI) / 3, offset + (4 * Math.PI) / 3];
    for (const theta of angles) {
      const arm = this.createOneArm(theta, physicsWorld, sceneManager, syncSystem);
      this.arms.push(arm);
    }
  }

  private createOneArm(
    theta: number,
    physicsWorld: PhysicsWorld,
    sceneManager: SceneManager,
    syncSystem: SyncSystem,
  ): ArmData {
    const ul = this.upperArmLength;
    const fl = this.forearmLength;
    const cl = this.clawLength;

    const anchorX = HEAD_HE.x * Math.sin(theta);
    const anchorZ = HEAD_HE.z * Math.cos(theta);
    const armX = this.targetPos.x + anchorX;
    const armY = this.targetPos.y - HEAD_HE.y;
    const armZ = this.targetPos.z + anchorZ;

    // arm rigid body (one body, all colliders on it)
    const jointAxis = { x: -Math.cos(theta), y: 0, z: Math.sin(theta) };
    const openQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(jointAxis.x, 0, jointAxis.z), this.maxOpeningAngle);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(armX, armY, armZ)
      .setLinearDamping(0.01)
      .setAngularDamping(0.05)
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setRotation({ x: openQ.x, y: openQ.y, z: openQ.z, w: openQ.w });
    const body = physicsWorld.addBody(`arm_body_${theta}`, bodyDesc);

    // upper arm collider (shorter than visual — bottom at -0.8*ul vs -2*ul, avoids false wall contact)
    const upperC = physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARM_HALF_W, ul * 0.4, ARM_HALF_W)
        .setTranslation(0, -ul * 0.4, 0)
        .setCollisionGroups(ARM_COLLISION_GROUPS),
      body,
    );

    // forearm collider (cuboid matching visual, repositioned/rotated in update)
    const forearmC = physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARM_HALF_W, fl, ARM_HALF_W)
        .setTranslation(0, -(ul * 2 + fl), 0)
        .setCollisionGroups(ARM_COLLISION_GROUPS),
      body,
    );

    // claw collider (cuboid matching visual, repositioned/rotated in update)
    const clawC = physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(CLAW_HALF_W, cl, CLAW_HALF_W)
        .setTranslation(0, -(ul * 2 + fl * 2 + cl), 0)
        .setFriction(this.clawFriction)
        .setCollisionGroups(ARM_COLLISION_GROUPS),
      body,
    );

    // revolute joint to head
    const headAnchor = { x: anchorX, y: -HEAD_HE.y, z: anchorZ };
    const armAnchor = { x: 0, y: 0, z: 0 };

    const jointData = RAPIER.JointData.revolute(headAnchor, armAnchor, jointAxis);
    const rawJoint = physicsWorld.world.createImpulseJoint(jointData, this.headBody, body, true);
    const joint = rawJoint as RAPIER.RevoluteImpulseJoint;
    joint.setContactsEnabled(false);
    joint.configureMotorModel(MotorModel.ForceBased);
    joint.setLimits(this.maxCloseAngle, this.maxOpeningAngle + 0.1);

    // visual hierarchy
    const pivot = new THREE.Group();
    pivot.position.set(armX, armY, armZ);
    sceneManager.addMesh(`arm_pivot_${theta}`, pivot);
    syncSystem.addPair(body, pivot);

    const armMat = new THREE.MeshStandardMaterial({ color: 0xaaccdd, roughness: 0.3, metalness: 0.5 });
    const forearmMat = new THREE.MeshStandardMaterial({ color: 0xbbddcc, roughness: 0.3, metalness: 0.5 });
    const clawMat = new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.3, metalness: 0.5 });

    // upper arm mesh
    const upperMesh = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_HALF_W * 2, ul * 2, ARM_HALF_W * 2),
      armMat,
    );
    upperMesh.position.set(0, -ul, 0);
    upperMesh.castShadow = true;
    pivot.add(upperMesh);

    // forearm pivot at bottom of upper arm + rotation
    const forearmPivot = new THREE.Group();
    forearmPivot.position.set(0, -(ul * 2), 0);
    pivot.add(forearmPivot);

    const forearmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_HALF_W * 2, fl * 2, ARM_HALF_W * 2),
      forearmMat,
    );
    forearmMesh.position.set(0, -fl, 0);
    forearmMesh.castShadow = true;
    forearmPivot.add(forearmMesh);

    // claw pivot at bottom of forearm + rotation
    const clawPivot = new THREE.Group();
    clawPivot.position.set(0, -(fl * 2), 0);
    forearmPivot.add(clawPivot);

    const clawMesh = new THREE.Mesh(
      new THREE.BoxGeometry(CLAW_HALF_W * 2, cl * 2, CLAW_HALF_W * 2),
      clawMat,
    );
    clawMesh.position.set(0, -cl, 0);
    clawMesh.castShadow = true;
    clawPivot.add(clawMesh);

    return {
      body, joint, theta,
      upperCollider: upperC, forearmCollider: forearmC, clawCollider: clawC,
      pivot, upperMesh, forearmPivot, forearmMesh, clawPivot, clawMesh,
    };
  }

  private rebuildArmColliders(arm: ArmData): void {
    const ul = this.upperArmLength;
    const fl = this.forearmLength;
    const cl = this.clawLength;

    this.physicsWorld.world.removeCollider(arm.upperCollider, true);
    this.physicsWorld.world.removeCollider(arm.forearmCollider, true);
    this.physicsWorld.world.removeCollider(arm.clawCollider, true);

    arm.upperCollider = this.physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARM_HALF_W, ul * 0.4, ARM_HALF_W).setTranslation(0, -ul * 0.4, 0).setCollisionGroups(ARM_COLLISION_GROUPS),
      arm.body,
    );
    arm.forearmCollider = this.physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARM_HALF_W, fl, ARM_HALF_W).setTranslation(0, -(ul * 2 + fl), 0).setCollisionGroups(ARM_COLLISION_GROUPS),
      arm.body,
    );
    arm.clawCollider = this.physicsWorld.world.createCollider(
      RAPIER.ColliderDesc.cuboid(CLAW_HALF_W, cl, CLAW_HALF_W)
        .setTranslation(0, -(ul * 2 + fl * 2 + cl), 0)
        .setFriction(this.clawFriction)
        .setCollisionGroups(ARM_COLLISION_GROUPS),
      arm.body,
    );

    // update visual meshes
    arm.upperMesh.geometry.dispose();
    arm.upperMesh.geometry = new THREE.BoxGeometry(ARM_HALF_W * 2, ul * 2, ARM_HALF_W * 2);
    arm.upperMesh.position.set(0, -ul, 0);

    arm.forearmPivot.position.set(0, -(ul * 2), 0);
    arm.forearmMesh.geometry.dispose();
    arm.forearmMesh.geometry = new THREE.BoxGeometry(ARM_HALF_W * 2, fl * 2, ARM_HALF_W * 2);
    arm.forearmMesh.position.set(0, -fl, 0);

    arm.clawPivot.position.set(0, -(fl * 2), 0);
    arm.clawMesh.geometry.dispose();
    arm.clawMesh.geometry = new THREE.BoxGeometry(CLAW_HALF_W * 2, cl * 2, CLAW_HALF_W * 2);
    arm.clawMesh.position.set(0, -cl, 0);
  }

  setParams(params: SimulationParams): void {
    this.closingTorque = params.closingTorque;
    this.holdTorque = params.holdTorque;
    this.maxOpeningAngle = params.maxOpeningAngle;
    this.maxCloseAngle = params.maxCloseAngle ?? 0;
    this.clawPitch = params.clawPitch;
    this.forearmAngle = params.forearmAngle;
    this.collisionLimitEnabled = params.collisionLimitEnabled;
    this.collisionLimitForce = params.collisionLimitForce;

    if (this.clawFriction !== (params.clawFriction ?? 1)) {
      this.clawFriction = params.clawFriction ?? 1;
      for (const arm of this.arms) {
        arm.clawCollider.setFriction(this.clawFriction);
      }
    }

    if (this.maxCloseAngle !== (params.maxCloseAngle ?? 0)) {
      this.maxCloseAngle = params.maxCloseAngle ?? 0;
      for (const arm of this.arms) {
        arm.joint.setLimits(this.maxCloseAngle, this.maxOpeningAngle + 0.1);
      }
    }

    const lengthChanged =
      this.upperArmLength !== params.upperArmLength ||
      this.forearmLength !== params.forearmLength ||
      this.clawLength !== params.clawLength;
    if (lengthChanged) {
      this.upperArmLength = params.upperArmLength;
      this.forearmLength = params.forearmLength;
      this.clawLength = params.clawLength;
      for (const arm of this.arms) {
        this.rebuildArmColliders(arm);
      }
    }

    if (this.armRotation !== params.armRotation) {
      this.armRotation = params.armRotation;
      this.armRebuildPending = true;
    }
  }

  private destroyArms(): void {
    for (const arm of this.arms) {
      this.syncSystem.removePair(arm.body);
      this.physicsWorld.world.removeRigidBody(arm.body);
      arm.upperMesh.geometry.dispose();
      arm.forearmMesh.geometry.dispose();
      arm.clawMesh.geometry.dispose();
      const pivotName = `arm_pivot_${arm.theta}`;
      const pivot = this.sceneManager.getMesh(pivotName);
      if (pivot) {
        this.sceneManager.scene.remove(pivot);
      }
    }
    this.arms = [];
  }

  private isArmContact(arm: ArmData): boolean {
    const exempt = new Set(["prize", "crane_head", "wall_back", "wall_left", "wall_right"]);
    let found = false;
    const check = (other: RAPIER.Collider) => {
      if (found) return;
      const parent = other.parent();
      if (!parent) return;
      const name = this.physicsWorld.getBodyName(parent);
      if (!name || !exempt.has(name)) found = true;
    };
    this.physicsWorld.world.contactPairsWith(arm.upperCollider, check);
    if (!found) this.physicsWorld.world.contactPairsWith(arm.forearmCollider, check);
    if (!found) this.physicsWorld.world.contactPairsWith(arm.clawCollider, check);
    return found;
  }

  resetToIdle(): void {
    this.autoState = AutoState.IDLE;
    this.autoTimer = 0;
    this.contactStartY = 0;
    this.fanfarePlayed = false;
    this.openingPrizeY = 0;
    this.debugLogTimer = 0;
    this.currentOpenRatio = 1;
    this.targetPos.x = 0;
    this.targetPos.y = INITIAL_ARM_Y;
    this.targetPos.z = DROP_POS.z;
    this.headBody.setNextKinematicTranslation(this.targetPos);
    const range = this.maxOpeningAngle - this.maxCloseAngle;
    const targetAngle = this.maxCloseAngle + range;
    for (const arm of this.arms) {
      arm.joint.configureMotor(targetAngle, 0, this.holdTorque, 5.0);
    }
  }

  update(dt: number, input: InputState): void {
    if (this.armRebuildPending) {
      this.armRebuildPending = false;
      this.destroyArms();
      this.createArms(this.physicsWorld, this.sceneManager, this.syncSystem);
    }

    if (input.actionTrigger) this.handleActionTrigger();

    if (this.autoState !== AutoState.IDLE) {
      this.updateAutoSequence(dt);
    } else {
      let contactYScale = 1;
      if (this.collisionLimitEnabled && input.moveY > 0) {
        for (const arm of this.arms) {
          if (this.isArmContact(arm)) {
            contactYScale = Math.min(contactYScale, this.collisionLimitForce);
          }
        }
      }

      this.targetPos.x += input.moveX * MOVE_SPEED * dt;
      this.targetPos.z += input.moveZ * MOVE_SPEED * dt;
      this.targetPos.y += input.moveY * MOVE_SPEED * dt * contactYScale;

      this.targetPos.x = Math.max(CLAMP_MIN.x, Math.min(CLAMP_MAX.x, this.targetPos.x));
      this.targetPos.z = Math.max(CLAMP_MIN.z, Math.min(CLAMP_MAX.z, this.targetPos.z));
      this.targetPos.y = Math.max(CLAMP_MIN.y, Math.min(CLAMP_MAX.y, this.targetPos.y));

      this.headBody.setNextKinematicTranslation(this.targetPos);

      const isMoving = input.moveX !== 0 || input.moveZ !== 0 || input.moveY !== 0;
      if (isMoving || input.clawClose) {
        for (const arm of this.arms) {
          arm.body.wakeUp();
        }
      }

      if (input.clawClose) {
        this.currentOpenRatio = Math.max(0, this.currentOpenRatio - dt * 3);
      } else {
        this.currentOpenRatio = Math.min(1, this.currentOpenRatio + dt * 2);
      }

      const range = this.maxOpeningAngle - this.maxCloseAngle;
      const targetAngle = this.maxCloseAngle + this.currentOpenRatio * range;
      const stiffness = input.clawClose ? this.closingTorque : this.holdTorque;

      for (const arm of this.arms) {
        arm.joint.configureMotor(targetAngle, 0, stiffness, 5.0);
      }
    }

    {
      const prizeBody = this.physicsWorld.getBody("prize");
      if (prizeBody) {
        const pos = prizeBody.translation();
        if (this.debugLogTimer > 0) {
          this.debugLogTimer -= dt;
          console.log("prize y", pos.y.toFixed(4), "openingY", this.openingPrizeY.toFixed(4), "drop", (this.openingPrizeY - pos.y).toFixed(4));
        }
        
        let prizeEnteredDropZone = false;
        for (const detector of this.dropZoneDetectors) {
          if (detector.update(prizeBody)) {
            prizeEnteredDropZone = true;
            console.log("FANFARE TRIGGER! prize entered drop zone", pos.toString());
            break;
          }
        }
        
        if (!this.fanfarePlayed && prizeEnteredDropZone && this.openingPrizeY > 0) {
          this.audio.fanfare();
          this.fanfarePlayed = true;
          this.debugLogTimer = 0;
        }
      }
    }

    const axis = (theta: number) => ({ x: Math.cos(theta), y: 0, z: -Math.sin(theta) });

    for (const arm of this.arms) {
      const a = axis(arm.theta);
      const sf = Math.sin(this.forearmAngle / 2);
      const cf = Math.cos(this.forearmAngle / 2);
      arm.forearmPivot.quaternion.set(a.x * sf, 0, a.z * sf, cf);

      const sc = Math.sin(this.clawPitch / 2);
      const cc = Math.cos(this.clawPitch / 2);
      arm.clawPivot.quaternion.set(a.x * sc, 0, a.z * sc, cc);

      // reposition/rotate colliders to match visual
      const faQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(a.x, 0, a.z), this.forearmAngle);
      const cpQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(a.x, 0, a.z), this.clawPitch);
      const ul = this.upperArmLength;
      const fl = this.forearmLength;
      const cl = this.clawLength;

      const fPos = new THREE.Vector3(0, -fl, 0).applyQuaternion(faQ);
      fPos.y += -(ul * 2);
      arm.forearmCollider.setTranslationWrtParent({ x: fPos.x, y: fPos.y, z: fPos.z });
      arm.forearmCollider.setRotationWrtParent({ x: a.x * sf, y: 0, z: a.z * sf, w: cf });

      const cPos = new THREE.Vector3(0, -cl, 0).applyQuaternion(cpQ);
      cPos.y += -(fl * 2);
      cPos.applyQuaternion(faQ);
      cPos.y += -(ul * 2);
      arm.clawCollider.setTranslationWrtParent({ x: cPos.x, y: cPos.y, z: cPos.z });
      const clawQ = faQ.clone().multiply(cpQ);
      arm.clawCollider.setRotationWrtParent({ x: clawQ.x, y: clawQ.y, z: clawQ.z, w: clawQ.w });
    }
  }

  private handleActionTrigger(): void {
    this.audio.buttonClick();
    if (this.autoState === AutoState.IDLE) {
      this.autoState = AutoState.DESCENDING;
      this.autoTimer = 0;
      this.contactStartY = 0;
      this.fanfarePlayed = false;
    } else if (this.autoState === AutoState.DESCENDING) {
      this.autoState = AutoState.CLOSING;
      this.autoTimer = 0;
    }
  }

  private updateAutoSequence(dt: number): void {
    const MOVE_SPEED_FAST = 0.6;

    switch (this.autoState) {
      case AutoState.DESCENDING: {
        let contactDetected = false;
        if (this.collisionLimitEnabled) {
          for (const arm of this.arms) {
            if (this.isArmContact(arm)) {
              contactDetected = true;
              break;
            }
          }
        }
        if (contactDetected) {
          if (this.contactStartY === 0) this.contactStartY = this.targetPos.y;
        } else {
          this.contactStartY = 0;
        }
        const contactYScale = contactDetected ? this.collisionLimitForce : 1;
        this.targetPos.y -= MOVE_SPEED * dt * contactYScale;
        const pushedEnough = contactDetected && this.contactStartY - this.targetPos.y >= 0.02;
        if (pushedEnough || this.targetPos.y <= CLAMP_MIN.y) {
          this.autoState = AutoState.CLOSING;
          this.autoTimer = 0;
          this.contactStartY = 0;
        }
        break;
      }

      case AutoState.CLOSING:
        this.autoTimer += dt;
        this.currentOpenRatio = Math.max(0, this.currentOpenRatio - dt * 4);
        if (this.autoTimer > 0.8) {
          this.autoState = AutoState.ASCENDING;
          this.autoTimer = 0;
        }
        break;

      case AutoState.ASCENDING:
        this.targetPos.y += MOVE_SPEED * dt;
        if (this.targetPos.y >= INITIAL_ARM_Y) {
          this.targetPos.y = INITIAL_ARM_Y;
          this.autoState = AutoState.MOVING_OUT;
          this.autoTimer = 0;
        }
        break;

      case AutoState.MOVING_OUT: {
        const dx = DROP_POS.x - this.targetPos.x;
        const dz = DROP_POS.z - this.targetPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.05) {
          this.targetPos.x += (dx / dist) * MOVE_SPEED_FAST * dt;
          this.targetPos.z += (dz / dist) * MOVE_SPEED_FAST * dt;
        } else {
          this.targetPos.x = DROP_POS.x;
          this.targetPos.z = DROP_POS.z;
          this.autoState = AutoState.OPENING;
          this.autoTimer = 0;
        }
        break;
      }

      case AutoState.OPENING:
        if (this.autoTimer === 0) {
          this.debugLogTimer = 3;
          const pb = this.physicsWorld.getBody("prize");
          this.openingPrizeY = pb ? pb.translation().y : 0;
        }
        this.autoTimer += dt;
        this.currentOpenRatio = Math.min(1, this.currentOpenRatio + dt * 3);
        if (this.autoTimer > 0.6) {
          this.autoState = AutoState.IDLE;
        }
        break;
    }

    this.targetPos.x = Math.max(CLAMP_MIN.x, Math.min(CLAMP_MAX.x, this.targetPos.x));
    this.targetPos.z = Math.max(CLAMP_MIN.z, Math.min(CLAMP_MAX.z, this.targetPos.z));
    this.targetPos.y = Math.max(CLAMP_MIN.y, Math.min(CLAMP_MAX.y, this.targetPos.y));
    this.headBody.setNextKinematicTranslation(this.targetPos);

    for (const arm of this.arms) {
      arm.body.wakeUp();
    }

    const range = this.maxOpeningAngle - this.maxCloseAngle;
    const targetAngle = this.maxCloseAngle + this.currentOpenRatio * range;
    const stiffness = this.holdTorque;
    for (const arm of this.arms) {
      arm.joint.configureMotor(targetAngle, 0, stiffness, 5.0);
    }

    if (this.autoState !== this.prevAutoState) {
      this.prevAutoState = this.autoState;
      switch (this.autoState) {
        case AutoState.CLOSING: this.audio.clawClose(); break;
        case AutoState.OPENING: this.audio.dropPrize(); break;
        case AutoState.IDLE: this.audio.clawOpen(); break;
      }
    }
  }
}
