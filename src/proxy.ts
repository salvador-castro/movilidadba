import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

// Next.js 16: `middleware` paso a llamarse `proxy`. Corre en runtime nodejs.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto estaticos e imagenes:
     * - _next/static, _next/image
     * - favicon, archivos de imagen
     * - /datasets (GeoJSON estaticos)
     */
    "/((?!_next/static|_next/image|favicon.ico|datasets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
