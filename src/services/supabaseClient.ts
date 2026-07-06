import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Clé "publishable" (sb_publishable_…), conçue pour être exposée côté client
// et protégée par les policies RLS. On n'utilise JAMAIS la clé service_role,
// la clé sb_secret ni le JWT secret dans le front.
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * Vrai si les variables d'environnement Supabase sont présentes.
 * Sinon, l'application bascule en "mode démo" local (voir localStore.ts).
 */
export const isSupabaseConfigured = Boolean(url && publishableKey)

/**
 * Client Supabase. Null si non configuré — l'app fonctionne alors
 * en mode démo (données fictives, pas de persistance distante).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, publishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/** Garde-fou : lève une erreur explicite si on tente d'utiliser Supabase non configuré. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase non configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env.local.',
    )
  }
  return supabase
}
