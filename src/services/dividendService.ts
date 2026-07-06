import type { DividendEvent } from '../types'
import { requireSupabase } from './supabaseClient'
import { useRemoteBackend } from './dataMode'
import { dividendEventToRow, rowToDividendEvent } from './rowMappers'
import * as local from './localStore'

export async function listDividendEvents(userId: string): Promise<DividendEvent[]> {
  if (!useRemoteBackend()) return local.listRows<DividendEvent>('dividend_events', userId)
  const { data, error } = await requireSupabase()
    .from('dividend_events')
    .select('*')
    .order('ex_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToDividendEvent)
}

export async function createDividendEvent(
  input: Omit<DividendEvent, 'id' | 'createdAt'>,
): Promise<DividendEvent> {
  if (!useRemoteBackend()) return local.insertRow<DividendEvent>('dividend_events', input)
  const { data, error } = await requireSupabase()
    .from('dividend_events')
    .insert(dividendEventToRow(input))
    .select()
    .single()
  if (error) throw error
  return rowToDividendEvent(data)
}

export async function deleteDividendEvent(id: string): Promise<void> {
  if (!useRemoteBackend()) return local.deleteRow('dividend_events', id)
  const { error } = await requireSupabase().from('dividend_events').delete().eq('id', id)
  if (error) throw error
}
