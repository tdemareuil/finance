import type { Account } from '../types'
import { requireSupabase } from './supabaseClient'
import { useRemoteBackend } from './dataMode'
import { accountToRow, rowToAccount } from './rowMappers'
import * as local from './localStore'

export async function listAccounts(userId: string): Promise<Account[]> {
  if (!useRemoteBackend()) return local.listRows<Account>('accounts', userId)
  const { data, error } = await requireSupabase()
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToAccount)
}

export async function createAccount(
  input: Omit<Account, 'id' | 'createdAt'>,
): Promise<Account> {
  if (!useRemoteBackend()) return local.insertRow<Account>('accounts', input)
  const { data, error } = await requireSupabase()
    .from('accounts')
    .insert(accountToRow(input))
    .select()
    .single()
  if (error) throw error
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
