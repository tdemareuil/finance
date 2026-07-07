import { useState, type FormEvent } from 'react'
import { Modal } from './ui'
import { createTransaction } from '../services/transactionService'
import { updateAccount } from '../services/accountService'
import { computeCash, computeLivretInterest, isInterestBearing } from '../services/portfolioCalculator'
import { formatMoney } from '../utils'
import type { Account, Transaction } from '../types'

// ---------------------------------------------------------------------------
// Édition d'une ligne « espèces » (CTO/PEA) ou d'un livret/plan d'épargne.
// Le montant se règle en créant une transaction d'ajustement (dépôt/retrait)
// pour atteindre exactement le solde saisi ; le taux (livrets) met à jour le
// compte. L'ajustement est daté du jour → il ne modifie pas les intérêts déjà
// courus (règle des quinzaines), donc le solde affiché = montant saisi.
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10)

function num(v: FormDataEntryValue | null): number | undefined {
  if (v == null || String(v).trim() === '') return undefined
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Intérêts (crédités + courus) d'un compte pour un taux donné. */
function interestAt(account: Account, txs: Transaction[], rate: number | undefined): number {
  if (!isInterestBearing(account.type) || !rate) return 0
  const flows = txs
    .filter((t) => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
    .map((t) => ({ date: t.date, amount: (t.type === 'DEPOSIT' ? 1 : -1) * (t.amount ?? 0) }))
  const i = computeLivretInterest(flows, rate)
  return i.credited + i.accrued
}

export default function CashLineModal({
  account,
  transactions,
  userId,
  onClose,
  onSaved,
}: {
  account: Account
  transactions: Transaction[]
  userId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const hasRate = isInterestBearing(account.type)
  const accTx = transactions.filter((t) => t.accountId === account.id)
  const cash = computeCash(accTx)
  // Solde brut (signé) vs solde affiché (espèces d'un compte-titres plancher à 0).
  const rawBalance = cash + interestAt(account, accTx, account.interestRate)
  const currentBalance = hasRate ? rawBalance : Math.max(0, rawBalance)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      const target = num(fd.get('amount'))
      if (target == null || target < 0) throw new Error('Saisissez un montant valide.')

      const newRate = hasRate ? (() => { const p = num(fd.get('interestRatePct')); return p != null ? p / 100 : undefined })() : undefined

      // Solde (brut, signé) qui sera affiché avec le nouveau taux, hors ajustement du jour.
      const projected = cash + interestAt(account, accTx, hasRate ? newRate : account.interestRate)
      const projectedDisplayed = hasRate ? projected : Math.max(0, projected)
      // Aucun ajustement si la cible = solde affiché actuel (évite un dépôt fantôme
      // quand le solde brut est déjà négatif mais affiché à 0).
      const delta =
        Math.abs(target - projectedDisplayed) < 0.005 ? 0 : Math.round((target - projected) * 100) / 100
      if (Math.abs(delta) > 0.005) {
        await createTransaction({
          userId,
          accountId: account.id,
          type: delta > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
          date: TODAY,
          amount: Math.abs(delta),
          currency: account.currency,
          note: 'Ajustement solde',
          source: 'MANUAL',
        })
      }

      if (hasRate && newRate !== account.interestRate) {
        await updateAccount(account.id, { interestRate: newRate })
      }

      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Modifier — ${account.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          <span>Montant actuel (€)</span>
          <input
            name="amount"
            type="number"
            step="any"
            min="0"
            defaultValue={Math.round(currentBalance * 100) / 100}
            required
          />
          <span className="muted small">Solde actuel : {formatMoney(currentBalance, account.currency)}</span>
        </label>
        {hasRate && (
          <label className="field">
            <span>Taux annuel %</span>
            <input
              name="interestRatePct"
              type="number"
              step="any"
              min="0"
              defaultValue={account.interestRate != null ? account.interestRate * 100 : ''}
              placeholder="Ex : 3"
            />
            <span className="muted small">Les intérêts sont recalculés automatiquement (règle des quinzaines).</span>
          </label>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
