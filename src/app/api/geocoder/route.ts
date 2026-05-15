import { NextResponse, type NextRequest } from "next/server";
import { estaEnCaba } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NORMALIZADOR = "https://servicios.usig.buenosaires.gob.ar/normalizar";
const REVERSE =
  "https://datosabiertos-usig-apis.buenosaires.gob.ar/geocoder/2.2/reversegeocoding";

interface DireccionNormalizada {
  cod_partido?: string;
  direccion?: string;
  coordenadas?: { x: string | number; y: string | number };
}
type UsigReverse = {
  puerta?: string;
  calle_alturas?: string;
  esquina?: string;
};

/** El geocoder USIG a veces envuelve la respuesta en parentesis: ({...}). */
function parseUsig<T>(text: string): T {
  let t = text.trim();
  if (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1);
  return JSON.parse(t) as T;
}

/**
 * Geocodificador (proxy del servicio USIG del GCBA).
 *  - Directo:  ?direccion=Av. Cabildo 1234   -> { label, lat, lng }
 *  - Inverso:  ?lat=-34.6&lng=-58.4          -> { label, lat, lng }
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const direccion = sp.get("direccion")?.trim();
  const lat = sp.get("lat");
  const lng = sp.get("lng");
  const sugerencias = sp.get("sugerencias")?.trim();

  try {
    // --- Sugerencias rápidas (sin geocodificar) ---
    if (sugerencias) {
      if (sugerencias.length < 3) return NextResponse.json({ resultados: [] });
      const res = await fetch(
        `${NORMALIZADOR}/?direccion=${encodeURIComponent(sugerencias)}&maxOptions=6`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        direccionesNormalizadas?: DireccionNormalizada[];
      };
      const resultados = (data.direccionesNormalizadas ?? [])
        .filter((d) => d.cod_partido === "caba" && d.direccion)
        .map((d) => d.direccion as string)
        .slice(0, 5);
      return NextResponse.json({ resultados });
    }

    // --- Inverso: coordenadas -> direccion legible ---
    if (lat && lng) {
      const res = await fetch(
        `${REVERSE}?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}`,
        { cache: "no-store" },
      );
      const raw = parseUsig<UsigReverse | UsigReverse[]>(await res.text());
      const item = Array.isArray(raw) ? raw[0] : raw;
      const label =
        item?.puerta ||
        item?.calle_alturas ||
        item?.esquina ||
        "Ubicacion sin direccion";
      return NextResponse.json({
        label,
        lat: Number(lat),
        lng: Number(lng),
      });
    }

    // --- Directo: el normalizador acepta texto libre y devuelve WGS84 ---
    if (direccion) {
      const res = await fetch(
        `${NORMALIZADOR}/?direccion=${encodeURIComponent(direccion)}&geocodificar=true`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        direccionesNormalizadas?: DireccionNormalizada[];
      };

      const enCaba = (data.direccionesNormalizadas ?? []).find(
        (d) => d.cod_partido === "caba" && d.coordenadas,
      );
      if (!enCaba?.coordenadas) {
        return NextResponse.json(
          { error: "No se encontro esa direccion en CABA" },
          { status: 404 },
        );
      }

      const wlng = Number(enCaba.coordenadas.x);
      const wlat = Number(enCaba.coordenadas.y);
      if (!estaEnCaba(wlng, wlat)) {
        return NextResponse.json(
          { error: "La direccion quedo fuera de CABA" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        label: enCaba.direccion ?? direccion,
        lat: wlat,
        lng: wlng,
      });
    }

    return NextResponse.json(
      { error: "Falta el parametro 'direccion' o 'lat'+'lng'" },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Error en el geocodificador", detail: String(err) },
      { status: 502 },
    );
  }
}
