-- Migration : élargit les types de compte autorisés.
-- Ajoute Livret A, LDDS, PER et PEE (en plus de CTO, PEA, Livret+).
-- À exécuter sur une base existante dans : Supabase > SQL Editor.
-- (Le schema.sql à jour inclut déjà ces types pour les nouvelles bases.)

alter table public.accounts
  drop constraint if exists accounts_type_check;

alter table public.accounts
  add constraint accounts_type_check
  check (type in ('CTO', 'PEA', 'LIVRET_A', 'LDDS', 'LIVRET_PLUS', 'PER', 'PEE'));
