import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Position } from '../types'
import { assetRisk, RISK_ORDER, type RiskLevel } from '../utils'
import { formatMoney, formatPct, signClass } from '../utils'

// ---------------------------------------------------------------------------
// Liste de tous les titres détenus, groupés par compte / type / risque.
// ---------------------------------------------------------------------------

type GroupMode = 'account' | 'type' | 'risk'

const MODE_LABEL: Record<GroupMode, string> = {
  account: 'Compte',
  type: 'Type',
  risk: 'Risque',
}

const TYPE_LABEL: Record<string, string> = {
  STOCK: 'Actions',
  ETF: 'ETF',
  CASH: 'Liquidités',
}

interface Group {
  key: string
  label: string
  positions: Position[]
  total: number
}

function buildGroups(positions: Position[], mode: GroupMode): Group[] {
  const map = new Map<string, Group>()

  for (const p of positions) {
    let key: string
    let label: string
    if (mode === 'account') {
      key = p.accountId
      label = p.account.name
    } else if (mode === 'type') {
      key = p.asset.type
      label = TYPE_LABEL[p.asset.type] ?? p.asset.type
    } else {
      key = assetRisk(p.asset)
      label = key
    }
    let g = map.get(key)
    if (!g) {
      g = { key, label, positions: [], total: 0 }
      map.set(key, g)
    }
    g.positions.push(p)
    g.total += p.currentValue ?? 0
  }

  const groups = [...map.values()]
  // Tri des lignes dans chaque groupe : valeur décroissante.
  for (const g of groups) g.positions.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))

  // Tri des groupes : risque → ordre fixe ; sinon valeur décroissante.
  if (mode === 'risk') {
    groups.sort((a, b) => RISK_ORDER.indexOf(a.key as RiskLevel) - RISK_ORDER.indexOf(b.key as RiskLevel))
  } else {
    groups.sort((a, b) => b.total - a.total)
  }
  return groups
}

export default function HoldingsGrouped({ positions }: { positions: Position[] }) {
  const [mode, setMode] = useState<GroupMode>('account')
  const held = useMemo(() => positions.filter((p) => p.quantity > 0), [positions])
  const groups = useMemo(() => buildGroups(held, mode), [held, mode])

  if (held.length === 0) {
    return <p className="muted">Aucune position ouverte.</p>
  }

  return (
    <>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <span className="muted small" style={{ alignSelf: 'center', marginRight: 8 }}>Grouper par :</span>
        {(Object.keys(MODE_LABEL) as GroupMode[]).map((m) => (
          <button key={m} className={`tab ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.key} className="holdings-group">
          <div className="holdings-group-head">
            <span className="holdings-group-title">{g.label}</span>
            <span className="holdings-group-total">{formatMoney(g.total)}</span>
          </div>
          <div className="table-scroll">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Titre</th>
                  {mode !== 'account' && <th>Compte</th>}
                  <th className="num">Quantité</th>
                  <th className="num">Valeur</th>
                  <th className="num">Perf.</th>
                  <th className="num">Poids</th>
                </tr>
              </thead>
              <tbody>
                {g.positions.map((p) => (
                  <tr key={`${p.assetId}-${p.accountId}`}>
                    <td>
                      <Link to={`/assets/${p.assetId}`}>{p.asset.name}</Link>
                      <div className="muted small">{p.asset.ticker}</div>
                    </td>
                    {mode !== 'account' && <td className="muted small">{p.account.name}</td>}
                    <td className="num">{p.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</td>
                    <td className="num">{formatMoney(p.currentValue, p.currency)}</td>
                    <td className={`num ${signClass(p.performancePct)}`}>{formatPct(p.performancePct)}</td>
                    <td className="num">{formatPct(p.weight, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}
