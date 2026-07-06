import { useEffect, useState, type FormEvent } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card, EmptyState, Loading, Modal } from '../components/common/ui'
import { createRsuGrant, deleteRsuGrant, listRsuGrants, updateRsuGrant } from '../services/rsuService'
import { computeVestingSummary } from '../services/rsuCalculator'
import type { Asset, RsuGrant, RsuPlatform, VestingEvent, VestingType } from '../types'

const TODAY = new Date().toISOString().slice(0, 10)

const PLATFORM_LABEL: Record<RsuPlatform, string> = {
  EquatePlus: 'EquatePlus',
  Carta: 'Carta',
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function VestingProgressBar({ vestedShares, total }: { vestedShares: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (vestedShares / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
      <div
        style={{
          flex: 1,
          background: 'var(--border)',
          borderRadius: 4,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: pct >= 100 ? 'var(--positive, #22c55e)' : 'var(--accent, #6366f1)',
            height: '100%',
            width: `${pct}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>
      <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', opacity: 0.8 }}>
        {vestedShares.toLocaleString()} / {total.toLocaleString()}
      </span>
    </div>
  )
}

interface CalendarModalProps {
  grant: RsuGrant
  asset: Asset | undefined
  events: VestingEvent[]
  vestedShares: number
  onClose: () => void
}

function CalendarModal({ grant, asset, events, vestedShares, onClose }: CalendarModalProps) {
  const pct = grant.totalShares > 0 ? ((vestedShares / grant.totalShares) * 100).toFixed(1) : '0'
  return (
    <Modal
      title={`Calendrier de vesting — ${asset?.name ?? '?'} (${formatDate(grant.grantDate)})`}
      onClose={onClose}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
          <span>
            <strong>{vestedShares.toLocaleString()}</strong> actions acquises sur{' '}
            <strong>{grant.totalShares.toLocaleString()}</strong> ({pct}%)
          </span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span>
            <strong>{(grant.totalShares - vestedShares).toLocaleString()}</strong> à venir
          </span>
        </div>
        <VestingProgressBar vestedShares={vestedShares} total={grant.totalShares} />
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th className="num">Actions</th>
              <th className="num">Cumulatif</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} style={{ opacity: e.status === 'pending' ? 0.65 : 1 }}>
                <td>{formatDate(e.date)}</td>
                <td className="num">+{e.shares.toLocaleString()}</td>
                <td className="num">{e.cumulativeShares.toLocaleString()}</td>
                <td>
                  <span
                    className={`chip chip-${e.status === 'vested' ? 'positive' : 'default'}`}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {e.status === 'vested' ? 'Acquis' : 'À venir'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

interface GrantFormProps {
  grant: RsuGrant | null
  assets: Asset[]
  busy: boolean
  error: string | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

function GrantForm({ grant, assets, busy, error, onSubmit, onClose }: GrantFormProps) {
  const [vestingType, setVestingType] = useState<VestingType>(grant?.vestingType ?? 'cliff')
  const stockAssets = assets.filter((a) => a.type !== 'CASH')

  return (
    <Modal
      title={grant ? 'Modifier le grant RSU' : 'Nouveau grant RSU'}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="form-grid">
        <label className="field">
          <span>Actif (action)</span>
          <select name="assetId" defaultValue={grant?.assetId ?? ''} required>
            <option value="" disabled>Choisir un actif…</option>
            {stockAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ticker} — {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Plateforme</span>
          <select name="platform" defaultValue={grant?.platform ?? 'EquatePlus'}>
            <option value="EquatePlus">EquatePlus</option>
            <option value="Carta">Carta</option>
          </select>
        </label>

        <label className="field">
          <span>Date d'attribution</span>
          <input name="grantDate" type="date" defaultValue={grant?.grantDate ?? ''} required />
        </label>

        <label className="field">
          <span>Nombre d'actions total</span>
          <input
            name="totalShares"
            type="number"
            min="1"
            step="1"
            defaultValue={grant?.totalShares ?? ''}
            required
            placeholder="Ex : 200"
          />
        </label>

        <label className="field">
          <span>Type de vesting</span>
          <select
            name="vestingType"
            value={vestingType}
            onChange={(e) => setVestingType(e.target.value as VestingType)}
          >
            <option value="cliff">Cliff — livraison en une seule fois</option>
            <option value="monthly">Mensuel — livraison échelonnée</option>
          </select>
        </label>

        {vestingType === 'cliff' && (
          <label className="field">
            <span>Date de livraison</span>
            <input name="vestingDate" type="date" defaultValue={grant?.vestingDate ?? ''} required />
          </label>
        )}

        {vestingType === 'monthly' && (
          <>
            <label className="field">
              <span>Date du premier vesting</span>
              <input
                name="vestingStartDate"
                type="date"
                defaultValue={grant?.vestingStartDate ?? ''}
                required
              />
            </label>
            <label className="field">
              <span>Durée en mois <span className="muted">(ex : 48 = 4 ans)</span></span>
              <input
                name="vestingMonths"
                type="number"
                min="1"
                step="1"
                defaultValue={grant?.vestingMonths ?? ''}
                required
                placeholder="Ex : 48"
              />
            </label>
          </>
        )}

        <label className="field">
          <span>Note <span className="muted">(optionnel)</span></span>
          <input name="note" defaultValue={grant?.note ?? ''} placeholder="Ex : Grant performance 2023" />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function RsuPage() {
  const { user } = useAuth()
  const { assets, loading: portfolioLoading } = usePortfolio()

  const [grants, setGrants] = useState<RsuGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<RsuGrant | null>(null)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [calendar, setCalendar] = useState<RsuGrant | null>(null)

  async function loadGrants() {
    if (!user) return
    try {
      setGrants(await listRsuGrants(user.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGrants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleDelete(g: RsuGrant) {
    const asset = assets.find((a) => a.id === g.assetId)
    if (!confirm(`Supprimer le grant ${asset?.ticker ?? ''} (${formatDate(g.grantDate)}) ?`)) return
    try {
      await deleteRsuGrant(g.id)
      setGrants((prev) => prev.filter((x) => x.id !== g.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setFormError(null)
    const fd = new FormData(e.currentTarget)

    const vestingType = fd.get('vestingType') as VestingType
    const totalShares = Number(fd.get('totalShares'))
    const vestingMonths = fd.get('vestingMonths') ? Number(fd.get('vestingMonths')) : undefined

    if (vestingType === 'monthly' && vestingMonths && totalShares % vestingMonths !== 0) {
      // Allow non-divisible: last tranche absorbs remainder — no warning needed.
    }

    const payload: Omit<RsuGrant, 'id' | 'createdAt'> = {
      userId: user.id,
      assetId: String(fd.get('assetId')),
      grantDate: String(fd.get('grantDate')),
      totalShares,
      platform: fd.get('platform') as RsuPlatform,
      vestingType,
      vestingDate: vestingType === 'cliff' ? String(fd.get('vestingDate')) || undefined : undefined,
      vestingStartDate:
        vestingType === 'monthly' ? String(fd.get('vestingStartDate')) || undefined : undefined,
      vestingMonths,
      note: String(fd.get('note') ?? '').trim() || undefined,
    }

    try {
      if (editing) {
        const updated = await updateRsuGrant(editing.id, payload)
        setGrants((prev) => prev.map((g) => (g.id === editing.id ? updated : g)))
      } else {
        const created = await createRsuGrant(payload)
        setGrants((prev) => [created, ...prev])
      }
      setEditing(null)
      setCreating(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || portfolioLoading) return <Loading />

  const assetById = Object.fromEntries(assets.map((a) => [a.id, a]))

  const calendarGrant = calendar ? grants.find((g) => g.id === calendar.id) ?? calendar : null
  const calendarSummary = calendarGrant
    ? computeVestingSummary(calendarGrant, TODAY)
    : null

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">RSU</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau grant
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <Card>
        {grants.length === 0 ? (
          <EmptyState
            title="Aucun grant RSU"
            hint="Ajoutez vos plans d'attribution d'actions pour suivre votre calendrier de vesting."
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Actif</th>
                <th>Plateforme</th>
                <th>Attribution</th>
                <th className="num">Actions</th>
                <th>Vesting</th>
                <th>Prochaine livraison</th>
                <th>Progression</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => {
                const asset = assetById[g.assetId]
                const { vestedShares, nextEvent } = computeVestingSummary(g, TODAY)
                const vestingLabel =
                  g.vestingType === 'cliff'
                    ? 'Cliff'
                    : `Mensuel · ${g.vestingMonths} mois`
                return (
                  <tr key={g.id}>
                    <td>
                      <span className="chip chip-default">
                        {asset?.ticker ?? '?'}
                      </span>{' '}
                      <span style={{ opacity: 0.7 }}>{asset?.name ?? g.assetId}</span>
                    </td>
                    <td>
                      <span className="chip chip-info">{PLATFORM_LABEL[g.platform]}</span>
                    </td>
                    <td>{formatDate(g.grantDate)}</td>
                    <td className="num">{g.totalShares.toLocaleString()}</td>
                    <td>{vestingLabel}</td>
                    <td>
                      {nextEvent ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {formatDate(nextEvent.date)}{' '}
                          <span style={{ opacity: 0.6 }}>
                            (+{nextEvent.shares.toLocaleString()})
                          </span>
                        </span>
                      ) : (
                        <span className="chip chip-positive" style={{ fontSize: '0.75rem' }}>
                          Terminé
                        </span>
                      )}
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <VestingProgressBar vestedShares={vestedShares} total={g.totalShares} />
                    </td>
                    <td className="row-actions">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setCalendar(g)}
                      >
                        Calendrier
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setEditing(g)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn btn-sm btn-danger-ghost"
                        onClick={() => handleDelete(g)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {(creating || editing) && (
        <GrantForm
          grant={editing}
          assets={assets}
          busy={busy}
          error={formError}
          onSubmit={handleSubmit}
          onClose={() => {
            setEditing(null)
            setCreating(false)
            setFormError(null)
          }}
        />
      )}

      {calendarGrant && calendarSummary && (
        <CalendarModal
          grant={calendarGrant}
          asset={assetById[calendarGrant.assetId]}
          events={calendarSummary.events}
          vestedShares={calendarSummary.vestedShares}
          onClose={() => setCalendar(null)}
        />
      )}
    </div>
  )
}
