import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePortfolio } from '../context/PortfolioContext'
import { Card } from '../components/ui'
import { EurUsdChart } from '../components/charts'
import { isEodhdConfigured, isFmpConfigured, marketDataMode } from '../services/marketDataService'
import { isFinnhubConfigured } from '../services/analysisService'
import { clearDemoData, seedDemoData } from '../services/localStore'

const MODE_LABEL: Record<string, string> = {
  EODHD: 'EODHD (temps réel)',
  FMP: 'FMP (fallback)',
  MOCK: 'Mock (données fictives)',
}

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

      <Card title="Providers de données">
        <ul className="kv-list">
          <li><span>Données de marché (source principale)</span><strong>{MODE_LABEL[marketDataMode]}</strong></li>
          <li><span>EODHD (marché)</span><strong>{isEodhdConfigured ? 'Détectée' : 'Absente'}</strong></li>
          <li><span>Finnhub (analyse)</span><strong>{isFinnhubConfigured ? 'Détectée' : 'Absente'}</strong></li>
          <li><span>FMP (fallback marché + analyse)</span><strong>{isFmpConfigured ? 'Détectée' : 'Absente'}</strong></li>
        </ul>
        <p className="muted small">
          Ordre de fallback — marché : EODHD → FMP → mock ; analyse : Finnhub → FMP → mock.
          Les clés se renseignent dans <code>.env.local</code> (jamais committées). Sans clé, des données
          fictives déterministes sont utilisées. Les résultats (y compris vides) sont mis en cache pour
          éviter les appels répétés.
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
          Les montants en USD sont convertis en EUR via un taux de change fixe simplifié (prototype).
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
