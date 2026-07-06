import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Email pré-rempli en dur (mono-utilisateur) : seul le mot de passe est demandé.
const PRESET_EMAIL = (import.meta.env.VITE_LOGIN_EMAIL as string | undefined)?.trim() || ''

export default function LoginPage() {
  const { user, signIn, supabaseEnabled } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(PRESET_EMAIL)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const passwordOnly = PRESET_EMAIL !== ''

  // Déjà connecté → dashboard (dans un effet, jamais pendant le rendu).
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
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
          <p className="auth-tagline">Suivi de portefeuille CTO · PEA · Livret+</p>
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
