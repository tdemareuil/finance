import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { Card, EmptyState, Loading, StatCard } from '../components/common/ui'
import ValueChart from '../components/charts/ValueChart'
import CumulativeAreaChart from '../components/charts/CumulativeAreaChart'
import { feesByAccount, feesCumulativeByMonth } from '../utils/aggregations'
import AllocationPie from '../components/charts/AllocationPie'
import { formatMoney, formatPct, signClass } from '../utils/format'

export default function DashboardPage() {
  const { loading, summary, valueSeries, benchmarkSeries, transactions, marketError, benchmarkSymbol, accounts } =
    usePortfolio()

  if (loading) return <Loading label="Calcul du portefeuille…" />

  if (transactions.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Dashboard</h1>
        <EmptyState
          title="Aucune transaction pour le moment"
          hint={
            <>
              Ajoutez vos premières opérations depuis <Link to="/transactions">Transactions</Link> ou{' '}
              <Link to="/import">importez un CSV</Link>.
            </>
          }
        />
      </div>
    )
  }

  const s = summary
  const accountNameFn = (id: string) => accounts.find((a) => a.id === id)?.name ?? id
  const feesCumul = feesCumulativeByMonth(transactions)
  const feesPerAccount = feesByAccount(transactions, accountNameFn)
  // Écart de perf vs benchmark (valeur finale).
  const lastValue = valueSeries.at(-1)?.totalValue ?? null
  const lastBench = benchmarkSeries.at(-1)?.benchmark ?? null
  const vsBenchmark =
    lastValue != null && lastBench != null && lastBench > 0 ? lastValue - lastBench : null

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      {marketError && <div className="alert alert-warn">{marketError} Les valeurs affichées peuvent être partielles.</div>}

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

      <div className="cards-2">
        <Card title="Top positions">
          {s.positions.filter((p) => p.quantity > 0).length === 0 ? (
            <p className="muted">Aucune position ouverte.</p>
          ) : (
            <table className="table compact">
              <thead>
                <tr>
                  <th>Actif</th>
                  <th className="num">Valeur</th>
                  <th className="num">P&L latent</th>
                  <th className="num">Poids</th>
                </tr>
              </thead>
              <tbody>
                {s.positions
                  .filter((p) => p.quantity > 0)
                  .slice(0, 6)
                  .map((p) => (
                    <tr key={`${p.assetId}-${p.accountId}`}>
                      <td>
                        <Link to={`/assets/${p.assetId}`}>{p.asset.name}</Link>
                        <div className="muted small">{p.account.name}</div>
                      </td>
                      <td className="num">{formatMoney(p.currentValue, p.currency)}</td>
                      <td className={`num ${signClass(p.unrealizedPnL)}`}>{formatPct(p.performancePct)}</td>
                      <td className="num">{formatPct(p.weight, 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Répartition rapide">
          <ul className="kv-list">
            <li>
              <span>Positions ouvertes</span>
              <strong>{s.positions.filter((p) => p.quantity > 0).length}</strong>
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
            <Link className="btn btn-sm" to="/portfolio">Voir le portefeuille</Link>
            <Link className="btn btn-sm btn-ghost" to="/dividends">Voir les dividendes</Link>
          </div>
        </Card>
      </div>

      <div className="cards-2">
        <Card
          title="Frais cumulés"
          action={
            <span className="muted small">
              {s.investedCapital > 0 ? `${formatPct(s.feesPaid / s.investedCapital)} du capital investi` : ''}
            </span>
          }
        >
          <CumulativeAreaChart data={feesCumul} color="#ef4444" label="Frais cumulés" />
        </Card>
        <Card title="Frais par compte">
          {feesPerAccount.length === 0 ? (
            <p className="muted">Aucun frais enregistré.</p>
          ) : (
            <AllocationPie data={feesPerAccount} />
          )}
        </Card>
      </div>
    </div>
  )
}
