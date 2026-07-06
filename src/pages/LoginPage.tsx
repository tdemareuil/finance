import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Email pré-rempli en dur (mono-utilisateur) : seul le mot de passe est demandé.
const PRESET_EMAIL = (import.meta.env.VITE_LOGIN_EMAIL as string | undefined)?.trim() || ''

/**
 * Traduit une erreur de connexion en message clair, en distinguant :
 *  - serveur injoignable (projet en pause OU filtrage réseau/DNS d'entreprise) ;
 *  - identifiants incorrects ;
 *  - trop de tentatives ;
 *  - incident serveur Supabase.
 */
function describeSignInError(err: unknown): ReactNode {
  const msg = err instanceof Error ? err.message : String(err)
  const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : undefined

  // 1) Réseau : le fetch n'a jamais abouti (projet en pause, hors ligne, ou
  //    domaine Supabase bloqué par un filtrage DNS d'entreprise type Cisco Umbrella).
  if (status === 0 || /failed to fetch|networkerror|load failed|fetch/i.test(msg)) {
    return (
      <>
        <strong>Serveur injoignable.</strong> La requête n'a pas atteint Supabase. Causes possibles :
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Projet Supabase <strong>en pause</strong> (offre gratuite) → ouvrez le dashboard et cliquez « Resume ».</li>
          <li>
            Domaine Supabase <strong>bloqué par le réseau d'entreprise</strong> (filtrage DNS / proxy) → testez depuis un
            autre réseau (partage de connexion 4G) ou demandez à l'IT d'autoriser <code>*.supabase.co</code>.
          </li>
          <li>Connexion internet coupée.</li>
        </ul>
      </>
    )
  }

  // 2) Identifiants incorrects.
  if (status === 400 || /invalid login credentials|invalid[_ ]credentials/i.test(msg)) {
    return 'Mot de passe incorrect.'
  }

  // 3) Trop de tentatives.
  if (status === 429 || /rate limit|too many/i.test(msg)) {
    return 'Trop de tentatives. Patientez une minute puis réessayez.'
  }

  // 4) Incident côté serveur Supabase.
  if (status !== undefined && status >= 500) {
    return 'Serveur Supabase momentanément indisponible (incident possible). Réessayez dans quelques minutes.'
  }

  // 5) Cas non catégorisé : message brut.
  return msg || 'Une erreur est survenue.'
}

export default function LoginPage() {
  const { user, signIn, supabaseEnabled } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(PRESET_EMAIL)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ReactNode | null>(null)
  const [busy, setBusy] = useState(false)
  const passwordOnly = PRESET_EMAIL !== ''

  // Déjà connecté → dashboard (dans un effet, jamais pendant le rendu).
  useEffect(() => {
    if (user) navigate('/portfolio', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/portfolio')
    } catch (err) {
      setError(describeSignInError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-icon">💰</span>
          <h1>Patrimoine</h1>
          <p className="auth-tagline">Suivi de portefeuille CTO · PEA · Livrets</p>
        </div>

        {!supabaseEnabled ? (
          <div className="alert alert-warn">
            Supabase n'est pas configuré. Renseignez <code>VITE_SUPABASE_URL</code> et{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> dans <code>.env.local</code> pour vous connecter.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {passwordOnly ? (
              // Email fourni par l'environnement, envoyé au serveur mais non éditable.
              <input type="hidden" name="email" value={email} autoComplete="username" />
            ) : (
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="vous@exemple.fr"
                />
              </label>
            )}
            <label className="field">
              <span>Mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus={passwordOnly}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
