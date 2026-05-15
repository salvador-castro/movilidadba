"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Modo = "ingresar" | "registrarse";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [modo, setModo] = useState<Modo>("ingresar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") {
      setError("No se pudo completar el ingreso con Google.");
    }
  }, []);

  async function conEmail(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    setAviso(null);

    if (modo === "ingresar") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError("Email o contraseña incorrectos.");
      else router.push("/");
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push("/");
      } else {
        setAviso("Te enviamos un email para confirmar tu cuenta.");
      }
    }
    setCargando(false);
  }

  async function conGoogle() {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden p-4">
      {/* Fondo decorativo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, rgba(0,212,255,0.15), transparent), radial-gradient(50% 50% at 90% 100%, rgba(167,139,250,0.18), transparent)",
        }}
      />

      <div className="glass animate-fade-up relative z-10 w-full max-w-sm rounded-2xl p-7 shadow-2xl">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1 text-xs text-muted transition hover:text-ink"
        >
          ← Volver al mapa
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
            style={{
              background:
                "linear-gradient(135deg,var(--color-accent),var(--color-accent-2))",
            }}
          >
            🚇
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Movilidad BA</h1>
            <p className="text-xs text-muted">
              {modo === "ingresar"
                ? "Ingresá a tu cuenta"
                : "Creá tu cuenta gratis"}
            </p>
          </div>
        </div>

        <button
          onClick={conGoogle}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-panel-soft py-2.5 text-sm font-semibold text-ink transition hover:border-accent/40"
        >
          <GoogleIcon /> Continuar con Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-muted">o con tu email</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={conEmail} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-xl border border-line bg-panel-soft px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mín. 6 caracteres)"
            className="w-full rounded-xl border border-line bg-panel-soft px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}
          {aviso && <p className="text-xs text-emerald-400">{aviso}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="mt-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
          >
            {cargando
              ? "Procesando…"
              : modo === "ingresar"
                ? "Ingresar"
                : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          {modo === "ingresar" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
          <button
            onClick={() => {
              setModo(modo === "ingresar" ? "registrarse" : "ingresar");
              setError(null);
              setAviso(null);
            }}
            className="font-semibold text-accent hover:underline"
          >
            {modo === "ingresar" ? "Registrate" : "Ingresá"}
          </button>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2.1 1.6-4.8 2.5-7.6 2.5-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.5l6.5 5.5C40.9 36.5 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
