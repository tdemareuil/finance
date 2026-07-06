import { useMemo, useState, type FormEvent } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card, EmptyState, Loading, Modal } from '../components/common/ui'
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '../services/transactionService'
import type { Currency, Transaction, TransactionType } from '../types'
import { formatDate, formatMoney, formatNumber } from '../utils/format'

const TYPE_LABEL: Record<TransactionType, string> = {
  BUY: 'Achat',
  SELL: 'Vente',
  DIVIDEND: 'Dividende',
  FEE: 'Frais',
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
}

const ASSET_TYPES: TransactionType[] = ['BUY', 'SELL', 'DIVIDEND']

export default function TransactionsPage() {
  const { user } = useAuth()
  const { transactions, accounts, assets, loading, reload } = usePortfolio()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterAccount, setFilterAccount] = useState('')
  const [filterType, setFilterType] = useState('')

  // État du formulaire (pour adapter les champs selon le type).
  const [formType, setFormType] = useState<TransactionType>('BUY')

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const assetName = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])

  const filtered = transactions.filter(
    (t) => (!filterAccount || t.accountId === filterAccount) && (!filterType || t.type === filterType),
  )

  if (loading) return <Loading />

  function openCreate() {
    setFormType('BUY')
    setCreating(true)
  }
  function openEdit(t: Transaction) {
    setFormType(t.type)
    setEditing(t)
  }
  function close() {
    setEditing(null)
    setCreating(false)
    setError(null)
  }

  async function handleDelete(t: Transaction) {
    if (!confirm('Supprimer cette transaction ?')) return
    try {
      await deleteTransaction(t.id)
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
    const num = (k: string) => {
      const v = fd.get(k)
      if (v == null || String(v).trim() === '') return undefined
      const n = Number(String(v).replace(',', '.'))
      return Number.isFinite(n) ? n : undefined
    }
    const type = fd.get('type') as TransactionType
    const assetId = String(fd.get('assetId') ?? '') || undefined
    const payload: Omit<Transaction, 'id' | 'createdAt'> = {
      userId: user.id,
      accountId: String(fd.get('accountId')),
      assetId: ASSET_TYPES.includes(type) ? assetId : undefined,
      type,
      date: String(fd.get('date')),
      quantity: num('quantity'),
      price: num('price'),
      fees: num('fees'),
      currency: fd.get('currency') as Currency,
      amount: num('amount'),
      note: String(fd.get('note') ?? '').trim() || undefined,
      source: editing?.source ?? 'MANUAL',
      importBatchId: editing?.importBatchId,
    }
    if (!payload.accountId) {
      setError('Sélectionnez un compte.')
      setBusy(false)
      return
    }
    if ((type === 'BUY' || type === 'SELL') && !assetId) {
      setError('Sélectionnez un actif pour un achat/vente.')
      setBusy(false)
      return
    }
    try {
      if (editing) await updateTransaction(editing.id, payload)
      else await createTransaction(payload)
      await reload()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  const showModal = creating || editing != null
  const c = editing
  const isAssetType = ASSET_TYPES.includes(formType)
  const isAmountType = !['BUY', 'SELL'].includes(formType)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Transactions</h1>
        <button className="btn btn-primary" onClick={openCreate} disabled={accounts.length === 0}>
          + Nouvelle transaction
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="alert alert-warn">Créez d'abord un compte avant d'ajouter des transactions.</div>
      )}

      <Card>
        <div className="filters">
          <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
            <option value="">Tous les comptes</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="muted small">{filtered.length} opération(s)</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Aucune transaction" hint="Ajoutez une opération ou importez un CSV." />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Compte</th>
                  <th>Actif</th>
                  <th className="num">Qté</th>
                  <th className="num">Prix</th>
                  <th className="num">Frais</th>
                  <th className="num">Montant</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.date)}</td>
                    <td><span className={`chip chip-${t.type.toLowerCase()}`}>{TYPE_LABEL[t.type]}</span></td>
                    <td>{accountName.get(t.accountId) ?? '—'}</td>
                    <td>{t.assetId ? assetName.get(t.assetId) ?? '—' : '—'}</td>
                    <td className="num">{t.quantity != null ? formatNumber(t.quantity, 4) : '—'}</td>
                    <td className="num">{t.price != null ? formatMoney(t.price, t.currency) : '—'}</td>
                    <td className="num">{t.fees != null ? formatMoney(t.fees, t.currency) : '—'}</td>
                    <td className="num">{t.amount != null ? formatMoney(t.amount, t.currency) : '—'}</td>
                    <td className="row-actions">
                      {t.source === 'CSV_IMPORT' && <span className="chip chip-import" title="Importé depuis un CSV">CSV</span>}
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(t)}>Modifier</button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDelete(t)}>Suppr.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <Modal title={c ? 'Modifier la transaction' : 'Nouvelle transaction'} onClose={close} wide>
          <form onSubmit={handleSubmit} className="form-grid form-grid-2">
            <label className="field">
              <span>Type</span>
              <select name="type" defaultValue={c?.type ?? 'BUY'} onChange={(e) => setFormType(e.target.value as TransactionType)}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" name="date" defaultValue={c?.date ?? new Date().toISOString().slice(0, 10)} required />
            </label>
            <label className="field">
              <span>Compte</span>
              <select name="accountId" defaultValue={c?.accountId ?? accounts[0]?.id ?? ''} required>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Actif {isAssetType ? '' : '(optionnel)'}</span>
              <select name="assetId" defaultValue={c?.assetId ?? ''} disabled={!isAssetType && formType !== 'DIVIDEND'}>
                <option value="">— Aucun —</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>

            {!isAmountType && (
              <>
                <label className="field"><span>Quantité</span><input name="quantity" type="number" step="any" defaultValue={c?.quantity ?? ''} placeholder="10" /></label>
                <label className="field"><span>Prix unitaire</span><input name="price" type="number" step="any" defaultValue={c?.price ?? ''} placeholder="145.20" /></label>
              </>
            )}
            {isAmountType && (
              <label className="field"><span>Montant</span><input name="amount" type="number" step="any" defaultValue={c?.amount ?? ''} placeholder="1000" /></label>
            )}

            <label className="field"><span>Frais</span><input name="fees" type="number" step="any" defaultValue={c?.fees ?? ''} placeholder="3.90" /></label>
            <label className="field">
              <span>Devise</span>
              <select name="currency" defaultValue={c?.currency ?? 'EUR'}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="field form-span-2"><span>Note</span><input name="note" defaultValue={c?.note ?? ''} placeholder="Optionnel" /></label>

            {error && <div className="alert alert-error form-span-2">{error}</div>}
            <div className="form-actions form-span-2">
              <button type="button" className="btn btn-ghost" onClick={close}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
