import { NextResponse } from "next/server";
import { fetchTransporte } from "@/lib/transporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Alert {
  alert?: {
    informed_entity?: { route_id?: string }[];
    header_text?: { translation?: { text?: string; language?: string }[] };
    description_text?: { translation?: { text?: string; language?: string }[] };
  };
}

function textoEs(t?: { translation?: { text?: string; language?: string }[] }) {
  if (!t?.translation?.length) return "";
  const es = t.translation.find((x) => x.language === "es");
  return (es ?? t.translation[0]).text ?? "";
}

/** Estado del servicio de subte: alertas por linea. */
export async function GET() {
  try {
    const data = await fetchTransporte<{ entity?: Alert[] }>(
      "subtes/serviceAlerts",
      { json: "1" },
    );

    const lineas = (data.entity ?? [])
      .map((e) => {
        const routeId =
          e.alert?.informed_entity?.[0]?.route_id?.replace("Linea", "") ?? "";
        return {
          linea: routeId,
          titulo: textoEs(e.alert?.header_text),
          detalle: textoEs(e.alert?.description_text),
        };
      })
      .filter((l) => l.linea && l.titulo);

    return NextResponse.json(
      { lineas },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo obtener el estado del subte", detail: String(err) },
      { status: 502 },
    );
  }
}
