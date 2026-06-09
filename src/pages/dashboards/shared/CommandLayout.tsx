import React from 'react'

// ── Clickable card wrapper ─────────────────────────────────────────────────────
// Wraps any dash-card (or other element) in an accessible click target.
// When onClick is omitted the div renders without any interactive behaviour.
export function ClickablePanel({
  onClick, children, className = 'dash-card', ariaLabel,
}: {
  onClick?: () => void
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}) {
  if (!onClick) return <div className={className}>{children}</div>
  return (
    <div
      className={`${className} cursor-pointer transition-colors hover:border-blood/30`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      {children}
    </div>
  )
}

// ── Readiness Ring ─────────────────────────────────────────────────────────────
// SVG donut ring identical to DashboardPreview's CommandUI ring.
export function ReadinessRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r      = size * 0.42
  const circ   = 2 * Math.PI * r
  const offset = circ - (Math.max(0, Math.min(100, pct)) / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#222226" strokeWidth={size * 0.07} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#C41E3A" strokeWidth={size * 0.07}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="font-display text-off-white leading-none"
          style={{ fontSize: size * 0.24 }}>{pct}</span>
        <span className="font-condensed text-gray-3 uppercase tracking-widest"
          style={{ fontSize: size * 0.09 }}>Score</span>
      </div>
    </div>
  )
}

// ── Mini Progress Bar ─────────────────────────────────────────────────────────
// Identical to DashboardPreview's MiniBar.
// Pass pct=null to show a muted dash (data unavailable).
export function MiniBar({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="bg-charcoal-2 p-3 border border-charcoal-3">
      <div className="font-condensed text-[10px] font-medium tracking-wide text-gray-2 mb-1.5">
        {label}
      </div>
      {pct === null ? (
        <div className="h-[2px] bg-charcoal-3 rounded" />
      ) : (
        <div className="h-[2px] bg-charcoal-3 rounded overflow-hidden">
          <div className="h-full rounded"
            style={{
              width: `${Math.min(100, Math.max(0, pct))}%`,
              background: '#C41E3A',
              transition: 'width 1s ease',
            }} />
        </div>
      )}
    </div>
  )
}
