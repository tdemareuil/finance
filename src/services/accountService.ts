import type { Account, AccountType } from '../types'
import { requireSupabase } from './supabaseClient'
import { useRemoteBackend } from './dataMode'
import { accountToRow, rowToAccount } from './rowMappers'
import * as local from './localStore'

/**
 * Deux comptes ne font doublon que s'ils ont le **même type** ET le **même nom**.
 * Le nom encode la banque (« Livret A Fortuneo ») : un même type dans une banque
 * différente porte un nom différent, donc reste un compte distinct (autorisé).
 */
export function isSameAccount(
  a: { type: AccountType; name: string },
  b: { type: AccountType; name: string },
): boolean {
  return a.type === b.type && a.name.trim().toLowerCase() === b.name.trim().toLowerCase()
}

export async function listAccounts(userId: string): Promise<Account[]> {
  if (!useRemoteBackend()) return local.listRows<Account>('accounts', userId)
  const { data, error } = await requireSupabase()
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToAccount)
}

/**
 * Crée un compte — **idempotent** : si un compte identique (même type + même nom)
 * existe déjà pour l'utilisateur, il est renvoyé tel quel plutôt que dupliqué.
 * Protège tous les points d'entrée (import CSV, versement livret, réglages) et les
 * deux backends. Un index unique en base (voir migration_accounts_unique.sql) sert
 * de garde-fou ultime contre les doublons (course entre onglets, etc.).
 */
export async function createAccount(
  input: Omit<Account, 'id' | 'createdAt'>,
): Promise<Account> {
  if (!useRemoteBackend()) {
    const existing = local
      .listRows<Account>('accounts', input.userId)
      .find((a) => isSameAccount(a, input))
    return existing ?? local.insertRow<Account>('accounts', input)
  }
  const { data, error } = await requireSupabase()
    .from('accounts')
    .insert(accountToRow(input))
    .select()
    .single()
  if (error) {
    // Violation d'unicité (index uq_accounts_user_type_name) : le compte existe
    // déjà (créé en parallèle) → on récupère et on renvoie l'existant.
    if ((error as { code?: string }).code === '23505') {
      const existing = (await listAccounts(input.userId)).find((a) => isSameAccount(a, input))
      if (existing) return existing
    }
    throw error
  }
  return rowToAccount(data)
}

export async function updateAccount(
  id: string,
  patch: Partial<Account>,
): Promise<Account> {
  if (!useRemoteBackend()) return local.updateRow<Account>('accounts', id, patch)
  const { data, error } = await requireSupabase()
    .from('accounts')
    .update(accountToRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToAccount(data)
}

export async function deleteAccount(id: string): Promise<void> {
  if (!useRemoteBackend()) return local.deleteRow('accounts', id)
  const { error } = await requireSupabase().from('accounts').delete().eq('id', id)
  if (error) throw error
}
