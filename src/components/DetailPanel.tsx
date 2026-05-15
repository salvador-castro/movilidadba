"use client";

import type { SeleccionMapa } from "@/lib/types";

interface Props {
  sel: SeleccionMapa;
  canSave: boolean;
  onClose: () => void;
  onSave: (lng: number, lat: number, label: string) => void;
}

export default function DetailPanel({ sel, canSave, onClose, onSave }: Props) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${sel.lat},${sel.lng}`;

  return (
    <div className="glass animate-fade-up pointer-events-auto absolute bottom-5 left-1/2 z-20 w-[min(92vw,380px)] -translate-x-1/2 rounded-2xl p-4 shadow-2xl md:left-[392px] md:translate-x-0">
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
        style={{ background: sel.color }}
      />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">
            {sel.title}
          </h3>
          {sel.subtitle && (
            <p className="mt-0.5 truncate text-sm text-muted">{sel.subtitle}</p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 rounded-lg px-2 py-1 text-muted transition hover:bg-panel-soft hover:text-ink"
        >
          ✕
        </button>
      </div>

      {sel.rows.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 pl-2">
          {sel.rows.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-line bg-panel-soft px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-muted">
                {r.label}
              </div>
              <div className="text-sm font-semibold text-ink">{r.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2 pl-2">
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-accent/15 py-2 text-center text-sm font-semibold text-accent transition hover:bg-accent/25"
        >
          Cómo llegar
        </a>
        {canSave && sel.kind !== "favorito" && (
          <button
            onClick={() => onSave(sel.lng, sel.lat, sel.title)}
            className="rounded-xl border border-line bg-panel-soft px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent/40"
            title="Guardar como favorito"
          >
            ⭐
          </button>
        )}
      </div>
    </div>
  );
}
