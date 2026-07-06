import { useState, type FormEvent } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card, EmptyState, Modal } from './ui'
import { createAccount, deleteAccount, updateAccount } from '../services/accountService'
import type { Account, AccountType, Currency } from '../types'
import { ACCOUNT_TYPE_LABEL, formatMoney } from '../utils'
import { computeCash, computeLivretInterest, isInterestBearing } from '../services/portfolioCalculator'

// Gestion des comptes (CRUD) — section intégrée à la page Paramètres.
export default function AccountsManager() {
  const { user } = useAuth()
  const { accounts, transactions, reload } = usePortfolio()
  const [editing, setEditing] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function txCountFor(id: string) {
    return transactions.filter((t) => t.accountId === id).length
  }

  async function handleDelete(a: Account) {
    const n = txCountFor(a.id)
    const msg =
      n > 0
        ? `Supprimer le compte "${a.name}" et ses ${n} transaction(s) associée(s) ? Cette action est irréversible.`
        : `Supprimer le compte "${a.name}" ?`
    if (!confirm(msg)) return
    try {
      await deleteAccount(a.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const ratePct = String(fd.get('interestRatePct') ?? '').trim().replace(',', '.')
    const rate = ratePct === '' ? undefined : Number(ratePct) / 100
    const payload = {
      name: String(fd.get('name')).trim(),
      type: fd.get('type') as AccountType,
      currency: fd.get('currency') as Currency,
      interestRate: rate != null && Number.isFinite(rate) ? rate : undefined,
    }
    try {
      if (editing) await updateAccount(editing.id, payload)
      else await createAccount({ userId: user.id, ...payload })
      await reload()
      setEditing(null)
      setCreating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  const showModal = creating || editing != null
  const current = editing

  return (
    <Card
      title="Comptes"
      action={<button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>+ Nouveau compte</button>}
    >
      {accounts.length === 0 ? (
        <EmptyState title="Aucun compte" hint="Créez un CTO, un PEA ou un livret pour commencer." />
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Devise</th>
                <th className="num">Taux</th>
                <th className="num">Transactions</th>
                <th className="num">Intérêts courus</th>
                <th className="num">Solde (EUR)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const accountTx = transactions.filter((t) => t.accountId === a.id)
                const cash = computeCash(accountTx)
                const interest =
                  isInterestBearing(a.type) && a.interestRate
                    ? computeLivretInterest(
                        accountTx
                          .filter((t) => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
                          .map((t) => ({ date: t.date, amount: (t.type === 'DEPOSIT' ? 1 : -1) * (t.amount ?? 0) })),
                        a.interestRate,
                      )
                    : { credited: 0, accrued: 0 }
                const balance = cash + interest.credited + interest.accrued
                return (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td><span className="chip chip-default">{ACCOUNT_TYPE_LABEL[a.type]}</span></td>
                    <td>{a.currency}</td>
                    <td className="num">{a.interestRate ? `${(a.interestRate * 100).toFixed(2)} %` : '—'}</td>
                    <td className="num">{txCountFor(a.id)}</td>
                    <td className="num positive">{interest.accrued > 0 ? formatMoney(interest.accrued, a.currency) : '—'}</td>
                    <td className="num">{formatMoney(balance)}</td>
                    <td className="row-actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(a)}>Modifier</button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDelete(a)}>Supprimer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={current ? 'Modifier le compte' : 'Nouveau compte'}
          onClose={() => { setEditing(null); setCreating(false) }}
        >
          <form onSubmit={handleSubmit} className="form-grid">
            <label className="field">
              <span>Nom</span>
              <input name="name" defaultValue={current?.name ?? ''} required placeholder="Ex : PEA Fortuneo" />
            </label>
            <label className="field">
              <span>Type</span>
              <select name="type" defaultValue={current?.type ?? 'CTO'}>
                {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((t) => (
                  <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Devise</span>
              <select name="currency" defaultValue={current?.currency ?? 'EUR'}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="field">
              <span>Taux annuel % <span className="muted">(Livret A · LDDS · Livret+ : intérêts calculés automatiquement)</span></span>
              <input
                name="interestRatePct"
                type="number"
                step="any"
                min="0"
                defaultValue={current?.interestRate != null ? current.interestRate * 100 : ''}
                placeholder="Ex : 3"
              />
            </label>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setCreating(false) }}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}
