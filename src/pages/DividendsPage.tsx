import { useEffect, useMemo, useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { Card, EmptyState, Loading, StatCard } from '../components/common/ui'
import MonthlyBarChart from '../components/charts/MonthlyBarChart'
import AllocationPie from '../components/charts/AllocationPie'
import { dividendsByAsset, dividendsByMonth } from '../utils/aggregations'
import { getDividendEvents } from '../services/marketDataService'
import type { DividendCalendarEntry, DividendEvent } from '../types'
import { formatDate, formatMoney, formatNumber, formatPct } from '../utils/format'

export default function DividendsPage() {
  const { transactions, assets, positions, summary, loading, dividendEvents } = usePortfolio()
  const [marketEvents, setMarketEvents] = useState<DividendEvent[]>([])
  const [calLoading, setCalLoading] = useState(true)

  // Quantité détenue par actif (tous comptes).
  const qtyByAsset = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of positions) m.set(p.assetId, (m.get(p.assetId) ?? 0) + p.quantity)
    return m
  }, [positions])

  const heldAssets = useMemo(() => assets.filter((a) => (qtyByAsset.get(a.id) ?? 0) > 0 && a.type !== 'CASH'), [assets, qtyByAsset])

  useEffect(() => {
    let active = true
    async function run() {
      setCalLoading(true)
      try {
        const results = await Promise.all(heldAssets.map((a) => getDividendEvents(a).catch(() => [])))
        if (active) setMarketEvents(results.flat())
      } finally {
        if (active) setCalLoading(false)
      }
    }
    if (heldAssets.length) run()
    else {
      setMarketEvents([])
      setCalLoading(false)
    }
  }, [heldAssets])

  if (loading) return <Loading />

  const byMonth = dividendsByMonth(transactions)
  const byAsset = dividendsByAsset(transactions, assets)

  // Rendement sur coût = dividendes reçus / capital investi (approché).
  const totalCost = positions.reduce((s, p) => s + p.totalCost, 0)
  const yieldOnCost = totalCost > 0 ? summary.dividendsReceived / totalCost : null

  // Calendrier : événements stockés + événements marché, futurs & récents.
  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const today = new Date().toISOString().slice(0, 10)
  const allEvents = [...dividendEvents, ...marketEvents]
  const calendar: DividendCalendarEntry[] = allEvents
    .map((ev) => {
      const asset = assetMap.get(ev.assetId)
      if (!asset) return null
      const qty = qtyByAsset.get(ev.assetId) ?? 0
      const refDate = ev.paymentDate ?? ev.exDate ?? today
      return {
        asset,
        event: ev,
        quantityHeld: qty,
        estimatedAmount: qty * ev.amountPerShare,
        status: refDate <= today ? ('RECU' as const) : ('PREVU' as const),
      }
    })
    .filter((e): e is DividendCalendarEntry => e != null && e.quantityHeld > 0)
    .sort((a, b) => {
      const da = a.event.paymentDate ?? a.event.exDate ?? ''
      const db = b.event.paymentDate ?? b.event.exDate ?? ''
      return da < db ? 1 : -1
    })

  if (transactions.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Dividendes</h1>
        <EmptyState title="Aucune donnée" hint="Ajoutez des transactions de type Dividende." />
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Dividendes</h1>

      <div className="stat-grid">
        <StatCard label="Dividendes reçus (total)" value={formatMoney(summary.dividendsReceived)} tone="positive" />
        <StatCard label="Rendement sur coût" value={formatPct(yieldOnCost)} sub="dividendes / coût d'acquisition" />
        <StatCard label="Événements à venir" value={calendar.filter((c) => c.status === 'PREVU').length} />
      </div>

      <div className="cards-2">
        <Card title="Dividendes reçus par mois">
          <MonthlyBarChart data={byMonth} color="#22c55e" label="Dividendes" />
        </Card>
        <Card title="Dividendes par actif">
          <AllocationPie data={byAsset} />
        </Card>
      </div>

      <Card
        title="Calendrier des dividendes"
        action={calLoading ? <span className="muted small">Chargement…</span> : undefined}
      >
        {calendar.length === 0 ? (
          <p className="muted">Aucun événement de dividende pour les positions détenues.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Actif</th>
                  <th>Ex-date</th>
                  <th>Paiement</th>
                  <th className="num">Montant / action</th>
                  <th className="num">Qté détenue</th>
                  <th className="num">Montant estimé</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {calendar.map((c, i) => (
                  <tr key={`${c.event.id}-${i}`}>
                    <td>{c.asset.name}</td>
                    <td>{formatDate(c.event.exDate)}</td>
                    <td>{formatDate(c.event.paymentDate)}</td>
                    <td className="num">{formatMoney(c.event.amountPerShare, c.event.currency)}</td>
                    <td className="num">{formatNumber(c.quantityHeld, 2)}</td>
                    <td className="num">{formatMoney(c.estimatedAmount, c.event.currency)}</td>
                    <td>
                      <span className={`chip ${c.status === 'RECU' ? 'chip-dividend' : 'chip-default'}`}>
                        {c.status === 'RECU' ? 'Reçu' : 'Prévu'}
                      </span>
                    </td>
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
