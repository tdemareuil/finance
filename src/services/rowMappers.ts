import type {
  Account,
  Asset,
  DividendEvent,
  ImportBatch,
  RsuGrant,
  Transaction,
} from '../types'

// Conversion entre les lignes Supabase (snake_case) et les types TS (camelCase).
// On omet les champs undefined à l'écriture pour laisser les défauts SQL agir.

function clean<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k]
  return out
}

// --- Account ---------------------------------------------------------------
export function rowToAccount(r: Record<string, any>): Account {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    interestRate: r.interest_rate ?? undefined,
    createdAt: r.created_at,
  }
}

export function accountToRow(a: Partial<Account>): Record<string, unknown> {
  return clean({
    id: a.id,
    user_id: a.userId,
    name: a.name,
    type: a.type,
    currency: a.currency,
    interest_rate: a.interestRate,
  })
}

// --- Asset -----------------------------------------------------------------
export function rowToAsset(r: Record<string, any>): Asset {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    ticker: r.ticker,
    exchange: r.exchange ?? undefined,
    isin: r.isin ?? undefined,
    currency: r.currency,
    type: r.type,
    sector: r.sector ?? undefined,
    country: r.country ?? undefined,
    tradingViewSymbol: r.trading_view_symbol ?? undefined,
    finnhubSymbol: r.finnhub_symbol ?? undefined,
    createdAt: r.created_at,
  }
}

export function assetToRow(a: Partial<Asset>): Record<string, unknown> {
  return clean({
    id: a.id,
    user_id: a.userId,
    name: a.name,
    ticker: a.ticker,
    exchange: a.exchange,
    isin: a.isin,
    currency: a.currency,
    type: a.type,
    sector: a.sector,
    country: a.country,
    trading_view_symbol: a.tradingViewSymbol,
    finnhub_symbol: a.finnhubSymbol,
  })
}

// --- Transaction -----------------------------------------------------------
export function rowToTransaction(r: Record<string, any>): Transaction {
  return {
    id: r.id,
    userId: r.user_id,
    accountId: r.account_id,
    assetId: r.asset_id ?? undefined,
    type: r.type,
    date: r.date,
    quantity: r.quantity ?? undefined,
    price: r.price ?? undefined,
    fees: r.fees ?? undefined,
    currency: r.currency,
    amount: r.amount ?? undefined,
    note: r.note ?? undefined,
    source: r.source ?? undefined,
    importBatchId: r.import_batch_id ?? undefined,
    externalId: r.external_id ?? undefined,
    createdAt: r.created_at,
  }
}

export function transactionToRow(t: Partial<Transaction>): Record<string, unknown> {
  return clean({
    id: t.id,
    user_id: t.userId,
    account_id: t.accountId,
    asset_id: t.assetId,
    type: t.type,
    date: t.date,
    quantity: t.quantity,
    price: t.price,
    fees: t.fees,
    currency: t.currency,
    amount: t.amount,
    note: t.note,
    source: t.source,
    import_batch_id: t.importBatchId,
    external_id: t.externalId,
  })
}

// --- DividendEvent ---------------------------------------------------------
export function rowToDividendEvent(r: Record<string, any>): DividendEvent {
  return {
    id: r.id,
    userId: r.user_id,
    assetId: r.asset_id,
    exDate: r.ex_date ?? undefined,
    paymentDate: r.payment_date ?? undefined,
    amountPerShare: Number(r.amount_per_share),
    currency: r.currency,
    createdAt: r.created_at,
  }
}

export function dividendEventToRow(d: Partial<DividendEvent>): Record<string, unknown> {
  return clean({
    id: d.id,
    user_id: d.userId,
    asset_id: d.assetId,
    ex_date: d.exDate,
    payment_date: d.paymentDate,
    amount_per_share: d.amountPerShare,
    currency: d.currency,
  })
}

// --- ImportBatch -----------------------------------------------------------
export function rowToImportBatch(r: Record<string, any>): ImportBatch {
  return {
    id: r.id,
    userId: r.user_id,
    fileName: r.file_name,
    broker: r.broker ?? undefined,
    status: r.status,
    createdAt: r.created_at,
  }
}

export function importBatchToRow(b: Partial<ImportBatch>): Record<string, unknown> {
  return clean({
    id: b.id,
    user_id: b.userId,
    file_name: b.fileName,
    broker: b.broker,
    status: b.status,
  })
}

// --- RsuGrant ---------------------------------------------------------------
export function rowToRsuGrant(r: Record<string, any>): RsuGrant {
  return {
    id: r.id,
    userId: r.user_id,
    assetId: r.asset_id,
    grantDate: r.grant_date,
    totalShares: Number(r.total_shares),
    platform: r.platform,
    vestingType: r.vesting_type,
    vestingDate: r.vesting_date ?? undefined,
    vestingStartDate: r.vesting_start_date ?? undefined,
    vestingMonths: r.vesting_months ?? undefined,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  }
}

export function rsuGrantToRow(g: Partial<RsuGrant>): Record<string, unknown> {
  return clean({
    id: g.id,
    user_id: g.userId,
    asset_id: g.assetId,
    grant_date: g.grantDate,
    total_shares: g.totalShares,
    platform: g.platform,
    vesting_type: g.vestingType,
    vesting_date: g.vestingDate,
    vesting_start_date: g.vestingStartDate,
    vesting_months: g.vestingMonths,
    note: g.note,
  })
}
