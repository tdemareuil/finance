import { useEffect, useState } from 'react'
import type {
  AnalystConsensus,
  AnalystRating,
  AnalystRecommendation,
  Asset,
  CompanyFundamentals,
  CompanyNewsItem,
  PriceTarget,
} from '../../types'
import {
  getConsensus,
  getFundamentals,
  getNews,
  getPriceTarget,
  getRecommendationTrends,
  isFinnhubConfigured,
  isFmpConfigured,
} from '../../services/analysisService'
import { providerLabel, type ProviderName } from '../../services/providers/types'
import { Card, Loading } from '../common/ui'
import { formatDate, formatMoney, formatNumber, formatPct, signClass } from '../../utils/format'

const RATING_LABEL: Record<AnalystRating, string> = {
  STRONG_BUY: 'Achat fort',
  BUY: 'Achat',
  HOLD: 'Conserver',
  SELL: 'Vendre',
  STRONG_SELL: 'Vente forte',
  UNKNOWN: 'Indéterminé',
}
const RATING_TONE: Record<AnalystRating, string> = {
  STRONG_BUY: 'buy',
  BUY: 'buy',
  HOLD: 'dividend',
  SELL: 'sell',
  STRONG_SELL: 'sell',
  UNKNOWN: 'default',
}

function formatMarketCap(millions: number | undefined, currency = 'USD'): string {
  if (millions == null) return '—'
  const symbol = currency === 'EUR' ? '€' : '$'
  if (millions >= 1_000_000) return `${(millions / 1_000_000).toFixed(2)} T${symbol}`
  if (millions >= 1_000) return `${(millions / 1_000).toFixed(2)} Md${symbol}`
  return `${millions.toFixed(0)} M${symbol}`
}

interface State {
  loading: boolean
  consensus: AnalystConsensus | null
  target: PriceTarget | null
  trends: AnalystRecommendation[]
  news: CompanyNewsItem[]
  fundamentals: CompanyFundamentals | null
  sources: (ProviderName | 'none')[]
}

export default function AssetAnalysis({
  asset,
  currentPrice,
}: {
  asset: Asset
  currentPrice: number | null
}) {
  const [state, setState] = useState<State>({
    loading: true,
    consensus: null,
    target: null,
    trends: [],
    news: [],
    fundamentals: null,
    sources: [],
  })

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, loading: true }))
    ;(async () => {
      const empty = { data: null, source: 'none' as const }
      const emptyArr = { data: [], source: 'none' as const }
      const [consensus, target, trends, news, fundamentals] = await Promise.all([
        getConsensus(asset).catch(() => empty),
        getPriceTarget(asset).catch(() => empty),
        getRecommendationTrends(asset).catch(() => emptyArr),
        getNews(asset).catch(() => emptyArr),
        getFundamentals(asset).catch(() => empty),
      ])
      if (!active) return
      // Sources réellement utilisées (hors 'none'), pour l'affichage discret.
      const sources = [consensus.source, target.source, trends.source, news.source, fundamentals.source]
      setState({
        loading: false,
        consensus: consensus.data,
        target: target.data,
        trends: trends.data ?? [],
        news: news.data ?? [],
        fundamentals: fundamentals.data,
        sources,
      })
    })()
    return () => {
      active = false
    }
  }, [asset])

  const { loading, consensus, target, trends, news, fundamentals, sources } = state
  const isEtf = asset.type === 'ETF'
  const noFinnhubSymbol = !asset.finnhubSymbol?.trim()
  const usedSources = [...new Set(sources.filter((s) => s !== 'none'))] as ProviderName[]
  const anyMock = usedSources.includes('mock')
  const noAnalysisKey = !isFinnhubConfigured && !isFmpConfigured

  const potential =
    target?.targetMean != null && currentPrice != null && currentPrice > 0
      ? (target.targetMean - currentPrice) / currentPrice
      : null

  return (
    <div className="page">
      {noAnalysisKey && (
        <div className="alert alert-warn">
          Aucune clé d'analyse configurée (Finnhub / FMP) — <strong>données simulées</strong> (démonstration).
          Renseignez <code>VITE_FINNHUB_API_KEY</code> ou <code>VITE_FMP_API_KEY</code> dans <code>.env.local</code>.
        </div>
      )}

      {!loading && usedSources.length > 0 && (
        <p className="muted small">Source : {usedSources.map(providerLabel).join(', ')}</p>
      )}

      {loading ? (
        <Loading label="Chargement des données d'analyse…" />
      ) : (
        <>
          {/* 1 · Consensus analystes */}
          <Card
            title="Consensus analystes"
            action={consensus?.period && <span className="muted small">Période : {consensus.period}</span>}
          >
            {consensus ? (
              <>
                <div className="consensus-head">
                  <span className={`chip chip-${RATING_TONE[consensus.rating]} rating-badge`}>
                    {RATING_LABEL[consensus.rating]}
                  </span>
                  <span className="muted small">
                    {consensus.total} analyste(s) · maj {formatDate(consensus.updatedAt)}
                  </span>
                </div>
                <div className="consensus-bars">
                  <ConsensusBar label="Strong Buy" value={consensus.strongBuy} total={consensus.total} tone="buy" />
                  <ConsensusBar label="Buy" value={consensus.buy} total={consensus.total} tone="buy" />
                  <ConsensusBar label="Hold" value={consensus.hold} total={consensus.total} tone="dividend" />
                  <ConsensusBar label="Sell" value={consensus.sell} total={consensus.total} tone="sell" />
                  <ConsensusBar label="Strong Sell" value={consensus.strongSell} total={consensus.total} tone="sell" />
                </div>
              </>
            ) : isEtf ? (
              <p className="muted">
                Les recommandations analystes sont généralement peu disponibles pour les ETF.
                Les news, dividendes et données de marché restent disponibles si l'API les fournit.
              </p>
            ) : (
              <p className="muted">
                Données d'analyse indisponibles pour cet actif.
                {noFinnhubSymbol && ' Symbole Finnhub non configuré pour cet actif.'}
              </p>
            )}
          </Card>

          {/* 2 · Objectifs de cours */}
          <Card title="Objectifs de cours">
            {target ? (
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Objectif moyen</div>
                  <div className="stat-value">{formatMoney(target.targetMean, asset.currency)}</div>
                  {potential != null && (
                    <div className={`stat-sub ${signClass(potential)}`}>Potentiel {formatPct(potential)}</div>
                  )}
                </div>
                <div className="stat-card">
                  <div className="stat-label">Objectif médian</div>
                  <div className="stat-value">{formatMoney(target.targetMedian, asset.currency)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Objectif haut</div>
                  <div className="stat-value positive">{formatMoney(target.targetHigh, asset.currency)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Objectif bas</div>
                  <div className="stat-value negative">{formatMoney(target.targetLow, asset.currency)}</div>
                </div>
              </div>
            ) : (
              <p className="muted">
                Objectifs de cours indisponibles pour cet actif
                {!noAnalysisKey ? ' (endpoint souvent réservé au plan payant du provider).' : '.'}
              </p>
            )}
          </Card>

          {/* 3 · Tendance des recommandations */}
          <Card title="Tendance des recommandations">
            {trends.length > 0 ? (
              <div className="table-scroll">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th className="num">Strong Buy</th>
                      <th className="num">Buy</th>
                      <th className="num">Hold</th>
                      <th className="num">Sell</th>
                      <th className="num">Strong Sell</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((t, i) => (
                      <tr key={`${t.period}-${i}`}>
                        <td>{t.period ?? '—'}</td>
                        <td className="num">{t.strongBuy}</td>
                        <td className="num">{t.buy}</td>
                        <td className="num">{t.hold}</td>
                        <td className="num">{t.sell}</td>
                        <td className="num">{t.strongSell}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                {isEtf
                  ? 'Pas de tendance de recommandation pour les ETF.'
                  : 'Tendance des recommandations indisponible pour cet actif.'}
              </p>
            )}
          </Card>

          {/* 4 · Actualités récentes */}
          <Card title="Actualités récentes">
            {news.length > 0 ? (
              <ul className="news-list">
                {news.map((n) => (
                  <li key={n.id} className="news-item">
                    <div className="news-main">
                      {n.url && n.url !== '#' ? (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="news-headline">
                          {n.headline}
                        </a>
                      ) : (
                        <span className="news-headline">{n.headline}</span>
                      )}
                      {n.summary && <p className="news-summary">{n.summary.slice(0, 220)}{n.summary.length > 220 ? '…' : ''}</p>}
                      <div className="news-meta muted small">
                        {n.source ?? 'Source inconnue'} · {formatDate(n.datetime)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Aucune actualité disponible pour cet actif.</p>
            )}
          </Card>

          {/* 5 · Fondamentaux */}
          <Card title="Fondamentaux clés">
            {fundamentals ? (
              <ul className="kv-list fundamentals">
                <li><span>Capitalisation</span><strong>{formatMarketCap(fundamentals.marketCapitalization, fundamentals.currency)}</strong></li>
                <li><span>PER (normalisé annuel)</span><strong>{formatNumber(fundamentals.peNormalizedAnnual)}</strong></li>
                <li><span>PER (TTM)</span><strong>{formatNumber(fundamentals.peBasicExclExtraTTM)}</strong></li>
                <li><span>EPS (TTM)</span><strong>{formatMoney(fundamentals.epsBasicExclExtraItemsTTM, asset.currency)}</strong></li>
                <li><span>Rendement du dividende</span><strong>{fundamentals.dividendYieldIndicatedAnnual != null ? `${formatNumber(fundamentals.dividendYieldIndicatedAnnual)} %` : '—'}</strong></li>
                <li><span>Bêta</span><strong>{formatNumber(fundamentals.beta)}</strong></li>
                <li><span>Plus haut 52 sem.</span><strong>{formatMoney(fundamentals.week52High, asset.currency)}</strong></li>
                <li><span>Plus bas 52 sem.</span><strong>{formatMoney(fundamentals.week52Low, asset.currency)}</strong></li>
              </ul>
            ) : (
              <p className="muted">Fondamentaux indisponibles pour cet actif.</p>
            )}
          </Card>

          <p className="muted small disclaimer">
            {anyMock ? 'Certaines données sont simulées. ' : ''}
            Données informatives uniquement, ne constituent pas un conseil financier.
          </p>
        </>
      )}
    </div>
  )
}

function ConsensusBar({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="consensus-bar-row">
      <span className="consensus-bar-label">{label}</span>
      <div className="consensus-bar-track">
        <div className={`consensus-bar-fill chip-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="consensus-bar-value num">{value}</span>
    </div>
  )
}
