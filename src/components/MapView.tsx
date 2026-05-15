"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SUBTE_COLORS } from "@/lib/layers";
import { CENTRO_CABA } from "@/lib/geo";
import type { Favorito, LayerKey, LayerVisibility, SeleccionMapa } from "@/lib/types";

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Capas que responden al click del usuario. */
const CLICKABLE: LayerKey[] = [
  "subte",
  "ecobici",
  "colectivos",
  "taxis",
  "trenes",
  "ciclovias",
];

/** Orden de apilado: las capas de puntos quedan siempre arriba. */
const POINT_LAYERS = [
  "lyr-ciclovias",
  "lyr-trenes-est",
  "lyr-subte-est",
  "lyr-taxis",
  "lyr-ecobici",
  "lyr-colectivos",
];

interface Props {
  visibility: LayerVisibility;
  colectivosFiltro: string;
  favoritos: Favorito[];
  placing: boolean;
  pendingPick: { lng: number; lat: number } | null;
  searchResult: { lng: number; lat: number; label: string } | null;
  flyTarget: { lng: number; lat: number; zoom?: number } | null;
  onSelect: (sel: SeleccionMapa | null) => void;
  onPick: (lng: number, lat: number) => void;
}

export default function MapView({
  visibility,
  colectivosFiltro,
  favoritos,
  placing,
  pendingPick,
  searchResult,
  flyTarget,
  onSelect,
  onPick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const initialized = useRef<Set<LayerKey>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const markers = useRef<maplibregl.Marker[]>([]);
  const pickMarker = useRef<maplibregl.Marker | null>(null);
  const searchMarker = useRef<maplibregl.Marker | null>(null);

  // Props vivos para los handlers registrados una sola vez.
  const placingRef = useRef(placing);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  placingRef.current = placing;
  onSelectRef.current = onSelect;
  onPickRef.current = onPick;

  /* --- Crear el mapa una sola vez --- */
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: CENTRO_CABA,
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          'Datos: <a href="https://data.buenosaires.gob.ar" target="_blank">BA Data</a> · API Transporte GCBA',
      }),
      "bottom-left",
    );

    map.on("load", () => {
      readyRef.current = true;
      syncLayers();
      syncMarkers();
    });

    // Click en zona vacia: deselecciona o coloca pin.
    map.on("click", (e) => {
      if (placingRef.current) {
        onPickRef.current(e.lngLat.lng, e.lngLat.lat);
        return;
      }
      const hits = map.queryRenderedFeatures(e.point, {
        layers: POINT_LAYERS.concat("lyr-subte-est").filter((id) =>
          map.getLayer(id),
        ),
      });
      if (hits.length === 0) onSelectRef.current(null);
    });

    return () => {
      Object.values(timers.current).forEach(clearInterval);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Crea fuentes y capas para un modo (lazy) --- */
  function initLayer(key: LayerKey) {
    const map = mapRef.current!;
    if (initialized.current.has(key)) return;
    initialized.current.add(key);

    const ds = "/datasets";

    if (key === "subte") {
      map.addSource("src-subte-red", {
        type: "geojson",
        data: `${ds}/subte/red_subte.geojson`,
      });
      map.addSource("src-subte-est", {
        type: "geojson",
        data: `${ds}/subte/estaciones_de_subte.geojson`,
      });
      map.addLayer({
        id: "lyr-subte-red",
        type: "line",
        source: "src-subte-red",
        paint: {
          "line-width": 3.5,
          "line-color": [
            "match",
            ["get", "nombre"],
            "Linea A", SUBTE_COLORS.A,
            "Linea B", SUBTE_COLORS.B,
            "Linea C", SUBTE_COLORS.C,
            "Linea D", SUBTE_COLORS.D,
            "Linea E", SUBTE_COLORS.E,
            "Linea H", SUBTE_COLORS.H,
            "#888888",
          ],
        },
      });
      map.addLayer({
        id: "lyr-subte-est",
        type: "circle",
        source: "src-subte-est",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 15, 7],
          "circle-color": [
            "match",
            ["get", "linea"],
            "A", SUBTE_COLORS.A,
            "B", SUBTE_COLORS.B,
            "C", SUBTE_COLORS.C,
            "D", SUBTE_COLORS.D,
            "E", SUBTE_COLORS.E,
            "H", SUBTE_COLORS.H,
            "#cccccc",
          ],
          "circle-stroke-width": 1.6,
          "circle-stroke-color": "#0b0c12",
        },
      });
    }

    if (key === "trenes") {
      map.addSource("src-trenes-red", {
        type: "geojson",
        data: `${ds}/trenes/red-de-ferrocarril.geojson`,
      });
      map.addSource("src-trenes-est", {
        type: "geojson",
        data: `${ds}/trenes/estaciones_ferroviarias.geojson`,
      });
      map.addLayer({
        id: "lyr-trenes-red",
        type: "line",
        source: "src-trenes-red",
        paint: { "line-color": "#2dd4bf", "line-width": 2.2, "line-opacity": 0.8 },
      });
      map.addLayer({
        id: "lyr-trenes-est",
        type: "circle",
        source: "src-trenes-est",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 6],
          "circle-color": "#2dd4bf",
          "circle-stroke-width": 1.4,
          "circle-stroke-color": "#0b0c12",
        },
      });
    }

    if (key === "ciclovias") {
      map.addSource("src-ciclovias", {
        type: "geojson",
        data: `${ds}/ciclovias/ciclovias.geojson`,
      });
      map.addLayer({
        id: "lyr-ciclovias",
        type: "line",
        source: "src-ciclovias",
        paint: { "line-color": "#84cc16", "line-width": 2, "line-opacity": 0.75 },
      });
    }

    if (key === "premetro") {
      map.addSource("src-premetro", {
        type: "geojson",
        data: `${ds}/premetro/lineas_de_premetro.geojson`,
      });
      map.addLayer({
        id: "lyr-premetro",
        type: "line",
        source: "src-premetro",
        paint: {
          "line-color": "#c084fc",
          "line-width": 3,
          "line-dasharray": [2, 1.5],
        },
      });
    }

    if (key === "taxis") {
      map.addSource("src-taxis", {
        type: "geojson",
        data: `${ds}/taxis/paradas_taxis.geojson`,
      });
      map.addLayer({
        id: "lyr-taxis",
        type: "circle",
        source: "src-taxis",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 6],
          "circle-color": "#ffcc00",
          "circle-stroke-width": 1.3,
          "circle-stroke-color": "#0b0c12",
        },
      });
    }

    if (key === "ecobici") {
      map.addSource("src-ecobici", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "lyr-ecobici",
        type: "circle",
        source: "src-ecobici",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 15, 8],
          "circle-color": [
            "case",
            ["get", "offline"],
            "#4b5563",
            ["step", ["get", "bikes"], "#ef4444", 1, "#f59e0b", 4, "#22c55e"],
          ],
          "circle-stroke-width": 1.6,
          "circle-stroke-color": "#0b0c12",
        },
      });
    }

    if (key === "colectivos") {
      map.addSource("src-colectivos", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "lyr-colectivos",
        type: "circle",
        source: "src-colectivos",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 6],
          "circle-color": "#ff7a00",
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#0b0c12",
        },
      });
    }

    // Cursor + click para capas interactivas.
    const interactiveLayer = clickLayerId(key);
    if (interactiveLayer) {
      map.on("mouseenter", interactiveLayer, () => {
        if (!placingRef.current)
          map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", interactiveLayer, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", interactiveLayer, (e) => {
        if (placingRef.current) return;
        const f = e.features?.[0];
        if (!f) return;
        onSelectRef.current(
          buildSeleccion(key, f.properties ?? {}, e.lngLat.lng, e.lngLat.lat),
        );
      });
    }

    restack();
  }

  /** Reordena para que los puntos queden sobre las lineas. */
  function restack() {
    const map = mapRef.current!;
    POINT_LAYERS.forEach((id) => {
      if (map.getLayer(id)) map.moveLayer(id);
    });
  }

  /* --- Sincroniza visibilidad de capas con el estado --- */
  function syncLayers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    (Object.keys(visibility) as LayerKey[]).forEach((key) => {
      const on = visibility[key];
      if (on) initLayer(key);
      layerIdsOf(key).forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
        }
      });
      // Polling de datos en vivo.
      if (key === "ecobici" || key === "colectivos") {
        if (on) startLive(key);
        else stopLive(key);
      }
    });
  }

  function startLive(key: "ecobici" | "colectivos") {
    if (timers.current[key]) return;
    refreshLive(key);
    const ms = key === "ecobici" ? 30000 : 20000;
    timers.current[key] = setInterval(() => refreshLive(key), ms);
  }
  function stopLive(key: "ecobici" | "colectivos") {
    if (timers.current[key]) {
      clearInterval(timers.current[key]);
      delete timers.current[key];
    }
  }
  async function refreshLive(key: "ecobici" | "colectivos") {
    const map = mapRef.current;
    if (!map) return;
    try {
      const url =
        key === "colectivos" && colectivosFiltro.trim()
          ? `/api/transporte/colectivos?linea=${encodeURIComponent(colectivosFiltro.trim())}`
          : `/api/transporte/${key}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const geojson = await res.json();
      const src = map.getSource(`src-${key}`) as maplibregl.GeoJSONSource | undefined;
      src?.setData(geojson);
    } catch {
      /* error transitorio: reintenta en el proximo tick */
    }
  }

  /* --- Marcadores DOM: favoritos, pick y busqueda --- */
  function syncMarkers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    markers.current.forEach((m) => m.remove());
    markers.current = favoritos.map((f) => {
      const el = document.createElement("div");
      el.className = "fav-marker";
      el.textContent = "⭐";
      el.title = f.label;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current({
          kind: "favorito",
          title: f.label,
          subtitle: f.address ?? undefined,
          lng: f.lng,
          lat: f.lat,
          color: "#facc15",
          rows: [],
        });
      });
      return new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([f.lng, f.lat])
        .addTo(map);
    });
  }

  /* --- Efectos reactivos --- */
  useEffect(() => {
    syncLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility]);

  useEffect(() => {
    // Cambio de filtro de colectivos: refresca si esta visible.
    if (visibility.colectivos) refreshLive("colectivos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colectivosFiltro]);

  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritos]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = placing ? "crosshair" : "";
  }, [placing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickMarker.current?.remove();
    pickMarker.current = null;
    if (pendingPick) {
      const el = document.createElement("div");
      el.className = "pick-marker";
      el.textContent = "\u{1F4CD}";
      pickMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([pendingPick.lng, pendingPick.lat])
        .addTo(map);
    }
  }, [pendingPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    searchMarker.current?.remove();
    searchMarker.current = null;
    if (searchResult) {
      const el = document.createElement("div");
      el.className = "pick-marker";
      el.textContent = "\u{1F3AF}";
      searchMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([searchResult.lng, searchResult.lat])
        .addTo(map);
    }
  }, [searchResult]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && flyTarget) {
      map.flyTo({
        center: [flyTarget.lng, flyTarget.lat],
        zoom: flyTarget.zoom ?? 15,
        duration: 1100,
      });
    }
  }, [flyTarget]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

/* ----------------- helpers ----------------- */

function clickLayerId(key: LayerKey): string | null {
  const map: Partial<Record<LayerKey, string>> = {
    subte: "lyr-subte-est",
    trenes: "lyr-trenes-est",
    taxis: "lyr-taxis",
    ecobici: "lyr-ecobici",
    colectivos: "lyr-colectivos",
    ciclovias: "lyr-ciclovias",
  };
  return CLICKABLE.includes(key) ? (map[key] ?? null) : null;
}

function layerIdsOf(key: LayerKey): string[] {
  switch (key) {
    case "subte":
      return ["lyr-subte-red", "lyr-subte-est"];
    case "trenes":
      return ["lyr-trenes-red", "lyr-trenes-est"];
    case "ciclovias":
      return ["lyr-ciclovias"];
    case "premetro":
      return ["lyr-premetro"];
    case "taxis":
      return ["lyr-taxis"];
    case "ecobici":
      return ["lyr-ecobici"];
    case "colectivos":
      return ["lyr-colectivos"];
  }
}

type Props2 = Record<string, unknown>;
const str = (p: Props2, k: string) => (p[k] == null ? "" : String(p[k]));
const num = (p: Props2, k: string) => Number(p[k] ?? 0);

function buildSeleccion(
  key: LayerKey,
  p: Props2,
  lng: number,
  lat: number,
): SeleccionMapa {
  switch (key) {
    case "subte":
      return {
        kind: "subte",
        title: str(p, "estacion") || "Estacion de subte",
        subtitle: `Linea ${str(p, "linea")}`,
        lng,
        lat,
        color: SUBTE_COLORS[str(p, "linea")] ?? "#00aeef",
        rows: [],
      };
    case "ecobici": {
      const offline = p.offline === true;
      return {
        kind: "ecobici",
        title: str(p, "name") || "Estacion EcoBici",
        subtitle: str(p, "address"),
        lng,
        lat,
        color: offline ? "#6b7280" : "#22c55e",
        rows: offline
          ? [{ label: "Estado", value: "Fuera de servicio" }]
          : [
              { label: "Bicis disponibles", value: String(num(p, "bikes")) },
              { label: "Mecanicas", value: String(num(p, "mechanical")) },
              { label: "Electricas", value: String(num(p, "ebikes")) },
              { label: "Anclajes libres", value: String(num(p, "docks")) },
            ],
      };
    }
    case "colectivos":
      return {
        kind: "colectivos",
        title: `Linea ${str(p, "linea")}`,
        subtitle: str(p, "destino"),
        lng,
        lat,
        color: "#ff7a00",
        rows: [
          { label: "Empresa", value: str(p, "empresa") || "-" },
          { label: "Velocidad", value: `${num(p, "velocidad")} km/h` },
        ],
      };
    case "taxis":
      return {
        kind: "taxis",
        title: "Parada de taxi",
        subtitle: str(p, "dirreccion"),
        lng,
        lat,
        color: "#ffcc00",
        rows: [
          { label: "Barrio", value: str(p, "barrio") || "-" },
          { label: "Comuna", value: str(p, "comuna") || "-" },
        ],
      };
    case "trenes":
      return {
        kind: "trenes",
        title: str(p, "nombre") || "Estacion de tren",
        subtitle: str(p, "linea"),
        lng,
        lat,
        color: "#2dd4bf",
        rows: [
          { label: "Ramal", value: str(p, "ramal") || "-" },
          { label: "Barrio", value: str(p, "barrio") || "-" },
        ],
      };
    case "ciclovias":
      return {
        kind: "ciclovias",
        title: "Ciclovia",
        subtitle: str(p, "nombre"),
        lng,
        lat,
        color: "#84cc16",
        rows: [
          { label: "Tipo", value: str(p, "tipo") || "-" },
          { label: "Barrio", value: str(p, "barrio") || "-" },
        ],
      };
    default:
      return {
        kind: key,
        title: "Punto",
        lng,
        lat,
        color: "#00d4ff",
        rows: [],
      };
  }
}
