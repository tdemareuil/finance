import { Link } from 'react-router-dom'
import type { Position } from '../types'
import { formatMoney, signClass } from '../utils'

// ---------------------------------------------------------------------------
// Positions clôturées : titres entièrement vendus (quantité nulle) dont on
// conserve la plus-value réalisée et les dividendes perçus, avec accès à la fiche.
// ---------------------------------------------------------------------------

export default function ClosedPositions({ positions }: { positions: Position[] }) {
  const closed = positions
    .filter((p) => p.quantity <= 1e-9 && (p.realizedPnL !== 0 || p.dividendsReceived !== 0))
    .sort((a, b) => b.realizedPnL - a.realizedPnL)

  if (closed.length === 0) return null

  return (
    <div className="table-scroll">
      <table className="table compact">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Compte</th>
            <th className="num">Plus-value réalisée</th>
            <th className="num">Dividendes perçus</th>
          </tr>
        </thead>
        <tbody>
          {closed.map((p) => (
            <tr key={`${p.assetId}-${p.accountId}`}>
              <td>
                <Link to={`/assets/${p.assetId}`}>{p.asset.name}</Link>
                <div className="muted small">{p.asset.ticker}</div>
              </td>
              <td className="muted small">{p.account.name}</td>
              <td className={`num ${signClass(p.realizedPnL)}`}>{formatMoney(p.realizedPnL, p.currency)}</td>
              <td className="num">
                {p.dividendsReceived > 0 ? formatMoney(p.dividendsReceived, p.currency) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
