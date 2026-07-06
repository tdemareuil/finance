import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, formatMonth } from '../../utils/format'
import { tooltipStyle } from './ValueChart'

export interface MonthlyPoint {
  month: string // YYYY-MM
  value: number
}

export default function MonthlyBarChart({
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
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
