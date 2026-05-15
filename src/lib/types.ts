/** Modos de transporte que maneja la app. */
export type LayerKey =
  | "subte"
  | "ecobici"
  | "colectivos"
  | "taxis"
  | "trenes"
  | "ciclovias"
  | "premetro";

/** Estado de visibilidad de cada capa del mapa. */
export type LayerVisibility = Record<LayerKey, boolean>;

/** Domicilio favorito guardado por un usuario. */
export interface Favorito {
  id: string;
  user_id: string;
  label: string;
  address: string | null;
  lat: number;
  lng: number;
  created_at: string;
}

/** Feature seleccionada en el mapa, normalizada para el panel de detalle. */
export interface SeleccionMapa {
  kind: LayerKey | "favorito";
  title: string;
  subtitle?: string;
  lng: number;
  lat: number;
  /** Pares etiqueta/valor a mostrar en el panel. */
  rows: { label: string; value: string }[];
  /** Color de acento del panel. */
  color: string;
}

/** Resultado del geocodificador (ya convertido a WGS84). */
export interface GeocodeResult {
  label: string;
  lng: number;
  lat: number;
}
