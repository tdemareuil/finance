import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ValuePoint } from '../../services/portfolioCalculator'
import type { BenchmarkPoint } from '../../services/benchmarkService'
import { formatMoney, formatMonth } from '../../utils/format'
import { COLOR_BENCHMARK, COLOR_INVESTED, COLOR_PORTFOLIO } from './palette'

interface Props {
  valueSeries: ValuePoint[]
  benchmarkSeries?: BenchmarkPoint[]
  showBenchmark?: boolean
  showInvested?: boolean
}

export default function ValueChart({
  valueSeries,
  benchmarkSeries = [],
  showBenchmark = true,
  showInvested = true,
}: Props) {
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

export const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--text)',
}
