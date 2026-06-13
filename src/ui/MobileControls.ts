import { InputManager } from "../InputManager";

export class MobileControls {
  private container: HTMLDivElement;

  constructor(private inputManager: InputManager) {
    this.container = document.createElement("div");
    this.container.id = "mobile-controls";
    this.injectStyles();
    this.buildDPad();
    this.buildActionBtn();
    document.body.appendChild(this.container);
  }

  private buildDPad(): void {
    const pad = document.createElement("div");
    pad.id = "dpad";

    const buttons = [
      { id: "btn-up", label: "▲", dir: "up" as const, x: 1, y: 0 },
      { id: "btn-down", label: "▼", dir: "down" as const, x: 1, y: 2 },
      { id: "btn-left", label: "◀", dir: "left" as const, x: 0, y: 1 },
      { id: "btn-right", label: "▶", dir: "right" as const, x: 2, y: 1 },
    ];

    for (const b of buttons) {
      const el = document.createElement("button");
      el.id = b.id;
      el.className = "ctrl-btn dir-btn";
      el.textContent = b.label;
      el.style.gridRow = String(b.y + 1);
      el.style.gridColumn = String(b.x + 1);

      const start = () => this.inputManager.setMobileDir(b.dir, true);
      const end = () => this.inputManager.setMobileDir(b.dir, false);
      el.addEventListener("touchstart", (e) => { e.preventDefault(); start(); });
      el.addEventListener("touchend", (e) => { e.preventDefault(); end(); });
      el.addEventListener("touchcancel", end);
      el.addEventListener("mousedown", start);
      el.addEventListener("mouseup", end);
      el.addEventListener("mouseleave", end);

      pad.appendChild(el);
    }

    this.container.appendChild(pad);
  }

  private buildActionBtn(): void {
    const btn = document.createElement("button");
    btn.id = "btn-action";
    btn.className = "ctrl-btn action-btn";
    btn.textContent = "アクション";

    const fire = () => this.inputManager.triggerAction();
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); fire(); });
    btn.addEventListener("mousedown", fire);

    this.container.appendChild(btn);
  }

  private injectStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #mobile-controls {
        position: fixed;
        bottom: 20px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 24px;
        pointer-events: none;
        z-index: 200;
        user-select: none;
        -webkit-user-select: none;
      }
      #mobile-controls > * { pointer-events: auto; }
      #dpad {
        display: grid;
        grid-template: repeat(3, 56px) / repeat(3, 56px);
        gap: 4px;
      }
      .ctrl-btn {
        border: none;
        border-radius: 12px;
        background: rgba(255,255,255,0.15);
        color: #ccd;
        font-size: 22px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .ctrl-btn:active, .ctrl-btn.active {
        background: rgba(100,140,220,0.35);
      }
      .dir-btn {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .action-btn {
        width: 90px;
        height: 90px;
        border-radius: 50%;
        font-size: 14px;
        font-weight: 700;
        background: rgba(255,80,80,0.25);
        border-color: rgba(255,80,80,0.3);
        color: #faa;
      }
      .action-btn:active {
        background: rgba(255,80,80,0.45);
      }
    `;
    document.head.appendChild(style);
  }
}
