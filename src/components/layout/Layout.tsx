import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePortfolio } from '../../context/PortfolioContext'
import { getTheme, setTheme, type Theme } from '../../utils/theme'
import GlobalSearch from '../search/GlobalSearch'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/portfolio', label: 'Portefeuille', icon: '📁' },
  { to: '/transactions', label: 'Transactions', icon: '💸' },
  { to: '/accounts', label: 'Comptes', icon: '🏦' },
  { to: '/assets', label: 'Actifs', icon: '📈' },
  { to: '/dividends', label: 'Dividendes', icon: '💰' },
  { to: '/rsu', label: 'RSU', icon: '🏷️' },
  { to: '/import', label: 'Import CSV', icon: '📥' },
  { to: '/settings', label: 'Paramètres', icon: '⚙️' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { refreshing, reload, marketMode } = usePortfolio()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getTheme())

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
          <span className="badge badge-market">Marché : {marketMode === 'EODHD' ? 'EODHD' : 'mock'}</span>
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
          <span className="topbar-user">{user?.email}</span>
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
