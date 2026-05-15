"use client";

import { useState } from "react";
import Link from "next/link";
import { LAYERS } from "@/lib/layers";
import type { Favorito, LayerKey, LayerVisibility } from "@/lib/types";
import SubteStatus from "./SubteStatus";

interface RoutePoint {
  text: string;
  coords: { lat: number; lng: number } | null;
}

interface Props {
  visibility: LayerVisibility;
  onToggle: (key: LayerKey) => void;
  colectivosFiltro: string;
  onColectivosFiltro: (v: string) => void;
  userEmail: string | null;
  favoritos: Favorito[];
  onSearch: (direccion: string) => Promise<{ ok: boolean; message?: string }>;
  onFlyTo: (lng: number, lat: number) => void;
  onDeleteFav: (id: string) => void;
  onStartPlacing: () => void;
  onSignOut: () => void;
  searchResult: { lng: number; lat: number; label: string } | null;
  onClearSearch: () => void;
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
}: Props) {
  const [abierto, setAbierto] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [capasAbiertas, setCapasAbiertas] = useState(false);

  // Route A -> B
  const [routeA, setRouteA] = useState<RoutePoint>({ text: "", coords: null });
  const [routeB, setRouteB] = useState<RoutePoint>({ text: "", coords: null });
  const [geocodingA, setGeocodingA] = useState(false);
  const [geocodingB, setGeocodingB] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!busqueda.trim() || buscando) return;
    setBuscando(true);
    setMsg(null);
    const r = await onSearch(busqueda.trim());
    setBuscando(false);
    if (!r.ok) setMsg(r.message ?? "No se encontró la dirección.");
  }

  async function geocodeAddr(addr: string): Promise<{ lat: number; lng: number; label: string } | null> {
    try {
      const res = await fetch(`/api/geocoder?direccion=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (!res.ok) return null;
      return { lat: data.lat, lng: data.lng, label: data.label };
    } catch {
      return null;
    }
  }

  async function buscarRutaA(e: React.FormEvent) {
    e.preventDefault();
    if (!routeA.text.trim() || geocodingA) return;
    setGeocodingA(true);
    setRouteError(null);
    const coords = await geocodeAddr(routeA.text.trim());
    setGeocodingA(false);
    if (coords) {
      setRouteA((prev) => ({ ...prev, coords }));
      onFlyTo(coords.lng, coords.lat);
    } else {
      setRouteError("No se encontró la dirección de origen.");
    }
  }

  async function buscarRutaB(e: React.FormEvent) {
    e.preventDefault();
    if (!routeB.text.trim() || geocodingB) return;
    setGeocodingB(true);
    setRouteError(null);
    const coords = await geocodeAddr(routeB.text.trim());
    setGeocodingB(false);
    if (coords) {
      setRouteB((prev) => ({ ...prev, coords }));
      onFlyTo(coords.lng, coords.lat);
    } else {
      setRouteError("No se encontró la dirección de destino.");
    }
  }

  const routeUrl =
    routeA.coords && routeB.coords
      ? `https://www.google.com/maps/dir/${routeA.coords.lat},${routeA.coords.lng}/${routeB.coords.lat},${routeB.coords.lng}`
      : null;

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
          {/* Busqueda */}
          <form onSubmit={buscar} className="relative">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
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
          {msg && <p className="mt-1.5 text-xs text-amber-400">{msg}</p>}

          {/* Resultado de busqueda */}
          {searchResult && (
            <div className="animate-fade-up mt-2 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
              <span className="text-base">🎯</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {searchResult.label}
              </span>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${searchResult.lat},${searchResult.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-accent/20 px-2 py-1 text-xs font-semibold text-accent transition hover:bg-accent/30"
                title="Cómo llegar"
              >
                Cómo llegar
              </a>
              <button
                onClick={onClearSearch}
                aria-label="Borrar búsqueda"
                className="shrink-0 rounded-lg px-1.5 py-1 text-muted transition hover:text-red-400"
              >
                ✕
              </button>
            </div>
          )}

          {/* Ruta A → B */}
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
            🗺️ Cómo llegar
          </h2>
          <div className="flex flex-col gap-1.5">
            <form onSubmit={buscarRutaA} className="relative">
              <input
                value={routeA.text}
                onChange={(e) => setRouteA({ text: e.target.value, coords: null })}
                placeholder="Desde — dirección de origen"
                className={`w-full rounded-xl border py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent ${
                  routeA.coords ? "border-accent/50 bg-accent/10" : "border-line bg-panel-soft"
                }`}
              />
              <button
                type="submit"
                aria-label="Buscar origen"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-muted transition hover:text-accent"
              >
                {geocodingA ? (
                  <span className="block h-4 w-4 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
                ) : routeA.coords ? (
                  "✓"
                ) : (
                  "🔍"
                )}
              </button>
            </form>

            <form onSubmit={buscarRutaB} className="relative">
              <input
                value={routeB.text}
                onChange={(e) => setRouteB({ text: e.target.value, coords: null })}
                placeholder="Hasta — dirección de destino"
                className={`w-full rounded-xl border py-2.5 pl-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-accent ${
                  routeB.coords ? "border-accent/50 bg-accent/10" : "border-line bg-panel-soft"
                }`}
              />
              <button
                type="submit"
                aria-label="Buscar destino"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-muted transition hover:text-accent"
              >
                {geocodingB ? (
                  <span className="block h-4 w-4 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
                ) : routeB.coords ? (
                  "✓"
                ) : (
                  "🔍"
                )}
              </button>
            </form>

            {routeError && <p className="text-xs text-amber-400">{routeError}</p>}

            {routeUrl ? (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-accent py-2 text-center text-sm font-semibold text-black transition hover:brightness-110"
              >
                Ver ruta en Google Maps
              </a>
            ) : (
              <p className="text-xs text-muted">
                Ingresá origen y destino para calcular la ruta.
              </p>
            )}
          </div>

          {/* Capas del mapa (colapsable) */}
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
                      style={{
                        background: on ? `${l.color}22` : "transparent",
                      }}
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

          {/* Domicilios favoritos */}
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
