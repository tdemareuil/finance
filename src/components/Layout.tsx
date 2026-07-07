import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePortfolio } from '../context/PortfolioContext'
import { getTheme, setTheme, type Theme } from '../utils'
import GlobalSearch from './GlobalSearch'

const NAV = [
  { to: '/portfolio', label: 'Portefeuille', icon: '📊' },
  { to: '/dividends', label: 'Dividendes', icon: '💰' },
  { to: '/settings', label: 'Paramètres', icon: '⚙️' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { refreshing, reload, marketMode } = usePortfolio()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getTheme())

  // Fermer le volet mobile avec la touche Échap.
  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {menuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-icon">💰</span>
          <span className="brand-name">Patrimoine</span>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {user?.isDemo && <span className="badge badge-demo">Mode démo</span>}
          <span className="badge badge-market">
            Marché : {marketMode === 'TWELVE_DATA' ? 'Twelve Data' : marketMode === 'FMP' ? 'FMP' : marketMode === 'FINNHUB' ? 'Finnhub' : 'indisponible'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            ☰
          </button>
          <GlobalSearch />
          <div className="topbar-spacer" />
          <button
            className="btn btn-ghost btn-icon"
            onClick={toggleTheme}
            aria-label="Basculer le thème"
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-sm" onClick={() => reload()} disabled={refreshing}>
            {refreshing ? 'Actualisation…' : '↻ Actualiser'}
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
