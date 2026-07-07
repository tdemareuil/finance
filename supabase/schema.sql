-- =====================================================================
-- Schéma Supabase — Dashboard patrimonial
-- À exécuter dans : Supabase > SQL Editor > New query > Run
-- =====================================================================
-- Toutes les tables sont liées à auth.users(id) via user_id.
-- Row Level Security est activé partout : chaque utilisateur ne voit,
-- n'insère, ne modifie et ne supprime QUE ses propres lignes.
-- =====================================================================

-- Extension pour gen_random_uuid() (activée par défaut sur Supabase).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('CTO', 'PEA', 'LIVRET_A', 'LDDS', 'LIVRET_PLUS', 'PER', 'PEE')),
  currency      text not null default 'EUR' check (currency in ('EUR', 'USD')),
  interest_rate numeric,
  created_at    timestamptz not null default now()
);

-- Empêche les doublons de comptes : un compte est identifié par (utilisateur,
-- type, nom). Le nom encode la banque (« Livret A Fortuneo »), donc un même type
-- dans une autre banque a un nom différent et reste autorisé.
create unique index if not exists uq_accounts_user_type_name
  on public.accounts (user_id, type, lower(btrim(name)));

-- ---------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------
create table if not exists public.assets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  ticker              text not null,
  exchange            text,
  isin                text,
  currency            text not null default 'EUR' check (currency in ('EUR', 'USD')),
  type                text not null check (type in ('STOCK', 'ETF', 'CASH')),
  sector              text,
  country             text,
  trading_view_symbol text,
  eodhd_symbol        text,
  finnhub_symbol      text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  account_id       uuid not null references public.accounts (id) on delete cascade,
  asset_id         uuid references public.assets (id) on delete set null,
  type             text not null check (type in ('BUY','SELL','DIVIDEND','FEE','DEPOSIT','WITHDRAWAL')),
  date             date not null,
  quantity         numeric,
  price            numeric,
  fees             numeric,
  currency         text not null default 'EUR' check (currency in ('EUR', 'USD')),
  amount           numeric,
  note             text,
  source           text default 'MANUAL' check (source in ('MANUAL', 'CSV_IMPORT')),
  import_batch_id  uuid,
  external_id      text,
  created_at       timestamptz not null default now()
);

-- Empêche tout doublon d'import : un même identifiant source ne peut exister
-- qu'une fois par utilisateur (les transactions manuelles ont external_id null,
-- non concernées par la contrainte).
create unique index if not exists uq_tx_user_external
  on public.transactions (user_id, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------
-- portfolio_snapshots
-- ---------------------------------------------------------------------
create table if not exists public.portfolio_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  date               date not null,
  total_value        numeric not null default 0,
  invested_capital   numeric not null default 0,
  cash               numeric not null default 0,
  unrealized_pnl     numeric not null default 0,
  realized_pnl       numeric not null default 0,
  dividends_received numeric not null default 0,
  fees_paid          numeric not null default 0,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- dividend_events
-- ---------------------------------------------------------------------
create table if not exists public.dividend_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  asset_id          uuid not null references public.assets (id) on delete cascade,
  ex_date           date,
  payment_date      date,
  amount_per_share  numeric not null,
  currency          text not null default 'EUR' check (currency in ('EUR', 'USD')),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- rsu_grants
-- ---------------------------------------------------------------------
create table if not exists public.rsu_grants (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  asset_id           uuid not null references public.assets (id) on delete cascade,
  grant_date         date not null,
  total_shares       numeric not null,
  platform           text not null check (platform in ('EquatePlus', 'Carta')),
  vesting_type       text not null check (vesting_type in ('cliff', 'monthly')),
  vesting_date       date,
  vesting_start_date date,
  vesting_months     integer,
  note               text,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- import_batches
-- ---------------------------------------------------------------------
create table if not exists public.import_batches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  file_name   text not null,
  broker      text check (broker in ('TRADE_REPUBLIC', 'FORTUNEO', 'GENERIC')),
  status      text not null default 'PENDING' check (status in ('PENDING', 'IMPORTED', 'FAILED')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Index utiles
-- ---------------------------------------------------------------------
create index if not exists idx_rsu_grants_user  on public.rsu_grants (user_id);
create index if not exists idx_rsu_grants_asset on public.rsu_grants (asset_id);

create index if not exists idx_accounts_user      on public.accounts (user_id);
create index if not exists idx_assets_user        on public.assets (user_id);
create index if not exists idx_tx_user            on public.transactions (user_id);
create index if not exists idx_tx_account         on public.transactions (account_id);
create index if not exists idx_tx_asset           on public.transactions (asset_id);
create index if not exists idx_snapshots_user     on public.portfolio_snapshots (user_id);
create index if not exists idx_dividends_user     on public.dividend_events (user_id);
create index if not exists idx_batches_user       on public.import_batches (user_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.accounts            enable row level security;
alter table public.assets              enable row level security;
alter table public.transactions        enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.dividend_events     enable row level security;
alter table public.import_batches      enable row level security;
alter table public.rsu_grants          enable row level security;

-- Une paire de policies par table : SELECT/INSERT/UPDATE/DELETE
-- restreints à auth.uid() = user_id.
-- (Le "do $$ ... $$" génère les 4 policies pour chaque table.)

do $$
declare
  t text;
  tables text[] := array[
    'accounts', 'assets', 'transactions',
    'portfolio_snapshots', 'dividend_events', 'import_batches', 'rsu_grants'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%1$s_select" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I;', t);

    execute format(
      'create policy "%1$s_select" on public.%1$I for select using (auth.uid() = user_id);', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$I for insert with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "%1$s_update" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;
