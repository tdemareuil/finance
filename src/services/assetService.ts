import type { Asset } from '../types'
import { requireSupabase } from './supabaseClient'
import { useRemoteBackend } from './dataMode'
import { assetToRow, rowToAsset } from './rowMappers'
import * as local from './localStore'

export async function listAssets(userId: string): Promise<Asset[]> {
  if (!useRemoteBackend()) return local.listRows<Asset>('assets', userId)
  const { data, error } = await requireSupabase()
    .from('assets')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToAsset)
}

export async function createAsset(input: Omit<Asset, 'id' | 'createdAt'>): Promise<Asset> {
  if (!useRemoteBackend()) return local.insertRow<Asset>('assets', input)
  const { data, error } = await requireSupabase()
    .from('assets')
    .insert(assetToRow(input))
    .select()
    .single()
  if (error) throw error
  return rowToAsset(data)
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<Asset> {
  if (!useRemoteBackend()) return local.updateRow<Asset>('assets', id, patch)
  const { data, error } = await requireSupabase()
    .from('assets')
    .update(assetToRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToAsset(data)
}

export async function deleteAsset(id: string): Promise<void> {
  if (!useRemoteBackend()) return local.deleteRow('assets', id)
  const { error } = await requireSupabase().from('assets').delete().eq('id', id)
  if (error) throw error
}
