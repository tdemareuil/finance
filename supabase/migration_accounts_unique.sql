-- Migration : empêche les comptes en double.
-- À exécuter dans Supabase > SQL Editor.
--
-- Un compte est identifié par (utilisateur, type, nom). Le nom encode la banque
-- (« Livret A Fortuneo »), donc un même type dans une autre banque a un nom
-- différent et reste un compte distinct (autorisé).
--
-- ⚠️ Si des doublons existent déjà, cet index échouera à se créer. Repérez-les
-- puis fusionnez/supprimez-les avant de relancer :
--   select user_id, type, lower(btrim(name)) as n, count(*)
--   from public.accounts
--   group by 1, 2, 3 having count(*) > 1;

create unique index if not exists uq_accounts_user_type_name
  on public.accounts (user_id, type, lower(btrim(name)));
