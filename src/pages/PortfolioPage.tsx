import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card, EmptyState, Loading, StatCard } from '../components/common/ui'
import ValueChart from '../components/charts/ValueChart'
import AllocationPie from '../components/charts/AllocationPie'
import HoldingsGrouped from '../components/dashboard/HoldingsGrouped'
import AddOperationModal from '../components/dashboard/AddOperationModal'
import {
  allocationByAccount,
  allocationByCountry,
  allocationByCurrency,
  allocationBySector,
  allocationByType,
} from '../utils/aggregations'
import { formatMoney, formatPct, signClass } from '../utils/format'

export default function PortfolioPage() {
  const { user } = useAuth()
  const {
    loading,
    summary,
    valueSeries,
    benchmarkSeries,
    transactions,
    marketError,
    benchmarkSymbol,
    positions,
    accounts,
    assets,
    reload,
  } = usePortfolio()
  const [adding, setAdding] = useState(false)

  if (loading) return <Loading label="Calcul du portefeuille…" />

  const s = summary
  const open = positions.filter((p) => p.quantity > 0)
  // Écart de perf vs benchmark (valeur finale).
  const lastValue = valueSeries.at(-1)?.totalValue ?? null
  const lastBench = benchmarkSeries.at(-1)?.benchmark ?? null
  const vsBenchmark =
    lastValue != null && lastBench != null && lastBench > 0 ? lastValue - lastBench : null

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Portefeuille</h1>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Ajouter une opération
        </button>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          title="Aucune transaction pour le moment"
          hint={
            <>
              Ajoutez votre première opération avec le bouton{' '}
              <strong>« + Ajouter une opération »</strong> ou <Link to="/import">importez un CSV</Link>.
            </>
          }
        />
      ) : (
        <>
          {marketError && (
            <div className="alert alert-warn">{marketError} Les valeurs affichées peuvent être partielles.</div>
          )}

          <div className="stat-grid">
            <StatCard label="Valeur totale" value={formatMoney(s.totalValue)} />
            <StatCard label="Capital investi net" value={formatMoney(s.investedCapital)} />
            <StatCard label="Cash disponible" value={formatMoney(s.cash)} />
            <StatCard
              label="Performance globale"
              value={formatPct(s.totalReturnPct)}
              tone={signClass(s.totalReturnPct) as 'positive' | 'negative' | 'neutral'}
              sub={s.annualizedReturnPct != null ? `${formatPct(s.annualizedReturnPct)} / an` : undefined}
            />
            <StatCard
              label="Plus-value latente"
              value={formatMoney(s.unrealizedPnL)}
              tone={signClass(s.unrealizedPnL) as 'positive' | 'negative' | 'neutral'}
            />
            <StatCard
              label="Plus-value réalisée"
              value={formatMoney(s.realizedPnL)}
              tone={signClass(s.realizedPnL) as 'positive' | 'negative' | 'neutral'}
            />
            <StatCard label="Dividendes reçus" value={formatMoney(s.dividendsReceived)} tone="positive" />
            <StatCard label="Frais payés" value={formatMoney(s.feesPaid)} tone="negative" />
            {(s.livretInterestAccrued > 0 || s.livretInterestCredited > 0) && (
              <StatCard
                label="Intérêts Livret+ (année en cours)"
                value={formatMoney(s.livretInterestAccrued)}
                tone="positive"
                sub={`crédités à ce jour : ${formatMoney(s.livretInterestCredited)}`}
              />
            )}
          </div>

          <Card
            title="Évolution du patrimoine"
            action={
              <span className="muted small">
                vs MSCI World ({benchmarkSymbol})
                {vsBenchmark != null && (
                  <strong className={signClass(vsBenchmark)}> · {formatMoney(vsBenchmark)}</strong>
                )}
              </span>
            }
          >
            <ValueChart valueSeries={valueSeries} benchmarkSeries={benchmarkSeries} />
          </Card>

          <Card title="Mes titres">
            <HoldingsGrouped positions={positions} />
          </Card>

          {open.length > 0 && (
            <Card title="Allocations">
              <div className="alloc-grid">
                <div className="alloc-item">
                  <h3 className="alloc-title">Par compte</h3>
                  <AllocationPie data={allocationByAccount(open)} />
                </div>
                <div className="alloc-item">
                  <h3 className="alloc-title">Par type d'actif</h3>
                  <AllocationPie data={allocationByType(open)} />
                </div>
                <div className="alloc-item">
                  <h3 className="alloc-title">Par devise</h3>
                  <AllocationPie data={allocationByCurrency(open)} />
                </div>
                <div className="alloc-item">
                  <h3 className="alloc-title">Par secteur</h3>
                  <AllocationPie data={allocationBySector(open)} />
                </div>
                <div className="alloc-item">
                  <h3 className="alloc-title">Par pays</h3>
                  <AllocationPie data={allocationByCountry(open)} />
                </div>
              </div>
            </Card>
          )}

          <Card title="Répartition rapide">
            <ul className="kv-list">
              <li>
                <span>Positions ouvertes</span>
                <strong>{open.length}</strong>
              </li>
              <li>
                <span>Transactions</span>
                <strong>{transactions.length}</strong>
              </li>
              <li>
                <span>Frais / capital investi</span>
                <strong>{s.investedCapital > 0 ? formatPct(s.feesPaid / s.investedCapital) : '—'}</strong>
              </li>
              <li>
                <span>Dividendes / capital investi</span>
                <strong className="positive">
                  {s.investedCapital > 0 ? formatPct(s.dividendsReceived / s.investedCapital) : '—'}
                </strong>
              </li>
            </ul>
            <div className="dashboard-links">
              <Link className="btn btn-sm btn-ghost" to="/dividends">Voir les dividendes</Link>
            </div>
          </Card>
        </>
      )}

      {adding && user && (
        <AddOperationModal
          accounts={accounts}
          assets={assets}
          userId={user.id}
          onClose={() => setAdding(false)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
