import type {
  AnalystRecommendation,
  Asset,
  CompanyFundamentals,
  CompanyNewsItem,
  PriceTarget,
} from '../types'

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
