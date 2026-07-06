import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../../context/PortfolioContext'
import { Modal } from '../common/ui'
import TradingViewWidget from '../assets/TradingViewWidget'
import AssetAnalysis from '../assets/AssetAnalysis'
import { getLatestPrice } from '../../services/marketDataService'
import type { Asset, AssetType, Currency } from '../../types'
import {
  searchInstruments,
  toTradingViewSymbol,
  type InstrumentSearchResult,
} from '../../services/instrumentSearchService'

// Places de cotation en zone euro → devise EUR (le reste : USD par défaut,
// Currency ne gère que EUR/USD). Best-effort pour le formatage des montants.
const EUR_EXCHANGES = new Set(['PA', 'AS', 'BR', 'LS', 'DE', 'MI', 'MC', 'VI', 'HE', 'IR', 'F'])

function inferCurrency(symbol: string): Currency {
  const dot = symbol.lastIndexOf('.')
  if (dot === -1) return 'USD'
  return EUR_EXCHANGES.has(symbol.slice(dot + 1).toUpperCase()) ? 'EUR' : 'USD'
}

function inferAssetType(finnhubType: string): AssetType {
  const t = finnhubType.toLowerCase()
  if (t.includes('etf') || t.includes('etp') || t.includes('fund')) return 'ETF'
  return 'STOCK'
}

/** Construit un Asset synthétique depuis un résultat de recherche (hors portefeuille). */
function syntheticAsset(result: InstrumentSearchResult): Asset {
  return {
    id: `search-${result.symbol}`,
    userId: '',
    name: result.description,
    ticker: result.displaySymbol,
    currency: inferCurrency(result.symbol),
    type: inferAssetType(result.type),
    finnhubSymbol: result.symbol,
    createdAt: '',
  }
}

// ---------------------------------------------------------------------------
// Modal de fiche rapide (graphique TradingView + analyse complète)
// ---------------------------------------------------------------------------
function QuickMarketModal({
  result,
  portfolioAsset,
  onClose,
}: {
  result: InstrumentSearchResult
  portfolioAsset: Asset | undefined
  onClose: () => void
}) {
  const navigate = useNavigate()
  const tvSymbol = toTradingViewSymbol(result.symbol)

  // Actif utilisé pour l'analyse : le vrai si présent au portefeuille, sinon synthétique.
  const asset = portfolioAsset ?? syntheticAsset(result)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setCurrentPrice(null)
    getLatestPrice(asset)
      .then((r) => {
        if (active) setCurrentPrice(r.data?.close ?? null)
      })
      .catch(() => {
        if (active) setCurrentPrice(null)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id])

  function handleGoToDetail() {
    if (portfolioAsset) {
      navigate(`/assets/${portfolioAsset.id}`)
      onClose()
    }
  }

  return (
    <Modal
      title={
        <span>
          <span className="chip chip-default" style={{ marginRight: 8, fontSize: '0.9rem' }}>
            {result.displaySymbol}
          </span>
          {result.description}
        </span>
      }
      onClose={onClose}
      wide
      footer={
        portfolioAsset ? (
          <button className="btn btn-primary btn-sm" onClick={handleGoToDetail}>
            Voir le détail complet dans votre portefeuille →
          </button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {result.type && (
          <span className="chip chip-default" style={{ fontSize: '0.75rem' }}>
            {result.type}
          </span>
        )}
        {portfolioAsset && (
          <span className="chip chip-positive" style={{ fontSize: '0.75rem' }}>
            Dans votre portefeuille
          </span>
        )}
        <span className="chip chip-info" style={{ fontSize: '0.75rem' }}>
          {tvSymbol}
        </span>
      </div>
      <TradingViewWidget symbol={tvSymbol} />
      <AssetAnalysis asset={asset} currentPrice={currentPrice} />
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Barre de recherche principale (topbar)
// ---------------------------------------------------------------------------
export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<InstrumentSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<InstrumentSearchResult | null>(null)

  const { assets } = usePortfolio()
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fermer en cliquant hors du composant
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // Chercher l'actif correspondant dans le portefeuille
  const findPortfolioAsset = useCallback(
    (r: InstrumentSearchResult) =>
      assets.find(
        (a) =>
          a.ticker === r.displaySymbol ||
          a.finnhubSymbol === r.symbol ||
          a.name.toLowerCase() === r.description.toLowerCase(),
      ),
    [assets],
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!val.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setOpen(true)
      try {
        const res = await searchInstruments(val)
        setResults(res)
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  function handleSelect(r: InstrumentSearchResult) {
    setOpen(false)
    setQuery('')
    setResults([])
    setSelected(r)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} className="global-search">
      <div className="search-input-wrap">
        <span className="search-icon" aria-hidden>🔍</span>
        <input
          className="search-input"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Nom, ticker, ISIN…"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {open && (
        <div className="search-dropdown">
          {loading && (
            <div className="search-empty">Recherche en cours…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="search-empty">Aucun résultat pour « {query} »</div>
          )}
          {!loading && results.map((r) => {
            const inPortfolio = !!findPortfolioAsset(r)
            return (
              <button
                key={r.symbol}
                className="search-result"
                onMouseDown={(e) => e.preventDefault()} // empêche blur avant click
                onClick={() => handleSelect(r)}
              >
                <span className="chip chip-default" style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                  {r.displaySymbol}
                </span>
                <span className="search-desc">{r.description}</span>
                <span className="search-type">{r.type}</span>
                {inPortfolio && (
                  <span className="chip chip-positive" style={{ fontSize: '0.68rem', flexShrink: 0 }}>
                    Portefeuille
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <QuickMarketModal
          result={selected}
          portfolioAsset={findPortfolioAsset(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
