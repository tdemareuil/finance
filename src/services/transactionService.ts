import type { Transaction } from '../types'
import { requireSupabase } from './supabaseClient'
import { useRemoteBackend } from './dataMode'
import { rowToTransaction, transactionToRow } from './rowMappers'
import * as local from './localStore'

export async function listTransactions(userId: string): Promise<Transaction[]> {
  if (!useRemoteBackend()) {
    return local
      .listRows<Transaction>('transactions', userId)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }
  const { data, error } = await requireSupabase()
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToTransaction)
}

export async function createTransaction(
  input: Omit<Transaction, 'id' | 'createdAt'>,
): Promise<Transaction> {
  if (!useRemoteBackend()) return local.insertRow<Transaction>('transactions', input)
  const { data, error } = await requireSupabase()
    .from('transactions')
    .insert(transactionToRow(input))
    .select()
    .single()
  if (error) throw error
  return rowToTransaction(data)
}

/** Insertion en masse (utilisée par l'import CSV). */
export async function createTransactionsBulk(
  inputs: Array<Omit<Transaction, 'id' | 'createdAt'>>,
): Promise<Transaction[]> {
  if (inputs.length === 0) return []
  if (!useRemoteBackend()) return local.insertManyRows<Transaction>('transactions', inputs)
  const { data, error } = await requireSupabase()
    .from('transactions')
    .insert(inputs.map(transactionToRow))
    .select()
  if (error) throw error
  return (data ?? []).map(rowToTransaction)
}

export async function updateTransaction(
  id: string,
  patch: Partial<Transaction>,
): Promise<Transaction> {
  if (!useRemoteBackend()) return local.updateRow<Transaction>('transactions', id, patch)
  const { data, error } = await requireSupabase()
    .from('transactions')
    .update(transactionToRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToTransaction(data)
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!useRemoteBackend()) return local.deleteRow('transactions', id)
  const { error } = await requireSupabase().from('transactions').delete().eq('id', id)
  if (error) throw error
}
