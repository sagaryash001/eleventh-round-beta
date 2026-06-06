import React from 'react'
import { Link } from 'react-router-dom'

// ── Readiness ring ─────────────────────────────────────────────
export function ReadinessRing({ pct, size = 110, color = '#c00000', label = 'Score' }: {
  pct: number; size?: number; color?: string; label?: string
}) {
  const r = size * 0.41; const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display:'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a1d" strokeWidth={size*0.075} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.075}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="font-display text-off-white leading-none" style={{ fontSize: size * 0.28 }}>{pct}</span>
        <span className="font-condensed text-gray-3 font-bold uppercase tracking-widest" style={{ fontSize: size * 0.09 }}>{label}</span>
      </div>
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────
export function BarChart({ data, height = 140 }: {
  data: { label: string; value: number; color?: string }[]; height?: number
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const barH = height - 44  // leave room for value label + x-label
  return (
    <div className="flex items-end gap-2 w-full" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
          <span className="font-display text-off-white" style={{ fontSize: 16, lineHeight:1 }}>{d.value}</span>
          <div className="w-full rounded-t-sm"
            style={{ height: `${Math.max((d.value / max) * barH, 4)}px`,
              background: d.color || 'linear-gradient(to top, #8b0000, #c00000)',
              transition: 'height 1s cubic-bezier(.25,.46,.45,.94)',
            }} />
          <span className="font-condensed text-gray-3 text-center leading-tight"
            style={{ fontSize: 10, letterSpacing:'0.05em' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Spark line ─────────────────────────────────────────────────
export function SparkLine({ values, color = '#c00000', height = 48 }: {
  values: number[]; color?: string; height?: number
}) {
  const max = Math.max(...values); const min = Math.min(...values)
  const w = 200; const h = height
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline fill={`${color}18`} stroke="none" points={`0,${h} ${pts} ${w},${h}`} />
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

// ── Stacked bar ────────────────────────────────────────────────
export function StackedBar({ segments }: {
  segments: { label: string; pct: number; color: string }[]
}) {
  return (
    <div>
      <div className="flex h-4 rounded overflow-hidden gap-0.5">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color, minWidth: 2 }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="font-condensed text-gray-3" style={{ fontSize: 11, letterSpacing:'0.04em' }}>{s.label} {s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Radar chart ────────────────────────────────────────────────
export function RadarChart({ axes, size = 140 }: {
  axes: { label: string; value: number }[]; size?: number
}) {
  const cx = size/2, cy = size/2, r = size * 0.36
  const n = axes.length
  const toXY = (i: number, radius: number) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
  }
  const dataPoints = axes.map((a, i) => toXY(i, (a.value / 100) * r))
  const dataPath = dataPoints.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z'

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {[0.25, 0.5, 0.75, 1].map(l => {
        const pts = Array.from({ length: n }, (_, i) => toXY(i, r * l))
        return <polygon key={l} fill="none" stroke="#222226" strokeWidth="0.75"
          points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
      })}
      {Array.from({ length: n }, (_, i) => {
        const end = toXY(i, r)
        return <line key={i} x1={cx} y1={cy} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke="#222226" strokeWidth="0.75" />
      })}
      <path d={dataPath} fill="rgba(139,0,0,0.28)" stroke="#c00000" strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const pos = toXY(i, r + 14)
        return <text key={i} x={pos.x.toFixed(1)} y={pos.y.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: size*0.07, fill:'#7a7672', fontFamily:'Barlow Condensed,sans-serif', fontWeight:600 }}>
          {a.label}
        </text>
      })}
    </svg>
  )
}

// ── Activity heatmap ───────────────────────────────────────────
export function ActivityHeatmap({ weeks = 12 }: { weeks?: number }) {
  const days = Array.from({ length: weeks * 7 }, () => ({
    v: Math.random() > 0.42 ? Math.floor(Math.random() * 4) + 1 : 0
  }))
  const cols = ['#141416', '#4a0000', '#8b0000', '#c00000', '#ff2020']
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} className="flex flex-col gap-1">
          {Array.from({ length: 7 }, (_, d) => (
            <div key={d} className="w-3 h-3 rounded-sm" style={{ background: cols[days[w*7+d].v] }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Timeline ───────────────────────────────────────────────────
export function Timeline({ events }: {
  events: { date: string; label: string; type: 'green'|'red'|'yellow' }[]
}) {
  const dotColor = { green:'#00c060', red:'#c00000', yellow:'#c9a82c' }
  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-0 bottom-0 w-px bg-charcoal-3" />
      {events.map((e, i) => (
        <div key={i} className="relative mb-4 last:mb-0">
          <div className="absolute rounded-full border-2 border-charcoal" style={{
            background: dotColor[e.type], width: 10, height: 10, left: -23, top: 4,
          }} />
          <div className="font-condensed text-gray-3 mb-0.5" style={{ fontSize: 10, letterSpacing:'0.15em' }}>{e.date}</div>
          <div className="font-condensed font-semibold text-gray-1" style={{ fontSize: 13, letterSpacing:'0.04em' }}>{e.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Stat card — big number first ───────────────────────────────
export function StatCard({ label, value, sub, barPct, trend, barColor='#c00000', accent }: {
  label: string; value: React.ReactNode; sub?: string
  barPct?: number; trend?: number; barColor?: string; accent?: string
}) {
  return (
    <div className="dash-card" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
      <div className="dash-label">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="dash-stat leading-none">{value}</div>
        {trend !== undefined && (
          <span className="font-condensed font-bold mb-2 flex-shrink-0"
            style={{ fontSize: 13, color: trend >= 0 ? '#00c060' : '#c00000' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && <div className="dash-sub">{sub}</div>}
      {barPct !== undefined && (
        <div className="dash-bar-track">
          <div className="dash-bar-fill" style={{ width:`${barPct}%`, background:barColor }} />
        </div>
      )}
    </div>
  )
}

// ── List card ──────────────────────────────────────────────────
export function ListCard({ label, items }: {
  label: string
  items: { name: string; badge: string; type: 'green'|'red'|'yellow' }[]
}) {
  return (
    <div className="dash-card">
      <div className="dash-label">{label}</div>
      <ul className="dc-list">
        {items.map((it, i) => (
          <li key={i} className="dash-list-item">
            <span className="dash-item-name">{it.name}</span>
            <span className={`badge badge-${it.type}`}>{it.badge}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Section heading ────────────────────────────────────────────
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-off-white uppercase mb-5"
      style={{ fontSize: 'clamp(28px,3vw,44px)', lineHeight: 0.95 }}>
      {children}
    </h2>
  )
}

export function FullWidthCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dash-card" style={{ gridColumn: '1 / -1' }}>
      <div className="dash-label">{label}</div>
      {children}
    </div>
  )
}

// ── Skeleton shimmer ───────────────────────────────────────────
export function SkeletonBlock({ h = 16, className = '' }: { h?: number; className?: string }) {
  return (
    <div
      className={`rounded animate-pulse bg-charcoal-2 ${className}`}
      style={{ height: h, opacity: 0.6 }}
    />
  )
}

/** Full tab skeleton — use while useApi loading=true. */
export function DashSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock h={32} className="w-48 mb-6" />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="dash-card space-y-3">
            <SkeletonBlock h={10} className="w-28" />
            <SkeletonBlock h={28} className="w-16" />
            <SkeletonBlock h={6} />
          </div>
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {[0, 1].map(i => (
          <div key={i} className="dash-card space-y-3">
            <SkeletonBlock h={10} className="w-32" />
            <SkeletonBlock h={80} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────
export function EmptyState({
  icon = '○', title, body, action,
}: {
  icon?: string
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div
      className="dash-card text-center py-10 flex flex-col items-center gap-3"
      style={{ borderColor: '#222226', borderStyle: 'dashed' }}
    >
      <span style={{ fontSize: 30, opacity: 0.3, color: '#7a7672' }}>{icon}</span>
      <div
        className="font-condensed font-bold uppercase tracking-widest"
        style={{ fontSize: 10, color: '#4a4846' }}
      >
        {title}
      </div>
      <p className="font-body" style={{ fontSize: 13, maxWidth: 360, lineHeight: 1.6, color: '#4a4846' }}>
        {body}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ── API error state ────────────────────────────────────────────
export function ApiError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="dash-card text-center py-5" style={{ borderColor: '#4a0000' }}>
      <p className="font-condensed text-blood-glow" style={{ fontSize: 12 }}>
        Could not load data — {message}
      </p>
      {retry && (
        <button onClick={retry} className="btn-ghost mt-3 text-[10px] py-1.5 px-4">
          Retry
        </button>
      )}
    </div>
  )
}

// ── Setup checklist item ───────────────────────────────────────
export function ChecklistItem({
  done, label, detail, href,
}: {
  done: boolean; label: string; detail?: string; href?: string
}) {
  return (
    <div
      className="flex items-center gap-4 py-3 border-b border-charcoal-3 last:border-0"
    >
      <div
        className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
        style={{
          borderColor: done ? '#00c060' : '#4a4846',
          background:  done ? 'rgba(0,192,96,0.12)' : 'transparent',
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <polyline points="2 6 5 9 10 3" stroke="#00c060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <div
          className="font-condensed font-bold"
          style={{ fontSize: 12, color: done ? '#f0ece4' : '#7a7672', letterSpacing: '0.05em' }}
        >
          {label}
        </div>
        {detail && (
          <div className="font-condensed" style={{ fontSize: 10, color: '#4a4846' }}>{detail}</div>
        )}
      </div>
      {href && !done && (
        <Link
          to={href}
          className="font-condensed font-bold uppercase text-blood-glow no-underline"
          style={{ fontSize: 10, letterSpacing: '0.2em' }}
        >
          Setup →
        </Link>
      )}
    </div>
  )
}
