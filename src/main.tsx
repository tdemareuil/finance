import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PortfolioProvider } from './context/PortfolioContext'
import { initTheme } from './utils'
import './index.css'

initTheme()

// HashRouter : compatible GitHub Pages (pas de configuration serveur pour le
// routing SPA, les URLs sont de la forme /#/dashboard).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <PortfolioProvider>
          <App />
        </PortfolioProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
