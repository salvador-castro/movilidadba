"use client";

import { useEffect, useState } from "react";

interface Props {
  point: { lng: number; lat: number };
  /** Etiqueta sugerida (ej: nombre de la estacion clickeada). */
  sugerido?: string;
  onCancel: () => void;
  onSave: (label: string, address: string) => Promise<void>;
}

const ATAJOS = ["🏠 Casa", "💼 Trabajo", "📚 Estudio", "❤️ Familia"];

export default function SaveFavModal({
  point,
  sugerido,
  onCancel,
  onSave,
}: Props) {
  const [label, setLabel] = useState(sugerido ?? "");
  const [address, setAddress] = useState("");
  const [cargandoDir, setCargandoDir] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Geocodificacion inversa para sugerir la direccion.
  useEffect(() => {
    let activo = true;
    fetch(`/api/geocoder?lat=${point.lat}&lng=${point.lng}`)
      .then((r) => r.json())
      .then((d) => {
        if (activo && d.label) setAddress(d.label);
      })
      .catch(() => {})
      .finally(() => activo && setCargandoDir(false));
    return () => {
      activo = false;
    };
  }, [point]);

  async function submit() {
    if (!label.trim() || guardando) return;
    setGuardando(true);
    try {
      await onSave(label.trim(), address.trim());
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="glass animate-fade-up w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-ink">Guardar domicilio</h3>
        <p className="mt-1 text-sm text-muted">
          {cargandoDir
            ? "Buscando la dirección…"
            : "Poné un nombre para encontrarlo rápido."}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ATAJOS.map((a) => (
            <button
              key={a}
              onClick={() => setLabel(a)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                label === a
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line bg-panel-soft text-muted hover:text-ink"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs font-medium text-muted">
          Nombre
        </label>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Casa, Trabajo, Gimnasio…"
          className="mt-1 w-full rounded-xl border border-line bg-panel-soft px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        <label className="mt-3 block text-xs font-medium text-muted">
          Dirección
        </label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Dirección aproximada"
          className="mt-1 w-full rounded-xl border border-line bg-panel-soft px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!label.trim() || guardando}
            className="flex-1 rounded-xl bg-accent py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
