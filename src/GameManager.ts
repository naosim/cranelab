import { PhysicsWorld } from "./physics/PhysicsWorld";
import { SceneManager } from "./rendering/SceneManager";
import { SyncSystem } from "./rendering/SyncSystem";
import { StageManager } from "./StageManager";
import { CraneController } from "./crane/CraneController";
import { InputManager } from "./InputManager";
import { ControlPanel } from "./ui/ControlPanel";
import { MobileControls } from "./ui/MobileControls";
import { SimulationParams, defaultParams } from "./params/simulationParams";
import { PrizeFactory } from "./prize/PrizeFactory";
import { ColliderDebug } from "./debug/ColliderDebug";
import { getRandomBlueprint } from "./prize/PrizeLoader";

export class GameManager {
  physicsWorld: PhysicsWorld;
  sceneManager: SceneManager;
  syncSystem: SyncSystem;
  stageManager: StageManager;
  craneController: CraneController;
  inputManager: InputManager;
  colliderDebug: ColliderDebug;
  params: SimulationParams;
  private pendingParams: SimulationParams | null = null;
  private savedState: { t: { x: number; y: number; z: number }; r: { x: number; y: number; z: number; w: number } } | null = null;
  private coordEl: HTMLDivElement;
  private cameraModeEl: HTMLDivElement | null = null;
  private cameraTargetMode: 'origin' | 'arm' | 'prize' = 'origin';

  constructor(container: HTMLElement) {
    const saved = localStorage.getItem("craneParams");
    if (saved) {
      try { this.params = { ...defaultParams, ...JSON.parse(saved) }; }
      catch { this.params = { ...defaultParams }; }
    } else {
      this.params = { ...defaultParams };
    }
    this.physicsWorld = new PhysicsWorld();
    this.sceneManager = new SceneManager(container);
    this.syncSystem = new SyncSystem();
    this.stageManager = new StageManager(this.physicsWorld, this.sceneManager, this.syncSystem, this.params);
    this.craneController = new CraneController(this.physicsWorld, this.sceneManager, this.syncSystem, this.params);
    this.inputManager = new InputManager();
    new MobileControls(this.inputManager);
    this.colliderDebug = new ColliderDebug(this.sceneManager.scene);
    new ControlPanel(this.params, (p) => this.onParamsChanged(p));
    this.coordEl = this.addCoordDisplay();
    this.addResetButton();
    this.addRevertButton();
    this.addCameraTargetButton();
  }

  private addCoordDisplay(): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText = `
      position: fixed; top: 92px; right: 16px; z-index: 90;
      padding: 4px 10px; border-radius: 4px;
      background: rgba(0,0,0,0.45); color: #8cf;
      font: 13px/1.4 monospace;
    `;
    el.textContent = "X 0.00  Y 0.00  Z 0.00";
    document.body.appendChild(el);
    return el;
  }

  private addResetButton(): void {
    const btn = document.createElement("button");
    btn.textContent = "景品リセット";
    btn.style.cssText = `
      position: fixed; top: 12px; right: 16px; z-index: 90;
      padding: 8px 14px; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; background: rgba(20,180,120,0.25);
      color: #8fc; font-size: 13px; font-family: 'Segoe UI', sans-serif;
      cursor: pointer; backdrop-filter: blur(4px); transition: background 0.15s;
    `;
    btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(20,180,120,0.4)"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "rgba(20,180,120,0.25)"; });
    btn.addEventListener("click", () => this.resetPrize());
    document.body.appendChild(btn);
  }

  private addRevertButton(): void {
    const btn = document.createElement("button");
    btn.textContent = "戻す";
    btn.style.cssText = `
      position: fixed; top: 52px; right: 16px; z-index: 90;
      padding: 8px 14px; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; background: rgba(200,160,60,0.25);
      color: #ec8; font-size: 13px; font-family: 'Segoe UI', sans-serif;
      cursor: pointer; backdrop-filter: blur(4px); transition: background 0.15s;
    `;
    btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(200,160,60,0.4)"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "rgba(200,160,60,0.25)"; });
    btn.addEventListener("click", () => this.revertPrize());
    document.body.appendChild(btn);
  }

  private addCameraTargetButton(): void {
    this.cameraModeEl = document.createElement("div");
    this.cameraModeEl.style.cssText = `
      position: fixed; top: 132px; right: 16px; z-index: 90;
      padding: 4px 10px; border-radius: 4px;
      background: rgba(0,0,0,0.45); color: #8cf;
      font: 12px/1.4 'Segoe UI', sans-serif;
      text-align: right; min-width: 60px;
    `;
    this.updateCameraModeLabel();
    document.body.appendChild(this.cameraModeEl);

    const btn = document.createElement("button");
    btn.textContent = "視点";
    btn.style.cssText = `
      position: fixed; top: 156px; right: 16px; z-index: 90;
      padding: 8px 14px; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; background: rgba(100,100,200,0.25);
      color: #aac; font-size: 13px; font-family: 'Segoe UI', sans-serif;
      cursor: pointer; backdrop-filter: blur(4px); transition: background 0.15s;
    `;
    btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(100,100,200,0.4)"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "rgba(100,100,200,0.25)"; });
    btn.addEventListener("click", () => this.cycleCameraTargetMode());
    document.body.appendChild(btn);
  }

  private cycleCameraTargetMode(): void {
    const modes: ('origin' | 'arm' | 'prize')[] = ['origin', 'arm', 'prize'];
    const currentIndex = modes.indexOf(this.cameraTargetMode);
    this.cameraTargetMode = modes[(currentIndex + 1) % modes.length];
    this.updateCameraModeLabel();
  }

  private updateCameraModeLabel(): void {
    if (!this.cameraModeEl) return;
    const labels = { origin: '原点', arm: 'アーム', prize: '景品' };
    this.cameraModeEl.textContent = `視点: ${labels[this.cameraTargetMode]}`;
  }

  private resetPrize(): void {
    this.savedState = null;
    const oldBody = this.physicsWorld.getBody("prize_bear");
    if (oldBody) {
      this.syncSystem.removePair(oldBody);
      this.physicsWorld.removeBody("prize_bear");
    }
    this.sceneManager.removeMesh("prize_bear");
    const blueprint = getRandomBlueprint();
    if (blueprint) {
      PrizeFactory.createFromBlueprint(this.physicsWorld, this.sceneManager, this.syncSystem, this.params.prizeMass, blueprint);
    } else {
      PrizeFactory.create(this.physicsWorld, this.sceneManager, this.syncSystem, this.params.prizeMass);
    }
  }

  private revertPrize(): void {
    if (!this.savedState) return;
    const body = this.physicsWorld.getBody("prize_bear");
    if (!body) return;
    body.setTranslation(this.savedState.t, true);
    body.setRotation(this.savedState.r, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.craneController.resetToIdle();
  }

  private onParamsChanged(p: SimulationParams): void {
    this.pendingParams = p;
  }

  update(dt: number): void {
    if (this.pendingParams) {
      const p = this.pendingParams;
      this.pendingParams = null;
      Object.assign(this.params, p);
      this.stageManager.updateShieldHeight(p.shieldHeight);
      this.craneController.setParams(p);
      PrizeFactory.updateMass(this.physicsWorld, p.prizeMass);
      if (typeof p.lightweight === 'boolean') {
        this.physicsWorld.setSolverIterations(p.lightweight ? 4 : 8);
        this.sceneManager.setLightweight(p.lightweight);
      }
    }
    const input = this.inputManager.getState();
    if (input.actionTrigger) {
      const body = this.physicsWorld.getBody("prize_bear");
      if (body) {
        const st = body.translation();
        const sr = body.rotation();
        this.savedState = {
          t: { x: st.x, y: st.y, z: st.z },
          r: { x: sr.x, y: sr.y, z: sr.z, w: sr.w },
        };
      }
    }
    if (input.colliderDebugTrigger) this.colliderDebug.toggle();
    this.craneController.update(dt, input);

    const head = this.physicsWorld.getBody("crane_head");
    if (head) {
      const t = head.translation();
      this.coordEl.textContent = `X ${t.x.toFixed(2)}  Y ${t.y.toFixed(2)}  Z ${t.z.toFixed(2)}`;
    }
    this.physicsWorld.step();
    this.syncSystem.sync();
    this.colliderDebug.update(this.physicsWorld.world);
    this.updateCameraTarget();
    this.sceneManager.render();
  }

  private updateCameraTarget(): void {
    let targetX = 0, targetY = 0.5, targetZ = 0;
    
    switch (this.cameraTargetMode) {
      case 'origin':
        targetX = 0; targetY = 0.5; targetZ = 0;
        break;
      case 'arm': {
        const head = this.physicsWorld.getBody("crane_head");
        if (head) {
          const t = head.translation();
          targetX = t.x; targetY = t.y; targetZ = t.z;
        }
        break;
      }
      case 'prize': {
        const prize = this.physicsWorld.getBody("prize_bear");
        if (prize) {
          const t = prize.translation();
          targetX = t.x; targetY = t.y; targetZ = t.z;
        }
        break;
      }
    }
    
    this.sceneManager.controls.target.set(targetX, targetY, targetZ);
  }
}
