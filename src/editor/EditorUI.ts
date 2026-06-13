import { PrizeBlueprint, PrizePart } from "./PrizeData";

export interface UIActions {
  onAddPart: () => void;
  onDuplicatePart: (id: string) => void;
  onDeletePart: (id: string) => void;
  onSelectPart: (id: string | null) => void;
  onUpdatePart: (id: string, updates: Partial<PrizePart>) => void;
  onUpdateBlueprint: (updates: Partial<PrizeBlueprint>) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

export class EditorUI {
  readonly el: HTMLDivElement;
  private listEl: HTMLDivElement;
  private propsEl: HTMLDivElement;
  private settingsEl: HTMLDivElement;
  private jsonEl: HTMLDivElement;
  private actions: UIActions;

  constructor(actions: UIActions) {
    this.actions = actions;
    this.el = document.createElement("div");
    this.el.style.cssText = `
      width:100%;height:100%;display:flex;flex-direction:column;
      background:#1a1a2e;color:#ccc;font:13px/1.5 'Segoe UI',sans-serif;
    `;
    this.el.innerHTML = `
      <div style="padding:10px 12px;border-bottom:1px solid #333;font-size:15px;font-weight:600;color:#8cf;">Prize Editor</div>
      <div id="ui-settings" style="border-bottom:1px solid #333;padding:8px 12px;"></div>
      <div id="ui-tabs" style="border-bottom:1px solid #333;display:flex;gap:2px;padding:4px 8px;background:#141420;">
        <button data-tab="parts" style="padding:4px 10px;background:#2a3a4a;border:none;border-radius:3px;color:#8cf;cursor:pointer;font-size:12px;border-bottom:2px solid #6af;">Parts</button>
        <button data-tab="json" style="padding:4px 10px;background:#1a2a3a;border:none;border-radius:3px;color:#666;cursor:pointer;font-size:12px;">JSON</button>
      </div>
      <div id="ui-part-list" style="flex:1;overflow-y:auto;padding:6px 8px;"></div>
      <div id="ui-json" style="flex:1;overflow-y:auto;padding:6px 8px;display:none;background:#0a0a14;"></div>
      <div id="ui-props" style="border-top:1px solid #333;padding:8px 12px;display:none;"></div>
      <div style="border-top:1px solid #333;padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;">
        <button data-action="add" style="padding:5px 10px;background:#2a5a3a;border:none;border-radius:4px;color:#8f8;cursor:pointer;">+ Add</button>
        <button data-action="dup" style="padding:5px 10px;background:#3a4a5a;border:none;border-radius:4px;color:#8cf;cursor:pointer;">Dup</button>
        <button data-action="del" style="padding:5px 10px;background:#5a2a2a;border:none;border-radius:4px;color:#f88;cursor:pointer;">Del</button>
        <button data-action="export" style="padding:5px 10px;background:#3a3a5a;border:none;border-radius:4px;color:#ccf;cursor:pointer;">Export</button>
        <button data-action="import" style="padding:5px 10px;background:#3a3a5a;border:none;border-radius:4px;color:#ccf;cursor:pointer;">Import</button>
      </div>
      <style>
        .part-item:hover{background:#2a3040;}
        .part-item.selected{background:#2a3a5a;}
        .prop-row{display:flex;align-items:center;gap:6px;margin:3px 0;}
        .prop-row label{width:16px;color:#888;font-size:11px;}
        .prop-row input[type=range]{flex:1;}
        .prop-row .prop-val{width:32px;text-align:right;color:#8cf;font-size:11px;font-family:monospace;}
        .prop-row input[type=color]{width:28px;height:22px;padding:0;border:none;cursor:pointer;}
      </style>
    `;
    this.settingsEl = this.el.querySelector("#ui-settings")!;
    this.listEl = this.el.querySelector("#ui-part-list")!;
    this.jsonEl = this.el.querySelector("#ui-json")!;
    this.propsEl = this.el.querySelector("#ui-props")!;

    const tabButtons = this.el.querySelectorAll("button[data-tab]");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab((btn as HTMLElement).getAttribute("data-tab")!));
    });

    this.el.querySelector("[data-action=add]")!.addEventListener("click", () => actions.onAddPart());
    this.el.querySelector("[data-action=dup]")!.addEventListener("click", () => {
      const sel = this.el.querySelector(".part-item.selected");
      if (sel) actions.onDuplicatePart(sel.getAttribute("data-part-id")!);
    });
    this.el.querySelector("[data-action=del]")!.addEventListener("click", () => {
      const sel = this.el.querySelector(".part-item.selected");
      if (sel) actions.onDeletePart(sel.getAttribute("data-part-id")!);
    });
    this.el.querySelector("[data-action=export]")!.addEventListener("click", () => actions.onExport());
    this.el.querySelector("[data-action=import]")!.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => actions.onImport(reader.result as string);
        reader.readAsText(file);
      });
      input.click();
    });
  }

  refreshSettings(blueprint: PrizeBlueprint): void {
    const tag = blueprint.tag;
    if (!tag) {
      this.settingsEl.innerHTML = `
        <div style="margin-bottom:4px;font-weight:500;color:#8cf;">Prize Settings</div>
        <div class="prop-row"><label>N</label><input type="text" value="${blueprint.name}" id="bp-name" style="flex:1;background:#222;border:1px solid #444;border-radius:3px;color:#ccc;padding:2px 6px;font-size:12px;"></div>
        <div class="prop-row" style="margin-top:6px;"><label style="width:auto;">Tag</label><label style="color:#666;font-size:11px;">(blueprint has no tag config)</label></div>
      `;
      const nameInput = this.settingsEl.querySelector("#bp-name")!;
      nameInput.addEventListener("change", () => {
        this.actions.onUpdateBlueprint({ name: (nameInput as HTMLInputElement).value });
      });
      return;
    }
    this.settingsEl.innerHTML = `
      <div style="margin-bottom:4px;font-weight:500;color:#8cf;">Prize Settings</div>
      <div class="prop-row"><label>N</label><input type="text" value="${blueprint.name}" id="bp-name" style="flex:1;background:#222;border:1px solid #444;border-radius:3px;color:#ccc;padding:2px 6px;font-size:12px;"></div>
      <div style="margin:6px 0 4px;font-size:12px;color:#8cf;">Tag</div>
      <div class="prop-row"><label style="width:auto;font-size:12px;">Show</label><input type="checkbox" ${tag.enabled ? "checked" : ""} id="tag-enabled" style="accent-color:#6af;"></div>
      ${tag.enabled ? `
      <div class="prop-row"><label>X</label><input type="range" min="-0.3" max="0.3" step="0.005" value="${tag.px.toFixed(3)}" data-tag="px"><span class="prop-val">${tag.px.toFixed(3)}</span></div>
      <div class="prop-row"><label>Y</label><input type="range" min="-0.1" max="0.3" step="0.005" value="${tag.py.toFixed(3)}" data-tag="py"><span class="prop-val">${tag.py.toFixed(3)}</span></div>
      <div class="prop-row"><label>Z</label><input type="range" min="-0.4" max="0.1" step="0.005" value="${tag.pz.toFixed(3)}" data-tag="pz"><span class="prop-val">${tag.pz.toFixed(3)}</span></div>
      <div class="prop-row"><label>R</label><input type="range" min="0" max="${Math.PI * 2}" step="0.05" value="${tag.ry.toFixed(3)}" data-tag="ry"><span class="prop-val">${tag.ry.toFixed(3)}</span></div>
      ` : ""}
    `;
    const nameInput = this.settingsEl.querySelector("#bp-name")!;
    nameInput.addEventListener("change", () => {
      this.actions.onUpdateBlueprint({ name: (nameInput as HTMLInputElement).value });
    });
    const enabledCb = this.settingsEl.querySelector("#tag-enabled") as HTMLInputElement;
    enabledCb.addEventListener("change", () => {
      this.actions.onUpdateBlueprint({ tag: { ...tag, enabled: enabledCb.checked } });
    });
    if (tag.enabled) {
      const tagRanges = this.settingsEl.querySelectorAll("input[type=range][data-tag]");
      tagRanges.forEach((inp) => {
        inp.addEventListener("input", () => {
          const span = (inp as HTMLElement).parentElement!.querySelector(".prop-val");
          if (span) span.textContent = parseFloat((inp as HTMLInputElement).value).toFixed(3);
        });
        inp.addEventListener("change", () => {
          const prop = (inp as HTMLElement).getAttribute("data-tag")!;
          const val = parseFloat((inp as HTMLInputElement).value);
          this.actions.onUpdateBlueprint({ tag: { ...tag, [prop]: val } });
        });
      });
    }
  }

  refreshList(blueprint: PrizeBlueprint, selectedId: string | null): void {
    this.listEl.innerHTML = "";
    for (const part of blueprint.parts) {
      const item = document.createElement("div");
      item.className = "part-item" + (part.id === selectedId ? " selected" : "");
      item.setAttribute("data-part-id", part.id);
      item.style.cssText =
        `padding:4px 8px;margin:2px 0;border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:6px;`;
      item.innerHTML =
        `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${part.color}"></span>${part.label}`;
      item.addEventListener("click", () => this.actions.onSelectPart(part.id));
      this.listEl.appendChild(item);
    }
  }

  showProperties(part: PrizePart | null): void {
    if (!part) {
      this.propsEl.style.display = "none";
      return;
    }
    this.propsEl.style.display = "block";
    this.propsEl.innerHTML = `
      <div style="margin-bottom:6px;font-weight:500;color:#8cf;">${part.label}</div>
      <div class="prop-row"><label>W</label><input type="range" min="0.01" max="0.3" step="0.005" value="${(part.hw * 2).toFixed(3)}" data-prop="w"><span class="prop-val">${(part.hw * 2).toFixed(3)}</span></div>
      <div class="prop-row"><label>H</label><input type="range" min="0.01" max="0.3" step="0.005" value="${(part.hh * 2).toFixed(3)}" data-prop="h"><span class="prop-val">${(part.hh * 2).toFixed(3)}</span></div>
      <div class="prop-row"><label>D</label><input type="range" min="0.01" max="0.3" step="0.005" value="${(part.hd * 2).toFixed(3)}" data-prop="d"><span class="prop-val">${(part.hd * 2).toFixed(3)}</span></div>
      <div class="prop-row"><label>X</label><input type="range" min="-0.2" max="0.2" step="0.005" value="${part.px.toFixed(3)}" data-prop="px"><span class="prop-val">${part.px.toFixed(3)}</span></div>
      <div class="prop-row"><label>Y</label><input type="range" min="-0.2" max="0.2" step="0.005" value="${part.py.toFixed(3)}" data-prop="py"><span class="prop-val">${part.py.toFixed(3)}</span></div>
      <div class="prop-row"><label>Z</label><input type="range" min="-0.2" max="0.2" step="0.005" value="${part.pz.toFixed(3)}" data-prop="pz"><span class="prop-val">${part.pz.toFixed(3)}</span></div>
      <div class="prop-row"><label>N</label><input type="text" value="${part.label}" data-prop="label" style="flex:1;background:#222;border:1px solid #444;border-radius:3px;color:#ccc;padding:2px 6px;font-size:12px;"></div>
      <div class="prop-row"><label>C</label><input type="color" value="${part.color}" data-prop="color"></div>
    `;
    const rangeInputs = this.propsEl.querySelectorAll("input[type=range]");
    const colorInputs = this.propsEl.querySelectorAll("input[type=color]");
    const textInputs = this.propsEl.querySelectorAll("input[type=text]");
    rangeInputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        const span = (inp as HTMLElement).parentElement!.querySelector(".prop-val");
        if (span) span.textContent = parseFloat((inp as HTMLInputElement).value).toFixed(3);
      });
      inp.addEventListener("change", () => {
        const prop = (inp as HTMLElement).getAttribute("data-prop")!;
        this.actions.onUpdatePart(part.id, this.parseProp(prop, (inp as HTMLInputElement).value));
      });
    });
    colorInputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        const prop = (inp as HTMLElement).getAttribute("data-prop")!;
        this.actions.onUpdatePart(part.id, this.parseProp(prop, (inp as HTMLInputElement).value));
      });
    });
    textInputs.forEach((inp) => {
      inp.addEventListener("change", () => {
        const prop = (inp as HTMLElement).getAttribute("data-prop")!;
        const val = (inp as HTMLInputElement).value;
        this.actions.onUpdatePart(part.id, this.parseProp(prop, val));
      });
    });
  }

  private parseProp(prop: string, val: string): Partial<PrizePart> {
    const num = parseFloat(val);
    switch (prop) {
      case "w": return { hw: num / 2 };
      case "h": return { hh: num / 2 };
      case "d": return { hd: num / 2 };
      case "px": return { px: num };
      case "py": return { py: num };
      case "pz": return { pz: num };
      case "color": return { color: val };
      case "label": return { label: val };
      default: return {};
    }
  }

  private switchTab(tab: string): void {
    const isJson = tab === "json";
    this.listEl.style.display = isJson ? "none" : "block";
    this.jsonEl.style.display = isJson ? "block" : "none";
    this.el.querySelectorAll("button[data-tab]").forEach((btn) => {
      const isActive = (btn as HTMLElement).getAttribute("data-tab") === tab;
      (btn as HTMLElement).style.background = isActive ? "#2a3a4a" : "#1a2a3a";
      (btn as HTMLElement).style.color = isActive ? "#8cf" : "#666";
      (btn as HTMLElement).style.borderBottom = isActive ? "2px solid #6af" : "none";
    });
  }

  updateJsonDisplay(blueprint: PrizeBlueprint): void {
    const jsonText = JSON.stringify(blueprint, null, 2);
    this.jsonEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px 0;border-bottom:1px solid #333;">
        <span style="font-weight:500;color:#8cf;">JSON Output</span>
        <button id="copy-json" style="padding:4px 8px;background:#3a4a5a;border:none;border-radius:3px;color:#8cf;cursor:pointer;font-size:11px;">Copy</button>
      </div>
      <pre id="json-text" style="background:#1a1a2e;color:#8f8;font-size:11px;line-height:1.3;overflow-x:auto;padding:8px;border-radius:3px;border:1px solid #333;white-space:pre-wrap;word-break:break-all;margin:0;">${this.escapeHtml(jsonText)}</pre>
    `;
    const copyBtn = this.jsonEl.querySelector("#copy-json") as HTMLButtonElement;
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(jsonText).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
        });
      });
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}