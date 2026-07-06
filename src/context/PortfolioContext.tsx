import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Account,
  Asset,
  DividendEvent,
  MarketPrice,
  Position,
  PortfolioSummary,
  Transaction,
} from '../types'
import { useAuth } from './AuthContext'
import { listAccounts } from '../services/accountService'
import { listAssets } from '../services/assetService'
import { listTransactions } from '../services/transactionService'
import { listDividendEvents } from '../services/dividendService'
import {
  getHistoricalPrices,
  getLatestPrice,
  marketDataMode,
} from '../services/marketDataService'
import {
  computePositions,
  computeSummary,
  computeValueSeries,
  type ValuePoint,
} from '../services/portfolioCalculator'
import {
  computeBenchmarkSeries,
  DEFAULT_BENCHMARK_SYMBOL,
  type BenchmarkPoint,
} from '../services/benchmarkService'

interface PortfolioContextValue {
  loading: boolean
  refreshing: boolean
  error: string | null
  marketError: string | null
  marketMode: typeof marketDataMode

  accounts: Account[]
  assets: Asset[]
  transactions: Transaction[]
  dividendEvents: DividendEvent[]

  priceByAssetId: Record<string, number | null>
  positions: Position[]
  summary: PortfolioSummary
  valueSeries: ValuePoint[]
  benchmarkSeries: BenchmarkPoint[]

  benchmarkSymbol: string
  setBenchmarkSymbol: (s: string) => void

  reload: () => Promise<void>
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined)

const BENCHMARK_KEY = 'patrimoine-benchmark-symbol'

const EMPTY_SUMMARY: PortfolioSummary = {
  totalValue: 0,
  investedCapital: 0,
  cash: 0,
  unrealizedPnL: 0,
  realizedPnL: 0,
  dividendsReceived: 0,
  feesPaid: 0,
  totalReturnPct: null,
  annualizedReturnPct: null,
  livretInterestCredited: 0,
  livretInterestAccrued: 0,
  positions: [],
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marketError, setMarketError] = useState<string | null>(null)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dividendEvents, setDividendEvents] = useState<DividendEvent[]>([])

  const [priceByAssetId, setPriceByAssetId] = useState<Record<string, number | null>>({})
  const [valueSeries, setValueSeries] = useState<ValuePoint[]>([])
  const [benchmarkSeries, setBenchmarkSeries] = useState<BenchmarkPoint[]>([])

  const [benchmarkSymbol, setBenchmarkSymbolState] = useState<string>(
    () => localStorage.getItem(BENCHMARK_KEY) || DEFAULT_BENCHMARK_SYMBOL,
  )

  const reqIdRef = useRef(0)

  const setBenchmarkSymbol = useCallback((s: string) => {
    setBenchmarkSymbolState(s)
    localStorage.setItem(BENCHMARK_KEY, s)
  }, [])

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!user) return
      const reqId = ++reqIdRef.current
      isRefresh ? setRefreshing(true) : setLoading(true)
      setError(null)
      try {
        const [acc, ast, txs, divs] = await Promise.all([
          listAccounts(user.id),
          listAssets(user.id),
          listTransactions(user.id),
          listDividendEvents(user.id),
        ])
        if (reqId !== reqIdRef.current) return
        setAccounts(acc)
        setAssets(ast)
        setTransactions(txs)
        setDividendEvents(divs)

        // Cours actuels (mock ou EODHD). Ne bloque pas l'app en cas d'échec.
        const prices: Record<string, number | null> = {}
        setMarketError(null)
        await Promise.all(
          ast.map(async (a) => {
            if (a.type === 'CASH') {
              prices[a.id] = 1
              return
            }
            try {
              const { data } = await getLatestPrice(a)
              prices[a.id] = data?.close ?? null
              if (data == null) setMarketError('Certaines données de marché sont indisponibles.')
            } catch {
              prices[a.id] = null
              setMarketError('Certaines données de marché sont indisponibles.')
            }
          }),
        )
        if (reqId !== reqIdRef.current) return
        setPriceByAssetId(prices)

        // Séries historiques (valeur du patrimoine + benchmark).
        try {
          const first =
            txs.length > 0 ? txs.reduce((m, t) => (t.date < m ? t.date : m), txs[0].date) : null
          if (first) {
            const today = new Date().toISOString().slice(0, 10)
            const histEntries = await Promise.all(
              ast
                .filter((a) => a.type !== 'CASH')
                .map(async (a) => {
                  try {
                    const { data } = await getHistoricalPrices(a, first, today)
                    return [a.id, data ?? []] as const
                  } catch {
                    return [a.id, [] as MarketPrice[]] as const
                  }
                }),
            )
            const histByAsset: Record<string, MarketPrice[]> = {}
            for (const [id, series] of histEntries) histByAsset[id] = series
            if (reqId !== reqIdRef.current) return
            setValueSeries(computeValueSeries(txs, ast, histByAsset, acc))

            const bench = await computeBenchmarkSeries(txs, benchmarkSymbol)
            if (reqId !== reqIdRef.current) return
            setBenchmarkSeries(bench)
          } else {
            setValueSeries([])
            setBenchmarkSeries([])
          }
        } catch {
          setMarketError('Impossible de calculer les séries historiques (données de marché).')
        }
      } catch (e) {
        if (reqId !== reqIdRef.current) return
        setError(e instanceof Error ? e.message : 'Erreur de chargement des données.')
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [user, benchmarkSymbol],
  )

  useEffect(() => {
    if (user) {
      load(false)
    } else {
      setAccounts([])
      setAssets([])
      setTransactions([])
      setDividendEvents([])
      setPriceByAssetId({})
      setValueSeries([])
      setBenchmarkSeries([])
      setLoading(false)
    }
  }, [user, load])

  const positions = useMemo(
    () => computePositions(transactions, accounts, assets, priceByAssetId),
    [transactions, accounts, assets, priceByAssetId],
  )

  const summary = useMemo(
    () => (transactions.length ? computeSummary(positions, transactions, accounts) : EMPTY_SUMMARY),
    [positions, transactions, accounts],
  )

  const value: PortfolioContextValue = {
    loading,
    refreshing,
    error,
    marketError,
    marketMode: marketDataMode,
    accounts,
    assets,
    transactions,
    dividendEvents,
    priceByAssetId,
    positions,
    summary,
    valueSeries,
    benchmarkSeries,
    benchmarkSymbol,
    setBenchmarkSymbol,
    reload: () => load(true),
  }

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio doit être utilisé dans <PortfolioProvider>.')
  return ctx
}
