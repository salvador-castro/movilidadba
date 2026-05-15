/**
 * Helper server-side para la API Unificada de Transporte del GCBA.
 * Mantiene las credenciales fuera del navegador, corta cada intento con un
 * timeout y reintenta ante el error intermitente del proxy del GCBA.
 */
const BASE = "https://apitransporte.buenosaires.gob.ar";

export class TransporteError extends Error {}

interface Opciones {
  /** Cantidad de intentos totales. */
  retries?: number;
  /** Timeout por intento, en ms. */
  timeoutMs?: number;
}

export async function fetchTransporte<T = unknown>(
  path: string,
  params: Record<string, string> = {},
  { retries = 3, timeoutMs = 12000 }: Opciones = {},
): Promise<T> {
  const clientId = process.env.TRANSPORTE_CLIENT_ID;
  const clientSecret = process.env.TRANSPORTE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new TransporteError(
      "Faltan TRANSPORTE_CLIENT_ID / TRANSPORTE_CLIENT_SECRET en el entorno.",
    );
  }

  const search = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    ...params,
  });
  const url = `${BASE}/${path}?${search.toString()}`;

  let lastError: unknown;
  for (let intento = 1; intento <= retries; intento++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      const text = await res.text();

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new TransporteError(`Respuesta no-JSON (HTTP ${res.status})`);
      }

      // El proxy del GCBA falla de forma intermitente: { message: "Proxy: ..." }
      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message: unknown }).message === "string" &&
        (data as { message: string }).message.includes("Proxy")
      ) {
        throw new TransporteError((data as { message: string }).message);
      }

      if (!res.ok) {
        throw new TransporteError(`HTTP ${res.status}`);
      }

      return data as T;
    } catch (err) {
      lastError = err;
      if (intento < retries) {
        await new Promise((r) => setTimeout(r, 400 * intento));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new TransporteError("Error desconocido");
}
