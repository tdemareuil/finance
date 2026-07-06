import { useState, type FormEvent } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card, EmptyState, Loading, Modal } from '../components/common/ui'
import { createAccount, deleteAccount, updateAccount } from '../services/accountService'
import type { Account, AccountType, Currency } from '../types'
import { formatMoney } from '../utils/format'
import { computeCash } from '../services/portfolioCalculator'

const TYPE_LABEL: Record<AccountType, string> = { CTO: 'CTO', PEA: 'PEA', LIVRET_PLUS: 'Livret+' }

export default function AccountsPage() {
  const { user } = useAuth()
  const { accounts, transactions, loading, reload } = usePortfolio()
  const [editing, setEditing] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Loading />

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
    const payload = {
      name: String(fd.get('name')).trim(),
      type: fd.get('type') as AccountType,
      currency: fd.get('currency') as Currency,
    }
    try {
      if (editing) {
        await updateAccount(editing.id, payload)
      } else {
        await createAccount({ userId: user.id, ...payload })
      }
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
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Comptes</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nouveau compte</button>
      </div>

      <Card>
        {accounts.length === 0 ? (
          <EmptyState title="Aucun compte" hint="Créez un CTO, un PEA ou un Livret+ pour commencer." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Devise</th>
                <th className="num">Transactions</th>
                <th className="num">Solde (EUR)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const cash = computeCash(transactions.filter((t) => t.accountId === a.id))
                return (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td><span className="chip chip-default">{TYPE_LABEL[a.type]}</span></td>
                    <td>{a.currency}</td>
                    <td className="num">{txCountFor(a.id)}</td>
                    <td className="num">{formatMoney(cash)}</td>
                    <td className="row-actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(a)}>Modifier</button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDelete(a)}>Supprimer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && (
        <Modal
          title={current ? 'Modifier le compte' : 'Nouveau compte'}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        >
          <form onSubmit={handleSubmit} className="form-grid" id="account-form">
            <label className="field">
              <span>Nom</span>
              <input name="name" defaultValue={current?.name ?? ''} required placeholder="Ex : PEA Fortuneo" />
            </label>
            <label className="field">
              <span>Type</span>
              <select name="type" defaultValue={current?.type ?? 'CTO'}>
                <option value="CTO">CTO</option>
                <option value="PEA">PEA</option>
                <option value="LIVRET_PLUS">Livret+</option>
              </select>
            </label>
            <label className="field">
              <span>Devise</span>
              <select name="currency" defaultValue={current?.currency ?? 'EUR'}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
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
    </div>
  )
}
