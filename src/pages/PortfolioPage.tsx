import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { Card, EmptyState, Loading } from '../components/common/ui'
import AllocationPie from '../components/charts/AllocationPie'
import { formatMoney, formatNumber, formatPct, signClass } from '../utils/format'
import {
  allocationByAccount,
  allocationByCountry,
  allocationByCurrency,
  allocationBySector,
  allocationByType,
} from '../utils/aggregations'

export default function PortfolioPage() {
  const { positions, loading, transactions } = usePortfolio()

  if (loading) return <Loading />

  const open = positions.filter((p) => p.quantity > 0)

  if (transactions.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Portefeuille</h1>
        <EmptyState title="Aucune position" hint={<>Ajoutez des transactions ou <Link to="/import">importez un CSV</Link>.</>} />
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Portefeuille</h1>

      <Card title="Positions actuelles">
        {open.length === 0 ? (
          <p className="muted">Aucune position ouverte (toutes les lignes ont été vendues).</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Actif</th>
                  <th>Compte</th>
                  <th className="num">Qté</th>
                  <th className="num">PRU</th>
                  <th className="num">Cours</th>
                  <th className="num">Valeur</th>
                  <th className="num">P&L latent</th>
                  <th className="num">Perf.</th>
                  <th className="num">Dividendes</th>
                  <th className="num">Poids</th>
                </tr>
              </thead>
              <tbody>
                {open.map((p) => (
                  <tr key={`${p.assetId}-${p.accountId}`}>
                    <td>
                      <Link to={`/assets/${p.assetId}`}>{p.asset.name}</Link>
                      <div className="muted small">{p.asset.ticker} · {p.currency}</div>
                    </td>
                    <td>{p.account.name}</td>
                    <td className="num">{formatNumber(p.quantity, 4)}</td>
                    <td className="num">{formatMoney(p.averageCost, p.currency)}</td>
                    <td className="num">{p.currentPrice != null ? formatMoney(p.currentPrice, p.currency) : '—'}</td>
                    <td className="num">{formatMoney(p.currentValue, p.currency)}</td>
                    <td className={`num ${signClass(p.unrealizedPnL)}`}>{formatMoney(p.unrealizedPnL, p.currency)}</td>
                    <td className={`num ${signClass(p.performancePct)}`}>{formatPct(p.performancePct)}</td>
                    <td className="num positive">{p.dividendsReceived > 0 ? formatMoney(p.dividendsReceived, p.currency) : '—'}</td>
                    <td className="num">{formatPct(p.weight, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="cards-2">
        <Card title="Allocation par compte"><AllocationPie data={allocationByAccount(open)} /></Card>
        <Card title="Allocation par type d'actif"><AllocationPie data={allocationByType(open)} /></Card>
        <Card title="Allocation par devise"><AllocationPie data={allocationByCurrency(open)} /></Card>
        <Card title="Allocation par secteur"><AllocationPie data={allocationBySector(open)} /></Card>
        <Card title="Allocation par pays"><AllocationPie data={allocationByCountry(open)} /></Card>
      </div>
    </div>
  )
}
