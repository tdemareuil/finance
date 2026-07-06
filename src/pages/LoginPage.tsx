import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, signIn, signUp, enterDemoMode, supabaseEnabled } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Déjà connecté → dashboard.
  if (user) {
    navigate('/dashboard', { replace: true })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate('/dashboard')
      } else {
        const { needsConfirmation } = await signUp(email, password)
        if (needsConfirmation) {
          setInfo('Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.')
          setMode('signin')
        } else {
          navigate('/dashboard')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  function handleDemo() {
    enterDemoMode()
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-icon">💰</span>
          <h1>Patrimoine</h1>
          <p className="auth-tagline">Suivi de portefeuille CTO · PEA · Livret+</p>
        </div>

        {!supabaseEnabled && (
          <div className="alert alert-warn">
            Supabase n'est pas configuré. Vous pouvez explorer l'application en <strong>mode démo</strong>.
            Renseignez <code>.env.local</code> pour activer les comptes et la synchronisation multi-appareils.
          </div>
        )}

        {supabaseEnabled && (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => setMode('signin')}
                type="button"
              >
                Connexion
              </button>
              <button
                className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => setMode('signup')}
                type="button"
              >
                Créer un compte
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
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
              <label className="field">
                <span>Mot de passe</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                />
              </label>
              {error && <div className="alert alert-error">{error}</div>}
              {info && <div className="alert alert-info">{info}</div>}
              <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                {busy ? 'Veuillez patienter…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
              </button>
            </form>

            <div className="auth-divider"><span>ou</span></div>
          </>
        )}

        <button className="btn btn-block btn-secondary" onClick={handleDemo} type="button">
          Explorer en mode démo
        </button>
        <p className="auth-fineprint">
          Le mode démo utilise des données fictives stockées localement. Aucune donnée réelle,
          aucune clé API dans le dépôt.
        </p>
      </div>
    </div>
  )
}
