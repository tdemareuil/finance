import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../../context/PortfolioContext'
import { Modal } from '../common/ui'
import TradingViewWidget from '../assets/TradingViewWidget'
import {
  searchInstruments,
  toTradingViewSymbol,
  type InstrumentSearchResult,
} from '../../services/instrumentSearchService'

// ---------------------------------------------------------------------------
// Modal de fiche rapide (graphique TradingView + infos)
// ---------------------------------------------------------------------------
function QuickMarketModal({
  result,
  portfolioAssetId,
  onClose,
}: {
  result: InstrumentSearchResult
  portfolioAssetId: string | undefined
  onClose: () => void
}) {
  const navigate = useNavigate()
  const tvSymbol = toTradingViewSymbol(result.symbol)

  function handleGoToDetail() {
    if (portfolioAssetId) {
      navigate(`/assets/${portfolioAssetId}`)
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
        portfolioAssetId ? (
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
        {portfolioAssetId && (
          <span className="chip chip-positive" style={{ fontSize: '0.75rem' }}>
            Dans votre portefeuille
          </span>
        )}
        <span className="chip chip-info" style={{ fontSize: '0.75rem' }}>
          {tvSymbol}
        </span>
      </div>
      <TradingViewWidget symbol={tvSymbol} />
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
          portfolioAssetId={findPortfolioAsset(selected)?.id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
