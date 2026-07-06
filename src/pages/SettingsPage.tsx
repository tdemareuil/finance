import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePortfolio } from '../context/PortfolioContext'
import { Card } from '../components/common/ui'
import { isEodhdConfigured, marketDataMode } from '../services/marketDataService'
import { clearDemoData, seedDemoData } from '../services/localStore'

const BENCHMARKS = [
  { symbol: 'CW8.PA', label: 'Amundi MSCI World (CW8.PA, EUR)' },
  { symbol: 'IWDA.AS', label: 'iShares Core MSCI World (IWDA.AS, EUR)' },
  { symbol: 'URTH', label: 'iShares MSCI World (URTH, USD)' },
]

export default function SettingsPage() {
  const { user, signOut, supabaseEnabled: sbEnabled } = useAuth()
  const { benchmarkSymbol, setBenchmarkSymbol, reload } = usePortfolio()
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

      <Card title="Données de marché (EODHD)">
        <ul className="kv-list">
          <li><span>Mode actuel</span><strong>{marketDataMode === 'EODHD' ? 'EODHD (temps réel)' : 'Mock (données fictives)'}</strong></li>
          <li><span>Clé EODHD</span><strong>{isEodhdConfigured ? 'Détectée' : 'Absente'}</strong></li>
        </ul>
        {!isEodhdConfigured && (
          <p className="muted small">
            Pour activer les cours réels, renseignez <code>VITE_EODHD_API_KEY</code> dans <code>.env.local</code>.
            La clé n'est jamais stockée dans le dépôt. Sans clé, l'application utilise des données de marché fictives.
          </p>
        )}
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
        <p className="muted small">Utilisé pour la courbe comparative du Dashboard.</p>
        <button className="btn btn-sm" onClick={() => reload()}>Recalculer</button>
      </Card>

      <Card title="Devise principale">
        <ul className="kv-list">
          <li><span>Devise d'affichage des agrégats</span><strong>EUR</strong></li>
        </ul>
        <p className="muted small">
          Les montants en USD sont convertis en EUR via un taux de change fixe simplifié (prototype).
        </p>
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
