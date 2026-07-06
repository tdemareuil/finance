import type {
  Account,
  Asset,
  DividendEvent,
  ImportBatch,
  Transaction,
} from '../types'
import { buildDemoData } from '../data/demoData'

// ---------------------------------------------------------------------------
// Store local pour le MODE DÉMO uniquement.
// Utilisé quand Supabase n'est pas configuré, ou pour "charger les données de
// démo". Ce n'est PAS le stockage principal de l'app : quand Supabase est
// configuré, tout passe par Supabase (source de vérité).
// Persisté dans localStorage sous une clé dédiée, à des fins de confort démo.
// ---------------------------------------------------------------------------

export const DEMO_USER_ID = 'demo-user'
const STORAGE_KEY = 'patrimoine-demo-store-v1'

interface StoreShape {
  accounts: Account[]
  assets: Asset[]
  transactions: Transaction[]
  dividend_events: DividendEvent[]
  import_batches: ImportBatch[]
}

type TableName = keyof StoreShape

function emptyStore(): StoreShape {
  return { accounts: [], assets: [], transactions: [], dividend_events: [], import_batches: [] }
}

function load(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...emptyStore(), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return emptyStore()
}

function persist(store: StoreShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota / mode privé — on ignore, le store reste en mémoire */
  }
}

let store: StoreShape = load()

function genId(): string {
  return 'loc-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Recharge le jeu de données de démonstration (écrase le store démo). */
export function seedDemoData(userId: string = DEMO_USER_ID): void {
  const data = buildDemoData(userId)
  store = {
    accounts: data.accounts,
    assets: data.assets,
    transactions: data.transactions,
    dividend_events: data.dividendEvents,
    import_batches: [],
  }
  persist(store)
}

/** Vide entièrement le store démo. */
export function clearDemoData(): void {
  store = emptyStore()
  persist(store)
}

export function hasDemoData(): boolean {
  return store.accounts.length > 0 || store.transactions.length > 0
}

// --- CRUD générique ---------------------------------------------------------

export function listRows<T extends { userId: string }>(table: TableName, userId: string): T[] {
  return (store[table] as unknown as T[]).filter((r) => r.userId === userId)
}

export function insertRow<T extends { id: string; createdAt: string }>(
  table: TableName,
  row: Omit<T, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): T {
  const record = { ...row, id: row.id ?? genId(), createdAt: row.createdAt ?? nowIso() } as T
  ;(store[table] as unknown as T[]).push(record)
  persist(store)
  return record
}

export function insertManyRows<T extends { id: string; createdAt: string }>(
  table: TableName,
  rows: Array<Omit<T, 'id' | 'createdAt'> & { id?: string; createdAt?: string }>,
): T[] {
  return rows.map((r) => insertRow<T>(table, r))
}

export function updateRow<T extends { id: string }>(
  table: TableName,
  id: string,
  patch: Partial<T>,
): T {
  const arr = store[table] as unknown as T[]
  const idx = arr.findIndex((r) => r.id === id)
  if (idx === -1) throw new Error(`Ligne introuvable dans ${table}: ${id}`)
  arr[idx] = { ...arr[idx], ...patch }
  persist(store)
  return arr[idx]
}

export function deleteRow(table: TableName, id: string): void {
  const arr = store[table] as unknown as Array<{ id: string }>
  const idx = arr.findIndex((r) => r.id === id)
  if (idx !== -1) {
    arr.splice(idx, 1)
    persist(store)
  }
}
