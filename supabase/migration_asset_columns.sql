-- Migration : garantit que toutes les colonnes optionnelles d'`assets` existent.
-- À exécuter dans Supabase > SQL Editor.
--
-- Utile si la base a été créée avec une ancienne version du schéma : l'import
-- Trade Republic crée de NOUVEAUX actifs enrichis (secteur, pays, symboles
-- Finnhub/TradingView). Si une de ces colonnes manque, l'insertion de l'actif
-- échoue (« Could not find the '…' column of 'assets' »), alors qu'un ré-import
-- Fortuneo qui réutilise des actifs déjà présents fonctionne.
-- Idempotent : sans effet si les colonnes existent déjà.

alter table public.assets add column if not exists sector              text;
alter table public.assets add column if not exists country             text;
alter table public.assets add column if not exists trading_view_symbol text;
alter table public.assets add column if not exists finnhub_symbol      text;
