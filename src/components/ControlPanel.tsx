"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LAYERS } from "@/lib/layers";
import type { Favorito, LayerKey, LayerVisibility } from "@/lib/types";
import SubteStatus from "./SubteStatus";

type RouteGeometry = { type: "LineString"; coordinates: [number, number][] };

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
}

async function fetchSugs(text: string): Promise<string[]> {
  if (text.length < 3) return [];
  try {
    const res = await fetch(
      `/api/geocoder?sugerencias=${encodeURIComponent(text)}`,
    );
    const data = await res.json() as { resultados?: string[] };
    return data.resultados ?? [];
  } catch {
    return [];
  }
}

async function geocodeAddr(
  addr: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `/api/geocoder?direccion=${encodeURIComponent(addr)}`,
    );
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

  useEffect(() => {
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

  return { items, show, setShow };
}

function SugDropdown({
  items,
  onSelect,
}: {
  items: string[];
  onSelect: (s: string) => void;
}) {
  if (!items.length) return null;
  return (
    <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-panel-soft shadow-xl">
      {items.map((s, i) => (
        <li key={i}>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(s);
            }}
            className="w-full px-3 py-2 text-left text-sm text-ink transition hover:bg-panel-soft"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
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
}: Props) {
  const [abierto, setAbierto] = useState(true);
  const [capasAbiertas, setCapasAbiertas] = useState(false);

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
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [routeErr, setRouteErr] = useState<string | null>(null);
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

  async function calcularRuta() {
    if (!coordsA || !coordsB || calculando) return;
    setCalculando(true);
    setRouteErr(null);
    try {
      const res = await fetch(
        `/api/ruta?olng=${coordsA.lng}&olat=${coordsA.lat}&dlng=${coordsB.lng}&dlat=${coordsB.lat}`,
      );
      const data = await res.json() as {
        geometry?: RouteGeometry;
        distance?: number;
        duration?: number;
        error?: string;
      };
      if (!res.ok || !data.geometry) {
        setRouteErr(data.error ?? "No se pudo calcular la ruta.");
      } else {
        onRouteGeo(data.geometry);
        setRouteInfo({ distance: data.distance!, duration: data.duration! });
        // Fly to midpoint at zoom 13 to show the full route
        onFlyTo(
          (coordsA.lng + coordsB.lng) / 2,
          (coordsA.lat + coordsB.lat) / 2,
          13,
        );
      }
    } catch {
      setRouteErr("Error de conexión al calcular la ruta.");
    } finally {
      setCalculando(false);
    }
  }

  function limpiarRuta() {
    setTextA("");
    setTextB("");
    setCoordsA(null);
    setCoordsB(null);
    setRouteInfo(null);
    setRouteErr(null);
    onRouteGeo(null);
  }

  const distKm = routeInfo ? (routeInfo.distance / 1000).toFixed(1) : null;
  const durMin = routeInfo ? Math.round(routeInfo.duration / 60) : null;

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
            style={{
              background:
                "linear-gradient(135deg,var(--color-accent),var(--color-accent-2))",
            }}
          >
            🚇
          </div>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold leading-tight text-ink">
              Movilidad BA
            </h1>
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
                placeholder="Buscar dirección — ej: Av. Cabildo 1234"
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
              <SugDropdown
                items={sugSearch.items}
                onSelect={seleccionarSugSearch}
              />
            )}
          </div>
          {msg && <p className="mt-1.5 text-xs text-amber-400">{msg}</p>}

          {/* Resultado de búsqueda */}
          {searchResult && (
            <div className="animate-fade-up mt-2 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
              <span className="text-base">🎯</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {searchResult.label}
              </span>
              <button
                onClick={onClearSearch}
                aria-label="Borrar búsqueda"
                className="shrink-0 rounded-lg px-1.5 py-1 text-muted transition hover:text-red-400"
                title="Borrar dirección"
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
                  }}
                  onFocus={() => sugA.items.length > 0 && sugA.setShow(true)}
                  onBlur={() => setTimeout(() => sugA.setShow(false), 150)}
                  placeholder="Desde — dirección de origen"
                  className={`w-full rounded-xl border py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent ${
                    coordsA
                      ? "border-accent/50 bg-accent/10"
                      : "border-line bg-panel-soft"
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
                    sugA.setShow(false);
                    geocodearA(s);
                  }}
                />
              )}
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
                  }}
                  onFocus={() => sugB.items.length > 0 && sugB.setShow(true)}
                  onBlur={() => setTimeout(() => sugB.setShow(false), 150)}
                  placeholder="Hasta — dirección de destino"
                  className={`w-full rounded-xl border py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent ${
                    coordsB
                      ? "border-accent/50 bg-accent/10"
                      : "border-line bg-panel-soft"
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
                    sugB.setShow(false);
                    geocodearB(s);
                  }}
                />
              )}
            </div>

            {routeErr && <p className="text-xs text-amber-400">{routeErr}</p>}

            {coordsA && coordsB && !routeInfo && (
              <button
                onClick={calcularRuta}
                disabled={calculando}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
              >
                {calculando && (
                  <span className="block h-4 w-4 animate-spin-slow rounded-full border-2 border-black/30 border-t-black" />
                )}
                {calculando ? "Calculando…" : "Ver ruta"}
              </button>
            )}

            {routeInfo && (
              <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
                <span className="text-base">🗺️</span>
                <div className="flex-1 text-sm text-ink">
                  <span className="font-semibold">{distKm} km</span>
                  <span className="mx-1.5 text-muted">·</span>
                  <span className="text-muted">{durMin} min</span>
                </div>
                <button
                  onClick={limpiarRuta}
                  className="shrink-0 rounded-lg px-1.5 py-1 text-muted transition hover:text-red-400"
                  title="Borrar ruta"
                >
                  ✕
                </button>
              </div>
            )}

            {!coordsA && !coordsB && !routeInfo && (
              <p className="text-xs text-muted">
                Ingresá origen y destino para trazar la ruta en el mapa.
              </p>
            )}
          </div>

          {/* ── Capas del mapa (colapsable) ── */}
          <button
            onClick={() => setCapasAbiertas((v) => !v)}
            className="mb-2 mt-5 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted transition hover:text-ink"
          >
            <span>Capas del mapa</span>
            <span className="text-base leading-none">{capasAbiertas ? "▲" : "▼"}</span>
          </button>
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
                        <span className="text-sm font-semibold text-ink">
                          {l.label}
                        </span>
                        {l.kind === "live" && (
                          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Vivo
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {l.description}
                      </span>
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

          {/* Estado del subte */}
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
            Estado del subte
          </h2>
          <SubteStatus />

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
                    <div className="truncate text-sm font-semibold text-ink">
                      ⭐ {f.label}
                    </div>
                    {f.address && (
                      <div className="truncate text-xs text-muted">
                        {f.address}
                      </div>
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
              <span className="min-w-0 flex-1 truncate text-xs text-muted">
                {userEmail}
              </span>
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
