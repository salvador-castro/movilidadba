import { NextResponse } from "next/server";
import { fetchTransporte } from "@/lib/transporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface GbfsStation {
  station_id: string;
  name: string;
  address?: string;
  capacity?: number;
  lat: number;
  lon: number;
}
interface GbfsStatus {
  station_id: string;
  num_bikes_available: number;
  num_bikes_available_types?: { mechanical?: number; ebike?: number };
  num_docks_available: number;
  status: string;
  is_renting: number;
}

/** Devuelve las estaciones de EcoBici como GeoJSON con disponibilidad en vivo. */
export async function GET() {
  try {
    const [info, status] = await Promise.all([
      fetchTransporte<{ data: { stations: GbfsStation[] } }>(
        "ecobici/gbfs/stationInformation",
      ),
      fetchTransporte<{ data: { stations: GbfsStatus[] } }>(
        "ecobici/gbfs/stationStatus",
      ),
    ]);

    const statusById = new Map(
      status.data.stations.map((s) => [s.station_id, s]),
    );

    const features = info.data.stations
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
      .map((s) => {
        const st = statusById.get(s.station_id);
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [s.lon, s.lat],
          },
          properties: {
            id: s.station_id,
            name: s.name,
            address: s.address ?? "",
            capacity: s.capacity ?? 0,
            bikes: st?.num_bikes_available ?? 0,
            mechanical: st?.num_bikes_available_types?.mechanical ?? 0,
            ebikes: st?.num_bikes_available_types?.ebike ?? 0,
            docks: st?.num_docks_available ?? 0,
            renting: st?.is_renting ?? 0,
            offline: st?.status !== "IN_SERVICE",
          },
        };
      });

    return NextResponse.json(
      { type: "FeatureCollection", features },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo obtener EcoBici", detail: String(err) },
      { status: 502 },
    );
  }
}
