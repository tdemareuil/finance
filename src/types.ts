// Modèle de données central de l'application.
// Ces types reflètent le schéma Supabase (voir supabase/schema.sql).

export type Currency = 'EUR' | 'USD'

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
export type AccountType =
  | 'CTO'
  | 'PEA'
  | 'LIVRET_A'
  | 'LDDS'
  | 'LIVRET_PLUS'
  | 'PER'
  | 'PEE'

export interface Account {
  id: string
  userId: string
  name: string
  type: AccountType
  currency: Currency
  /** Taux d'intérêt annuel (fraction, ex : 0.03 = 3%). Pertinent pour les livrets (Livret A, LDDS, Livret+). */
  interestRate?: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Asset
// ---------------------------------------------------------------------------
export type AssetType = 'STOCK' | 'ETF' | 'CASH'

export interface Asset {
  id: string
  userId: string
  name: string
  ticker: string
  exchange?: string
  isin?: string
  currency: Currency
  type: AssetType
  sector?: string
  country?: string
  tradingViewSymbol?: string
  finnhubSymbol?: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------
export type TransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'FEE'
  | 'DEPOSIT'
  | 'WITHDRAWAL'

export type TransactionSource = 'MANUAL' | 'CSV_IMPORT'

export interface Transaction {
  id: string
  userId: string
  accountId: string
  assetId?: string
  type: TransactionType
  date: string // ISO date (YYYY-MM-DD)
  quantity?: number
  price?: number
  fees?: number
  currency: Currency
  amount?: number
  note?: string
  source?: TransactionSource
  importBatchId?: string
  /** Identifiant unique fourni par la source (ex : transaction_id Trade Republic) — sert à la déduplication. */
  externalId?: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// PortfolioSnapshot
// ---------------------------------------------------------------------------
export interface PortfolioSnapshot {
  id: string
  userId: string
  date: string
  totalValue: number
  investedCapital: number
  cash: number
  unrealizedPnL: number
  realizedPnL: number
  dividendsReceived: number
  feesPaid: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// MarketPrice
// ---------------------------------------------------------------------------
export interface MarketPrice {
  assetId: string
  date: string
  close: number
  currency: Currency
}

// ---------------------------------------------------------------------------
// StockSplit (marketDataService — splits)
// ---------------------------------------------------------------------------
export interface StockSplit {
  assetId: string
  date: string
  /** Ratio de split : numerator/denominator (ex : 4:1 → numerator 4, denominator 1). */
  numerator: number
  denominator: number
}

// ---------------------------------------------------------------------------
// DividendEvent
// ---------------------------------------------------------------------------
export interface DividendEvent {
  id: string
  userId: string
  assetId: string
  exDate?: string
  paymentDate?: string
  amountPerShare: number
  currency: Currency
  createdAt: string
}

// ---------------------------------------------------------------------------
// ImportBatch
// ---------------------------------------------------------------------------
export type Broker = 'TRADE_REPUBLIC' | 'FORTUNEO' | 'GENERIC'
export type ImportStatus = 'PENDING' | 'IMPORTED' | 'FAILED'

export interface ImportBatch {
  id: string
  userId: string
  fileName: string
  broker?: Broker
  status: ImportStatus
  createdAt: string
}

// ---------------------------------------------------------------------------
// Types dérivés (calculés côté client, non persistés)
// ---------------------------------------------------------------------------

/** Position agrégée pour un actif dans un compte donné. */
export interface Position {
  assetId: string
  accountId: string
  asset: Asset
  account: Account
  quantity: number
  /** Prix de revient unitaire moyen pondéré (PRU). */
  averageCost: number
  /** Coût total d'acquisition des titres encore détenus. */
  totalCost: number
  feesPaid: number
  realizedPnL: number
  dividendsReceived: number
  currentPrice: number | null
  currentValue: number | null
  unrealizedPnL: number | null
  performancePct: number | null
  /** Poids dans le portefeuille total (0..1). */
  weight: number
  currency: Currency
}

/** Résumé global du portefeuille. */
export interface PortfolioSummary {
  totalValue: number
  investedCapital: number
  cash: number
  unrealizedPnL: number
  realizedPnL: number
  dividendsReceived: number
  feesPaid: number
  /** Performance simple = (valeur + réalisé + dividendes - investi) / investi. */
  totalReturnPct: number | null
  annualizedReturnPct: number | null
  /** Intérêts Livret+ crédités (années révolues), inclus dans le cash. */
  livretInterestCredited: number
  /** Intérêts Livret+ courus (année en cours, non encore crédités). */
  livretInterestAccrued: number
  positions: Position[]
}

/** Ligne du calendrier de dividendes. */
export interface DividendCalendarEntry {
  asset: Asset
  event: DividendEvent
  quantityHeld: number
  estimatedAmount: number
  status: 'PREVU' | 'RECU'
}

// ---------------------------------------------------------------------------
// RSU (Restricted Stock Units)
// ---------------------------------------------------------------------------
export type RsuPlatform = 'EquatePlus' | 'Carta'
export type VestingType = 'cliff' | 'monthly'

export interface RsuGrant {
  id: string
  userId: string
  /** Actif sous-jacent (action de l'entreprise). */
  assetId: string
  grantDate: string // ISO date YYYY-MM-DD
  totalShares: number
  platform: RsuPlatform
  vestingType: VestingType
  /** cliff : date unique de livraison de la totalité des actions. */
  vestingDate?: string
  /** monthly : date du premier vesting mensuel. */
  vestingStartDate?: string
  /** monthly : nombre de mensualités (ex : 48 = 4 ans). */
  vestingMonths?: number
  note?: string
  createdAt: string
}

/** Événement de vesting calculé côté client (non persisté). */
export interface VestingEvent {
  date: string
  shares: number
  cumulativeShares: number
  status: 'vested' | 'pending'
}

// ---------------------------------------------------------------------------
// Analyse (analysisService — consensus, objectifs, news, fondamentaux).
// Séparé des données de marché (marketDataService).
// ---------------------------------------------------------------------------

export type AnalystRating =
  | 'STRONG_BUY'
  | 'BUY'
  | 'HOLD'
  | 'SELL'
  | 'STRONG_SELL'
  | 'UNKNOWN'

export interface AnalystConsensus {
  assetId: string
  symbol: string
  period?: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  total: number
  rating: AnalystRating
  updatedAt: string
}

export interface PriceTarget {
  assetId: string
  symbol: string
  targetHigh?: number
  targetLow?: number
  targetMean?: number
  targetMedian?: number
  currency?: string
  updatedAt: string
}

export interface AnalystRecommendation {
  assetId: string
  symbol: string
  period?: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

export interface CompanyNewsItem {
  id: string
  assetId: string
  headline: string
  source?: string
  url?: string
  datetime?: string
  summary?: string
  image?: string
}

/** Prochaine publication de résultats (earnings call). */
export interface NextEarnings {
  assetId: string
  symbol: string
  /** Date de la publication (YYYY-MM-DD). */
  date: string
  /** Estimation du BPA (EPS) si fournie. */
  epsEstimate?: number
  /** Moment : 'bmo' (avant ouverture), 'amc' (après clôture), 'dmh' (en séance) ou heure. */
  hour?: string
}
