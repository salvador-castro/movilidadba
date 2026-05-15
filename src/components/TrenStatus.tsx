"use client";

import { useEffect, useState } from "react";

interface Alerta {
  linea: string;
  titulo: string;
  detalle: string;
}

const LINEAS: { id: string; label: string; color: string }[] = [
  { id: "Mitre", label: "Mitre", color: "#006eb6" },
  { id: "Sarmiento", label: "Sarmiento", color: "#b8520a" },
  { id: "SanMartin", label: "San Martín", color: "#2e7d32" },
  { id: "BelgranoN", label: "Belgrano N", color: "#c62828" },
  { id: "BelgranoS", label: "Belgrano S", color: "#555555" },
  { id: "Roca", label: "Roca", color: "#880e4f" },
  { id: "Urquiza", label: "Urquiza", color: "#6a1b9a" },
];

export default function TrenStatus() {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const res = await fetch("/api/transporte/trenes");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (activo) setAlertas(data.lineas ?? []);
      } catch {
        if (activo) setError(true);
      }
    }
    cargar();
    const t = setInterval(cargar, 90000);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, []);

  const datos = error ? [] : alertas;

  if (!datos) {
    return <p className="text-xs text-muted">Cargando…</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {LINEAS.map((l) => {
        const alerta = datos.find(
          (a) =>
            a.linea === l.id ||
            a.linea.toLowerCase().replace(/\s/g, "") ===
              l.id.toLowerCase().replace(/\s/g, ""),
        );
        return (
          <div
            key={l.id}
            className="flex items-center gap-2 rounded-lg border border-line bg-panel-soft px-2 py-1.5"
            title={alerta?.titulo ?? "Servicio normal"}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
              style={{ background: l.color }}
            >
              🚂
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-semibold text-ink">
                {l.label}
              </span>
              <span
                className={`block truncate text-[10px] ${
                  error ? "text-muted" : alerta ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {error ? "Sin datos" : alerta ? alerta.titulo : "Normal"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
