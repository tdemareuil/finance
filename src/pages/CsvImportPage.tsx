import { useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/common/ui'
import {
  buildImportPreview,
  executeImport,
  GENERIC_COLUMNS,
  guessMapping,
  isExcelFile,
  isTradeRepublicCsv,
  parseCsvFile,
  parseFortuneoFile,
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
  currency: 'Devise', note: 'Note',
}

export default function CsvImportPage() {
  const { user } = useAuth()
  const { accounts, assets, transactions, reload } = usePortfolio()
  const [broker, setBroker] = useState<Broker>('AUTO')
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
  const [includeDuplicates, setIncludeDuplicates] = useState(false)
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
      // Fortuneo (.xls / format Fortuneo)
      if (broker === 'FORTUNEO' || (isExcelFile(file) && broker !== 'GENERIC')) {
        applyPreset(await parseFortuneoFile(file), file)
        return
      }
      // CSV : Trade Republic (sélectionné ou auto-détecté) sinon générique.
      const p = await parseCsvFile(file)
      if (broker === 'TRADE_REPUBLIC' || (broker === 'AUTO' && isTradeRepublicCsv(p.headers))) {
        applyPreset(parseTradeRepublicCsv(p, 'CTO Trade Republic'), file)
        return
      }
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
        { fileName, autoCreateAccounts, autoCreateAssets, includeDuplicates, defaultAccountType },
        user.id,
        accounts,
        assets,
      )
      setResult(res)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'import a échoué.")
    } finally {
      setBusy(false)
    }
  }

  const sampleCsv =
    'date,account,type,assetName,ticker,isin,quantity,price,fees,amount,currency,note\n' +
    '2024-01-15,CTO Trade Republic,BUY,Apple Inc.,AAPL,US0378331005,5,185.30,1,,USD,Achat AAPL\n' +
    '2024-02-01,PEA Fortuneo,dépôt,,,,,,,1000,EUR,Versement\n' +
    '2024-03-10,CTO Trade Republic,dividende,Apple Inc.,AAPL,,,,,2.5,USD,Dividende'

  function downloadSample() {
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'exemple-import-generique.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <h1 className="page-title">Import CSV</h1>

      {/* Étape 1 : upload */}
      <Card title="1 · Fichier et format">
        <div className="import-controls">
          <label className="field">
            <span>Format</span>
            <select value={broker} onChange={(e) => setBroker(e.target.value as Broker)}>
              <option value="AUTO">Auto-détection</option>
              <option value="GENERIC">Générique</option>
              <option value="TRADE_REPUBLIC">Trade Republic</option>
              <option value="FORTUNEO">Fortuneo</option>
            </select>
          </label>
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
          <button className="btn btn-ghost btn-sm" onClick={downloadSample} type="button">
            Télécharger un exemple
          </button>
        </div>
        <p className="muted small">
          <strong>Fortuneo</strong> : export « portefeuille détaillé » (.xls) — mapping automatique.
          {' '}<strong>Trade Republic</strong> : export CSV de transactions — mapping automatique.
          {' '}<strong>Générique</strong> : CSV avec mapping manuel des colonnes.
        </p>
        {busy && !preview && <p className="muted">Lecture du fichier…</p>}
      </Card>

      {/* Preset broker (Fortuneo / Trade Republic) : bandeau explicatif */}
      {preset && <div className="alert alert-info">{preset.note}</div>}

      {/* Étape 2 : mapping (CSV générique uniquement) */}
      {parsed && !preset && (
        <Card title="2 · Mapping des colonnes" action={<span className="muted small">{parsed.rows.length} ligne(s), {parsed.headers.length} colonne(s)</span>}>
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
          title="3 · Aperçu et validation"
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
            <label className="checkbox">
              <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} />
              Importer aussi les doublons probables
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
            <button className="btn btn-primary" onClick={handleImport} disabled={busy || (preview.okCount === 0 && !(includeDuplicates && preview.duplicateCount > 0))}>
              {busy ? 'Import en cours…' : `Importer ${preview.okCount + (includeDuplicates ? preview.duplicateCount : 0)} transaction(s)`}
            </button>
            <button className="btn btn-ghost" onClick={reset}>Recommencer</button>
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

      <Card title="Format générique attendu">
        <p className="muted small">
          Colonnes reconnues : <code>{GENERIC_COLUMNS.join(', ')}</code>.
          Types acceptés : BUY/SELL/DIVIDEND/FEE/DEPOSIT/WITHDRAWAL et leurs équivalents français
          (achat, vente, dividende, frais, dépôt, retrait).
          Dates ISO (AAAA-MM-JJ) ou JJ/MM/AAAA. Montants avec point ou virgule décimale.
        </p>
        <pre className="code-block">{sampleCsv}</pre>
        <p className="muted small">
          <strong>Fortuneo</strong> : l'export « portefeuille détaillé » (.xls) est reconnu
          automatiquement ; chaque position devient un achat au PRU (instantané).
          <br />
          <strong>Trade Republic</strong> : l'export CSV de transactions est reconnu automatiquement ;
          chaque ligne (dépôt, achat/vente, dividende, intérêt, frais) devient une opération datée.
        </p>
      </Card>
    </div>
  )
}
