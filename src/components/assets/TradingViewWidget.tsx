import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Widget "Advanced Chart" de TradingView.
// Charge le script d'embed officiel et injecte la configuration.
// Nécessite une connexion internet (script externe). Si le symbole est absent,
// le composant parent affiche un message d'information à la place.
// ---------------------------------------------------------------------------

export default function TradingViewWidget({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = '' // reset lors d'un changement de symbole

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
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Europe/Paris',
      theme: 'light',
      style: '1',
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
  }, [symbol])

  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ height: 480, width: '100%' }} />
  )
}
