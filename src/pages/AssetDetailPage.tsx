import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { Card, EmptyState, Loading, StatCard } from '../components/common/ui'
import TradingViewWidget from '../components/assets/TradingViewWidget'
import PriceLineChart from '../components/charts/PriceLineChart'
import AssetAnalysis from '../components/assets/AssetAnalysis'
import { getDividends, getHistoricalPrices } from '../services/marketDataService'
import { providerLabel } from '../services/providers/types'
import type { DividendEvent, MarketPrice } from '../types'
import type { ProviderName } from '../services/providers/types'
import { formatDate, formatMoney, formatNumber, formatPct, signClass } from '../utils/format'

const TX_LABEL: Record<string, string> = {
  BUY: 'Achat', SELL: 'Vente', DIVIDEND: 'Dividende', FEE: 'Frais', DEPOSIT: 'Dépôt', WITHDRAWAL: 'Retrait',
}

type Tab = 'resume' | 'performance' | 'analyse' | 'transactions' | 'dividendes'
const TABS: { key: Tab; label: string }[] = [
  { key: 'resume', label: 'Résumé' },
  { key: 'performance', label: 'Performance' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'dividendes', label: 'Dividendes' },
]

export default function AssetDetailPage() {
  const { assetId } = useParams()
  const { assets, positions, transactions, priceByAssetId, accounts, loading } = usePortfolio()
  const [tab, setTab] = useState<Tab>('resume')
  const [history, setHistory] = useState<MarketPrice[]>([])
  const [historySource, setHistorySource] = useState<ProviderName | 'none'>('none')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [divEvents, setDivEvents] = useState<DividendEvent[]>([])
  const [divLoaded, setDivLoaded] = useState(false)

  const asset = assets.find((a) => a.id === assetId)
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  // Réinitialise le lazy-load quand on change d'actif.
  useEffect(() => {
    setHistoryLoaded(false)
    setDivLoaded(false)
  }, [assetId])

  // Historique de cours : chargé UNIQUEMENT à l'ouverture de l'onglet Performance
  // (le cache évite tout rappel réseau si déjà frais).
  useEffect(() => {
    if (!asset || tab !== 'performance' || historyLoaded) return
    let active = true
    setHistoryLoading(true)
    setHistoryLoaded(true)
    const from = new Date()
    from.setFullYear(from.getFullYear() - 2)
    getHistoricalPrices(asset, from.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))
      .then(({ data, source }) => {
        if (!active) return
        setHistory(data ?? [])
        setHistorySource(source)
      })
      .catch(() => active && setHistory([]))
      .finally(() => active && setHistoryLoading(false))
    return () => {
      active = false
    }
  }, [asset, tab, historyLoaded])

  // Événements de dividendes : chargés à l'ouverture de l'onglet Dividendes.
  useEffect(() => {
    if (!asset || tab !== 'dividendes' || divLoaded) return
    let active = true
    setDivLoaded(true)
    getDividends(asset)
      .then(({ data }) => active && setDivEvents(data ?? []))
      .catch(() => active && setDivEvents([]))
    return () => {
      active = false
    }
  }, [asset, tab, divLoaded])

  if (loading) return <Loading />
  if (!asset) {
    return (
      <div className="page">
        <EmptyState title="Actif introuvable" hint={<Link to="/assets">Retour aux actifs</Link>} />
      </div>
    )
  }

  // Agrégat de la ligne (tous comptes confondus).
  const assetPositions = positions.filter((p) => p.assetId === asset.id)
  const quantity = assetPositions.reduce((s, p) => s + p.quantity, 0)
  const totalCost = assetPositions.reduce((s, p) => s + p.totalCost, 0)
  const pru = quantity > 0 ? totalCost / quantity : 0
  const dividends = assetPositions.reduce((s, p) => s + p.dividendsReceived, 0)
  const currentPrice = priceByAssetId[asset.id] ?? null
  const currentValue = currentPrice != null ? currentPrice * quantity : null
  const pnl = currentValue != null ? currentValue - totalCost : null
  const perf = currentValue != null && totalCost > 0 ? (currentValue - totalCost) / totalCost : null

  const assetTx = transactions.filter((t) => t.assetId === asset.id)
  const dividendTx = assetTx.filter((t) => t.type === 'DIVIDEND')
  const today = new Date().toISOString().slice(0, 10)
  const upcomingDiv = divEvents
    .filter((e) => (e.paymentDate ?? e.exDate ?? '') >= today)
    .sort((a, b) => ((a.paymentDate ?? a.exDate ?? '') < (b.paymentDate ?? b.exDate ?? '') ? -1 : 1))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/assets" className="back-link">← Actifs</Link>
          <h1 className="page-title">{asset.name}</h1>
          <p className="muted">
            {asset.ticker}{asset.exchange ? `.${asset.exchange}` : ''} · {asset.type} · {asset.currency}
            {asset.isin ? ` · ISIN ${asset.isin}` : ''}
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Quantité détenue" value={formatNumber(quantity, 4)} />
        <StatCard label="PRU" value={formatMoney(pru, asset.currency)} />
        <StatCard label="Cours actuel" value={currentPrice != null ? formatMoney(currentPrice, asset.currency) : '—'} />
        <StatCard label="Valeur" value={formatMoney(currentValue, asset.currency)} />
        <StatCard label="P&L latent" value={formatMoney(pnl, asset.currency)} tone={signClass(pnl) as never} sub={formatPct(perf)} />
        <StatCard label="Dividendes reçus" value={formatMoney(dividends, asset.currency)} tone="positive" />
      </div>

      {/* Onglets */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Résumé : graphique TradingView */}
      {tab === 'resume' && (
        <Card title="Graphique TradingView">
          {asset.tradingViewSymbol ? (
            <TradingViewWidget symbol={asset.tradingViewSymbol} />
          ) : (
            <div className="alert alert-info">
              Symbole TradingView non configuré pour cet actif.{' '}
              <Link to="/assets">Ajoutez-le</Link> (champ « Symbole TradingView », ex : <code>NASDAQ:AAPL</code>).
            </div>
          )}
        </Card>
      )}

      {/* Performance : cours + métriques */}
      {tab === 'performance' && (
        <Card
          title="Performance de la ligne (cours)"
          action={!historyLoading && historySource !== 'none' && <span className="muted small">Source : {providerLabel(historySource)}</span>}
        >
          {historyLoading ? <Loading label="Chargement des cours…" /> : <PriceLineChart prices={history} currency={asset.currency} />}
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <StatCard label="Performance latente" value={formatPct(perf)} tone={signClass(perf) as never} />
            <StatCard label="P&L latent" value={formatMoney(pnl, asset.currency)} tone={signClass(pnl) as never} />
            <StatCard label="Coût d'acquisition" value={formatMoney(totalCost, asset.currency)} />
          </div>
        </Card>
      )}

      {/* Analyse : consensus / objectifs / recommandations / news / fondamentaux */}
      {tab === 'analyse' && <AssetAnalysis asset={asset} currentPrice={currentPrice} />}

      {/* Transactions */}
      {tab === 'transactions' && (
        <Card title="Historique des transactions">
          {assetTx.length === 0 ? (
            <p className="muted">Aucune transaction pour cet actif.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Type</th><th>Compte</th>
                    <th className="num">Qté</th><th className="num">Prix</th><th className="num">Frais</th><th className="num">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {assetTx.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td><span className={`chip chip-${t.type.toLowerCase()}`}>{TX_LABEL[t.type]}</span></td>
                      <td>{accountName.get(t.accountId) ?? '—'}</td>
                      <td className="num">{t.quantity != null ? formatNumber(t.quantity, 4) : '—'}</td>
                      <td className="num">{t.price != null ? formatMoney(t.price, t.currency) : '—'}</td>
                      <td className="num">{t.fees != null ? formatMoney(t.fees, t.currency) : '—'}</td>
                      <td className="num">{t.amount != null ? formatMoney(t.amount, t.currency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Dividendes */}
      {tab === 'dividendes' && (
        <>
          <Card title="Dividendes reçus" action={<span className="muted small">Total : {formatMoney(dividends, asset.currency)}</span>}>
            {dividendTx.length === 0 ? (
              <p className="muted">Aucun dividende reçu enregistré pour cet actif.</p>
            ) : (
              <table className="table compact">
                <thead>
                  <tr><th>Date</th><th>Compte</th><th className="num">Montant</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {dividendTx.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{accountName.get(t.accountId) ?? '—'}</td>
                      <td className="num positive">{formatMoney(t.amount, t.currency)}</td>
                      <td className="muted small">{t.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Prochains dividendes">
            {upcomingDiv.length === 0 ? (
              <p className="muted">Aucun événement de dividende à venir connu pour cet actif.</p>
            ) : (
              <table className="table compact">
                <thead>
                  <tr><th>Ex-date</th><th>Paiement</th><th className="num">Montant / action</th><th className="num">Qté détenue</th><th className="num">Estimé</th></tr>
                </thead>
                <tbody>
                  {upcomingDiv.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDate(e.exDate)}</td>
                      <td>{formatDate(e.paymentDate)}</td>
                      <td className="num">{formatMoney(e.amountPerShare, e.currency)}</td>
                      <td className="num">{formatNumber(quantity, 2)}</td>
                      <td className="num">{formatMoney(quantity * e.amountPerShare, e.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
