import { NextResponse, type NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StationFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

function haversineDist(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkMin(km: number): number {
  return Math.max(1, Math.round(km * 12));
}

function nearest(
  stations: StationFeature[],
  lng: number,
  lat: number,
): { st: StationFeature; km: number } {
  let best = stations[0];
  let bestKm = Infinity;
  for (const s of stations) {
    const [slng, slat] = s.geometry.coordinates;
    const d = haversineDist(lng, lat, slng, slat);
    if (d < bestKm) {
      bestKm = d;
      best = s;
    }
  }
  return { st: best, km: bestKm };
}

function stationName(st: StationFeature): string {
  const p = st.properties;
  return String(p.estacion ?? p.nombre ?? "parada");
}

function lineLabel(st: StationFeature): string {
  return String(st.properties.linea ?? "");
}

// For subte: find the closest pair of stations from two different lines (transfer point).
function findTransfer(
  stations: StationFeature[],
  lineA: string,
  lineB: string,
): { ta: StationFeature; tb: StationFeature } | null {
  const stA = stations.filter((s) => lineLabel(s) === lineA);
  const stB = stations.filter((s) => lineLabel(s) === lineB);
  let bestDist = Infinity;
  let ta = stA[0];
  let tb = stB[0];
  for (const a of stA) {
    for (const b of stB) {
      const d = haversineDist(
        a.geometry.coordinates[0],
        a.geometry.coordinates[1],
        b.geometry.coordinates[0],
        b.geometry.coordinates[1],
      );
      if (d < bestDist) {
        bestDist = d;
        ta = a;
        tb = b;
      }
    }
  }
  // Consider it a real transfer only if stations are within 450m
  return bestDist <= 0.45 ? { ta, tb } : null;
}

interface Paso {
  icono: string;
  texto: string;
  duracion: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const olng = parseFloat(sp.get("olng") ?? "");
  const olat = parseFloat(sp.get("olat") ?? "");
  const dlng = parseFloat(sp.get("dlng") ?? "");
  const dlat = parseFloat(sp.get("dlat") ?? "");
  const mode = sp.get("mode") ?? "subte";

  if (!isFinite(olng) || !isFinite(olat) || !isFinite(dlng) || !isFinite(dlat)) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const ds = path.join(process.cwd(), "public", "datasets");
  const file =
    mode === "subte"
      ? path.join(ds, "subte", "estaciones_de_subte.geojson")
      : mode === "trenes"
        ? path.join(ds, "trenes", "estaciones_ferroviarias.geojson")
        : null;

  if (!file) {
    return NextResponse.json({ error: "Modo no soportado" }, { status: 400 });
  }

  try {
    const geojson = JSON.parse(fs.readFileSync(file, "utf8")) as {
      features: StationFeature[];
    };
    const stations = geojson.features.filter(
      (f) => f.geometry?.type === "Point",
    );

    const { st: stA, km: kmA } = nearest(stations, olng, olat);
    const { st: stB, km: kmB } = nearest(stations, dlng, dlat);

    const nameA = stationName(stA);
    const nameB = stationName(stB);
    const lineA = lineLabel(stA);
    const lineB = lineLabel(stB);
    const toMin = walkMin(kmA);
    const fromMin = walkMin(kmB);

    const steps: Paso[] = [];

    steps.push({
      icono: "🚶",
      texto: `Caminar ${toMin} min hasta ${nameA}`,
      duracion: toMin,
    });

    if (mode === "subte") {
      const lineALabel = `Línea ${lineA}`;
      if (lineA === lineB) {
        const legDist = haversineDist(
          stA.geometry.coordinates[0],
          stA.geometry.coordinates[1],
          stB.geometry.coordinates[0],
          stB.geometry.coordinates[1],
        );
        const legMin = Math.max(3, Math.round(legDist * 2.5));
        steps.push({
          icono: "🚇",
          texto: `Tomar ${lineALabel} hasta ${nameB}`,
          duracion: legMin,
        });
      } else {
        const transfer = findTransfer(stations, lineA, lineB);
        if (transfer) {
          const tNameA = stationName(transfer.ta);
          const tNameB = stationName(transfer.tb);
          const leg1Dist = haversineDist(
            stA.geometry.coordinates[0],
            stA.geometry.coordinates[1],
            transfer.ta.geometry.coordinates[0],
            transfer.ta.geometry.coordinates[1],
          );
          const leg2Dist = haversineDist(
            transfer.tb.geometry.coordinates[0],
            transfer.tb.geometry.coordinates[1],
            stB.geometry.coordinates[0],
            stB.geometry.coordinates[1],
          );
          steps.push({
            icono: "🚇",
            texto: `Tomar Línea ${lineA} hasta ${tNameA}`,
            duracion: Math.max(2, Math.round(leg1Dist * 2.5)),
          });
          steps.push({
            icono: "🔄",
            texto: `Combinar en ${tNameB} con Línea ${lineB}`,
            duracion: 3,
          });
          steps.push({
            icono: "🚇",
            texto: `Tomar Línea ${lineB} hasta ${nameB}`,
            duracion: Math.max(2, Math.round(leg2Dist * 2.5)),
          });
        } else {
          const legDist = haversineDist(
            stA.geometry.coordinates[0],
            stA.geometry.coordinates[1],
            stB.geometry.coordinates[0],
            stB.geometry.coordinates[1],
          );
          steps.push({
            icono: "🚇",
            texto: `Tomar Línea ${lineA} y combinar con Línea ${lineB} hacia ${nameB}`,
            duracion: Math.max(5, Math.round(legDist * 2.5)),
          });
        }
      }
    } else {
      // Tren
      const cleanLine = String(stA.properties.linea ?? "")
        .split(",")[0]
        .trim();
      const ramal = String(stA.properties.ramal ?? "");
      const ramalShort = ramal ? ` — ramal ${ramal.split(" / ")[0].split(" - ")[0]}` : "";
      const legDist = haversineDist(
        stA.geometry.coordinates[0],
        stA.geometry.coordinates[1],
        stB.geometry.coordinates[0],
        stB.geometry.coordinates[1],
      );
      steps.push({
        icono: "🚂",
        texto: `Tomar ${cleanLine}${ramalShort} hasta ${nameB}`,
        duracion: Math.max(5, Math.round(legDist * 1.8)),
      });
    }

    steps.push({
      icono: "🚶",
      texto: `Caminar ${fromMin} min hasta el destino`,
      duracion: fromMin,
    });

    return NextResponse.json({ steps, stationA: nameA, stationB: nameB, lineA, lineB });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al buscar estaciones", detail: String(err) },
      { status: 500 },
    );
  }
}
