import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Currency, MarketPrice } from '../../types'
import { formatMoney, formatMonth } from '../../utils/format'
import { COLOR_PORTFOLIO } from './palette'
import { tooltipStyle } from './ValueChart'

export default function PriceLineChart({
  prices,
  currency,
}: {
  prices: MarketPrice[]
  currency: Currency
}) {
  if (prices.length === 0) return <p className="muted">Aucune donnée de cours disponible.</p>
  const data = prices.map((p) => ({ date: p.date, close: p.close }))
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={formatMonth} minTickGap={30} stroke="var(--text-muted)" fontSize={12} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `${Math.round(v)}`} stroke="var(--text-muted)" fontSize={12} width={48} />
          <Tooltip
            formatter={(v: number) => [formatMoney(v, currency), 'Cours']}
            labelFormatter={(l) => formatMonth(l as string)}
            contentStyle={tooltipStyle}
          />
          <Line type="monotone" dataKey="close" stroke={COLOR_PORTFOLIO} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
