import { EditorScene } from "./EditorScene";
import { EditorUI } from "./EditorUI";
import { PrizeBuilder } from "./PrizeBuilder";
import { PrizeBlueprint, TagConfig, generateId, createDefaultPart, createDefaultTag, exportBlueprint, importBlueprint } from "./PrizeData";

const viewport = document.getElementById("viewport")!;
const panel = document.getElementById("panel")!;

let blueprint: PrizeBlueprint = {
  name: "my_prize",
  parts: [
    { id: generateId(), label: "body", hw: 0.08, hh: 0.10, hd: 0.08, px: 0, py: 0, pz: 0, color: "#8b5e3c" },
    { id: generateId(), label: "head", hw: 0.07, hh: 0.07, hd: 0.07, px: 0, py: 0.1, pz: 0.02, color: "#a0724e" },
  ],
  tag: createDefaultTag(),
};

let selectedId: string | null = null;
const builder = new PrizeBuilder();
let suppressTransformSync = false;

function rebuildScene(keepSelection: boolean): void {
  scene.detachTransform();
  builder.build(blueprint);
  if (keepSelection && selectedId) {
    scene.selectPart(selectedId);
  }
  ui.refreshList(blueprint, selectedId);
  ui.refreshSettings(blueprint);
}

const scene = new EditorScene(
  viewport,
  (e) => {
    selectedId = e.partId;
    scene.selectPart(selectedId);
    const part = blueprint.parts.find((p) => p.id === selectedId) ?? null;
    ui.showProperties(part);
    ui.refreshList(blueprint, selectedId);
  },
  (e) => {
    if (suppressTransformSync) return;
    const part = blueprint.parts.find((p) => p.id === e.partId);
    if (part) {
      part.px = e.position.x;
      part.py = e.position.y;
      part.pz = e.position.z;
      ui.showProperties(part);
    }
  },
);

scene.addGroup(builder.group);

const ui = new EditorUI({
  onAddPart: () => {
    const part = createDefaultPart();
    blueprint.parts.push(part);
    selectedId = part.id;
    rebuildScene(true);
    ui.showProperties(part);
    ui.updateJsonDisplay(blueprint);
  },
  onDuplicatePart: (id) => {
    const src = blueprint.parts.find((p) => p.id === id);
    if (!src) return;
    const part = { ...src, id: generateId(), label: src.label + "_copy" };
    blueprint.parts.push(part);
    selectedId = part.id;
    rebuildScene(true);
    ui.showProperties(part);
    ui.updateJsonDisplay(blueprint);
  },
  onDeletePart: (id) => {
    const idx = blueprint.parts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    blueprint.parts.splice(idx, 1);
    selectedId = null;
    rebuildScene(false);
    ui.showProperties(null);
    ui.updateJsonDisplay(blueprint);
  },
  onSelectPart: (id) => {
    selectedId = id;
    scene.selectPart(selectedId);
    const part = blueprint.parts.find((p) => p.id === id) ?? null;
    ui.showProperties(part);
    ui.refreshList(blueprint, selectedId);
  },
  onUpdatePart: (id, updates) => {
    const part = blueprint.parts.find((p) => p.id === id);
    if (!part) return;
    suppressTransformSync = true;
    Object.assign(part, updates);
    rebuildScene(true);
    ui.showProperties(part);
    ui.refreshList(blueprint, selectedId);
    suppressTransformSync = false;
    ui.updateJsonDisplay(blueprint);
  },
  onUpdateBlueprint: (updates) => {
    if (updates.name !== undefined) blueprint.name = updates.name;
    if (updates.tag !== undefined) {
      const prev = blueprint.tag ?? createDefaultTag();
      blueprint.tag = { ...prev, ...updates.tag } as TagConfig;
      builder.updateTag(blueprint.tag);
    }
    ui.refreshSettings(blueprint);
    ui.updateJsonDisplay(blueprint);
  },
  onExport: () => {
    const json = exportBlueprint(blueprint);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blueprint.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  onImport: (json) => {
    try {
      blueprint = importBlueprint(json);
      selectedId = null;
      scene.detachTransform();
      builder.build(blueprint);
      ui.refreshList(blueprint, null);
      ui.showProperties(null);
      ui.refreshSettings(blueprint);
      ui.updateJsonDisplay(blueprint);
    } catch (e) {
      alert("Import failed: " + e);
    }
  },
});
panel.appendChild(ui.el);

builder.build(blueprint);
ui.refreshList(blueprint, null);
ui.refreshSettings(blueprint);
ui.updateJsonDisplay(blueprint);
scene.animate();
