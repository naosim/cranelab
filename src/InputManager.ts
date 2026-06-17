export interface InputState {
  moveX: number;
  moveZ: number;
  moveY: number;
  clawClose: boolean;
  actionTrigger: boolean;
  colliderDebugTrigger: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private _clawPressed = false;
  private _actionTrigger = false;
  private _colliderDebugTrigger = false;
  private _mobileDir = { up: false, down: false, left: false, right: false };

  constructor() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e", "v"].includes(key)) {
        this.keys.add(key);
        if (key === "v") this._colliderDebugTrigger = true;
      }
      if (e.code === "Space") {
        this._clawPressed = true;
        e.preventDefault();
      }
      if (e.code === "Enter") {
        this._actionTrigger = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e"].includes(key)) {
        this.keys.delete(key);
      }
      if (e.code === "Space") {
        this._clawPressed = false;
      }
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this._clawPressed = false;
    });
  }

  setMobileDir(dir: "up" | "down" | "left" | "right", active: boolean): void {
    this._mobileDir[dir] = active;
  }

  triggerAction(): void {
    this._actionTrigger = true;
  }

  getState(): InputState {
    const state: InputState = {
      moveX: (this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("arrowleft") ? 1 : 0)
            + (this._mobileDir.right ? 1 : 0) - (this._mobileDir.left ? 1 : 0),
      moveZ: (this.keys.has("arrowdown") ? 1 : 0) - (this.keys.has("arrowup") ? 1 : 0)
            + (this._mobileDir.down ? 1 : 0) - (this._mobileDir.up ? 1 : 0),
      moveY: (this.keys.has("e") ? 1 : 0) - (this.keys.has("q") ? 1 : 0),
      clawClose: this._clawPressed,
      actionTrigger: this._actionTrigger,
      colliderDebugTrigger: this._colliderDebugTrigger,
    };
    this._actionTrigger = false;
    this._colliderDebugTrigger = false;
    return state;
  }
}
