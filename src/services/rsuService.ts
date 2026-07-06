import type { RsuGrant } from '../types'
import { requireSupabase } from './supabaseClient'
import { useRemoteBackend } from './dataMode'
import { rowToRsuGrant, rsuGrantToRow } from './rowMappers'
import * as local from './localStore'

export async function listRsuGrants(userId: string): Promise<RsuGrant[]> {
  if (!useRemoteBackend()) return local.listRows<RsuGrant>('rsu_grants', userId)
  const { data, error } = await requireSupabase()
    .from('rsu_grants')
    .select('*')
    .order('grant_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToRsuGrant)
}

export async function createRsuGrant(input: Omit<RsuGrant, 'id' | 'createdAt'>): Promise<RsuGrant> {
  if (!useRemoteBackend()) return local.insertRow<RsuGrant>('rsu_grants', input)
  const { data, error } = await requireSupabase()
    .from('rsu_grants')
    .insert(rsuGrantToRow(input))
    .select()
    .single()
  if (error) throw error
  return rowToRsuGrant(data)
}

export async function updateRsuGrant(id: string, patch: Partial<RsuGrant>): Promise<RsuGrant> {
  if (!useRemoteBackend()) return local.updateRow<RsuGrant>('rsu_grants', id, patch)
  const { data, error } = await requireSupabase()
    .from('rsu_grants')
    .update(rsuGrantToRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToRsuGrant(data)
}

export async function deleteRsuGrant(id: string): Promise<void> {
  if (!useRemoteBackend()) return local.deleteRow('rsu_grants', id)
  const { error } = await requireSupabase().from('rsu_grants').delete().eq('id', id)
  if (error) throw error
}
