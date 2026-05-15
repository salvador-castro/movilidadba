# 🚇 Movilidad BA

Mapa interactivo y **unificado** del transporte de la Ciudad de Buenos Aires:
subte, colectivos, EcoBici, trenes, ciclovías y paradas de taxi — en un solo lugar.

- Se puede usar **sin iniciar sesión**.
- Con cuenta (email o Google) podés guardar **domicilios favoritos**.

## Stack

| Capa      | Tecnología                                   |
| --------- | -------------------------------------------- |
| Framework | Next.js 16 (App Router) + React 19 + TS      |
| Estilos   | Tailwind CSS v4                              |
| Mapa      | MapLibre GL + tiles de CARTO (sin token)     |
| Auth + DB | Supabase                                     |
| Deploy    | Vercel                                       |

El "backend" son las **API Routes** de Next.js (`src/app/api/...`): hacen de
proxy para no exponer credenciales al navegador.

## Fuentes de datos

- **API Unificada de Transporte del GCBA** — datos en vivo de EcoBici,
  colectivos y estado del subte. Requiere `client_id` + `client_secret`.
- **Geocodificador USIG** del GCBA — búsqueda de direcciones.
- **GeoJSON de BA Data** (en `public/datasets/`) — red de subte, trenes,
  ciclovías, premetro y paradas de taxi.

## Puesta en marcha

### 1. Dependencias

```bash
npm install
```

### 2. Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
TRANSPORTE_CLIENT_ID=...
TRANSPORTE_CLIENT_SECRET=...
```

> ⚠️ `TRANSPORTE_*` **no** lleva prefijo `NEXT_PUBLIC_`: solo se usa en el
> servidor y nunca llega al navegador.

### 3. Base de datos (Supabase)

En el dashboard de Supabase → **SQL Editor**, ejecutá el contenido de
[`supabase/schema.sql`](supabase/schema.sql). Crea la tabla `favoritos` con
Row Level Security (cada usuario ve solo lo suyo).

### 4. Login con Google (opcional)

En Supabase → **Authentication → Providers → Google**: activarlo y cargar el
Client ID / Secret de Google Cloud. Como **Authorized redirect URI** en Google
Cloud usar: `https://TU-PROYECTO.supabase.co/auth/v1/callback`.

El login con email/contraseña funciona sin configuración extra.

### 5. Desarrollo

```bash
npm run dev
```

Abrir http://localhost:3000

## Deploy en Vercel

1. Subí el repo a GitHub e importalo en Vercel.
2. Cargá las 4 variables de entorno en **Settings → Environment Variables**.
3. Deploy. Vercel detecta Next.js automáticamente.
4. En Supabase → **Authentication → URL Configuration**, agregá tu dominio de
   Vercel a *Site URL* y *Redirect URLs* (`https://tu-app.vercel.app/**`).

## Estructura

```
src/
├── app/
│   ├── api/
│   │   ├── transporte/{ecobici,colectivos,subte}/  Proxies en vivo
│   │   └── geocoder/                               Proxy del geocodificador
│   ├── auth/callback/      Callback de OAuth (Google)
│   ├── login/              Ingreso / registro
│   └── page.tsx            Home: mapa + paneles
├── components/             MapView, ControlPanel, DetailPanel, ...
├── lib/                    Config de capas, tipos, geo, helper de la API
├── utils/supabase/         Clientes de Supabase (browser / server / proxy)
└── proxy.ts                Refresh de sesión (ex "middleware" en Next 16)
public/datasets/            GeoJSON estáticos de BA Data
```

## Notas técnicas

- **Next.js 16**: el antiguo `middleware.ts` se llama `proxy.ts`.
- El geocodificador USIG devuelve coordenadas **GKBA**; se convierten a WGS84
  con `proj4` en [`src/lib/geo.ts`](src/lib/geo.ts).
- La API del GCBA tiene un proxy con fallos intermitentes: el helper
  [`src/lib/transporte.ts`](src/lib/transporte.ts) reintenta automáticamente.
- **Taxis**: no existe un feed de taxis en tiempo real en CABA; se muestran las
  paradas oficiales (dato estático).
