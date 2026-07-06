import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { Card, EmptyState, Loading, StatCard } from '../components/ui'
import TradingViewWidget from '../components/TradingViewWidget'
import AssetAnalysis from '../components/AssetAnalysis'
import AddOperationModal from '../components/AddOperationModal'
import { getDividends } from '../services/marketDataService'
import { listRsuGrants, deleteRsuGrant } from '../services/rsuService'
import { deleteTransaction } from '../services/transactionService'
import { computeVestingSummary } from '../services/rsuCalculator'
import type { DividendEvent, RsuGrant, Transaction } from '../types'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatMoney, formatNumber, formatPct, signClass } from '../utils'

const TX_LABEL: Record<string, string> = {
  BUY: 'Achat', SELL: 'Vente', DIVIDEND: 'Dividende', FEE: 'Frais', DEPOSIT: 'Dépôt', WITHDRAWAL: 'Retrait',
}

type Tab = 'performance' | 'analyse' | 'transactions'
const TABS: { key: Tab; label: string }[] = [
  { key: 'performance', label: 'Performance' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'transactions', label: 'Transactions' },
]

export default function AssetDetailPage() {
  const { assetId } = useParams()
  const { user } = useAuth()
  const { assets, positions, transactions, priceByAssetId, accounts, loading, reload } = usePortfolio()
  const [tab, setTab] = useState<Tab>('performance')
  const [divEvents, setDivEvents] = useState<DividendEvent[]>([])
  const [rsuGrants, setRsuGrants] = useState<RsuGrant[]>([])
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [editGrant, setEditGrant] = useState<RsuGrant | null>(null)

  const asset = assets.find((a) => a.id === assetId)
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  // Grants RSU de l'utilisateur (filtrés sur cet actif à l'affichage).
  const reloadGrants = useCallback(() => {
    if (!user) return
    listRsuGrants(user.id).then(setRsuGrants).catch(() => setRsuGrants([]))
  }, [user])

  useEffect(() => {
    reloadGrants()
  }, [reloadGrants])

  async function handleDeleteTx(t: Transaction) {
    if (!confirm('Supprimer cette transaction ?')) return
    try {
      await deleteTransaction(t.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  async function handleDeleteGrant(g: RsuGrant) {
    if (!confirm('Supprimer ce grant RSU ?')) return
    try {
      await deleteRsuGrant(g.id)
      reloadGrants()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  // Historique des dividendes du titre (données de marché, mises en cache).
  useEffect(() => {
    if (!asset) return
    let active = true
    getDividends(asset)
      .then(({ data }) => active && setDivEvents(data ?? []))
      .catch(() => active && setDivEvents([]))
    return () => {
      active = false
    }
  }, [asset])

  if (loading) return <Loading />
  if (!asset) {
    return (
      <div className="page">
        <EmptyState title="Actif introuvable" hint={<Link to="/portfolio">Retour au portefeuille</Link>} />
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
  const assetGrants = rsuGrants.filter((g) => g.assetId === asset.id)
  const today = new Date().toISOString().slice(0, 10)
  const upcomingDiv = divEvents
    .filter((e) => (e.paymentDate ?? e.exDate ?? '') >= today)
    .sort((a, b) => ((a.paymentDate ?? a.exDate ?? '') < (b.paymentDate ?? b.exDate ?? '') ? -1 : 1))
  const pastDiv = divEvents
    .filter((e) => (e.paymentDate ?? e.exDate ?? '') < today)
    .sort((a, b) => ((a.paymentDate ?? a.exDate ?? '') > (b.paymentDate ?? b.exDate ?? '') ? -1 : 1))
  const hasDividendInfo = dividendTx.length > 0 || pastDiv.length > 0 || upcomingDiv.length > 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/portfolio" className="back-link">← Portefeuille</Link>
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

      {/* Performance : graphique TradingView + métriques + RSU */}
      {tab === 'performance' && (
        <>
          <Card title="Graphique TradingView">
            {asset.tradingViewSymbol ? (
              <TradingViewWidget symbol={asset.tradingViewSymbol} />
            ) : (
              <div className="alert alert-info">
                Symbole TradingView non configuré pour cet actif.{' '}
                <Link to="/settings">Ajoutez-le</Link> (Paramètres → Actifs, champ « Symbole TradingView », ex : <code>NASDAQ:AAPL</code>).
              </div>
            )}
            <div className="stat-grid" style={{ marginTop: 16 }}>
              <StatCard label="Performance latente" value={formatPct(perf)} tone={signClass(perf) as never} />
              <StatCard label="P&L latent" value={formatMoney(pnl, asset.currency)} tone={signClass(pnl) as never} />
              <StatCard label="Coût d'acquisition" value={formatMoney(totalCost, asset.currency)} />
            </div>
          </Card>

          {assetGrants.length > 0 && (
            <Card title="RSU · Vesting">
              <div className="table-scroll">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Attribution</th>
                      <th>Plateforme</th>
                      <th className="num">Actions</th>
                      <th>Vesting</th>
                      <th className="num">Acquises</th>
                      <th>Prochaine livraison</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetGrants.map((g) => {
                      const { vestedShares, nextEvent } = computeVestingSummary(g, today)
                      return (
                        <tr key={g.id}>
                          <td>{formatDate(g.grantDate)}</td>
                          <td><span className="chip chip-info">{g.platform}</span></td>
                          <td className="num">{g.totalShares.toLocaleString('fr-FR')}</td>
                          <td>{g.vestingType === 'cliff' ? 'Cliff' : `Mensuel · ${g.vestingMonths} mois`}</td>
                          <td className="num">{vestedShares.toLocaleString('fr-FR')} / {g.totalShares.toLocaleString('fr-FR')}</td>
                          <td>
                            {nextEvent
                              ? `${formatDate(nextEvent.date)} (+${nextEvent.shares.toLocaleString('fr-FR')})`
                              : <span className="chip chip-positive">Terminé</span>}
                          </td>
                          <td className="row-actions">
                            <button className="btn btn-sm btn-ghost" onClick={() => setEditGrant(g)}>Modifier</button>
                            <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDeleteGrant(g)}>Suppr.</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Dividendes : reçus par l'utilisateur + historique/à venir du titre */}
          {dividendTx.length > 0 && (
            <Card title="Dividendes reçus" action={<span className="muted small">Total : {formatMoney(dividends, asset.currency)}</span>}>
              <div className="table-scroll">
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
              </div>
            </Card>
          )}

          {pastDiv.length > 0 && (
            <Card title="Historique des dividendes du titre">
              <div className="table-scroll">
                <table className="table compact">
                  <thead>
                    <tr><th>Ex-date</th><th>Paiement</th><th className="num">Montant / action</th></tr>
                  </thead>
                  <tbody>
                    {pastDiv.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDate(e.exDate)}</td>
                        <td>{formatDate(e.paymentDate)}</td>
                        <td className="num">{formatMoney(e.amountPerShare, e.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {upcomingDiv.length > 0 && (
            <Card title="Prochains dividendes">
              <div className="table-scroll">
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
              </div>
            </Card>
          )}

          {!hasDividendInfo && (
            <Card title="Dividendes">
              <p className="muted">Aucun dividende reçu ni information de dividende disponible pour ce titre.</p>
            </Card>
          )}
        </>
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
                    <th className="num">Qté</th><th className="num">Prix</th><th className="num">Frais</th><th className="num">Montant</th><th></th>
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
                      <td className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditTx(t)}>Modifier</button>
                        <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDeleteTx(t)}>Suppr.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {editTx && user && (
        <AddOperationModal
          accounts={accounts}
          assets={assets}
          userId={user.id}
          editTransaction={editTx}
          onClose={() => setEditTx(null)}
          onSaved={reload}
        />
      )}
      {editGrant && user && (
        <AddOperationModal
          accounts={accounts}
          assets={assets}
          userId={user.id}
          editGrant={editGrant}
          onClose={() => setEditGrant(null)}
          onSaved={reloadGrants}
        />
      )}
    </div>
  )
}
