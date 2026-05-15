import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy para calcular una ruta entre dos puntos usando OSRM.
 * ?olng=&olat=&dlng=&dlat=
 * Devuelve: { geometry: LineString, distance: metros, duration: segundos }
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const olng = sp.get("olng");
  const olat = sp.get("olat");
  const dlng = sp.get("dlng");
  const dlat = sp.get("dlat");

  if (!olng || !olat || !dlng || !dlat) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const mode = sp.get("mode") ?? "foot";
  const url =
    `https://router.project-osrm.org/route/v1/${mode}/` +
    `${olng},${olat};${dlng},${dlat}?overview=full&geometries=geojson`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        geometry: { type: "LineString"; coordinates: [number, number][] };
        distance: number;
        duration: number;
      }>;
    };

    if (data.code !== "Ok" || !data.routes?.length) {
      return NextResponse.json({ error: "No se encontró ruta" }, { status: 404 });
    }

    const route = data.routes[0];
    return NextResponse.json({
      geometry: route.geometry,
      distance: Math.round(route.distance),
      duration: Math.round(route.duration),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al calcular la ruta", detail: String(err) },
      { status: 502 },
    );
  }
}
