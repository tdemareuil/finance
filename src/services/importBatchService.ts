import type { ImportBatch } from '../types'
import { requireSupabase } from './supabaseClient'
import { useRemoteBackend } from './dataMode'
import { importBatchToRow, rowToImportBatch } from './rowMappers'
import * as local from './localStore'

export async function createImportBatch(
  input: Omit<ImportBatch, 'id' | 'createdAt'>,
): Promise<ImportBatch> {
  if (!useRemoteBackend()) return local.insertRow<ImportBatch>('import_batches', input)
  const { data, error } = await requireSupabase()
    .from('import_batches')
    .insert(importBatchToRow(input))
    .select()
    .single()
  if (error) throw error
  return rowToImportBatch(data)
}

export async function updateImportBatch(
  id: string,
  patch: Partial<ImportBatch>,
): Promise<ImportBatch> {
  if (!useRemoteBackend()) return local.updateRow<ImportBatch>('import_batches', id, patch)
  const { data, error } = await requireSupabase()
    .from('import_batches')
    .update(importBatchToRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToImportBatch(data)
}
