import React from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#1a1a1d',
  border: '1px solid #222226',
  borderRadius: 0,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 12,
  color: '#f0ece4',
}
const TICK = { fill: '#7a7672', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }

// Empty state for charts
export function ChartEmpty({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 90 }}>
      <span className="font-condensed text-[9px] uppercase tracking-[0.3em] text-gray-3">{message}</span>
    </div>
  )
}

// Role / status donut
export function RoleDonut({ data }: {
  data: { name: string; value: number; color: string }[]
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <ChartEmpty message="No users registered yet" />
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={100} height={100}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={46}
            dataKey="value" strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="font-condensed text-[10px] text-gray-2 flex-1 truncate">{d.name}</span>
            <span className="font-condensed text-[11px] font-bold text-off-white">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Horizontal bar chart — funnel/status counts
export function FunnelBar({ data, color = '#C41E3A', height }: {
  data: { label: string; value: number }[]
  color?: string
  height?: number
}) {
  if (!data.length || data.every(d => d.value === 0)) return <ChartEmpty message="No applications yet" />
  const h = height ?? Math.max(data.length * 30 + 24, 80)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24, top: 2, bottom: 2 }}>
        <CartesianGrid horizontal={false} stroke="#222226" strokeDasharray="3 3" />
        <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={96} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" fill={color} radius={0} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Vertical bar chart — distribution
export function DistBar({ data }: {
  data: { label: string; value: number; color?: string }[]
}) {
  if (!data.length || data.every(d => d.value === 0)) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <CartesianGrid stroke="#222226" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" radius={0} maxBarSize={36}>
          {data.map((d, i) => <Cell key={i} fill={d.color ?? '#C41E3A'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Line chart — time trends
export function TrendLine({ data, color = '#C41E3A', label = 'Value', height = 100 }: {
  data: { month: string; value: number }[]
  color?: string; label?: string; height?: number
}) {
  if (!data.length || data.every(d => d.value === 0)) return <ChartEmpty message="No trend data yet" />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 2 }}>
        <CartesianGrid stroke="#222226" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} width={34} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, label]} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          dot={{ fill: color, r: 2.5 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Simple status pie (contracts, etc.)
export function StatusPie({ data }: {
  data: { name: string; value: number; color: string }[]
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <ChartEmpty />
  return (
    <div className="flex items-start gap-3">
      <ResponsiveContainer width={80} height={80}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={38} dataKey="value" strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 pt-1 flex-1 min-w-0">
        {data.map((d, i) => d.value > 0 && (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="font-condensed text-[10px] text-gray-2 truncate flex-1">{d.name}</span>
            <span className="font-condensed text-[10px] font-bold text-off-white">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
