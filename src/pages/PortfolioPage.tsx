import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card, EmptyState, Loading, StatCard } from '../components/ui'
import { ValueChart } from '../components/charts'
import { AllocationPie } from '../components/charts'
import HoldingsGrouped from '../components/HoldingsGrouped'
import AddOperationModal from '../components/AddOperationModal'
import {
  allocationByAccount,
  allocationByCountry,
  allocationByCurrency,
  allocationBySector,
  allocationByType,
} from '../utils'
import { formatMoney, formatPct, signClass } from '../utils'
import type { AccountType } from '../types'

// Opérations saisissables manuellement (le menu « + »). Les opérations de
// bourse (achat/vente) passent exclusivement par l'import CSV.
type Op =
  | { key: string; label: string; mode: 'rsu' }
  | { key: string; label: string; mode: 'savings'; savingsType: AccountType }

const OPS: Op[] = [
  { key: 'rsu', label: 'Grant RSU', mode: 'rsu' },
  { key: 'livret-a', label: 'Livret A', mode: 'savings', savingsType: 'LIVRET_A' },
  { key: 'ldds', label: 'LDDS', mode: 'savings', savingsType: 'LDDS' },
  { key: 'livret-plus', label: 'Livret+', mode: 'savings', savingsType: 'LIVRET_PLUS' },
  { key: 'per', label: 'PER', mode: 'savings', savingsType: 'PER' },
  { key: 'pee', label: 'PEE', mode: 'savings', savingsType: 'PEE' },
]

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [op, setOp] = useState<Op | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
        <div className="page-head-actions">
          <Link className="btn btn-primary" to="/import">
            📥 Importer un CSV
          </Link>
          <div className="dropdown" ref={menuRef}>
            <button
              className="btn btn-primary btn-icon"
              aria-label="Ajouter une opération"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              +
            </button>
            {menuOpen && (
              <div className="dropdown-menu" role="menu">
                {OPS.map((o) => (
                  <button
                    key={o.key}
                    role="menuitem"
                    className="dropdown-item"
                    onClick={() => {
                      setOp(o)
                      setMenuOpen(false)
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          title="Aucune transaction pour le moment"
          hint={
            <>
              <Link to="/import">Importez un CSV</Link> de votre courtier, ou ajoutez un grant RSU
              ou un versement sur un livret avec le bouton <strong>« + »</strong>.
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

      {op && user && (
        <AddOperationModal
          accounts={accounts}
          assets={assets}
          userId={user.id}
          mode={op.mode}
          savingsType={op.mode === 'savings' ? op.savingsType : undefined}
          onClose={() => setOp(null)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
