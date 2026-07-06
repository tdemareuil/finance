import { useEffect, useRef } from 'react'
import { getTheme } from '../utils'

// ---------------------------------------------------------------------------
// Widget "Advanced Chart" de TradingView.
// Charge le script d'embed officiel et injecte la configuration.
// Nécessite une connexion internet (script externe). Si le symbole est absent,
// le composant parent affiche un message d'information à la place.
//   - style '3' = courbe pleine (mode « région »), par défaut (au lieu des bougies) ;
//   - thème calqué sur celui de l'application (sombre par défaut) ;
//   - hauteur augmentée pour une meilleure lisibilité.
// ---------------------------------------------------------------------------

const HEIGHT = 220

export default function TradingViewWidget({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Thème appliqué au document (reflète le toggle clair/sombre), sinon préférence.
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : getTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = '' // reset lors d'un changement de symbole/thème

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    widgetDiv.style.width = '100%'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: '100%',
      height: HEIGHT,
      symbol,
      interval: 'D',
      timezone: 'Europe/Paris',
      theme,
      style: '3', // 3 = région (courbe pleine) ; 1 = bougies
      locale: 'fr',
      enable_publishing: false,
      hide_top_toolbar: false,
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    })
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [symbol, theme])

  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ height: HEIGHT, width: '100%' }} />
  )
}
