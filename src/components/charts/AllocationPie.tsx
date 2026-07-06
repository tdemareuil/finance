import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney } from '../../utils/format'
import { colorAt } from './palette'
import { tooltipStyle } from './ValueChart'

export interface AllocationSlice {
  name: string
  value: number
}

export default function AllocationPie({ data }: { data: AllocationSlice[] }) {
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
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, n) => [`${formatMoney(v)} (${((v / total) * 100).toFixed(1)}%)`, n as string]}
            contentStyle={tooltipStyle}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
