import { SimulationParams } from "../params/simulationParams";

type ParamKey = keyof SimulationParams;

interface SliderDef {
  key: ParamKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderDef[] = [
  { key: "shieldHeight", label: "シールド高さ", min: 0, max: 1.0, step: 0.01 },
  { key: "closingTorque", label: "つかみ強度", min: 10, max: 1000, step: 10 },
  { key: "holdTorque", label: "ホールド力", min: 1, max: 500, step: 5 },
  { key: "maxOpeningAngle", label: "最大開き角", min: 0, max: 1.5, step: 0.05 },
  { key: "maxCloseAngle", label: "閉じ切り角度", min: 0, max: 0.5, step: 0.01 },
  { key: "clawPitch", label: "手首の角度", min: 0, max: 0.8, step: 0.02 },
  { key: "forearmAngle", label: "ひじの角度", min: 0, max: 2.0, step: 0.02 },
  { key: "upperArmLength", label: "上腕長さ", min: 0.1, max: 0.5, step: 0.01 },
  { key: "forearmLength", label: "前腕長さ", min: 0.1, max: 0.5, step: 0.01 },
  { key: "clawLength", label: "手(爪)長さ", min: 0.03, max: 0.15, step: 0.01 },
  { key: "prizeMass", label: "景品 質量", min: 0.01, max: 5.0, step: 0.01 },
  { key: "collisionLimitForce", label: "衝突制限 強さ", min: 0, max: 1.0, step: 0.05 },
  { key: "clawFriction", label: "アーム摩擦", min: 0, max: 2, step: 0.05 },
  { key: "armRotation", label: "アーム回転角(度)", min: 0, max: 90, step: 1 },
];

const TOGGLES: { key: ParamKey; label: string }[] = [
  { key: "collisionLimitEnabled", label: "衝突制限" },
];

export class ControlPanel {
  private container: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;
  private sliders: Map<ParamKey, HTMLInputElement> = new Map();
  private labels: Map<ParamKey, HTMLSpanElement> = new Map();
  private _visible = true;

  constructor(
    private params: SimulationParams,
    onChange: (params: SimulationParams) => void,
  ) {
    this.container = document.createElement("div");
    this.container.id = "control-panel";
    this.injectStyles();

    const header = document.createElement("div");
    header.className = "cp-header";

    this.toggleBtn = document.createElement("button");
    this.toggleBtn.className = "cp-toggle-btn";
    this.toggleBtn.textContent = "⚙";
    this.toggleBtn.title = "パラメータ設定を開閉 (P)";
    this.toggleBtn.addEventListener("click", () => this.toggle());
    header.appendChild(this.toggleBtn);

    const title = document.createElement("h2");
    title.textContent = "パラメータ設定";
    header.appendChild(title);
    this.container.appendChild(header);

    this.bodyEl = document.createElement("div");
    this.bodyEl.className = "cp-body";

    const saveAndNotify = (p: SimulationParams) => {
      onChange(p);
      localStorage.setItem("craneParams", JSON.stringify(p));
    };

    for (const def of SLIDERS) {
      const row = document.createElement("div");
      row.className = "slider-row";

      const label = document.createElement("label");
      label.textContent = def.label;
      row.appendChild(label);

      const valueSpan = document.createElement("span");
      valueSpan.className = "slider-value";
      valueSpan.textContent = String(this.params[def.key]);
      row.appendChild(valueSpan);
      this.labels.set(def.key, valueSpan);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      const isDeg = def.key === "armRotation";
      const rawVal = this.params[def.key] as number;
      const displayVal = isDeg ? rawVal * 180 / Math.PI : rawVal;
      input.value = String(displayVal);
      valueSpan.textContent = String(displayVal);
      input.addEventListener("input", () => {
        const newVal = parseFloat(input.value);
        const storeVal = isDeg ? newVal * Math.PI / 180 : newVal;
        (this.params as unknown as Record<string, number>)[def.key] = storeVal;
        valueSpan.textContent = String(newVal);
        saveAndNotify({ ...this.params });
      });
      row.appendChild(input);
      this.sliders.set(def.key, input);

      this.bodyEl.appendChild(row);
    }

    for (const tog of TOGGLES) {
      const row = document.createElement("div");
      row.className = "toggle-row";

      const label = document.createElement("label");
      label.textContent = tog.label;
      row.appendChild(label);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(this.params[tog.key]);
      checkbox.addEventListener("change", () => {
        (this.params as unknown as Record<string, boolean>)[tog.key] = checkbox.checked;
        saveAndNotify({ ...this.params });
      });
      row.appendChild(checkbox);
      this.bodyEl.appendChild(row);
    }

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "リセット";
    resetBtn.className = "reset-btn";
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem("craneParams");
      location.reload();
    });
    this.bodyEl.appendChild(resetBtn);

    this.container.appendChild(this.bodyEl);
    document.body.appendChild(this.container);

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "p") this.toggle();
    });
  }

  private toggle(): void {
    this._visible = !this._visible;
    this.bodyEl.classList.toggle("hidden", !this._visible);
    this.toggleBtn.classList.toggle("collapsed", !this._visible);
    this.container.classList.toggle("collapsed", !this._visible);
  }

  private injectStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #control-panel {
        position: fixed;
        top: 12px;
        left: 12px;
        width: 240px;
        background: rgba(20, 24, 36, 0.88);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        color: #ccd;
        font-family: 'Segoe UI', sans-serif;
        font-size: 13px;
        z-index: 100;
        backdrop-filter: blur(6px);
        user-select: none;
        overflow: hidden;
        transition: width 0.2s, height 0.2s;
      }
      #control-panel.collapsed {
        width: auto;
        background: transparent;
        border: none;
        backdrop-filter: none;
      }
      .cp-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
      }
      .cp-toggle-btn {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        color: #ccd;
        font-size: 16px;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .cp-toggle-btn:hover {
        background: rgba(255,255,255,0.2);
      }
      .cp-toggle-btn.collapsed {
        background: rgba(20, 24, 36, 0.75);
        border-color: rgba(255,255,255,0.15);
        width: 40px;
        height: 40px;
        font-size: 20px;
      }
      .cp-header h2 {
        margin: 0;
        font-size: 14px;
        color: #eef;
        font-weight: 600;
        white-space: nowrap;
      }
      .cp-body {
        padding: 0 12px 12px;
      }
      .cp-body.hidden {
        display: none;
      }
      .slider-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }
      .slider-row label {
        flex: 1;
        font-size: 12px;
        color: #99a;
      }
      .slider-value {
        width: 32px;
        text-align: right;
        font-size: 11px;
        color: #aab;
        font-variant-numeric: tabular-nums;
      }
      .slider-row input[type="range"] {
        flex: 1;
        min-width: 60px;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: #334;
        border-radius: 2px;
        outline: none;
      }
      .slider-row input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #68c;
        cursor: pointer;
        border: none;
      }
      .toggle-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }
      .toggle-row label {
        flex: 1;
        font-size: 12px;
        color: #99a;
      }
      .toggle-row input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #68c;
        cursor: pointer;
      }
      .reset-btn {
        width: 100%;
        margin-top: 6px;
        padding: 6px 0;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        background: rgba(255,60,60,0.15);
        color: #e88;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .reset-btn:hover {
        background: rgba(255,60,60,0.3);
      }
    `;
    document.head.appendChild(style);
  }
}
