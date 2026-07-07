import type {
  Account,
  AnalystRecommendation,
  Asset,
  CompanyFundamentals,
  CompanyNewsItem,
  Currency,
  DividendEvent,
  PriceTarget,
  Transaction,
} from './types'


// ---------------------------------------------------------------------------
// Jeu de données de démonstration (fictif — aucune donnée réelle).
// Utilisé en mode démo, ou via le bouton "Charger les données de démo".
// Les IDs sont stables pour garantir l'intégrité référentielle.
// ---------------------------------------------------------------------------

const now = new Date().toISOString()

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function buildDemoData(userId: string): {
  accounts: Account[]
  assets: Asset[]
  transactions: Transaction[]
  dividendEvents: DividendEvent[]
} {
  const accounts: Account[] = [
    { id: 'demo-acc-pea', userId, name: 'PEA Fortuneo', type: 'PEA', currency: 'EUR', createdAt: now },
    { id: 'demo-acc-cto', userId, name: 'CTO Trade Republic', type: 'CTO', currency: 'EUR', createdAt: now },
    { id: 'demo-acc-livret', userId, name: 'Livret+', type: 'LIVRET_PLUS', currency: 'EUR', createdAt: now },
  ]

  const assets: Asset[] = [
    {
      id: 'demo-ast-cw8', userId, name: 'Amundi MSCI World UCITS ETF', ticker: 'CW8',
      exchange: 'PA', isin: 'FR0010315770', currency: 'EUR', type: 'ETF',
      sector: 'Diversifié', country: 'Monde', tradingViewSymbol: 'EURONEXT:CW8',
      eodhdSymbol: 'CW8.PA', finnhubSymbol: 'CW8.PA', createdAt: now,
    },
    {
      id: 'demo-ast-aapl', userId, name: 'Apple Inc.', ticker: 'AAPL',
      exchange: 'NASDAQ', isin: 'US0378331005', currency: 'USD', type: 'STOCK',
      sector: 'Technologie', country: 'États-Unis', tradingViewSymbol: 'NASDAQ:AAPL',
      eodhdSymbol: 'AAPL.US', finnhubSymbol: 'AAPL', createdAt: now,
    },
    {
      id: 'demo-ast-mc', userId, name: 'LVMH', ticker: 'MC',
      exchange: 'PA', isin: 'FR0000121014', currency: 'EUR', type: 'STOCK',
      sector: 'Luxe', country: 'France', tradingViewSymbol: 'EURONEXT:MC',
      eodhdSymbol: 'MC.PA', finnhubSymbol: 'MC.PA', createdAt: now,
    },
  ]

  const transactions: Transaction[] = [
    // --- Dépôts initiaux ---
    { id: 'demo-tx-01', userId, accountId: 'demo-acc-pea', type: 'DEPOSIT', date: iso(2023, 1, 10), amount: 10000, currency: 'EUR', source: 'MANUAL', note: 'Versement initial PEA', createdAt: now },
    { id: 'demo-tx-02', userId, accountId: 'demo-acc-cto', type: 'DEPOSIT', date: iso(2023, 1, 15), amount: 6000, currency: 'EUR', source: 'MANUAL', note: 'Versement initial CTO', createdAt: now },
    { id: 'demo-tx-03', userId, accountId: 'demo-acc-livret', type: 'DEPOSIT', date: iso(2023, 2, 1), amount: 5000, currency: 'EUR', source: 'MANUAL', note: 'Épargne de précaution', createdAt: now },

    // --- Achats ETF CW8 (PEA) ---
    { id: 'demo-tx-10', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-cw8', type: 'BUY', date: iso(2023, 1, 20), quantity: 10, price: 380, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-11', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-cw8', type: 'BUY', date: iso(2023, 6, 12), quantity: 8, price: 410, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-12', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-cw8', type: 'BUY', date: iso(2024, 1, 8), quantity: 6, price: 445, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },

    // --- Achats/ventes LVMH (PEA) ---
    { id: 'demo-tx-20', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-mc', type: 'BUY', date: iso(2023, 3, 3), quantity: 3, price: 820, fees: 3.9, currency: 'EUR', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-21', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-mc', type: 'SELL', date: iso(2024, 4, 18), quantity: 1, price: 780, fees: 3.9, currency: 'EUR', source: 'MANUAL', note: 'Prise de bénéfice partielle', createdAt: now },
    { id: 'demo-tx-22', userId, accountId: 'demo-acc-pea', assetId: 'demo-ast-mc', type: 'DIVIDEND', date: iso(2024, 4, 25), amount: 26, currency: 'EUR', source: 'MANUAL', note: 'Dividende LVMH', createdAt: now },

    // --- Apple (CTO, USD) ---
    { id: 'demo-tx-30', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'BUY', date: iso(2023, 2, 1), quantity: 15, price: 145, fees: 1, currency: 'USD', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-31', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'BUY', date: iso(2023, 9, 20), quantity: 10, price: 175, fees: 1, currency: 'USD', source: 'MANUAL', createdAt: now },
    { id: 'demo-tx-32', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'DIVIDEND', date: iso(2024, 2, 15), amount: 6, currency: 'USD', source: 'MANUAL', note: 'Dividende AAPL', createdAt: now },
    { id: 'demo-tx-33', userId, accountId: 'demo-acc-cto', assetId: 'demo-ast-aapl', type: 'DIVIDEND', date: iso(2024, 5, 15), amount: 6.25, currency: 'USD', source: 'MANUAL', note: 'Dividende AAPL', createdAt: now },

    // --- Frais de tenue de compte / courtage divers ---
    { id: 'demo-tx-40', userId, accountId: 'demo-acc-cto', type: 'FEE', date: iso(2023, 12, 31), amount: 12, currency: 'EUR', source: 'MANUAL', note: 'Frais de change annuels', createdAt: now },
    { id: 'demo-tx-41', userId, accountId: 'demo-acc-pea', type: 'FEE', date: iso(2024, 6, 30), amount: 8, currency: 'EUR', source: 'MANUAL', note: 'Droits de garde', createdAt: now },

    // --- Livret+ (intérêts modélisés en dépôt) ---
    { id: 'demo-tx-50', userId, accountId: 'demo-acc-livret', type: 'DEPOSIT', date: iso(2023, 12, 31), amount: 150, currency: 'EUR', source: 'MANUAL', note: 'Intérêts Livret+', createdAt: now },
  ]

  const dividendEvents: DividendEvent[] = [
    { id: 'demo-div-01', userId, assetId: 'demo-ast-mc', exDate: iso(2024, 4, 22), paymentDate: iso(2024, 4, 25), amountPerShare: 13, currency: 'EUR', createdAt: now },
    { id: 'demo-div-02', userId, assetId: 'demo-ast-aapl', exDate: iso(2024, 2, 9), paymentDate: iso(2024, 2, 15), amountPerShare: 0.24, currency: 'USD', createdAt: now },
  ]

  return { accounts, assets, transactions, dividendEvents }
}


// ---------------------------------------------------------------------------
// Données d'analyse fictives (mode mock) pour analysisService.
// Déterministes par symbole. Utilisées quand aucune clé Finnhub n'est configurée.
// Séparé de mockMarketData (cours) — cohérent avec la séparation des services.
// ---------------------------------------------------------------------------

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) + 1
}

function seeded(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function symbolOf(asset: Asset): string {
  return asset.finnhubSymbol || asset.ticker
}

function monthsAgoIso(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

/** Tendances de recommandation fictives (4 périodes). Vide pour les ETF. */
export function getMockRecommendationTrends(asset: Asset): AnalystRecommendation[] {
  if (asset.type === 'ETF' || asset.type === 'CASH') return []
  const rand = seeded(hashString(symbolOf(asset)))
  const symbol = symbolOf(asset)
  const out: AnalystRecommendation[] = []
  // Biais global (certains titres plus "buy" que d'autres).
  const bias = rand()
  for (let m = 0; m < 4; m++) {
    const base = 5 + Math.floor(rand() * 10)
    const strongBuy = Math.round(base * (0.2 + bias * 0.4))
    const buy = Math.round(base * (0.2 + rand() * 0.3))
    const hold = Math.round(base * (0.2 + rand() * 0.3))
    const sell = Math.round(base * rand() * 0.2)
    const strongSell = Math.round(base * rand() * 0.1)
    out.push({
      assetId: asset.id,
      symbol,
      period: monthsAgoIso(m),
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
    })
  }
  return out
}

export function getMockPriceTarget(asset: Asset): PriceTarget {
  const rand = seeded(hashString(symbolOf(asset)) + 7)
  const mid = 40 + Math.round(rand() * 260)
  const spread = mid * (0.08 + rand() * 0.12)
  return {
    assetId: asset.id,
    symbol: symbolOf(asset),
    targetMean: Math.round(mid * 100) / 100,
    targetMedian: Math.round((mid + (rand() - 0.5) * spread * 0.3) * 100) / 100,
    targetHigh: Math.round((mid + spread) * 100) / 100,
    targetLow: Math.round((mid - spread) * 100) / 100,
    currency: asset.currency,
    updatedAt: new Date().toISOString(),
  }
}

const NEWS_TEMPLATES = [
  { headline: 'Résultats trimestriels supérieurs aux attentes', source: 'MarketWire' },
  { headline: 'Un analyste relève son objectif de cours', source: 'Bloomberg' },
  { headline: 'Annonce d\'un nouveau partenariat stratégique', source: 'Reuters' },
  { headline: 'Le titre progresse dans un marché volatil', source: 'Les Échos' },
  { headline: 'Perspectives revues à la hausse pour l\'exercice', source: 'Financial Times' },
  { headline: 'Programme de rachat d\'actions annoncé', source: 'CNBC' },
  { headline: 'Nomination d\'un nouveau dirigeant', source: 'WSJ' },
]

export function getMockCompanyNews(asset: Asset): CompanyNewsItem[] {
  const rand = seeded(hashString(symbolOf(asset)) + 13)
  const n = 6
  const out: CompanyNewsItem[] = []
  for (let i = 0; i < n; i++) {
    const t = NEWS_TEMPLATES[Math.floor(rand() * NEWS_TEMPLATES.length)]
    const d = new Date()
    d.setDate(d.getDate() - i * 3 - Math.floor(rand() * 2))
    out.push({
      id: `mock-news-${asset.id}-${i}`,
      assetId: asset.id,
      headline: `${asset.name} — ${t.headline}`,
      source: t.source,
      url: '#',
      datetime: d.toISOString(),
      summary:
        'Résumé fictif (données mock) : cet article de démonstration illustre le fil d\'actualité. Configurez une clé Finnhub pour des news réelles.',
    })
  }
  return out
}

export function getMockCompanyFundamentals(asset: Asset): CompanyFundamentals {
  const rand = seeded(hashString(symbolOf(asset)) + 21)
  const price = 40 + rand() * 260
  return {
    assetId: asset.id,
    symbol: symbolOf(asset),
    marketCapitalization: Math.round((5000 + rand() * 2_000_000) * 10) / 10, // en M$
    peNormalizedAnnual: Math.round((10 + rand() * 35) * 100) / 100,
    peBasicExclExtraTTM: Math.round((10 + rand() * 35) * 100) / 100,
    epsBasicExclExtraItemsTTM: Math.round((1 + rand() * 12) * 100) / 100,
    dividendYieldIndicatedAnnual: Math.round(rand() * 4 * 100) / 100,
    beta: Math.round((0.6 + rand() * 1.2) * 100) / 100,
    week52High: Math.round(price * (1.05 + rand() * 0.2) * 100) / 100,
    week52Low: Math.round(price * (0.6 + rand() * 0.2) * 100) / 100,
    currency: asset.currency,
  }
}


// ---------------------------------------------------------------------------
// Données de marché fictives (mode mock).
// Génère des séries de prix déterministes (marche aléatoire seedée) pour que
// l'application soit pleinement fonctionnelle sans clé EODHD.
// ---------------------------------------------------------------------------

interface MockSymbolConfig {
  basePrice: number
  /** Volatilité quotidienne relative. */
  vol: number
  /** Dérive annuelle attendue (ex : 0.07 = +7%/an). */
  annualDrift: number
  currency: Currency
  /** Dividende annuel par action (approximatif), 0 si aucun. */
  annualDividend?: number
}

// Symboles connus des données de démo + benchmark MSCI World.
const SYMBOLS: Record<string, MockSymbolConfig> = {
  'CW8.PA': { basePrice: 480, vol: 0.008, annualDrift: 0.09, currency: 'EUR', annualDividend: 0 },
  'IWDA.AS': { basePrice: 92, vol: 0.008, annualDrift: 0.09, currency: 'EUR', annualDividend: 0 },
  'URTH': { basePrice: 150, vol: 0.008, annualDrift: 0.09, currency: 'USD', annualDividend: 2.2 },
  'AAPL.US': { basePrice: 195, vol: 0.014, annualDrift: 0.12, currency: 'USD', annualDividend: 1.0 },
  'MC.PA': { basePrice: 720, vol: 0.013, annualDrift: 0.06, currency: 'EUR', annualDividend: 13 },
  'AIR.PA': { basePrice: 145, vol: 0.013, annualDrift: 0.08, currency: 'EUR', annualDividend: 1.8 },
}

const DEFAULT_CONFIG: MockSymbolConfig = {
  basePrice: 100,
  vol: 0.012,
  annualDrift: 0.05,
  currency: 'EUR',
}

/** Hash déterministe d'une chaîne → nombre [0,1). */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}


function resolveConfig(symbol: string): MockSymbolConfig {
  return SYMBOLS[symbol] ?? { ...DEFAULT_CONFIG, basePrice: 50 + (hashString(symbol) % 200) }
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface MockPricePoint {
  date: string
  close: number
  currency: Currency
}

/**
 * Génère la série de prix quotidienne d'un symbole entre deux dates.
 * Déterministe : même symbole + mêmes dates ⇒ même série.
 */
export function getMockHistoricalPrices(
  symbol: string,
  from: string,
  to: string,
): MockPricePoint[] {
  const cfg = resolveConfig(symbol)
  const rand = seededRandom(hashString(symbol))
  const start = new Date(from)
  const end = new Date(to)
  const totalDays = Math.max(1, daysBetween(start, end))
  const dailyDrift = cfg.annualDrift / 252

  const out: MockPricePoint[] = []
  let price = cfg.basePrice
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay()
    // On saute les week-ends (marché fermé).
    if (dow === 0 || dow === 6) continue
    const shock = (rand() - 0.5) * 2 * cfg.vol
    price = price * (1 + dailyDrift + shock)
    out.push({ date: toISODate(d), close: Math.round(price * 100) / 100, currency: cfg.currency })
  }
  return out
}

/**
 * Série déterministe du cours EUR/USD (USD pour 1 EUR) entre deux dates.
 * Marche aléatoire douce et bornée autour de ~1,08 (précision 4 décimales),
 * utilisée en repli lorsqu'aucune clé de données de marché n'est configurée.
 */
export function getMockEurUsd(from: string, to: string): { date: string; rate: number }[] {
  const rand = seededRandom(hashString('EURUSD-fx'))
  const start = new Date(from)
  const end = new Date(to)
  const totalDays = Math.max(1, daysBetween(start, end))
  const out: { date: string; rate: number }[] = []
  let rate = 1.08
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue // marché fermé le week-end
    // Rappel vers 1,08 (retour à la moyenne) + petit choc quotidien.
    const meanReversion = (1.08 - rate) * 0.02
    const shock = (rand() - 0.5) * 2 * 0.004
    rate = Math.min(1.16, Math.max(1.0, rate + meanReversion + shock))
    out.push({ date: toISODate(d), rate: Math.round(rate * 10000) / 10000 })
  }
  return out
}

/** Dernier prix connu (aujourd'hui) pour un symbole. */
export function getMockLatestPrice(symbol: string, today: string): MockPricePoint {
  // On régénère sur ~2 ans pour obtenir un prix "actuel" cohérent.
  const from = new Date(today)
  from.setFullYear(from.getFullYear() - 2)
  const series = getMockHistoricalPrices(symbol, toISODate(from), today)
  return series[series.length - 1] ?? { date: today, close: resolveConfig(symbol).basePrice, currency: resolveConfig(symbol).currency }
}

export interface MockDividend {
  exDate: string
  paymentDate: string
  amountPerShare: number
  currency: Currency
}

/**
 * Événements de dividendes fictifs pour un symbole (trimestriels si annualDividend > 0).
 * Couvre l'année passée et les 2 prochains trimestres (calendrier).
 */
export function getMockDividendEvents(symbol: string, today: string): MockDividend[] {
  const cfg = resolveConfig(symbol)
  if (!cfg.annualDividend) return []
  const perQuarter = Math.round((cfg.annualDividend / 4) * 100) / 100
  const now = new Date(today)
  const events: MockDividend[] = []
  // De -4 trimestres à +2 trimestres.
  for (let q = -4; q <= 2; q++) {
    const ex = new Date(now)
    ex.setMonth(now.getMonth() + q * 3)
    ex.setDate(15)
    const pay = new Date(ex)
    pay.setDate(ex.getDate() + 20)
    events.push({
      exDate: toISODate(ex),
      paymentDate: toISODate(pay),
      amountPerShare: perQuarter,
      currency: cfg.currency,
    })
  }
  return events
}

export const KNOWN_MOCK_SYMBOLS = Object.keys(SYMBOLS)
