"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LAYERS } from "@/lib/layers";
import type { Favorito, LayerKey, LayerVisibility } from "@/lib/types";
import SubteStatus from "./SubteStatus";
import TrenStatus from "./TrenStatus";

type RouteGeometry = { type: "LineString"; coordinates: [number, number][] };

interface WalkStep {
  name: string;
  maneuver: string;
  modifier?: string;
  distance: number;
  duration: number;
}

interface Props {
  visibility: LayerVisibility;
  onToggle: (key: LayerKey) => void;
  colectivosFiltro: string;
  onColectivosFiltro: (v: string) => void;
  userEmail: string | null;
  favoritos: Favorito[];
  onSearch: (direccion: string) => Promise<{ ok: boolean; message?: string }>;
  onFlyTo: (lng: number, lat: number, zoom?: number) => void;
  onDeleteFav: (id: string) => void;
  onStartPlacing: () => void;
  onSignOut: () => void;
  searchResult: { lng: number; lat: number; label: string } | null;
  onClearSearch: () => void;
  onRouteGeo: (geo: RouteGeometry | null) => void;
  onSetRoutePoints: (
    pts: { a: { lng: number; lat: number } | null; b: { lng: number; lat: number } | null } | null,
  ) => void;
  onSetRouteColor: (color: string) => void;
}

const MODOS_TRANSITO: {
  id: string;
  emoji: string;
  label: string;
  layerKey: LayerKey | null;
  calcMin: (distKm: number, walkMin: number) => number;
}[] = [
  {
    id: "colectivo", emoji: "🚌", label: "Colectivo", layerKey: "colectivos",
    calcMin: (distKm) => Math.max(8, Math.round(distKm * 4 + 5)),
  },
  {
    id: "subte", emoji: "🚇", label: "Subte", layerKey: "subte",
    calcMin: (distKm) => Math.max(12, Math.round(distKm * 1.8 + 10)),
  },
  {
    id: "tren", emoji: "🚂", label: "Tren", layerKey: "trenes",
    calcMin: (distKm) => Math.max(20, Math.round(distKm * 1.2 + 15)),
  },
  {
    id: "walking", emoji: "🚶", label: "Caminando", layerKey: null,
    calcMin: (_distKm, walkMin) => walkMin,
  },
];

async function fetchSugs(text: string): Promise<string[]> {
  if (text.length < 3) return [];
  try {
    const res = await fetch(`/api/geocoder?sugerencias=${encodeURIComponent(text)}`);
    const data = await res.json() as { resultados?: string[] };
    return data.resultados ?? [];
  } catch {
    return [];
  }
}

async function geocodeAddr(addr: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`/api/geocoder?direccion=${encodeURIComponent(addr)}`);
    const data = await res.json() as { lat?: number; lng?: number };
    if (!res.ok || !data.lat) return null;
    return { lat: data.lat, lng: data.lng! };
  } catch {
    return null;
  }
}

function useSugerencias(text: string) {
  const [items, setItems] = useState<string[]>([]);
  const [show, setShow] = useState(false);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (lockedRef.current) {
      lockedRef.current = false;
      setItems([]);
      return;
    }
    if (text.length < 3) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      const results = await fetchSugs(text);
      setItems(results);
      if (results.length > 0) setShow(true);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  function lock() {
    lockedRef.current = true;
  }

  return { items, show, setShow, lock };
}

function SugDropdown({ items, onSelect }: { items: string[]; onSelect: (s: string) => void }) {
  if (!items.length) return null;
  return (
    <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-panel-soft shadow-xl">
      {items.map((s, i) => (
        <li key={i}>
          <button
            onMouseDown={(e) => { e.preventDefault(); onSelect(s); }}
            className="w-full px-3 py-2 text-left text-sm text-ink transition hover:bg-accent/10"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}

function maneuverIcon(type: string, modifier?: string): string {
  if (type === "depart") return "🚶";
  if (type === "arrive") return "📍";
  if (modifier === "left" || modifier === "sharp left" || modifier === "slight left") return "↰";
  if (modifier === "right" || modifier === "sharp right" || modifier === "slight right") return "↱";
  return "↑";
}

interface Paso {
  icono: string;
  texto: string;
  duracion: number;
}

function generarPasos(
  modoId: string,
  distKm: number,
  walkMin: number,
  walkSteps: WalkStep[],
): Paso[] {
  if (modoId === "walking") {
    return walkSteps.map((s) => {
      const icono = maneuverIcon(s.maneuver, s.modifier);
      const distStr =
        s.distance < 50
          ? ""
          : s.distance < 1000
            ? ` · ${Math.round(s.distance)}m`
            : ` · ${(s.distance / 1000).toFixed(1)}km`;
      const nombre = s.name || (s.maneuver === "arrive" ? "Llegada" : "Continuar");
      return { icono, texto: `${nombre}${distStr}`, duracion: Math.round(s.duration / 60) };
    });
  }

  const walkToStation = Math.max(2, Math.round(walkMin * 0.35));
  const walkFromStation = Math.max(2, Math.round(walkMin * 0.2));
  const emoji = modoId === "subte" ? "🚇" : modoId === "tren" ? "🚂" : "🚌";
  const label = modoId === "subte" ? "Subte" : modoId === "tren" ? "Tren" : "Colectivo";
  const transitMin =
    modoId === "subte"
      ? Math.max(5, Math.round(distKm * 1.8))
      : modoId === "tren"
        ? Math.max(8, Math.round(distKm * 1.2))
        : Math.max(3, Math.round(distKm * 4));

  return [
    { icono: "🚶", texto: `Caminar ~${walkToStation} min hasta la parada`, duracion: walkToStation },
    { icono: emoji, texto: `Tomar el ${label} (~${transitMin} min)`, duracion: transitMin },
    { icono: "🚶", texto: `Caminar ~${walkFromStation} min hasta el destino`, duracion: walkFromStation },
  ];
}

export default function ControlPanel({
  visibility,
  onToggle,
  colectivosFiltro,
  onColectivosFiltro,
  userEmail,
  favoritos,
  onSearch,
  onFlyTo,
  onDeleteFav,
  onStartPlacing,
  onSignOut,
  searchResult,
  onClearSearch,
  onRouteGeo,
  onSetRoutePoints,
  onSetRouteColor,
}: Props) {
  const [abierto, setAbierto] = useState(true);
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  const [subteAbierto, setSubteAbierto] = useState(false);
  const [trenAbierto, setTrenAbierto] = useState(false);

  // Main search
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sugSearch = useSugerencias(busqueda);

  // Route planner
  const [textA, setTextA] = useState("");
  const [coordsA, setCoordsA] = useState<{ lat: number; lng: number } | null>(null);
  const [textB, setTextB] = useState("");
  const [coordsB, setCoordsB] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodingA, setGeocodingA] = useState(false);
  const [geocodingB, setGeocodingB] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [routeErr, setRouteErr] = useState<string | null>(null);
  const [modoSel, setModoSel] = useState<string | null>(null);
  const [modosResult, setModosResult] = useState<
    { id: string; emoji: string; label: string; minutos: number; layerKey: LayerKey | null }[] | null
  >(null);
  const [routeInfo, setRouteInfo] = useState<{
    distKm: number;
    walkMin: number;
    steps: WalkStep[];
  } | null>(null);
  const [transitSteps, setTransitSteps] = useState<
    { icono: string; texto: string; duracion: number }[] | null
  >(null);
  const [fetchingTransit, setFetchingTransit] = useState(false);
  const sugA = useSugerencias(textA);
  const sugB = useSugerencias(textB);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!busqueda.trim() || buscando) return;
    setBuscando(true);
    setMsg(null);
    const r = await onSearch(busqueda.trim());
    setBuscando(false);
    sugSearch.setShow(false);
    if (!r.ok) setMsg(r.message ?? "No se encontró la dirección.");
  }

  async function seleccionarSugSearch(s: string) {
    setBusqueda(s);
    sugSearch.lock();
    sugSearch.setShow(false);
    setBuscando(true);
    setMsg(null);
    const r = await onSearch(s);
    setBuscando(false);
    if (!r.ok) setMsg(r.message ?? "No se encontró la dirección.");
  }

  async function geocodearA(text: string) {
    setGeocodingA(true);
    setRouteErr(null);
    const coords = await geocodeAddr(text);
    setGeocodingA(false);
    if (coords) {
      setCoordsA(coords);
      onFlyTo(coords.lng, coords.lat);
    } else {
      setRouteErr("No se encontró la dirección de origen.");
    }
  }

  async function geocodearB(text: string) {
    setGeocodingB(true);
    setRouteErr(null);
    const coords = await geocodeAddr(text);
    setGeocodingB(false);
    if (coords) {
      setCoordsB(coords);
      onFlyTo(coords.lng, coords.lat);
    } else {
      setRouteErr("No se encontró la dirección de destino.");
    }
  }

  async function submitA(e: React.FormEvent) {
    e.preventDefault();
    if (!textA.trim() || geocodingA) return;
    sugA.setShow(false);
    await geocodearA(textA.trim());
  }

  async function submitB(e: React.FormEvent) {
    e.preventDefault();
    if (!textB.trim() || geocodingB) return;
    sugB.setShow(false);
    await geocodearB(textB.trim());
  }

  function swapAB() {
    const newA = coordsB;
    const newB = coordsA;
    setTextA(textB);
    setTextB(textA);
    setCoordsA(newA);
    setCoordsB(newB);
    sugA.lock();
    sugB.lock();
    setModosResult(null);
    setModoSel(null);
    setRouteInfo(null);
    setTransitSteps(null);
    setFetchingTransit(false);
    onRouteGeo(null);
    onSetRouteColor("#00d4ff");
  }

  // Keep calcularOpciones in a ref so the useEffect below always calls the latest version
  const calcularOpcionesRef = useRef<() => void>(() => {});
  useEffect(() => {
    calcularOpcionesRef.current = async function calcularOpciones() {
      if (!coordsA || !coordsB || calculando) return;
      setCalculando(true);
      setRouteErr(null);
      setModosResult(null);
      setModoSel(null);
      setRouteInfo(null);
      try {
        const res = await fetch(
          `/api/ruta?olng=${coordsA.lng}&olat=${coordsA.lat}&dlng=${coordsB.lng}&dlat=${coordsB.lat}&mode=foot`,
        );
        const data = await res.json() as {
          geometry?: RouteGeometry;
          distance?: number;
          duration?: number;
          steps?: WalkStep[];
          error?: string;
        };
        if (!res.ok || !data.geometry) {
          setRouteErr(data.error ?? "No se pudo calcular la ruta.");
        } else {
          onRouteGeo(data.geometry);
          onFlyTo(
            (coordsA.lng + coordsB.lng) / 2,
            (coordsA.lat + coordsB.lat) / 2,
            13,
          );
          const distKm = (data.distance ?? 0) / 1000;
          const walkMin = Math.round((data.duration ?? 0) / 60);
          const steps = data.steps ?? [];
          setRouteInfo({ distKm, walkMin, steps });
          const modos = MODOS_TRANSITO.map((m) => ({
            id: m.id,
            emoji: m.emoji,
            label: m.label,
            layerKey: m.layerKey,
            minutos: m.calcMin(distKm, walkMin),
          })).sort((a, b) => a.minutos - b.minutos);
          setModosResult(modos);
        }
      } catch {
        setRouteErr("Error de conexión al calcular la ruta.");
      } finally {
        setCalculando(false);
      }
    };
  });

  // Sync map markers and auto-calculate route when both coords change
  useEffect(() => {
    onSetRoutePoints(
      coordsA || coordsB
        ? { a: coordsA ?? null, b: coordsB ?? null }
        : null,
    );
    if (coordsA && coordsB) {
      calcularOpcionesRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordsA, coordsB]);

  const MODO_COLORS: Record<string, string> = {
    walking: "#e2e8f0",
    subte: "#00aeef",
    colectivo: "#ff7a00",
    tren: "#2dd4bf",
  };

  async function seleccionarModo(modo: { id: string; layerKey: LayerKey | null }) {
    setModoSel(modo.id);
    setTransitSteps(null);
    onSetRouteColor(MODO_COLORS[modo.id] ?? "#00d4ff");

    if ((modo.id === "subte" || modo.id === "tren") && coordsA && coordsB) {
      setFetchingTransit(true);
      try {
        const modeParam = modo.id === "tren" ? "trenes" : "subte";
        const res = await fetch(
          `/api/ruta/estaciones?olng=${coordsA.lng}&olat=${coordsA.lat}&dlng=${coordsB.lng}&dlat=${coordsB.lat}&mode=${modeParam}`,
        );
        const data = (await res.json()) as {
          steps?: { icono: string; texto: string; duracion: number }[];
        };
        if (res.ok) setTransitSteps(data.steps ?? null);
      } catch {
        /* silent */
      } finally {
        setFetchingTransit(false);
      }
    }
  }

  function limpiarRuta() {
    setTextA("");
    setTextB("");
    setCoordsA(null);
    setCoordsB(null);
    setModosResult(null);
    setModoSel(null);
    setRouteErr(null);
    setRouteInfo(null);
    setTransitSteps(null);
    setFetchingTransit(false);
    onRouteGeo(null);
    onSetRouteColor("#00d4ff");
  }

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="glass animate-fade-up pointer-events-auto absolute left-4 top-4 z-30 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink shadow-xl"
        >
          ☰ Capas y búsqueda
        </button>
      )}

      <aside
        className={`glass pointer-events-auto absolute bottom-0 left-0 top-0 z-30 flex w-[min(92vw,376px)] flex-col shadow-2xl transition-transform duration-300 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: "linear-gradient(135deg,var(--color-accent),var(--color-accent-2))" }}
          >
            🚇
          </div>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold leading-tight text-ink">Movilidad BA</h1>
            <p className="text-xs text-muted">Cómo moverte por la Ciudad</p>
          </div>
          <button
            onClick={() => setAbierto(false)}
            aria-label="Ocultar panel"
            className="rounded-lg px-2 py-1 text-muted transition hover:bg-panel-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">

          {/* ── Búsqueda ── */}
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Buscar dirección
          </label>
          <div className="relative">
            <form onSubmit={buscar}>
              <input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  sugSearch.setShow(true);
                }}
                onFocus={() => sugSearch.items.length > 0 && sugSearch.setShow(true)}
                onBlur={() => setTimeout(() => sugSearch.setShow(false), 150)}
                placeholder="Ingrese dirección"
                className="w-full rounded-xl border border-line bg-panel-soft py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-muted transition hover:text-accent"
              >
                {buscando ? (
                  <span className="block h-4 w-4 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
                ) : (
                  "🔍"
                )}
              </button>
            </form>
            {sugSearch.show && (
              <SugDropdown items={sugSearch.items} onSelect={seleccionarSugSearch} />
            )}
          </div>
          {msg && <p className="mt-1.5 text-xs text-amber-400">{msg}</p>}

          {/* Resultado de búsqueda */}
          {searchResult && (
            <div className="animate-fade-up mt-2 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
              <span className="text-base">🎯</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{searchResult.label}</span>
              <button
                onClick={onClearSearch}
                aria-label="Borrar búsqueda"
                className="shrink-0 rounded-lg px-1.5 py-1 text-muted transition hover:text-red-400"
              >
                ✕
              </button>
            </div>
          )}

          {/* ── Cómo llegar ── */}
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
            Cómo llegar
          </h2>
          <div className="flex flex-col gap-1.5">
            {/* Dirección A */}
            <div className="relative">
              <form onSubmit={submitA}>
                <input
                  value={textA}
                  onChange={(e) => {
                    setTextA(e.target.value);
                    setCoordsA(null);
                    sugA.setShow(true);
                    setModosResult(null);
                    setModoSel(null);
                    setRouteInfo(null);
                  }}
                  onFocus={() => sugA.items.length > 0 && sugA.setShow(true)}
                  onBlur={() => setTimeout(() => sugA.setShow(false), 150)}
                  placeholder="Desde — dirección de origen"
                  className={`w-full rounded-xl border py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent ${
                    coordsA ? "border-accent/50 bg-accent/10" : "border-line bg-panel-soft"
                  }`}
                />
                <button
                  type="submit"
                  aria-label="Buscar origen"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-muted transition hover:text-accent"
                >
                  {geocodingA ? (
                    <span className="block h-4 w-4 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
                  ) : coordsA ? (
                    <span className="text-accent">✓</span>
                  ) : (
                    "🔍"
                  )}
                </button>
              </form>
              {sugA.show && (
                <SugDropdown
                  items={sugA.items}
                  onSelect={(s) => {
                    setTextA(s);
                    sugA.lock();
                    sugA.setShow(false);
                    setModosResult(null);
                    setModoSel(null);
                    setRouteInfo(null);
                    geocodearA(s);
                  }}
                />
              )}
            </div>

            {/* Swap button — right aligned */}
            <div className="flex justify-end">
              <button
                onClick={swapAB}
                title="Intercambiar origen y destino"
                className="rounded-lg border border-line px-3 py-1 text-sm text-muted transition hover:border-accent hover:text-accent"
              >
                ⇅
              </button>
            </div>

            {/* Dirección B */}
            <div className="relative">
              <form onSubmit={submitB}>
                <input
                  value={textB}
                  onChange={(e) => {
                    setTextB(e.target.value);
                    setCoordsB(null);
                    sugB.setShow(true);
                    setModosResult(null);
                    setModoSel(null);
                    setRouteInfo(null);
                  }}
                  onFocus={() => sugB.items.length > 0 && sugB.setShow(true)}
                  onBlur={() => setTimeout(() => sugB.setShow(false), 150)}
                  placeholder="Hasta — dirección de destino"
                  className={`w-full rounded-xl border py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent ${
                    coordsB ? "border-accent/50 bg-accent/10" : "border-line bg-panel-soft"
                  }`}
                />
                <button
                  type="submit"
                  aria-label="Buscar destino"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-muted transition hover:text-accent"
                >
                  {geocodingB ? (
                    <span className="block h-4 w-4 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
                  ) : coordsB ? (
                    <span className="text-accent">✓</span>
                  ) : (
                    "🔍"
                  )}
                </button>
              </form>
              {sugB.show && (
                <SugDropdown
                  items={sugB.items}
                  onSelect={(s) => {
                    setTextB(s);
                    sugB.lock();
                    sugB.setShow(false);
                    setModosResult(null);
                    setModoSel(null);
                    setRouteInfo(null);
                    geocodearB(s);
                  }}
                />
              )}
            </div>

            {routeErr && <p className="text-xs text-amber-400">{routeErr}</p>}

            {calculando && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted">
                <span className="block h-4 w-4 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
                Calculando…
              </div>
            )}

            {/* Modo cards */}
            {modosResult && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {modosResult.map((m, idx) => {
                    const selected = modoSel === m.id;
                    const isFirst = idx === 0;
                    return (
                      <button
                        key={m.id}
                        onClick={() => seleccionarModo(m)}
                        className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-center transition ${
                          selected
                            ? "border-accent bg-accent/15"
                            : "border-line bg-panel-soft hover:border-accent/40"
                        }`}
                      >
                        {isFirst && !modoSel && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">
                            Más rápido
                          </span>
                        )}
                        <span className="text-xl">{m.emoji}</span>
                        <span className="text-xs font-semibold text-ink">{m.label}</span>
                        <span className={`text-xs font-bold ${selected ? "text-accent" : "text-muted"}`}>
                          ~{m.minutos} min
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Step-by-step */}
                {modoSel && routeInfo && (
                  <div className="animate-fade-up mt-1 rounded-xl border border-line bg-panel-soft p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Paso a paso
                    </p>
                    {fetchingTransit ? (
                      <div className="flex items-center gap-2 py-1 text-xs text-muted">
                        <span className="block h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
                        Buscando estaciones…
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {(
                          transitSteps ??
                          generarPasos(modoSel, routeInfo.distKm, routeInfo.walkMin, routeInfo.steps)
                        ).map((p, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 text-base leading-none">{p.icono}</span>
                            <span className="flex-1 text-xs leading-snug text-ink">{p.texto}</span>
                            {p.duracion > 0 && (
                              <span className="shrink-0 text-[10px] font-semibold text-muted">
                                {p.duracion}m
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={limpiarRuta}
                  className="mt-1 rounded-xl border border-line py-1.5 text-xs font-medium text-muted transition hover:border-red-400/40 hover:text-red-400"
                >
                  Borrar ruta
                </button>
              </>
            )}

            {!coordsA && !coordsB && !modosResult && (
              <p className="text-xs text-muted">
                Ingresá origen y destino para ver las opciones de viaje.
              </p>
            )}
          </div>

          {/* ── Capas del mapa (colapsable) ── */}
          <div className="mb-2 mt-5">
            <button
              onClick={() => setCapasAbiertas((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted transition hover:text-ink"
            >
              <span>Capas del mapa</span>
              <span className="text-sm leading-none">{capasAbiertas ? "▲" : "▼"}</span>
            </button>
          </div>
          {capasAbiertas && (
            <div className="flex flex-col gap-1.5">
              {LAYERS.map((l) => {
                const on = visibility[l.key];
                return (
                  <button
                    key={l.key}
                    onClick={() => onToggle(l.key)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      on
                        ? "border-line bg-panel-soft"
                        : "border-transparent bg-panel-soft/40 hover:bg-panel-soft"
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                      style={{ background: on ? `${l.color}22` : "transparent" }}
                    >
                      {l.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-ink">{l.label}</span>
                        {l.kind === "live" && (
                          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Vivo
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted">{l.description}</span>
                    </span>
                    <span
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                        on ? "bg-accent" : "bg-line"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                          on ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Filtro de colectivos */}
          {visibility.colectivos && (
            <div className="animate-fade-up mt-2">
              <input
                value={colectivosFiltro}
                onChange={(e) => onColectivosFiltro(e.target.value)}
                placeholder="Filtrar colectivos por línea — ej: 152"
                className="w-full rounded-xl border border-line bg-panel-soft px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              />
            </div>
          )}

          {/* ── Estado del subte (colapsable) ── */}
          <div className="mt-5 flex items-center gap-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Estado del subte
            </h2>
            <button
              onClick={() => setSubteAbierto((v) => !v)}
              aria-label="Toggle estado subte"
              className="rounded p-0.5 text-muted transition hover:text-ink"
            >
              <span className="text-sm leading-none">{subteAbierto ? "▲" : "▼"}</span>
            </button>
          </div>
          {subteAbierto && (
            <div className="mt-2">
              <SubteStatus />
            </div>
          )}

          {/* ── Estado del tren (colapsable) ── */}
          <div className="mt-4 flex items-center gap-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Estado del tren
            </h2>
            <button
              onClick={() => setTrenAbierto((v) => !v)}
              aria-label="Toggle estado tren"
              className="rounded p-0.5 text-muted transition hover:text-ink"
            >
              <span className="text-sm leading-none">{trenAbierto ? "▲" : "▼"}</span>
            </button>
          </div>
          {trenAbierto && (
            <div className="mt-2">
              <TrenStatus />
            </div>
          )}

          {/* Mis domicilios */}
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
            Mis domicilios
          </h2>
          {userEmail ? (
            <div className="flex flex-col gap-1.5">
              {favoritos.length === 0 && (
                <p className="text-xs text-muted">
                  Todavía no guardaste domicilios. Agregá tu casa o trabajo para
                  tenerlos siempre a mano.
                </p>
              )}
              {favoritos.map((f) => (
                <div
                  key={f.id}
                  className="group flex items-center gap-2 rounded-xl border border-line bg-panel-soft px-3 py-2"
                >
                  <button
                    onClick={() => onFlyTo(f.lng, f.lat)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-semibold text-ink">⭐ {f.label}</div>
                    {f.address && (
                      <div className="truncate text-xs text-muted">{f.address}</div>
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteFav(f.id)}
                    aria-label="Eliminar"
                    className="rounded-lg px-2 py-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    🗑
                  </button>
                </div>
              ))}
              <button
                onClick={onStartPlacing}
                className="mt-1 rounded-xl border border-dashed border-line py-2 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent/10"
              >
                + Agregar domicilio
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-panel-soft p-3">
              <p className="text-xs text-muted">
                Iniciá sesión para guardar tus domicilios favoritos y acceder
                rápido a tus recorridos.
              </p>
              <Link
                href="/login"
                className="mt-2 block rounded-lg bg-accent py-2 text-center text-sm font-semibold text-black transition hover:brightness-110"
              >
                Ingresar
              </Link>
            </div>
          )}
        </div>

        {/* Footer / cuenta */}
        <div className="border-t border-line px-4 py-3">
          {userEmail ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                {userEmail[0]?.toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{userEmail}</span>
              <button
                onClick={onSignOut}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:text-ink"
              >
                Salir
              </button>
            </div>
          ) : (
            <p className="text-center text-[11px] text-muted">
              Datos abiertos del GCBA · Podés usar el mapa sin cuenta
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
