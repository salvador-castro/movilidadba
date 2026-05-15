"use client";

import { useEffect, useState } from "react";
import { SUBTE_COLORS } from "@/lib/layers";

interface Alerta {
  linea: string;
  titulo: string;
  detalle: string;
}

const LINEAS = ["A", "B", "C", "D", "E", "H"];

export default function SubteStatus() {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const res = await fetch("/api/transporte/subte");
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
        const alerta = datos.find((a) => a.linea === l);
        return (
          <div
            key={l}
            className="flex items-center gap-2 rounded-lg border border-line bg-panel-soft px-2 py-1.5"
            title={alerta?.titulo ?? "Servicio normal"}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-black"
              style={{ background: SUBTE_COLORS[l] }}
            >
              {l}
            </span>
            <span
              className={`truncate text-[11px] ${
                error ? "text-muted" : alerta ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {error ? "Sin datos" : alerta ? alerta.titulo : "Normal"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
