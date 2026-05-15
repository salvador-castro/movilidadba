import { NextResponse, type NextRequest } from "next/server";
import { fetchTransporte } from "@/lib/transporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La descarga completa de posiciones puede ser pesada: damos margen.
export const maxDuration = 30;

interface Vehiculo {
  route_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: number;
  id: string;
  direction: number;
  agency_name: string;
  route_short_name: string;
  trip_headsign: string;
}

/**
 * Posiciones de colectivos en vivo como GeoJSON.
 * Opcional `?linea=159` filtra por route_short_name.
 */
export async function GET(request: NextRequest) {
  const linea = request.nextUrl.searchParams.get("linea")?.trim().toLowerCase();

  try {
    const data = await fetchTransporte<Vehiculo[]>(
      "colectivos/vehiclePositionsSimple",
      {},
      { retries: 2, timeoutMs: 14000 },
    );

    const vehiculos = Array.isArray(data) ? data : [];
    const features = vehiculos
      .filter(
        (v) =>
          Number.isFinite(v.latitude) &&
          Number.isFinite(v.longitude) &&
          (!linea ||
            v.route_short_name?.trim().toLowerCase().startsWith(linea)),
      )
      .map((v) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [v.longitude, v.latitude],
        },
        properties: {
          id: v.id,
          linea: v.route_short_name ?? "?",
          destino: v.trip_headsign ?? "",
          empresa: v.agency_name ?? "",
          velocidad: Math.round(v.speed ?? 0),
        },
      }));

    return NextResponse.json(
      { type: "FeatureCollection", features, total: features.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo obtener colectivos", detail: String(err) },
      { status: 502 },
    );
  }
}
