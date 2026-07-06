import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, formatMonth } from '../../utils/format'
import { tooltipStyle } from './ValueChart'

export interface CumulativePoint {
  month: string
  value: number
}

export default function CumulativeAreaChart({
  data,
  color = '#ef4444',
  label = 'Cumul',
}: {
  data: CumulativePoint[]
  color?: string
  label?: string
}) {
  if (data.length === 0) return <p className="muted">Aucune donnée.</p>
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gCumul" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={(m) => formatMonth(`${m}-01`)} stroke="var(--text-muted)" fontSize={12} minTickGap={16} />
          <YAxis tickFormatter={(v) => `${Math.round(v)}`} stroke="var(--text-muted)" fontSize={12} width={44} />
          <Tooltip
            formatter={(v: number) => [formatMoney(v), label]}
            labelFormatter={(l) => formatMonth(`${l}-01`)}
            contentStyle={tooltipStyle}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#gCumul)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
