-- Migration : ajoute la colonne finnhub_symbol à la table assets.
-- À exécuter dans Supabase > SQL Editor si le schéma initial a été appliqué
-- AVANT l'ajout de la fonctionnalité "Analyse" (Finnhub).
-- (Le schema.sql à jour crée déjà cette colonne pour les nouvelles installations.)

alter table public.assets
  add column if not exists finnhub_symbol text;
