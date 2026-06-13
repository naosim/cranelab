import type { PrizeBlueprint } from "../editor/PrizeData";

const blueprints: Record<string, PrizeBlueprint> = {};

const blueprintModules = import.meta.glob("./blueprints/*.json", {
  eager: true,
}) as Record<string, { default: PrizeBlueprint }>;
for (const path in blueprintModules) {
  const blueprint = blueprintModules[path].default;
  if (blueprint && blueprint.name) {
    blueprints[blueprint.name] = blueprint;
  }
}

export function getBlueprint(type: string): PrizeBlueprint | null {
  return blueprints[type] ?? null;
}

export function hasBlueprint(type: string): boolean {
  return type in blueprints;
}

export function getBlueprintNames(): string[] {
  return Object.keys(blueprints);
}

export function getRandomBlueprint(): PrizeBlueprint | null {
  const names = getBlueprintNames();
  if (names.length === 0) return null;
  const selected = names[Math.floor(Math.random() * names.length)];
  return getBlueprint(selected);
}
