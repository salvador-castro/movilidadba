"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { defaultVisibility } from "@/lib/layers";
import type { Favorito, LayerKey, SeleccionMapa } from "@/lib/types";
import ControlPanel from "@/components/ControlPanel";
import DetailPanel from "@/components/DetailPanel";
import SaveFavModal from "@/components/SaveFavModal";

// MapLibre solo corre en el navegador.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-line border-t-accent" />
        <p className="text-sm text-muted">Cargando el mapa…</p>
      </div>
    </div>
  ),
});

interface PendingFav {
  lng: number;
  lat: number;
  sugerido?: string;
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [visibility, setVisibility] = useState(defaultVisibility());
  const [colectivosFiltro, setColectivosFiltro] = useState("");
  const [sel, setSel] = useState<SeleccionMapa | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [placing, setPlacing] = useState(false);
  const [pendingFav, setPendingFav] = useState<PendingFav | null>(null);
  const [searchResult, setSearchResult] = useState<
    { lng: number; lat: number; label: string } | null
  >(null);
  const [flyTarget, setFlyTarget] = useState<{
    lng: number;
    lat: number;
    zoom?: number;
  } | null>(null);
  const [routeGeo, setRouteGeo] = useState<{
    type: "LineString";
    coordinates: [number, number][];
  } | null>(null);
  const [routePoints, setRoutePoints] = useState<{
    a: { lng: number; lat: number } | null;
    b: { lng: number; lat: number } | null;
  } | null>(null);
  const [routeColor, setRouteColor] = useState("#00d4ff");
  const [transitGeo, setTransitGeo] = useState<{
    type: "FeatureCollection";
    features: {
      type: "Feature";
      geometry: { type: "LineString"; coordinates: [number, number][] };
      properties: Record<string, unknown>;
    }[];
  } | null>(null);

  /* --- Sesion + favoritos --- */
  const cargarFavoritos = useCallback(async () => {
    const { data } = await supabase
      .from("favoritos")
      .select("*")
      .order("created_at", { ascending: false });
    setFavoritos((data as Favorito[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) cargarFavoritos();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) cargarFavoritos();
      else setFavoritos([]);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, cargarFavoritos]);

  /* --- Handlers --- */
  const toggleLayer = useCallback((key: LayerKey) => {
    setVisibility((v) => ({ ...v, [key]: !v[key] }));
  }, []);

  const buscarDireccion = useCallback(async (direccion: string) => {
    try {
      const res = await fetch(
        `/api/geocoder?direccion=${encodeURIComponent(direccion)}`,
      );
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.error as string };
      setSearchResult({ lng: data.lng, lat: data.lat, label: data.label });
      setFlyTarget({ lng: data.lng, lat: data.lat, zoom: 16 });
      return { ok: true };
    } catch {
      return { ok: false, message: "Error de conexión con el geocodificador." };
    }
  }, []);

  const flyTo = useCallback((lng: number, lat: number, zoom = 16) => {
    setFlyTarget({ lng, lat, zoom });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResult(null);
  }, []);

  const handlePick = useCallback((lng: number, lat: number) => {
    setPlacing(false);
    setPendingFav({ lng, lat });
  }, []);

  const guardarFavorito = useCallback(
    async (label: string, address: string) => {
      if (!pendingFav) return;
      await supabase.from("favoritos").insert({
        label,
        address: address || null,
        lng: pendingFav.lng,
        lat: pendingFav.lat,
      });
      setPendingFav(null);
      await cargarFavoritos();
    },
    [supabase, pendingFav, cargarFavoritos],
  );

  const eliminarFavorito = useCallback(
    async (id: string) => {
      await supabase.from("favoritos").delete().eq("id", id);
      await cargarFavoritos();
    },
    [supabase, cargarFavoritos],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return (
    <main className="fixed inset-0 overflow-hidden">
      <MapView
        visibility={visibility}
        colectivosFiltro={colectivosFiltro}
        favoritos={favoritos}
        placing={placing}
        pendingPick={pendingFav}
        searchResult={searchResult}
        flyTarget={flyTarget}
        routeGeo={routeGeo}
        routePoints={routePoints}
        routeColor={routeColor}
        transitGeo={transitGeo}
        onSelect={setSel}
        onPick={handlePick}
      />

      <div className="pointer-events-none absolute inset-0">
        <ControlPanel
          visibility={visibility}
          onToggle={toggleLayer}
          colectivosFiltro={colectivosFiltro}
          onColectivosFiltro={setColectivosFiltro}
          userEmail={user?.email ?? null}
          favoritos={favoritos}
          onSearch={buscarDireccion}
          onFlyTo={flyTo}
          onDeleteFav={eliminarFavorito}
          onStartPlacing={() => {
            setPlacing(true);
            setSel(null);
          }}
          onSignOut={signOut}
          searchResult={searchResult}
          onClearSearch={clearSearch}
          onRouteGeo={setRouteGeo}
          onSetRoutePoints={setRoutePoints}
          onSetRouteColor={setRouteColor}
          onSetTransitGeo={setTransitGeo}
        />

        {/* Banner de modo "colocar pin" */}
        {placing && (
          <div className="glass animate-fade-up pointer-events-auto absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 shadow-xl">
            <span className="text-sm text-ink">
              📍 Tocá el mapa para marcar tu domicilio
            </span>
            <button
              onClick={() => setPlacing(false)}
              className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Panel de detalle */}
        {sel && (
          <DetailPanel
            sel={sel}
            canSave={!!user}
            onClose={() => setSel(null)}
            onSave={(lng, lat, label) =>
              setPendingFav({ lng, lat, sugerido: label })
            }
          />
        )}
      </div>

      {/* Modal para guardar favorito */}
      {pendingFav && user && (
        <SaveFavModal
          point={{ lng: pendingFav.lng, lat: pendingFav.lat }}
          sugerido={pendingFav.sugerido}
          onCancel={() => setPendingFav(null)}
          onSave={guardarFavorito}
        />
      )}
    </main>
  );
}
