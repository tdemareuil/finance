import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ValuePoint } from '../services/portfolioCalculator'
import type { BenchmarkPoint } from '../services/benchmarkService'
import { getEurUsdSeries, type FxSeries } from '../services/marketDataService'
import { formatMoney, formatMonth, type AllocationSlice, type MonthlyPoint } from '../utils'

// ===========================================================================
// Graphiques (Recharts) regroupés : ValueChart, MonthlyBarChart, AllocationPie.
// ===========================================================================

const CHART_COLORS = [
  '#4f7cff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
]
const COLOR_PORTFOLIO = '#4f7cff'
const COLOR_BENCHMARK = '#f59e0b'
const COLOR_INVESTED = '#94a3b8'

function colorAt(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--text)',
}
// Recharts colore le texte des items avec la couleur de la série (souvent noir
// par défaut → illisible en thème sombre). On force la couleur du texte.
const tooltipItemStyle = { color: 'var(--text)' }
const tooltipLabelStyle = { color: 'var(--text-muted)' }

// --- Évolution du patrimoine ----------------------------------------------
interface ValueChartProps {
  valueSeries: ValuePoint[]
  benchmarkSeries?: BenchmarkPoint[]
  showBenchmark?: boolean
  showInvested?: boolean
}

export function ValueChart({
  valueSeries,
  benchmarkSeries = [],
  showBenchmark = true,
  showInvested = true,
}: ValueChartProps) {
  const benchMap = new Map(benchmarkSeries.map((b) => [b.date, b.benchmark]))
  const data = valueSeries.map((v) => ({
    date: v.date,
    totalValue: v.totalValue,
    invested: v.invested,
    benchmark: benchMap.get(v.date) ?? null,
  }))

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_PORTFOLIO} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLOR_PORTFOLIO} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={formatMonth} minTickGap={24} stroke="var(--text-muted)" fontSize={12} />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            stroke="var(--text-muted)"
            fontSize={12}
            width={44}
          />
          <Tooltip
            formatter={(v: number, name) => [formatMoney(v), labelFor(name as string)]}
            labelFormatter={(l) => formatMonth(l as string)}
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend formatter={(v) => labelFor(v)} />
          <Area
            type="monotone"
            dataKey="totalValue"
            stroke={COLOR_PORTFOLIO}
            strokeWidth={2}
            fill="url(#gValue)"
            name="totalValue"
          />
          {showInvested && (
            <Line type="monotone" dataKey="invested" stroke={COLOR_INVESTED} strokeWidth={1.5} dot={false} name="invested" strokeDasharray="4 4" />
          )}
          {showBenchmark && (
            <Line type="monotone" dataKey="benchmark" stroke={COLOR_BENCHMARK} strokeWidth={2} dot={false} name="benchmark" connectNulls />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function labelFor(key: string): string {
  switch (key) {
    case 'totalValue':
      return 'Patrimoine'
    case 'invested':
      return 'Capital investi'
    case 'benchmark':
      return 'MSCI World'
    default:
      return key
  }
}

// --- Barres mensuelles -----------------------------------------------------
export function MonthlyBarChart({
  data,
  color = '#22c55e',
  label = 'Montant',
}: {
  data: MonthlyPoint[]
  color?: string
  label?: string
}) {
  if (data.length === 0) return <p className="muted">Aucune donnée.</p>
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={(m) => formatMonth(`${m}-01`)} stroke="var(--text-muted)" fontSize={12} minTickGap={16} />
          <YAxis tickFormatter={(v) => `${Math.round(v)}`} stroke="var(--text-muted)" fontSize={12} width={44} />
          <Tooltip
            formatter={(v: number) => [formatMoney(v), label]}
            labelFormatter={(l) => formatMonth(`${l}-01`)}
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Camembert d'allocation ------------------------------------------------
export function AllocationPie({ data }: { data: AllocationSlice[] }) {
  const filtered = data.filter((d) => d.value > 0)
  if (filtered.length === 0) {
    return <p className="muted">Aucune donnée d'allocation.</p>
  }
  const total = filtered.reduce((s, d) => s + d.value, 0)

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, n) => [`${formatMoney(v)} (${((v / total) * 100).toFixed(1)}%)`, n as string]}
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Cours EUR/USD ---------------------------------------------------------
const COLOR_FX = '#06b6d4'

/** Graphe du cours EUR/USD (USD pour 1 EUR) sur ~1 an. Se charge tout seul. */
export function EurUsdChart() {
  const [series, setSeries] = useState<FxSeries | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const to = new Date().toISOString().slice(0, 10)
    const fromDate = new Date()
    fromDate.setFullYear(fromDate.getFullYear() - 1)
    const from = fromDate.toISOString().slice(0, 10)
    let cancelled = false
    getEurUsdSeries(from, to)
      .then((s) => {
        if (!cancelled) setSeries(s)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="muted">Cours EUR/USD indisponible.</p>
  if (!series) return <p className="muted">Chargement du cours EUR/USD…</p>
  if (series.points.length === 0) return <p className="muted">Aucune donnée EUR/USD.</p>

  const last = series.points[series.points.length - 1]
  const fmtRate = (v: number) => v.toFixed(4)

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={series.points} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gFx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_FX} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLOR_FX} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={formatMonth} minTickGap={24} stroke="var(--text-muted)" fontSize={12} />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => v.toFixed(3)}
            stroke="var(--text-muted)"
            fontSize={12}
            width={48}
          />
          <Tooltip
            formatter={(v: number) => [fmtRate(v), 'EUR/USD']}
            labelFormatter={(l) => formatMonth(l as string)}
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Area type="monotone" dataKey="rate" stroke={COLOR_FX} strokeWidth={2} fill="url(#gFx)" name="EUR/USD" />
        </AreaChart>
      </ResponsiveContainer>
      <p className="muted small">
        1 € = {fmtRate(last.rate)} $ au {formatMonth(last.date)}
        {series.source === 'MOCK' && ' · données fictives (aucune clé de marché configurée)'}
      </p>
    </div>
  )
}
