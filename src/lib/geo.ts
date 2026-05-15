/** Bounding box aproximado de CABA, para descartar resultados fuera de rango. */
export function estaEnCaba(lng: number, lat: number): boolean {
  return lng > -58.55 && lng < -58.33 && lat > -34.71 && lat < -34.52;
}

/** Centro del mapa por defecto (Obelisco). */
export const CENTRO_CABA: [number, number] = [-58.4173, -34.6037];
