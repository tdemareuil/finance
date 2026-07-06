import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { Card, EmptyState, Loading, StatCard } from '../components/common/ui'
import TradingViewWidget from '../components/assets/TradingViewWidget'
import PriceLineChart from '../components/charts/PriceLineChart'
import { getHistoricalPrices } from '../services/marketDataService'
import type { MarketPrice } from '../types'
import { formatDate, formatMoney, formatNumber, formatPct, signClass } from '../utils/format'

const TX_LABEL: Record<string, string> = {
  BUY: 'Achat', SELL: 'Vente', DIVIDEND: 'Dividende', FEE: 'Frais', DEPOSIT: 'Dépôt', WITHDRAWAL: 'Retrait',
}

export default function AssetDetailPage() {
  const { assetId } = useParams()
  const { assets, positions, transactions, priceByAssetId, accounts, loading } = usePortfolio()
  const [history, setHistory] = useState<MarketPrice[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const asset = assets.find((a) => a.id === assetId)
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  useEffect(() => {
    let active = true
    async function run() {
      if (!asset) return
      setHistoryLoading(true)
      const from = new Date()
      from.setFullYear(from.getFullYear() - 2)
      try {
        const h = await getHistoricalPrices(asset, from.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))
        if (active) setHistory(h)
      } catch {
        if (active) setHistory([])
      } finally {
        if (active) setHistoryLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [asset])

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

      <Card title="Performance de la ligne (cours)">
        {historyLoading ? <Loading label="Chargement des cours…" /> : <PriceLineChart prices={history} currency={asset.currency} />}
      </Card>

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
    </div>
  )
}
