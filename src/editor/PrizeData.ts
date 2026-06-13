export interface PrizePart {
  id: string;
  label: string;
  hw: number;
  hh: number;
  hd: number;
  px: number;
  py: number;
  pz: number;
  color: string;
}

export interface TagConfig {
  enabled: boolean;
  px: number;
  py: number;
  pz: number;
  ry: number;
}

export interface PrizeBlueprint {
  name: string;
  parts: PrizePart[];
  tag?: TagConfig | null;
}

let _idCounter = 0;
export function generateId(): string {
  return `part_${++_idCounter}`;
}

export function createDefaultPart(): PrizePart {
  return {
    id: generateId(),
    label: "part",
    hw: 0.07,
    hh: 0.07,
    hd: 0.07,
    px: 0,
    py: 0,
    pz: 0,
    color: "#8b5e3c",
  };
}

export function createDefaultTag(): TagConfig {
  return { enabled: true, px: 0, py: 0.06, pz: -0.22, ry: 0 };
}

export function exportBlueprint(blueprint: PrizeBlueprint): string {
  return JSON.stringify(blueprint, null, 2);
}

export function importBlueprint(json: string): PrizeBlueprint {
  return JSON.parse(json) as PrizeBlueprint;
}
