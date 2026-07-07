import { useState, type FormEvent } from 'react'
import { Modal } from './ui'
import { createTransaction, updateTransaction } from '../services/transactionService'
import { createRsuGrant, updateRsuGrant } from '../services/rsuService'
import { createAccount } from '../services/accountService'
import { isInterestBearing } from '../services/portfolioCalculator'
import { ACCOUNT_TYPE_LABEL } from '../utils'
import type {
  Account,
  AccountType,
  Asset,
  Currency,
  RsuGrant,
  RsuPlatform,
  Transaction,
  TransactionType,
  VestingType,
} from '../types'

// ---------------------------------------------------------------------------
// Modale d'ajout d'opération manuelle. Les opérations de bourse (achat/vente)
// se font UNIQUEMENT par import CSV — la saisie manuelle couvre :
//   • un grant RSU
//   • un versement / retrait sur un livret ou plan d'épargne
//     (Livret A, LDDS, Livret+, PER, PEE)
// La modale sert aussi à l'ÉDITION d'une transaction ou d'un grant existants
// (depuis la fiche d'un titre), auquel cas le formulaire complet est affiché.
// ---------------------------------------------------------------------------

const TYPE_LABEL: Record<TransactionType, string> = {
  BUY: 'Achat',
  SELL: 'Vente',
  DIVIDEND: 'Dividende',
  FEE: 'Frais',
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
}
const ASSET_TYPES: TransactionType[] = ['BUY', 'SELL', 'DIVIDEND']
const TODAY = new Date().toISOString().slice(0, 10)
const NEW_ACCOUNT = '__new__'
// Banques proposées pour un nouveau livret / plan d'épargne. Le nom du compte
// devient « <type> <banque> » (ex. « Livret A Fortuneo »), comme « CTO Trade
// Republic » / « PEA Fortuneo » pour les comptes-titres.
const BANKS = ['Fortuneo', 'Société Générale', 'Banque Populaire', 'Axa', 'Revolut']

function num(fd: FormData, k: string): number | undefined {
  const v = fd.get(k)
  if (v == null || String(v).trim() === '') return undefined
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

export default function AddOperationModal({
  accounts,
  assets,
  userId,
  onClose,
  onSaved,
  mode,
  savingsType,
  editTransaction,
  editGrant,
}: {
  accounts: Account[]
  assets: Asset[]
  userId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
  /** Création : type d'opération à saisir (choisi dans le menu « + »). */
  mode?: 'rsu' | 'savings'
  /** Création savings : type de livret / plan visé (Livret A, PER, …). */
  savingsType?: AccountType
  /** Si fourni : mode édition d'une transaction (formulaire complet). */
  editTransaction?: Transaction
  /** Si fourni : mode édition d'un grant RSU. */
  editGrant?: RsuGrant
}) {
  // Vue affichée, déterminée entièrement par les props.
  const view: 'transaction' | 'rsu' | 'savings' = editTransaction
    ? 'transaction'
    : editGrant || mode === 'rsu'
      ? 'rsu'
      : 'savings'

  const [formType, setFormType] = useState<TransactionType>(editTransaction?.type ?? 'BUY')
  const [vestingType, setVestingType] = useState<VestingType>(editGrant?.vestingType ?? 'cliff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAssetType = ASSET_TYPES.includes(formType)
  const isAmountType = !['BUY', 'SELL'].includes(formType)
  const stockAssets = assets.filter((a) => a.type !== 'CASH')

  // --- Savings (versement / retrait sur un livret) -------------------------
  const savingsAccounts = accounts.filter((a) => a.type === savingsType)
  const [savingsAccountId, setSavingsAccountId] = useState(savingsAccounts[0]?.id ?? NEW_ACCOUNT)
  const savingsLabel = savingsType ? ACCOUNT_TYPE_LABEL[savingsType] : 'Épargne'
  const interestBearing = savingsType ? isInterestBearing(savingsType) : false

  async function submitTransaction(fd: FormData) {
    const type = fd.get('type') as TransactionType
    const assetId = String(fd.get('assetId') ?? '') || undefined
    if (!fd.get('accountId')) throw new Error('Sélectionnez un compte.')
    if ((type === 'BUY' || type === 'SELL') && !assetId)
      throw new Error('Sélectionnez un actif pour un achat/vente.')
    const payload: Omit<Transaction, 'id' | 'createdAt'> = {
      userId,
      accountId: String(fd.get('accountId')),
      assetId: ASSET_TYPES.includes(type) ? assetId : undefined,
      type,
      date: String(fd.get('date')),
      quantity: num(fd, 'quantity'),
      price: num(fd, 'price'),
      fees: num(fd, 'fees'),
      currency: fd.get('currency') as Currency,
      amount: num(fd, 'amount'),
      note: String(fd.get('note') ?? '').trim() || undefined,
      source: editTransaction?.source ?? 'MANUAL',
      importBatchId: editTransaction?.importBatchId,
    }
    if (editTransaction) await updateTransaction(editTransaction.id, payload)
    else await createTransaction(payload)
  }

  async function submitSavings(fd: FormData) {
    if (!savingsType) throw new Error('Type de compte manquant.')
    const amount = num(fd, 'amount')
    if (amount == null || amount <= 0) throw new Error('Saisissez un montant.')

    // Compte cible : existant ou créé à la volée.
    let accountId = String(fd.get('accountId') ?? '')
    if (accountId === NEW_ACCOUNT || accountId === '') {
      const rate = interestBearing ? num(fd, 'interestRatePct') : undefined
      const bank = String(fd.get('bank') ?? '').trim()
      const created = await createAccount({
        userId,
        name: bank ? `${savingsLabel} ${bank}` : savingsLabel,
        type: savingsType,
        currency: 'EUR',
        interestRate: rate != null ? rate / 100 : undefined,
      })
      accountId = created.id
    }

    const payload: Omit<Transaction, 'id' | 'createdAt'> = {
      userId,
      accountId,
      type: fd.get('sens') === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT',
      date: String(fd.get('date')),
      amount,
      currency: 'EUR',
      note: String(fd.get('note') ?? '').trim() || undefined,
      source: 'MANUAL',
    }
    await createTransaction(payload)
  }

  async function submitRsu(fd: FormData) {
    const vt = fd.get('vestingType') as VestingType
    const payload: Omit<RsuGrant, 'id' | 'createdAt'> = {
      userId,
      assetId: String(fd.get('assetId')),
      grantDate: String(fd.get('grantDate')),
      totalShares: Number(fd.get('totalShares')),
      platform: fd.get('platform') as RsuPlatform,
      vestingType: vt,
      vestingDate: vt === 'cliff' ? String(fd.get('vestingDate')) || undefined : undefined,
      vestingStartDate: vt === 'monthly' ? String(fd.get('vestingStartDate')) || undefined : undefined,
      vestingMonths: fd.get('vestingMonths') ? Number(fd.get('vestingMonths')) : undefined,
      note: String(fd.get('note') ?? '').trim() || undefined,
    }
    if (!payload.assetId) throw new Error('Choisissez un actif.')
    if (editGrant) await updateRsuGrant(editGrant.id, payload)
    else await createRsuGrant(payload)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      if (view === 'transaction') await submitTransaction(fd)
      else if (view === 'savings') await submitSavings(fd)
      else await submitRsu(fd)
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  const title = editTransaction
    ? 'Modifier la transaction'
    : editGrant
      ? 'Modifier le grant RSU'
      : view === 'rsu'
        ? 'Ajouter un grant RSU'
        : `Versement — ${savingsLabel}`

  return (
    <Modal title={title} onClose={onClose} wide>
      {view === 'transaction' ? (
        <form onSubmit={handleSubmit} className="form-grid form-grid-2">
          <label className="field">
            <span>Type</span>
            <select name="type" defaultValue={editTransaction?.type ?? 'BUY'} onChange={(e) => setFormType(e.target.value as TransactionType)}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" name="date" defaultValue={editTransaction?.date ?? TODAY} required />
          </label>
          <label className="field">
            <span>Compte</span>
            <select name="accountId" defaultValue={editTransaction?.accountId ?? accounts[0]?.id ?? ''} required>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Actif {isAssetType ? '' : '(optionnel)'}</span>
            <select name="assetId" defaultValue={editTransaction?.assetId ?? ''} disabled={!isAssetType && formType !== 'DIVIDEND'}>
              <option value="">— Aucun —</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          {!isAmountType && (
            <>
              <label className="field"><span>Quantité</span><input name="quantity" type="number" step="any" defaultValue={editTransaction?.quantity ?? ''} placeholder="10" /></label>
              <label className="field"><span>Prix unitaire</span><input name="price" type="number" step="any" defaultValue={editTransaction?.price ?? ''} placeholder="145.20" /></label>
            </>
          )}
          {isAmountType && (
            <label className="field"><span>Montant</span><input name="amount" type="number" step="any" defaultValue={editTransaction?.amount ?? ''} placeholder="1000" /></label>
          )}

          <label className="field"><span>Frais</span><input name="fees" type="number" step="any" defaultValue={editTransaction?.fees ?? ''} placeholder="3.90" /></label>
          <label className="field">
            <span>Devise</span>
            <select name="currency" defaultValue={editTransaction?.currency ?? 'EUR'}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="field form-span-2"><span>Note</span><input name="note" defaultValue={editTransaction?.note ?? ''} placeholder="Optionnel" /></label>

          {error && <div className="alert alert-error form-span-2">{error}</div>}
          <div className="form-actions form-span-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={busy || accounts.length === 0}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      ) : view === 'savings' ? (
        <form onSubmit={handleSubmit} className="form-grid form-grid-2">
          <label className="field">
            <span>Compte</span>
            <select
              name="accountId"
              value={savingsAccountId}
              onChange={(e) => setSavingsAccountId(e.target.value)}
            >
              {savingsAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              <option value={NEW_ACCOUNT}>+ Nouveau {savingsLabel}</option>
            </select>
          </label>
          <label className="field">
            <span>Sens</span>
            <select name="sens" defaultValue="DEPOSIT">
              <option value="DEPOSIT">Versement</option>
              <option value="WITHDRAWAL">Retrait</option>
            </select>
          </label>

          {savingsAccountId === NEW_ACCOUNT && (
            <>
              <label className="field">
                <span>Banque</span>
                <select name="bank" defaultValue={BANKS[0]}>
                  {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              {interestBearing && (
                <label className="field">
                  <span>Taux annuel % <span className="muted">(intérêts calculés auto.)</span></span>
                  <input name="interestRatePct" type="number" step="any" min="0" placeholder="Ex : 3" />
                </label>
              )}
            </>
          )}

          <label className="field">
            <span>Date</span>
            <input type="date" name="date" defaultValue={TODAY} required />
          </label>
          <label className="field">
            <span>Montant (€)</span>
            <input name="amount" type="number" step="any" min="0" placeholder="1000" required />
          </label>
          <label className="field form-span-2"><span>Note</span><input name="note" placeholder="Optionnel" /></label>

          {error && <div className="alert alert-error form-span-2">{error}</div>}
          <div className="form-actions form-span-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="form-grid form-grid-2">
          <label className="field">
            <span>Actif (action)</span>
            <select name="assetId" defaultValue={editGrant?.assetId ?? ''} required>
              <option value="" disabled>Choisir un actif…</option>
              {stockAssets.map((a) => <option key={a.id} value={a.id}>{a.ticker} — {a.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Plateforme</span>
            <select name="platform" defaultValue={editGrant?.platform ?? 'EquatePlus'}>
              <option value="EquatePlus">EquatePlus</option>
              <option value="Carta">Carta</option>
            </select>
          </label>
          <label className="field">
            <span>Date d'attribution</span>
            <input name="grantDate" type="date" defaultValue={editGrant?.grantDate ?? TODAY} required />
          </label>
          <label className="field">
            <span>Nombre d'actions total</span>
            <input name="totalShares" type="number" min="1" step="1" defaultValue={editGrant?.totalShares ?? ''} required placeholder="Ex : 200" />
          </label>
          <label className="field">
            <span>Type de vesting</span>
            <select name="vestingType" value={vestingType} onChange={(e) => setVestingType(e.target.value as VestingType)}>
              <option value="cliff">Cliff — livraison en une seule fois</option>
              <option value="monthly">Mensuel — livraison échelonnée</option>
            </select>
          </label>
          {vestingType === 'cliff' && (
            <label className="field">
              <span>Date de livraison</span>
              <input name="vestingDate" type="date" defaultValue={editGrant?.vestingDate ?? ''} required />
            </label>
          )}
          {vestingType === 'monthly' && (
            <>
              <label className="field">
                <span>Date du premier vesting</span>
                <input name="vestingStartDate" type="date" defaultValue={editGrant?.vestingStartDate ?? ''} required />
              </label>
              <label className="field">
                <span>Durée en mois <span className="muted">(ex : 48 = 4 ans)</span></span>
                <input name="vestingMonths" type="number" min="1" step="1" defaultValue={editGrant?.vestingMonths ?? ''} required placeholder="Ex : 48" />
              </label>
            </>
          )}
          <label className="field form-span-2">
            <span>Note <span className="muted">(optionnel)</span></span>
            <input name="note" defaultValue={editGrant?.note ?? ''} placeholder="Ex : Grant performance 2023" />
          </label>

          {error && <div className="alert alert-error form-span-2">{error}</div>}
          <div className="form-actions form-span-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={busy || stockAssets.length === 0}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
          {stockAssets.length === 0 && (
            <div className="alert alert-warn form-span-2">Aucune action disponible : ajoutez d'abord un actif.</div>
          )}
        </form>
      )}
    </Modal>
  )
}
