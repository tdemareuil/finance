import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui'
import { isUnreachableError } from '../utils'
import {
  buildImportPreview,
  executeImport,
  GENERIC_COLUMNS,
  guessMapping,
  isExcelFile,
  isFortuneoHistoryCsv,
  isTradeRepublicCsv,
  parseCsvFile,
  parseFortuneoFile,
  parseFortuneoHistoryCsv,
  parseTradeRepublicCsv,
  REQUIRED_COLUMNS,
  type BrokerImportResult,
  type ColumnMapping,
  type GenericColumn,
  type ImportPreview,
  type ImportResult,
  type ParsedCsv,
} from '../services/csvImportService'
import type { AccountType } from '../types'

type Broker = 'GENERIC' | 'TRADE_REPUBLIC' | 'FORTUNEO' | 'AUTO'

const COLUMN_LABEL: Record<GenericColumn, string> = {
  date: 'Date', account: 'Compte', type: 'Type', assetName: 'Nom actif', ticker: 'Ticker',
  isin: 'ISIN', quantity: 'Quantité', price: 'Prix', fees: 'Frais', amount: 'Montant',
  currency: 'Devise', note: 'Note', externalId: 'ID externe (dédup)',
}

export default function CsvImportPage() {
  const { user } = useAuth()
  const { accounts, assets, transactions, reload } = usePortfolio()
  // Le format est toujours auto-détecté (Fortuneo .xls / .csv, Trade Republic),
  // avec repli sur un mapping manuel si le CSV n'est pas reconnu.
  const broker: Broker = 'AUTO'
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [preset, setPreset] = useState<BrokerImportResult | null>(null)
  const [targetAccount, setTargetAccount] = useState('')
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Options d'import
  const [autoCreateAccounts, setAutoCreateAccounts] = useState(true)
  const [autoCreateAssets, setAutoCreateAssets] = useState(true)
  const [defaultAccountType, setDefaultAccountType] = useState<AccountType>('CTO')

  function reset() {
    setParsed(null)
    setPreset(null)
    setTargetAccount('')
    setMapping({})
    setPreview(null)
    setResult(null)
    setError(null)
    setFileName('')
  }

  function presetPreview(res: BrokerImportResult, accountName: string) {
    const rows = res.parsed.rows.map((r) => ({ ...r, account: accountName }))
    return buildImportPreview({ headers: res.parsed.headers, rows }, res.mapping, accounts, assets, transactions)
  }

  function applyPreset(res: BrokerImportResult, file: File) {
    setPreset(res)
    setFileName(file.name)
    setDefaultAccountType(res.detectedAccountType)
    setTargetAccount(res.detectedAccountName)
    setPreview(presetPreview(res, res.detectedAccountName))
  }

  async function handleFile(file: File) {
    reset()
    setBusy(true)
    try {
      // Fortuneo .xls (instantané de positions)
      if (isExcelFile(file) && broker !== 'GENERIC') {
        applyPreset(await parseFortuneoFile(file), file)
        return
      }
      const p = await parseCsvFile(file)
      // Fortuneo CSV (historique des opérations)
      if (broker === 'FORTUNEO' || (broker === 'AUTO' && isFortuneoHistoryCsv(p.headers))) {
        applyPreset(parseFortuneoHistoryCsv(p, 'PEA Fortuneo'), file)
        return
      }
      // Trade Republic (CSV de transactions)
      if (broker === 'TRADE_REPUBLIC' || (broker === 'AUTO' && isTradeRepublicCsv(p.headers))) {
        applyPreset(parseTradeRepublicCsv(p, 'CTO Trade Republic'), file)
        return
      }
      // Générique : mapping manuel
      setParsed(p)
      setFileName(file.name)
      setMapping(guessMapping(p.headers))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de lire le fichier.')
    } finally {
      setBusy(false)
    }
  }

  function changeTargetAccount(name: string) {
    setTargetAccount(name)
    if (preset) setPreview(presetPreview(preset, name))
  }

  function updateMapping(col: GenericColumn, header: string) {
    setMapping((m) => ({ ...m, [col]: header || undefined }))
    setPreview(null)
  }

  function handleBuildPreview() {
    if (!parsed) return
    setError(null)
    const missing = REQUIRED_COLUMNS.filter((c) => !mapping[c])
    if (missing.length) {
      setError(`Colonnes obligatoires non mappées : ${missing.map((c) => COLUMN_LABEL[c]).join(', ')}.`)
      return
    }
    setPreview(buildImportPreview(parsed, mapping, accounts, assets, transactions))
  }

  async function handleImport() {
    if (!preview || !user) return
    setBusy(true)
    setError(null)
    try {
      const res = await executeImport(
        preview,
        { fileName, autoCreateAccounts, autoCreateAssets, includeDuplicates: false, defaultAccountType },
        user.id,
        accounts,
        assets,
      )
      setResult(res)
      await reload()
    } catch (e) {
      if (isUnreachableError(e)) {
        setError(
          "Serveur injoignable : impossible d'écrire dans la base. Le projet Supabase est " +
            "peut-être en pause, ou le réseau / DNS de votre entreprise bloque Supabase " +
            '(testez depuis un autre réseau, ex. partage de connexion 4G). Aucune donnée ' +
            "n'a été enregistrée.",
        )
      } else {
        setError(e instanceof Error ? e.message : "L'import a échoué.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/portfolio" className="back-link">← Portefeuille</Link>
          <h1 className="page-title">Import CSV</h1>
        </div>
      </div>

      {/* Étape 1 : upload */}
      <Card title="Fichier et format">
        <div className="import-controls">
          <label className="field">
            <span>Fichier CSV ou Excel</span>
            <input
              type="file"
              accept=".csv,text/csv,.xls,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </label>
        </div>
        <p className="muted small">Le format est reconnu automatiquement.</p>
        {busy && !preview && <p className="muted">Lecture du fichier…</p>}
      </Card>

      {/* Formats reconnus automatiquement */}
      <Card title="Formats possibles">
        <p className="muted small">
          <strong>Fortuneo</strong> : l'export « portefeuille détaillé » (.xls) est reconnu
          automatiquement ; chaque position devient un achat au PRU (instantané). L'« historique
          des opérations » (.csv) est aussi reconnu.
          <br />
          <strong>Trade Republic</strong> : l'export CSV de transactions est reconnu automatiquement ;
          chaque ligne (dépôt, achat/vente, dividende, intérêt, frais) devient une opération datée.
        </p>
      </Card>

      {/* Preset broker (Fortuneo / Trade Republic) : bandeau explicatif */}
      {preset && <div className="alert alert-info">{preset.note}</div>}

      {/* Étape 2 : mapping (CSV générique uniquement) */}
      {parsed && !preset && (
        <Card title="Mapping des colonnes" action={<span className="muted small">{parsed.rows.length} ligne(s), {parsed.headers.length} colonne(s)</span>}>
          <div className="mapping-grid">
            {GENERIC_COLUMNS.map((col) => (
              <label key={col} className="field">
                <span>
                  {COLUMN_LABEL[col]}
                  {REQUIRED_COLUMNS.includes(col) && <em className="req"> *</em>}
                </span>
                <select value={mapping[col] ?? ''} onChange={(e) => updateMapping(col, e.target.value)}>
                  <option value="">— Ignorer —</option>
                  {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-primary" onClick={handleBuildPreview}>Générer l'aperçu</button>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
        </Card>
      )}

      {/* Étape 3 : aperçu */}
      {preview && (
        <Card
          title="Aperçu et validation"
          action={
            <span className="import-summary">
              <span className="chip chip-ok">{preview.okCount} OK</span>
              <span className="chip chip-dividend">{preview.duplicateCount} doublon(s)</span>
              <span className="chip chip-sell">{preview.errorCount} erreur(s)</span>
            </span>
          }
        >
          {(preview.missingAccounts.length > 0 || preview.missingAssets.length > 0) && (
            <div className="alert alert-info">
              {preview.missingAccounts.length > 0 && (
                <div>Comptes absents : <strong>{preview.missingAccounts.join(', ')}</strong></div>
              )}
              {preview.missingAssets.length > 0 && (
                <div>Actifs absents : <strong>{preview.missingAssets.map((a) => a.name).join(', ')}</strong></div>
              )}
            </div>
          )}

          <div className="import-options">
            {preset && (
              <label className="field inline">
                <span>Compte cible</span>
                <input
                  list="account-names"
                  value={targetAccount}
                  onChange={(e) => changeTargetAccount(e.target.value)}
                  placeholder="Ex : PEA Fortuneo"
                />
                <datalist id="account-names">
                  {accounts.map((a) => <option key={a.id} value={a.name} />)}
                </datalist>
              </label>
            )}
            <label className="checkbox">
              <input type="checkbox" checked={autoCreateAccounts} onChange={(e) => setAutoCreateAccounts(e.target.checked)} />
              Créer automatiquement les comptes manquants
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={autoCreateAssets} onChange={(e) => setAutoCreateAssets(e.target.checked)} />
              Créer automatiquement les actifs manquants
            </label>
            <label className="field inline">
              <span>Type des comptes créés</span>
              <select value={defaultAccountType} onChange={(e) => setDefaultAccountType(e.target.value as AccountType)}>
                <option value="CTO">CTO</option>
                <option value="PEA">PEA</option>
                <option value="LIVRET_PLUS">Livret+</option>
              </select>
            </label>
          </div>

          <div className="table-scroll preview-table">
            <table className="table compact">
              <thead>
                <tr>
                  <th>#</th><th>Statut</th><th>Date</th><th>Compte</th><th>Type</th><th>Actif</th>
                  <th className="num">Qté</th><th className="num">Prix</th><th className="num">Montant</th><th>Messages</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((r) => (
                  <tr key={r.index} className={`preview-row status-${r.status.toLowerCase()}`}>
                    <td>{r.index + 1}</td>
                    <td><span className={`chip chip-${r.status === 'OK' ? 'ok' : r.status === 'DUPLICATE' ? 'dividend' : 'sell'}`}>{r.status}</span></td>
                    <td>{r.date ?? '—'}</td>
                    <td>{r.accountName || '—'}{r.needsAccount && <span className="badge-new">nouveau</span>}</td>
                    <td>{r.type ?? '—'}</td>
                    <td>{r.assetName || r.ticker || r.isin || '—'}{r.needsAsset && <span className="badge-new">nouveau</span>}</td>
                    <td className="num">{r.quantity ?? '—'}</td>
                    <td className="num">{r.price ?? '—'}</td>
                    <td className="num">{r.amount ?? '—'}</td>
                    <td className="muted small">{r.messages.join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 200 && <p className="muted small">Aperçu limité à 200 lignes ({preview.rows.length} au total ; toutes seront importées).</p>}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-primary" onClick={handleImport} disabled={busy || preview.okCount === 0}>
              {busy ? 'Import en cours…' : `Importer ${preview.okCount} transaction(s)`}
            </button>
          </div>
        </Card>
      )}

      {/* Résultat */}
      {result && (
        <Card title="Import terminé ✓">
          <ul className="kv-list">
            <li><span>Transactions importées</span><strong>{result.inserted}</strong></li>
            <li><span>Lignes ignorées</span><strong>{result.skipped}</strong></li>
            <li><span>Comptes créés</span><strong>{result.createdAccounts}</strong></li>
            <li><span>Actifs créés</span><strong>{result.createdAssets}</strong></li>
            <li><span>Batch d'import</span><strong className="muted small">{result.batchId}</strong></li>
          </ul>
          <button className="btn btn-ghost" onClick={reset}>Nouvel import</button>
        </Card>
      )}

    </div>
  )
}
