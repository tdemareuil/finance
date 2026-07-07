import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Account, AccountType, AnalystConsensus, Asset, Currency, Position, Transaction } from '../types'
import {
  ACCOUNT_TYPE_LABEL,
  assetRisk,
  isSavingsAccount,
  RISK_ORDER,
  formatMoney,
  formatPct,
  signClass,
  type RiskLevel,
} from '../utils'
import { computeCash, computeLivretInterest, isInterestBearing } from '../services/portfolioCalculator'
import { getConsensus } from '../services/analysisService'
import CashLineModal from './CashLineModal'

// ---------------------------------------------------------------------------
// Liste de tous les actifs détenus, groupés par compte / type / risque.
// Inclut les titres (positions), les **espèces** de chaque compte-titres
// (CTO/PEA) et les comptes d'épargne (livrets, PER, PEE). Les lignes espèces
// et épargne sont éditables (montant, et taux pour les livrets).
// ---------------------------------------------------------------------------

type GroupMode = 'account' | 'type' | 'risk'
type HoldingKind = 'security' | 'cash' | 'savings'

const MODE_LABEL: Record<GroupMode, string> = {
  account: 'Compte',
  type: 'Type',
  risk: 'Risque',
}

const ASSET_TYPE_LABEL: Record<string, string> = {
  STOCK: 'Actions',
  ETF: 'ETF',
  CASH: 'Liquidités',
}

/** Ligne unifiée : un titre détenu, des espèces, ou le solde d'un livret. */
interface Holding {
  key: string
  name: string
  subtitle: string
  kind: HoldingKind
  /** Titre : lien vers la fiche + consensus analystes. */
  assetId?: string
  asset?: Asset
  accountId: string
  accountName: string
  /** Clé/label de regroupement « par type ». */
  typeKey: string
  typeLabel: string
  risk: RiskLevel
  quantity?: number
  /** Titre : prix de revient unitaire moyen (PRU). */
  pru?: number
  currentValue: number
  /** Titre : performance. */
  performancePct?: number | null
  /** Livret : taux d'intérêt annuel (affiché dans la colonne Perf.). */
  rate?: number
  weight: number
  currency: Currency
}

interface Group {
  key: string
  label: string
  holdings: Holding[]
  total: number
}

/** Regroupement « par type » d'un compte d'épargne : les livrets ensemble. */
function savingsTypeGroup(type: AccountType): [string, string] {
  if (isInterestBearing(type)) return ['LIVRETS', 'Livrets'] // Livret A, LDDS, Livret+
  return [type, ACCOUNT_TYPE_LABEL[type]] // PER, PEE
}

/** Solde d'un compte d'épargne = cash net (+ intérêts si porteur d'intérêts). */
function savingsBalance(acc: Account, txs: Transaction[]): number {
  const accTx = txs.filter((t) => t.accountId === acc.id)
  const cash = computeCash(accTx)
  if (isInterestBearing(acc.type) && acc.interestRate) {
    const flows = accTx
      .filter((t) => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
      .map((t) => ({ date: t.date, amount: (t.type === 'DEPOSIT' ? 1 : -1) * (t.amount ?? 0) }))
    const i = computeLivretInterest(flows, acc.interestRate)
    return cash + i.credited + i.accrued
  }
  return cash
}

function buildGroups(holdings: Holding[], mode: GroupMode): Group[] {
  const map = new Map<string, Group>()

  for (const h of holdings) {
    let key: string
    let label: string
    if (mode === 'account') {
      key = h.accountId
      label = h.accountName
    } else if (mode === 'type') {
      key = h.typeKey
      label = h.typeLabel
    } else {
      key = h.risk
      label = h.risk
    }
    let g = map.get(key)
    if (!g) {
      g = { key, label, holdings: [], total: 0 }
      map.set(key, g)
    }
    g.holdings.push(h)
    g.total += h.currentValue
  }

  const groups = [...map.values()]
  for (const g of groups) g.holdings.sort((a, b) => b.currentValue - a.currentValue)

  if (mode === 'risk') {
    groups.sort((a, b) => RISK_ORDER.indexOf(a.key as RiskLevel) - RISK_ORDER.indexOf(b.key as RiskLevel))
  } else {
    groups.sort((a, b) => b.total - a.total)
  }
  return groups
}

// Barre compacte des avis d'analystes (segments colorés proportionnels).
function ConsensusMiniBar({ c }: { c: AnalystConsensus }) {
  const segs = [
    { v: c.strongBuy, color: '#15803d', label: 'Strong Buy' },
    { v: c.buy, color: '#22c55e', label: 'Buy' },
    { v: c.hold, color: '#f59e0b', label: 'Hold' },
    { v: c.sell, color: '#ef4444', label: 'Sell' },
    { v: c.strongSell, color: '#b91c1c', label: 'Strong Sell' },
  ]
  const total = c.total || 1
  const title = segs.filter((s) => s.v > 0).map((s) => `${s.label} : ${s.v}`).join(' · ')
  return (
    <div className="consensus-mini" title={title}>
      {segs.map((s, i) =>
        s.v > 0 ? <span key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.color }} /> : null,
      )}
    </div>
  )
}

export default function HoldingsGrouped({
  positions,
  accounts,
  transactions,
  totalValue,
  userId,
  onChanged,
}: {
  positions: Position[]
  accounts: Account[]
  transactions: Transaction[]
  totalValue: number
  userId: string
  onChanged: () => void | Promise<void>
}) {
  const [mode, setMode] = useState<GroupMode>('account')
  const [editing, setEditing] = useState<Holding | null>(null)
  const [consensusMap, setConsensusMap] = useState<Record<string, AnalystConsensus | null>>({})

  // Consensus analystes pour chaque titre détenu (mis en cache par le service).
  useEffect(() => {
    const uniq = new Map<string, Asset>()
    for (const p of positions) {
      if (p.quantity > 0 && p.asset.type !== 'CASH') uniq.set(p.assetId, p.asset)
    }
    if (uniq.size === 0) return
    let cancelled = false
    Promise.all(
      [...uniq.values()].map(async (a) => {
        try {
          const { data } = await getConsensus(a)
          return [a.id, data] as const
        } catch {
          return [a.id, null] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setConsensusMap(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [positions])

  const holdings = useMemo<Holding[]>(() => {
    const fromPositions: Holding[] = positions
      .filter((p) => p.quantity > 0)
      .map((p) => ({
        key: `pos-${p.assetId}-${p.accountId}`,
        name: p.asset.name,
        subtitle: p.asset.ticker,
        kind: 'security' as HoldingKind,
        assetId: p.assetId,
        asset: p.asset,
        accountId: p.accountId,
        accountName: p.account.name,
        typeKey: p.asset.type,
        typeLabel: ASSET_TYPE_LABEL[p.asset.type] ?? p.asset.type,
        risk: assetRisk(p.asset),
        quantity: p.quantity,
        pru: p.averageCost,
        currentValue: p.currentValue ?? 0,
        performancePct: p.performancePct,
        weight: p.weight,
        currency: p.currency,
      }))

    const fromAccounts: Holding[] = accounts.map((a) => {
      const savings = isSavingsAccount(a.type)
      // Espèces d'un compte-titres : plancher à 0 (un achat sans versement ne
      // crée pas un solde négatif — cohérent avec le patrimoine total).
      const balance = savings
        ? savingsBalance(a, transactions)
        : Math.max(0, computeCash(transactions.filter((t) => t.accountId === a.id)))
      const [typeKey, typeLabel] = savings
        ? savingsTypeGroup(a.type)
        : (['CASH', ASSET_TYPE_LABEL.CASH] as [string, string])
      // Nom de la banque en caption : « <type> <banque> » → on retire le préfixe
      // de type pour ne garder que la banque (ex. « Fortuneo »).
      const accountTypeLabel = ACCOUNT_TYPE_LABEL[a.type]
      const bank = a.name.startsWith(accountTypeLabel)
        ? a.name.slice(accountTypeLabel.length).trim()
        : a.name === accountTypeLabel
          ? ''
          : a.name
      return {
        key: `acct-${a.id}`,
        name: savings ? accountTypeLabel : 'Espèces',
        subtitle: savings ? bank || accountTypeLabel : a.name,
        kind: (savings ? 'savings' : 'cash') as HoldingKind,
        accountId: a.id,
        accountName: a.name,
        typeKey,
        typeLabel,
        risk: 'Faible' as RiskLevel,
        quantity: undefined,
        currentValue: balance,
        performancePct: null,
        rate: isInterestBearing(a.type) ? a.interestRate : undefined,
        weight: totalValue > 0 ? balance / totalValue : 0,
        currency: a.currency,
      }
    })

    // Comptes-titres : on affiche toujours la ligne Espèces (même à 0 €).
    // Épargne : idem (éditable), sauf soldes négatifs improbables déjà gérés.
    return [...fromPositions, ...fromAccounts]
  }, [positions, accounts, transactions, totalValue])

  const groups = useMemo(() => buildGroups(holdings, mode), [holdings, mode])
  const grandTotal = useMemo(() => holdings.reduce((s, h) => s + h.currentValue, 0), [holdings])

  if (holdings.length === 0) {
    return <p className="muted">Aucun actif détenu.</p>
  }

  const editingAccount = editing ? accounts.find((a) => a.id === editing.accountId) : undefined

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
            <span className="holdings-group-total">
              {formatMoney(g.total)}
              <span className="muted small"> · {grandTotal > 0 ? ((g.total / grandTotal) * 100).toFixed(0) : '0'} %</span>
            </span>
          </div>
          <div className="table-scroll">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Actif</th>
                  {mode !== 'account' && <th>Compte</th>}
                  <th className="num">Qté</th>
                  <th className="num">PRU</th>
                  <th className="num">Valeur</th>
                  <th className="num">Perf.</th>
                  <th className="num">Poids</th>
                  <th>Avis</th>
                </tr>
              </thead>
              <tbody>
                {g.holdings.map((h) => (
                  <tr key={h.key}>
                    <td>
                      {h.assetId ? (
                        <Link to={`/assets/${h.assetId}`}>{h.name}</Link>
                      ) : (
                        <span>{h.name}</span>
                      )}
                      <div className="muted small">{h.subtitle}</div>
                    </td>
                    {mode !== 'account' && <td className="muted small">{h.accountName}</td>}
                    <td className="num">
                      {h.quantity != null ? h.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : '—'}
                    </td>
                    <td className="num">{h.pru != null ? formatMoney(h.pru, h.currency) : '—'}</td>
                    <td className="num">{formatMoney(h.currentValue, h.currency)}</td>
                    <td className={`num ${h.kind === 'security' ? signClass(h.performancePct) : ''}`}>
                      {h.kind === 'security'
                        ? h.performancePct != null
                          ? formatPct(h.performancePct)
                          : '—'
                        : h.rate != null
                          ? `${(h.rate * 100).toFixed(2)} %`
                          : '—'}
                    </td>
                    <td className="num">{formatPct(h.weight, 0)}</td>
                    <td>
                      {h.kind === 'security' ? (
                        consensusMap[h.assetId!] ? (
                          <ConsensusMiniBar c={consensusMap[h.assetId!]!} />
                        ) : (
                          <span className="muted small">—</span>
                        )
                      ) : (
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(h)}>Modifier</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editing && editingAccount && (
        <CashLineModal
          account={editingAccount}
          transactions={transactions}
          userId={userId}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </>
  )
}
