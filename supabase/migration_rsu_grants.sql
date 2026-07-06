-- Migration : grants RSU (Restricted Stock Units) avec calendrier de vesting.
-- À exécuter dans Supabase > SQL Editor.

create table if not exists public.rsu_grants (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  asset_id           uuid not null references public.assets (id) on delete cascade,
  grant_date         date not null,
  total_shares       numeric not null,
  platform           text not null check (platform in ('EquatePlus', 'Carta')),
  vesting_type       text not null check (vesting_type in ('cliff', 'monthly')),
  -- cliff : toutes les actions livrées à une date unique
  vesting_date       date,
  -- monthly : actions livrées mensuellement sur N mois
  vesting_start_date date,
  vesting_months     integer,
  note               text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_rsu_grants_user  on public.rsu_grants (user_id);
create index if not exists idx_rsu_grants_asset on public.rsu_grants (asset_id);

alter table public.rsu_grants enable row level security;

create policy "rsu_grants_select" on public.rsu_grants
  for select using (auth.uid() = user_id);
create policy "rsu_grants_insert" on public.rsu_grants
  for insert with check (auth.uid() = user_id);
create policy "rsu_grants_update" on public.rsu_grants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "rsu_grants_delete" on public.rsu_grants
  for delete using (auth.uid() = user_id);
