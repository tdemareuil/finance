import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePortfolio } from '../context/PortfolioContext'
import { Card } from '../components/ui'
import { EurUsdChart } from '../components/charts'
import { isTwelveDataConfigured, isFmpConfigured, marketDataMode } from '../services/marketDataService'
import { analysisMode, isFinnhubConfigured } from '../services/analysisService'
import { clearDemoData, seedDemoData } from '../services/localStore'

// Chaînes de providers, dans l'ordre de priorité réel des services.
interface ProviderStep {
  key: string
  name: string
  configured: boolean
}
const MARKET_CHAIN: ProviderStep[] = [
  { key: 'TWELVE_DATA', name: 'Twelve Data', configured: isTwelveDataConfigured },
  { key: 'FMP', name: 'FMP', configured: isFmpConfigured },
  { key: 'FINNHUB', name: 'Finnhub', configured: isFinnhubConfigured },
]
const ANALYSIS_CHAIN: ProviderStep[] = [
  { key: 'FMP', name: 'FMP', configured: isFmpConfigured },
  { key: 'FINNHUB', name: 'Finnhub', configured: isFinnhubConfigured },
]

/** Affiche une chaîne de providers, numérotée dans l'ordre de priorité. */
function ProviderChain({
  title,
  subtitle,
  steps,
  activeKey,
}: {
  title: string
  subtitle: string
  steps: ProviderStep[]
  activeKey: string
}) {
  return (
    <div className="provider-service">
      <h3 className="alloc-title">{title}</h3>
      <p className="muted small provider-subtitle">{subtitle}</p>
      <ol className="provider-chain">
        {steps.map((s, i) => {
          const active = s.key === activeKey && s.configured
          const role = active ? 'utilisé' : s.configured ? 'en secours' : 'clé absente'
          return (
            <li key={s.key} className={`provider-step${active ? ' active' : ''}${s.configured ? '' : ' off'}`}>
              <span className="provider-rank">{i + 1}</span>
              <span className="provider-name">{s.name}</span>
              <span className={`chip ${s.configured ? 'chip-ok' : 'chip-default'}`}>
                {s.configured ? 'Détectée' : 'Absente'}
              </span>
              <span className="provider-role muted small">{role}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const BENCHMARKS = [
  { symbol: 'CW8.PA', label: 'Amundi MSCI World (CW8.PA, EUR)' },
  { symbol: 'IWDA.AS', label: 'iShares Core MSCI World (IWDA.AS, EUR)' },
  { symbol: 'URTH', label: 'iShares MSCI World (URTH, USD)' },
]

export default function SettingsPage() {
  const { user, signOut, supabaseEnabled: sbEnabled } = useAuth()
  const { benchmarkSymbol, setBenchmarkSymbol, reload, fx } = usePortfolio()
  const usdPerEur = fx.USD > 0 ? 1 / fx.USD : null
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function reloadDemo() {
    if (!confirm('Recharger les données de démonstration ? Cela remplace les données démo actuelles.')) return
    seedDemoData(user!.id)
    await reload()
  }
  async function wipeDemo() {
    if (!confirm('Vider toutes les données de démonstration ?')) return
    clearDemoData()
    await reload()
  }

  return (
    <div className="page">
      <h1 className="page-title">Paramètres</h1>

      <Card title="Compte">
        <ul className="kv-list">
          <li><span>Email connecté</span><strong>{user?.email ?? '—'}</strong></li>
          <li><span>Mode</span><strong>{user?.isDemo ? 'Démo (données locales)' : 'Compte Supabase'}</strong></li>
          <li><span>Supabase</span><strong>{sbEnabled ? 'Configuré' : 'Non configuré'}</strong></li>
        </ul>
        <button className="btn btn-danger-ghost" onClick={handleSignOut}>Se déconnecter</button>
      </Card>

      <Card title="Providers de données">
        <p className="muted small" style={{ marginTop: 0 }}>
          Chaque service interroge ses providers <strong>dans l'ordre</strong> et s'arrête au premier qui
          répond. Bascule automatique au suivant si la clé est absente ou le quota atteint.{' '}
          <strong>Aucun repli fictif</strong> : une donnée indisponible reste vide, jamais inventée.
        </p>
        <div className="providers-grid">
          <ProviderChain
            title="Données de marché"
            subtitle="cours, historiques, dividendes"
            steps={MARKET_CHAIN}
            activeKey={marketDataMode}
          />
          <ProviderChain
            title="Analyse"
            subtitle="consensus, objectifs, news, fondamentaux"
            steps={ANALYSIS_CHAIN}
            activeKey={analysisMode}
          />
        </div>
        <p className="muted small">
          Les clés se renseignent dans <code>.env.local</code> (jamais committées).
        </p>
      </Card>

      <Card title="Benchmark MSCI World">
        <label className="field" style={{ maxWidth: 420 }}>
          <span>Symbole du benchmark</span>
          <select value={benchmarkSymbol} onChange={(e) => setBenchmarkSymbol(e.target.value)}>
            {BENCHMARKS.map((b) => <option key={b.symbol} value={b.symbol}>{b.label}</option>)}
            {!BENCHMARKS.some((b) => b.symbol === benchmarkSymbol) && (
              <option value={benchmarkSymbol}>{benchmarkSymbol}</option>
            )}
          </select>
        </label>
        <p className="muted small">Utilisé pour la courbe comparative du Portefeuille.</p>
        <button className="btn btn-sm" onClick={() => reload()}>Recalculer</button>
      </Card>

      <Card title="Devise principale">
        <ul className="kv-list">
          <li><span>Devise d'affichage des agrégats</span><strong>EUR</strong></li>
        </ul>
        <p className="muted small">
          Les montants en USD sont convertis en EUR au cours actuel
          {usdPerEur ? ` (1 € = ${usdPerEur.toFixed(4)} $)` : ''}, actualisé automatiquement.
        </p>
        <h3 className="alloc-title" style={{ marginTop: 16 }}>Cours EUR/USD (1 an)</h3>
        <EurUsdChart />
      </Card>

      {user?.isDemo && (
        <Card title="Données de démonstration">
          <p className="muted small">Ces actions n'affectent que le store local de démo.</p>
          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-sm" onClick={reloadDemo}>Recharger les données de démo</button>
            <button className="btn btn-sm btn-danger-ghost" onClick={wipeDemo}>Vider les données de démo</button>
          </div>
        </Card>
      )}
    </div>
  )
}
