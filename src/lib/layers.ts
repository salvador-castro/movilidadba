import type { LayerKey, LayerVisibility } from "./types";

export interface LayerMeta {
  key: LayerKey;
  label: string;
  description: string;
  /** Color de acento para chips y leyenda. */
  color: string;
  emoji: string;
  /** "live" = datos en tiempo real via API; "estatico" = GeoJSON local. */
  kind: "live" | "estatico";
  defaultOn: boolean;
}

export const LAYERS: LayerMeta[] = [
  {
    key: "subte",
    label: "Subte",
    description: "Red y estaciones",
    color: "#00aeef",
    emoji: "\u{1F687}",
    kind: "estatico",
    defaultOn: false,
  },
  {
    key: "ecobici",
    label: "EcoBici",
    description: "Bicis disponibles en vivo",
    color: "#22c55e",
    emoji: "\u{1F6B2}",
    kind: "live",
    defaultOn: false,
  },
  {
    key: "colectivos",
    label: "Colectivos",
    description: "Posicion en tiempo real",
    color: "#ff7a00",
    emoji: "\u{1F68C}",
    kind: "live",
    defaultOn: false,
  },
  {
    key: "taxis",
    label: "Paradas de taxi",
    description: "Paradas oficiales",
    color: "#ffcc00",
    emoji: "\u{1F695}",
    kind: "estatico",
    defaultOn: false,
  },
  {
    key: "trenes",
    label: "Trenes",
    description: "Red ferroviaria y estaciones",
    color: "#2dd4bf",
    emoji: "\u{1F686}",
    kind: "estatico",
    defaultOn: false,
  },
  {
    key: "ciclovias",
    label: "Ciclovias",
    description: "Red de ciclovias y bicisendas",
    color: "#84cc16",
    emoji: "\u{1F6E3}️",
    kind: "estatico",
    defaultOn: false,
  },
  {
    key: "premetro",
    label: "Premetro",
    description: "Linea E2",
    color: "#c084fc",
    emoji: "\u{1F68A}",
    kind: "estatico",
    defaultOn: false,
  },
];

/** Colores oficiales de las lineas de subte. */
export const SUBTE_COLORS: Record<string, string> = {
  A: "#18b5e6",
  B: "#e2231a",
  C: "#1455a0",
  D: "#00845a",
  E: "#642d8b",
  H: "#f4c500",
};

export function defaultVisibility(): LayerVisibility {
  return LAYERS.reduce((acc, l) => {
    acc[l.key] = l.defaultOn;
    return acc;
  }, {} as LayerVisibility);
}

export function metaOf(key: LayerKey): LayerMeta {
  return LAYERS.find((l) => l.key === key)!;
}
