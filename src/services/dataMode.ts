import { isSupabaseConfigured } from './supabaseClient'

// ---------------------------------------------------------------------------
// Mode de données runtime.
//  - 'SUPABASE' : source de vérité distante (nécessite Supabase configuré).
//  - 'DEMO'     : store local (données fictives), pour la démo hors-ligne.
// Par défaut on utilise Supabase s'il est configuré, sinon la démo.
// ---------------------------------------------------------------------------

export type DataMode = 'SUPABASE' | 'DEMO'

let mode: DataMode = isSupabaseConfigured ? 'SUPABASE' : 'DEMO'

export function getDataMode(): DataMode {
  return mode
}

export function setDataMode(m: DataMode): void {
  mode = m
}

/** Vrai si les appels doivent taper Supabase ; faux si on reste en local (démo). */
export function useRemoteBackend(): boolean {
  return isSupabaseConfigured && mode === 'SUPABASE'
}
