-- Migration : ajoute le taux d'intérêt annuel aux comptes (Livret+).
-- À exécuter dans Supabase > SQL Editor si le schéma a été appliqué avant l'ajout
-- de l'auto-calcul des intérêts Livret+.
-- Valeur stockée en fraction (0.03 = 3%).

alter table public.accounts
  add column if not exists interest_rate numeric;
