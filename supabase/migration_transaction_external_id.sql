-- Migration : identifiant source pour la déduplication des imports.
-- À exécuter dans Supabase > SQL Editor.

alter table public.transactions
  add column if not exists external_id text;

-- Un même identifiant source ne peut exister qu'une fois par utilisateur.
create unique index if not exists uq_tx_user_external
  on public.transactions (user_id, external_id)
  where external_id is not null;
