import Papa from 'papaparse'
import type {
  Account,
  AccountType,
  Asset,
  Currency,
  Transaction,
  TransactionType,
} from '../types'
import { createAccount } from './accountService'
import { createAsset } from './assetService'
import { createTransactionsBulk } from './transactionService'
import { createImportBatch, updateImportBatch } from './importBatchService'

// ---------------------------------------------------------------------------
// Import CSV générique avec mapping manuel des colonnes.
// ---------------------------------------------------------------------------

export type GenericColumn =
  | 'date'
  | 'account'
  | 'type'
  | 'assetName'
  | 'ticker'
  | 'isin'
  | 'quantity'
  | 'price'
  | 'fees'
  | 'amount'
  | 'currency'
  | 'note'

export const GENERIC_COLUMNS: GenericColumn[] = [
  'date', 'account', 'type', 'assetName', 'ticker', 'isin',
  'quantity', 'price', 'fees', 'amount', 'currency', 'note',
]

export const REQUIRED_COLUMNS: GenericColumn[] = ['date', 'account', 'type']

/** mapping : colonne générique -> en-tête présent dans le CSV. */
export type ColumnMapping = Partial<Record<GenericColumn, string>>

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

/** Parse un fichier CSV côté client. */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        resolve({
          headers: res.meta.fields ?? [],
          rows: res.data.filter((r) => Object.keys(r).length > 0),
        })
      },
      error: (err) => reject(err),
    })
  })
}

// ---------------------------------------------------------------------------
// Import Fortuneo — "Export portefeuille détaillé" (.xls / .xlsx).
// C'est un SNAPSHOT de positions (pas un historique de transactions). On le
// convertit en une transaction BUY par ligne, au PRU réel, afin de reconstituer
// les positions et le prix de revient. Les dividendes/frais/plus-values réalisées
// et les dates d'achat réelles ne sont pas reconstitués (voir avertissement UI).
// ---------------------------------------------------------------------------

export interface FortuneoParseResult {
  parsed: ParsedCsv
  mapping: ColumnMapping
  detectedAccountName: string
  detectedAccountType: AccountType
  exportDate: string | null
  positionCount: number
  skipped: number
}

const ACCOUNT_LABEL: Record<AccountType, string> = { CTO: 'CTO', PEA: 'PEA', LIVRET_PLUS: 'Livret+' }

export function isExcelFile(file: File): boolean {
  return /\.xlsx?$/i.test(file.name)
}

export async function parseFortuneoFile(file: File): Promise<FortuneoParseResult> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

  // Retire les accents (é → e) avant normalisation, sinon "Libellé"/"Qté" ne matchent pas.
  const norm = (s: unknown) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')

  const headerIdx = grid.findIndex(
    (r) => r.some((c) => norm(c) === 'libelle') && r.some((c) => norm(c) === 'isin'),
  )
  if (headerIdx === -1) {
    throw new Error(
      "Format Fortuneo non reconnu : en-tête « Libellé … ISIN » introuvable. Vérifiez que c'est bien un export « portefeuille détaillé ».",
    )
  }
  const header = grid[headerIdx].map((c) => String(c).trim())
  const col = (name: string) => header.findIndex((h) => norm(h) === norm(name))
  const iLib = col('Libellé')
  const iDev = col('Dev')
  const iQte = col('Qté')
  const iPM = col('PM')
  const iValo = col('Valorisation')
  const iPV = header.findIndex((h) => norm(h) === norm('+/- values'))
  const iIsin = col('ISIN')

  // Type de compte + date d'export à partir des lignes d'en-tête.
  const topText = grid.slice(0, headerIdx).flat().join(' ')
  const detectedAccountType: AccountType = /pea/i.test(topText)
    ? 'PEA'
    : /livret/i.test(topText)
      ? 'LIVRET_PLUS'
      : 'CTO'
  let exportDate: string | null = null
  for (const r of grid.slice(0, headerIdx)) {
    for (const c of r) {
      const s = String(c)
      if (/\d{2}\/\d{2}\/\d{4}/.test(s)) {
        exportDate = parseDate(s)
        break
      }
    }
    if (exportDate) break
  }
  const dateForTx = exportDate ?? new Date().toISOString().slice(0, 10)
  const accountName = `${ACCOUNT_LABEL[detectedAccountType]} Fortuneo`

  const rows: Record<string, string>[] = []
  let skipped = 0
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i]
    const lib = String(r[iLib] ?? '').trim()
    // On saute les sous-totaux "Solde position CPT", la ligne "Total …" et les
    // lignes vides. Le \b évite d'exclure des titres comme "TOTALENERGIES".
    if (!lib || /^solde position/i.test(lib) || /^total\b/i.test(lib)) continue

    const qte = parseNumber(String(r[iQte] ?? ''))
    if (!qte || qte <= 0) {
      skipped++
      continue
    }
    const valo = parseNumber(String(r[iValo] ?? ''))
    const pv = parseNumber(String(r[iPV] ?? '')) ?? 0

    // Ticker = texte entre les dernières parenthèses ; "-" = pas de ticker.
    const m = lib.match(/\(([^)]*)\)\s*$/)
    let ticker = m ? m[1].trim() : ''
    if (ticker === '-') ticker = ''
    const name = m && m.index != null ? lib.slice(0, m.index).trim() : lib
    const isin = String(r[iIsin] ?? '').trim()
    const currency = String(r[iDev] ?? 'EUR').trim().toUpperCase() === 'USD' ? 'USD' : 'EUR'

    // PRU précis : (valorisation − plus-value) / quantité. Fallback : colonne PM (arrondie).
    let price: number | undefined
    if (valo != null) price = Math.round(((valo - pv) / qte) * 10000) / 10000
    else price = parseNumber(String(r[iPM] ?? ''))

    rows.push({
      date: dateForTx,
      account: accountName,
      type: 'BUY',
      assetName: name,
      ticker,
      isin,
      quantity: String(qte),
      price: price != null ? String(price) : '',
      fees: '',
      amount: '',
      currency,
      note: `Import Fortuneo — position au ${exportDate ?? dateForTx}`,
    })
  }

  const mapping: ColumnMapping = {}
  for (const c of GENERIC_COLUMNS) mapping[c] = c
  return {
    parsed: { headers: [...GENERIC_COLUMNS], rows },
    mapping,
    detectedAccountName: accountName,
    detectedAccountType,
    exportDate,
    positionCount: rows.length,
    skipped,
  }
}

/** Devine un mapping initial en rapprochant les en-têtes des colonnes génériques. */
export function guessMapping(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const aliases: Record<GenericColumn, string[]> = {
    date: ['date', 'jour', 'valuedate', 'tradedate', 'operationdate'],
    account: ['account', 'compte', 'portfolio', 'wallet'],
    type: ['type', 'operation', 'sens', 'transactiontype', 'nature'],
    assetName: ['assetname', 'name', 'libelle', 'designation', 'instrument', 'produit'],
    ticker: ['ticker', 'symbol', 'symbole', 'code'],
    isin: ['isin'],
    quantity: ['quantity', 'quantite', 'qty', 'nombre', 'shares', 'parts'],
    price: ['price', 'prix', 'cours', 'unitprice', 'prixunitaire'],
    fees: ['fees', 'frais', 'commission', 'fee'],
    amount: ['amount', 'montant', 'total', 'value', 'valeur'],
    currency: ['currency', 'devise', 'ccy'],
    note: ['note', 'notes', 'comment', 'commentaire', 'label', 'libelle2'],
  }
  const mapping: ColumnMapping = {}
  for (const col of GENERIC_COLUMNS) {
    const found = headers.find((h) => aliases[col].includes(norm(h)))
    if (found) mapping[col] = found
  }
  return mapping
}

// --- Normalisation des types ------------------------------------------------
const TYPE_ALIASES: Record<string, TransactionType> = {
  buy: 'BUY', achat: 'BUY', 'achat titres': 'BUY',
  sell: 'SELL', vente: 'SELL',
  dividend: 'DIVIDEND', dividende: 'DIVIDEND', 'dividende brut': 'DIVIDEND',
  fee: 'FEE', frais: 'FEE', commission: 'FEE',
  deposit: 'DEPOSIT', depot: 'DEPOSIT', 'depôt': 'DEPOSIT', versement: 'DEPOSIT', virement: 'DEPOSIT',
  withdrawal: 'WITHDRAWAL', retrait: 'WITHDRAWAL',
}

export function normalizeType(raw: string): TransactionType | null {
  const k = raw.trim().toLowerCase()
  return TYPE_ALIASES[k] ?? (['BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL'].includes(raw.trim().toUpperCase())
    ? (raw.trim().toUpperCase() as TransactionType)
    : null)
}

function parseNumber(raw?: string): number | undefined {
  if (raw == null || raw.trim() === '') return undefined
  // Gère les formats FR (virgule décimale, espace milliers).
  const cleaned = raw.replace(/\s/g, '').replace(/ /g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

function parseDate(raw?: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  // ISO déjà bon
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // DD/MM/YYYY ou DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const [, d, mo, y] = m
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function normalizeCurrency(raw?: string): Currency {
  const c = (raw ?? '').trim().toUpperCase()
  return c === 'USD' || c === '$' ? 'USD' : 'EUR'
}

export type RowStatus = 'OK' | 'ERROR' | 'DUPLICATE'

export interface PreviewRow {
  index: number
  raw: Record<string, string>
  status: RowStatus
  messages: string[]
  // Champs normalisés
  date: string | null
  accountName: string
  type: TransactionType | null
  assetName?: string
  ticker?: string
  isin?: string
  quantity?: number
  price?: number
  fees?: number
  amount?: number
  currency: Currency
  note?: string
  // Résolution
  matchedAccountId?: string
  matchedAssetId?: string
  needsAccount: boolean
  needsAsset: boolean
}

export interface ImportPreview {
  rows: PreviewRow[]
  missingAccounts: string[]
  missingAssets: { name: string; ticker?: string; isin?: string; currency: Currency }[]
  okCount: number
  errorCount: number
  duplicateCount: number
}

function dupKey(t: {
  date: string | null
  accountName: string
  type: TransactionType | null
  assetKey: string
  quantity?: number
  price?: number
  amount?: number
}): string {
  return [t.date, t.accountName.toLowerCase(), t.type, t.assetKey, t.quantity ?? '', t.price ?? '', t.amount ?? ''].join('|')
}

/** Construit l'aperçu d'import : normalise, résout comptes/actifs, détecte doublons. */
export function buildImportPreview(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  accounts: Account[],
  assets: Asset[],
  existingTransactions: Transaction[],
): ImportPreview {
  const get = (row: Record<string, string>, col: GenericColumn): string | undefined => {
    const header = mapping[col]
    return header ? row[header] : undefined
  }

  const accountByName = new Map(accounts.map((a) => [a.name.trim().toLowerCase(), a]))
  const assetByTicker = new Map(assets.filter((a) => a.ticker).map((a) => [a.ticker.trim().toLowerCase(), a]))
  const assetByIsin = new Map(assets.filter((a) => a.isin).map((a) => [a.isin!.trim().toLowerCase(), a]))
  const assetByName = new Map(assets.map((a) => [a.name.trim().toLowerCase(), a]))

  // Clés de doublon des transactions existantes.
  const existingKeys = new Set<string>()
  const assetIdName = new Map(assets.map((a) => [a.id, a]))
  for (const t of existingTransactions) {
    const acc = accounts.find((a) => a.id === t.accountId)
    const assetKey = t.assetId ? (assetIdName.get(t.assetId)?.ticker ?? t.assetId).toLowerCase() : ''
    existingKeys.add(
      dupKey({
        date: t.date,
        accountName: acc?.name ?? t.accountId,
        type: t.type,
        assetKey,
        quantity: t.quantity,
        price: t.price,
        amount: t.amount,
      }),
    )
  }

  const seenInFile = new Set<string>()
  const missingAccounts = new Set<string>()
  const missingAssetsMap = new Map<string, { name: string; ticker?: string; isin?: string; currency: Currency }>()

  const rows: PreviewRow[] = parsed.rows.map((raw, index) => {
    const messages: string[] = []
    const date = parseDate(get(raw, 'date'))
    const accountName = (get(raw, 'account') ?? '').trim()
    const typeRaw = get(raw, 'type') ?? ''
    const type = normalizeType(typeRaw)
    const assetName = get(raw, 'assetName')?.trim() || undefined
    const ticker = get(raw, 'ticker')?.trim() || undefined
    const isin = get(raw, 'isin')?.trim() || undefined
    const quantity = parseNumber(get(raw, 'quantity'))
    const price = parseNumber(get(raw, 'price'))
    const fees = parseNumber(get(raw, 'fees'))
    const amount = parseNumber(get(raw, 'amount'))
    const currency = normalizeCurrency(get(raw, 'currency'))
    const note = get(raw, 'note')?.trim() || undefined

    if (!date) messages.push('Date manquante ou invalide.')
    if (!accountName) messages.push('Compte manquant.')
    if (!type) messages.push(`Type inconnu : "${typeRaw}".`)

    const needsAssetType = type === 'BUY' || type === 'SELL'
    const hasAssetRef = Boolean(ticker || isin || assetName)
    if (needsAssetType && !hasAssetRef) {
      messages.push('Actif requis pour un achat/vente (ticker, ISIN ou nom).')
    }
    if ((type === 'BUY' || type === 'SELL') && (quantity == null || price == null)) {
      messages.push('Quantité et prix requis pour un achat/vente.')
    }
    if ((type === 'DEPOSIT' || type === 'WITHDRAWAL' || type === 'DIVIDEND' || type === 'FEE') && amount == null) {
      messages.push('Montant requis pour ce type d\'opération.')
    }

    // Résolution compte
    const matchedAccount = accountName ? accountByName.get(accountName.toLowerCase()) : undefined
    const needsAccount = Boolean(accountName) && !matchedAccount
    if (needsAccount) missingAccounts.add(accountName)

    // Résolution actif
    let matchedAsset: Asset | undefined
    if (isin) matchedAsset = assetByIsin.get(isin.toLowerCase())
    if (!matchedAsset && ticker) matchedAsset = assetByTicker.get(ticker.toLowerCase())
    if (!matchedAsset && assetName) matchedAsset = assetByName.get(assetName.toLowerCase())
    const needsAsset = hasAssetRef && !matchedAsset
    if (needsAsset) {
      const keyName = assetName ?? ticker ?? isin ?? ''
      if (!missingAssetsMap.has(keyName.toLowerCase())) {
        missingAssetsMap.set(keyName.toLowerCase(), {
          name: assetName ?? ticker ?? isin ?? 'Inconnu',
          ticker,
          isin,
          currency,
        })
      }
    }

    // Doublon
    const assetKey = (ticker ?? isin ?? assetName ?? '').toLowerCase()
    const k = dupKey({ date, accountName, type, assetKey, quantity, price, amount })
    let status: RowStatus = 'OK'
    if (messages.length > 0) status = 'ERROR'
    else if (existingKeys.has(k) || seenInFile.has(k)) {
      status = 'DUPLICATE'
      messages.push('Doublon probable (mêmes date/compte/actif/type/quantité/prix/montant).')
    }
    seenInFile.add(k)

    return {
      index,
      raw,
      status,
      messages,
      date,
      accountName,
      type,
      assetName,
      ticker,
      isin,
      quantity,
      price,
      fees,
      amount,
      currency,
      note,
      matchedAccountId: matchedAccount?.id,
      matchedAssetId: matchedAsset?.id,
      needsAccount,
      needsAsset,
    }
  })

  return {
    rows,
    missingAccounts: [...missingAccounts],
    missingAssets: [...missingAssetsMap.values()],
    okCount: rows.filter((r) => r.status === 'OK').length,
    errorCount: rows.filter((r) => r.status === 'ERROR').length,
    duplicateCount: rows.filter((r) => r.status === 'DUPLICATE').length,
  }
}

export interface ImportOptions {
  fileName: string
  autoCreateAccounts: boolean
  autoCreateAssets: boolean
  includeDuplicates: boolean
  /** Type de compte par défaut pour les comptes créés automatiquement. */
  defaultAccountType: AccountType
}

export interface ImportResult {
  batchId: string
  inserted: number
  skipped: number
  createdAccounts: number
  createdAssets: number
}

/** Exécute l'import : crée comptes/actifs manquants, batch, puis insère les transactions. */
export async function executeImport(
  preview: ImportPreview,
  options: ImportOptions,
  userId: string,
  accounts: Account[],
  assets: Asset[],
): Promise<ImportResult> {
  const batch = await createImportBatch({
    userId,
    fileName: options.fileName,
    broker: 'GENERIC',
    status: 'PENDING',
  })

  try {
    // Maps de résolution (mises à jour au fil des créations).
    const accountByName = new Map(accounts.map((a) => [a.name.trim().toLowerCase(), a]))
    const assetByTicker = new Map(assets.filter((a) => a.ticker).map((a) => [a.ticker.toLowerCase(), a]))
    const assetByIsin = new Map(assets.filter((a) => a.isin).map((a) => [a.isin!.toLowerCase(), a]))
    const assetByName = new Map(assets.map((a) => [a.name.toLowerCase(), a]))

    let createdAccounts = 0
    let createdAssets = 0

    const rowsToImport = preview.rows.filter(
      (r) => r.status === 'OK' || (r.status === 'DUPLICATE' && options.includeDuplicates),
    )

    // 1) Créer les comptes manquants
    if (options.autoCreateAccounts) {
      for (const name of preview.missingAccounts) {
        if (!accountByName.has(name.toLowerCase())) {
          const created = await createAccount({
            userId,
            name,
            type: options.defaultAccountType,
            currency: 'EUR',
          })
          accountByName.set(name.toLowerCase(), created)
          createdAccounts++
        }
      }
    }

    // 2) Créer les actifs manquants
    if (options.autoCreateAssets) {
      for (const a of preview.missingAssets) {
        const existing =
          (a.isin && assetByIsin.get(a.isin.toLowerCase())) ||
          (a.ticker && assetByTicker.get(a.ticker.toLowerCase())) ||
          assetByName.get(a.name.toLowerCase())
        if (existing) continue
        const created = await createAsset({
          userId,
          name: a.name,
          ticker: a.ticker ?? a.name.slice(0, 8).toUpperCase(),
          isin: a.isin,
          currency: a.currency,
          type: 'STOCK',
        })
        if (created.ticker) assetByTicker.set(created.ticker.toLowerCase(), created)
        if (created.isin) assetByIsin.set(created.isin.toLowerCase(), created)
        assetByName.set(created.name.toLowerCase(), created)
        createdAssets++
      }
    }

    // 3) Construire et insérer les transactions
    const toInsert: Array<Omit<Transaction, 'id' | 'createdAt'>> = []
    let skipped = 0
    for (const r of rowsToImport) {
      const account = r.accountName ? accountByName.get(r.accountName.toLowerCase()) : undefined
      if (!account || !r.date || !r.type) {
        skipped++
        continue
      }
      let assetId: string | undefined = r.matchedAssetId
      if (!assetId && (r.ticker || r.isin || r.assetName)) {
        const found =
          (r.isin && assetByIsin.get(r.isin.toLowerCase())) ||
          (r.ticker && assetByTicker.get(r.ticker.toLowerCase())) ||
          (r.assetName && assetByName.get(r.assetName.toLowerCase()))
        assetId = found ? found.id : undefined
      }
      if ((r.type === 'BUY' || r.type === 'SELL') && !assetId) {
        skipped++
        continue
      }
      toInsert.push({
        userId,
        accountId: account.id,
        assetId,
        type: r.type,
        date: r.date,
        quantity: r.quantity,
        price: r.price,
        fees: r.fees,
        currency: r.currency,
        amount: r.amount,
        note: r.note,
        source: 'CSV_IMPORT',
        importBatchId: batch.id,
      })
    }

    const inserted = await createTransactionsBulk(toInsert)
    await updateImportBatch(batch.id, { status: 'IMPORTED' })

    return {
      batchId: batch.id,
      inserted: inserted.length,
      skipped,
      createdAccounts,
      createdAssets,
    }
  } catch (err) {
    await updateImportBatch(batch.id, { status: 'FAILED' }).catch(() => {})
    throw err
  }
}
