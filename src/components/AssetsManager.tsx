import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card, EmptyState, Modal } from './ui'
import { createAsset, deleteAsset, updateAsset } from '../services/assetService'
import type { Asset, AssetType, Currency } from '../types'
import { formatMoney } from '../utils'

const TYPE_LABEL: Record<AssetType, string> = { STOCK: 'Action', ETF: 'ETF', CASH: 'Cash' }

// Gestion des actifs (CRUD + symboles TradingView/Finnhub/EODHD) — section Paramètres.
export default function AssetsManager() {
  const { user } = useAuth()
  const { assets, transactions, priceByAssetId, reload } = usePortfolio()
  const [editing, setEditing] = useState<Asset | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function txCountFor(id: string) {
    return transactions.filter((t) => t.assetId === id).length
  }

  async function handleDelete(a: Asset) {
    const n = txCountFor(a.id)
    if (!confirm(n > 0 ? `Supprimer "${a.name}" ? ${n} transaction(s) y font référence (elles seront détachées).` : `Supprimer "${a.name}" ?`)) return
    try {
      await deleteAsset(a.id)
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
    const str = (k: string) => {
      const v = String(fd.get(k) ?? '').trim()
      return v === '' ? undefined : v
    }
    const payload = {
      name: String(fd.get('name')).trim(),
      ticker: String(fd.get('ticker')).trim(),
      exchange: str('exchange'),
      isin: str('isin'),
      currency: fd.get('currency') as Currency,
      type: fd.get('type') as AssetType,
      sector: str('sector'),
      country: str('country'),
      eodhdSymbol: str('eodhdSymbol'),
      tradingViewSymbol: str('tradingViewSymbol'),
      finnhubSymbol: str('finnhubSymbol'),
    }
    try {
      if (editing) await updateAsset(editing.id, payload)
      else await createAsset({ userId: user.id, ...payload })
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
  const c = editing

  return (
    <Card
      title="Actifs"
      action={<button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>+ Nouvel actif</button>}
    >
      {assets.length === 0 ? (
        <EmptyState title="Aucun actif" hint="Ajoutez une action, un ETF ou une ligne de cash." />
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Ticker</th>
                <th>Type</th>
                <th>ISIN</th>
                <th>Devise</th>
                <th className="num">Cours</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/assets/${a.id}`}>{a.name}</Link></td>
                  <td>{a.ticker}{a.exchange ? `.${a.exchange}` : ''}</td>
                  <td><span className="chip chip-default">{TYPE_LABEL[a.type]}</span></td>
                  <td className="muted small">{a.isin ?? '—'}</td>
                  <td>{a.currency}</td>
                  <td className="num">{priceByAssetId[a.id] != null ? formatMoney(priceByAssetId[a.id]!, a.currency) : '—'}</td>
                  <td className="row-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(a)}>Modifier</button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => handleDelete(a)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={c ? "Modifier l'actif" : 'Nouvel actif'} onClose={() => { setEditing(null); setCreating(false) }} wide>
          <form onSubmit={handleSubmit} className="form-grid form-grid-2">
            <label className="field"><span>Nom</span><input name="name" defaultValue={c?.name ?? ''} required placeholder="Ex : Apple Inc." /></label>
            <label className="field"><span>Ticker</span><input name="ticker" defaultValue={c?.ticker ?? ''} required placeholder="AAPL" /></label>
            <label className="field"><span>Exchange</span><input name="exchange" defaultValue={c?.exchange ?? ''} placeholder="NASDAQ, PA…" /></label>
            <label className="field"><span>ISIN</span><input name="isin" defaultValue={c?.isin ?? ''} placeholder="US0378331005" /></label>
            <label className="field">
              <span>Type</span>
              <select name="type" defaultValue={c?.type ?? 'STOCK'}>
                <option value="STOCK">Action</option>
                <option value="ETF">ETF</option>
                <option value="CASH">Cash</option>
              </select>
            </label>
            <label className="field">
              <span>Devise</span>
              <select name="currency" defaultValue={c?.currency ?? 'EUR'}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="field"><span>Secteur</span><input name="sector" defaultValue={c?.sector ?? ''} placeholder="Technologie" /></label>
            <label className="field"><span>Pays</span><input name="country" defaultValue={c?.country ?? ''} placeholder="États-Unis" /></label>
            <label className="field"><span>Symbole EODHD</span><input name="eodhdSymbol" defaultValue={c?.eodhdSymbol ?? ''} placeholder="AAPL.US" /></label>
            <label className="field"><span>Symbole TradingView</span><input name="tradingViewSymbol" defaultValue={c?.tradingViewSymbol ?? ''} placeholder="NASDAQ:AAPL" /></label>
            <label className="field"><span>Symbole Finnhub</span><input name="finnhubSymbol" defaultValue={c?.finnhubSymbol ?? ''} placeholder="AAPL, MC.PA…" /></label>
            {error && <div className="alert alert-error form-span-2">{error}</div>}
            <div className="form-actions form-span-2">
              <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setCreating(false) }}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}
