-- ============================================================
--  Movilidad BA — Esquema de base de datos (Supabase / Postgres)
--  Ejecutar en: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- Tabla de domicilios favoritos de cada usuario.
create table if not exists public.favoritos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  label      text not null,
  address    text,
  lat        double precision not null,
  lng        double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists favoritos_user_idx
  on public.favoritos (user_id);

-- ---------- Row Level Security ----------
-- Cada usuario solo puede ver y modificar SUS propios domicilios.
alter table public.favoritos enable row level security;

drop policy if exists "favoritos_select_own" on public.favoritos;
create policy "favoritos_select_own" on public.favoritos
  for select using (auth.uid() = user_id);

drop policy if exists "favoritos_insert_own" on public.favoritos;
create policy "favoritos_insert_own" on public.favoritos
  for insert with check (auth.uid() = user_id);

drop policy if exists "favoritos_update_own" on public.favoritos;
create policy "favoritos_update_own" on public.favoritos
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "favoritos_delete_own" on public.favoritos;
create policy "favoritos_delete_own" on public.favoritos
  for delete using (auth.uid() = user_id);
