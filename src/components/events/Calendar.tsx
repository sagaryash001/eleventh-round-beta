// ─────────────────────────────────────────────────────────────────────────────
// Shared calendar UI built on the unified /api/events/calendar-feed.
//
// One feed → many surfaces: the Command Center summary card + full panel, and the
// Event Calendar zone's Month + Agenda views all consume the same normalized
// CalendarFeedItem[] so nothing is stitched together per-dashboard.
//
// All components are responsive (month grid + agenda side-by-side on desktop,
// stacked on mobile) and degrade gracefully if the feed fails.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getCalendarFeed, type CalendarFeedItem, type FeedItemType } from '../../lib/api/events'
import { getCalendlyStatus, type CalendlyStatus } from '../../lib/api/calendly'

// ── Type → accent colour + label ──────────────────────────────────────────────
const TYPE_COLOR: Record<FeedItemType, string> = {
  event: '#C41E3A', calendly: '#00a2c0', obligation: '#c9a82c', deadline: '#b45309',
}
const TYPE_LABEL: Record<FeedItemType, string> = {
  event: 'App Event', calendly: 'Calendly', obligation: 'Obligation', deadline: 'Deadline',
}
const OVERDUE = '#c00000'

const itemColor = (it: CalendarFeedItem) =>
  it.status === 'overdue' ? OVERDUE : (TYPE_COLOR[it.type] ?? '#7a7672')
const isCancelled = (it: CalendarFeedItem) => it.status === 'cancelled' || it.status === 'canceled'

// ── Date helpers (local time so day-grouping never drifts a TZ) ───────────────
const dayKey  = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const monthEnd   = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const addMonths  = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// ── Feed hook ─────────────────────────────────────────────────────────────────
export function useCalendarFeed(params?: { from?: string; to?: string; includePast?: boolean }) {
  const [items, setItems]     = useState<CalendarFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const key = `${params?.from ?? ''}|${params?.to ?? ''}|${params?.includePast ? 1 : 0}`

  const reload = useCallback(() => {
    setLoading(true); setError(null)
    getCalendarFeed({ from: params?.from, to: params?.to, include_past: params?.includePast })
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(e => { setError(e?.message ?? 'Could not load calendar.'); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { reload() }, [reload])
  return { items, loading, error, reload }
}

// ── Mini month grid ───────────────────────────────────────────────────────────
function MiniMonth({ month, items, selected, onSelectDay, onPrev, onNext }: {
  month: Date
  items: CalendarFeedItem[]
  selected: string | null
  onSelectDay: (key: string) => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarFeedItem[]>()
    for (const it of items) {
      const k = dayKey(new Date(it.date))
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(it)
    }
    return m
  }, [items])

  const first = monthStart(month)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())          // back to Sunday
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d
  })
  const today = new Date()

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-off-white uppercase" style={{ fontSize: 15 }}>
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        {(onPrev || onNext) && (
          <div className="flex items-center gap-1">
            <button onClick={onPrev} className="font-condensed text-gray-3 hover:text-off-white px-2 py-1 border border-charcoal-3 leading-none" aria-label="Previous month">‹</button>
            <button onClick={onNext} className="font-condensed text-gray-3 hover:text-off-white px-2 py-1 border border-charcoal-3 leading-none" aria-label="Next month">›</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center font-condensed text-[9px] uppercase tracking-widest text-gray-3 py-1">{w}</div>
        ))}
        {cells.map((d, i) => {
          const k        = dayKey(d)
          const inMonth  = d.getMonth() === month.getMonth()
          const dayItems = byDay.get(k) ?? []
          const isToday  = sameDay(d, today)
          const isSel    = selected === k
          const dots     = [...new Set(dayItems.map(it => itemColor(it)))].slice(0, 3)
          return (
            <button key={i} onClick={() => onSelectDay(k)}
              className="relative flex flex-col items-center justify-start pt-1 transition-colors"
              style={{
                aspectRatio: '1 / 1', minHeight: 30,
                background: isSel ? 'rgba(196,30,58,0.16)' : isToday ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: isSel ? '1px solid #C41E3A' : '1px solid transparent',
                cursor: 'pointer',
              }}>
              <span className="font-condensed text-[11px] leading-none"
                style={{ color: !inMonth ? '#3a3a3e' : isToday ? '#C41E3A' : '#c9c5bd', fontWeight: isToday ? 700 : 400 }}>
                {d.getDate()}
              </span>
              {dots.length > 0 && (
                <span className="flex gap-0.5 mt-1">
                  {dots.map((c, di) => <span key={di} style={{ width: 4, height: 4, borderRadius: '50%', background: c }} />)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Single feed item row ──────────────────────────────────────────────────────
export function FeedItemRow({ item, onClick, showDate = true }: {
  item: CalendarFeedItem; onClick?: (it: CalendarFeedItem) => void; showDate?: boolean
}) {
  const color = itemColor(item)
  const cancelled = isCancelled(item)
  return (
    <button
      onClick={() => onClick?.(item)}
      disabled={!onClick}
      className="w-full text-left flex items-start gap-2.5 py-2 border-b border-charcoal-3 last:border-0 hover:bg-white/[0.02] transition-colors"
      style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <span className="flex-shrink-0 mt-1.5" style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      <div className="flex-1 min-w-0">
        <div className="font-condensed font-bold text-[12px] flex items-center gap-2 flex-wrap"
          style={{ color: cancelled ? '#7a7672' : '#f0ece4', textDecoration: cancelled ? 'line-through' : 'none' }}>
          <span className="truncate">{item.title}</span>
          <span className="font-condensed text-[8px] uppercase tracking-widest px-1.5 py-0.5 flex-shrink-0"
            style={{ border: `1px solid ${color}`, color }}>
            {cancelled ? 'Cancelled' : item.badge}
          </span>
        </div>
        <div className="font-condensed text-[10.5px] text-gray-3 mt-0.5">
          {showDate ? `${fmtDate(item.date)} · ` : ''}{fmtTime(item.date)}
          {item.metadata?.location ? ` · ${item.metadata.location}` : ''}
          {item.metadata?.event_name && item.type === 'obligation' ? ` · ${item.metadata.event_name}` : ''}
        </div>
      </div>
    </button>
  )
}

// ── Day detail (items for one selected day) ───────────────────────────────────
function DayDetail({ dayK, items, onOpenItem }: {
  dayK: string | null; items: CalendarFeedItem[]; onOpenItem?: (it: CalendarFeedItem) => void
}) {
  if (!dayK) return (
    <div className="font-condensed text-[12px] text-gray-3 py-6 text-center">Select a day to see its events &amp; deadlines.</div>
  )
  const dayItems = items.filter(it => dayKey(new Date(it.date)) === dayK)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const [y, m, d] = dayK.split('-').map(Number)
  const label = new Date(y, m, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div>
      <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-2">{label}</div>
      {dayItems.length === 0
        ? <div className="font-condensed text-[12px] text-gray-3 py-3">Nothing scheduled.</div>
        : <div>{dayItems.map(it => <FeedItemRow key={it.id} item={it} onClick={onOpenItem} showDate={false} />)}</div>}
    </div>
  )
}

// ── Month view (zone) ─────────────────────────────────────────────────────────
export function CalendarMonthView({ onOpenItem, refreshKey }: {
  onOpenItem?: (it: CalendarFeedItem) => void; refreshKey?: number
}) {
  const [month, setMonth] = useState(() => monthStart(new Date()))
  const [selected, setSelected] = useState<string | null>(dayKey(new Date()))
  // Pull a window padded a week each side so edge cells render their dots.
  const from = useMemo(() => { const d = monthStart(month); d.setDate(-7); return d.toISOString() }, [month])
  const to   = useMemo(() => { const d = monthEnd(month);   d.setDate(d.getDate() + 7); return d.toISOString() }, [month])
  const { items, loading, error, reload } = useCalendarFeed({ from, to, includePast: true })

  useEffect(() => { if (refreshKey !== undefined) reload() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="dash-card"><div className="font-condensed text-[12px] text-blood-glow">Calendar failed to load. <button onClick={reload} className="underline">Try again</button></div></div>

  return (
    <div className="grid gap-3.5 md:[grid-template-columns:minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="dash-card">
        <MiniMonth month={month} items={items} selected={selected}
          onSelectDay={setSelected}
          onPrev={() => setMonth(m => addMonths(m, -1))}
          onNext={() => setMonth(m => addMonths(m, 1))} />
        {loading && <div className="font-condensed text-[10px] text-gray-3 mt-2">Loading…</div>}
        <CalendarLegend />
      </div>
      <div className="dash-card">
        <DayDetail dayK={selected} items={items} onOpenItem={onOpenItem} />
      </div>
    </div>
  )
}

// ── Agenda / list view (zone) ─────────────────────────────────────────────────
const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'event', label: 'App Events' },
  { key: 'calendly', label: 'Calendly' },
  { key: 'obligation', label: 'Obligations' },
  { key: 'deadline', label: 'Deadlines' },
  { key: 'past', label: 'Past / Cancelled' },
]

export function CalendarAgendaView({ onOpenItem, refreshKey }: {
  onOpenItem?: (it: CalendarFeedItem) => void; refreshKey?: number
}) {
  const [filter, setFilter] = useState('all')
  // Wide window incl. past, split client-side.
  const from = useMemo(() => addMonths(new Date(), -3).toISOString(), [])
  const to   = useMemo(() => addMonths(new Date(), 6).toISOString(), [])
  const { items, loading, error, reload } = useCalendarFeed({ from, to, includePast: true })

  useEffect(() => { if (refreshKey !== undefined) reload() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const dayAgo = Date.now() - 86400000
  const filtered = useMemo(() => {
    let list = items
    if (filter === 'past') list = items.filter(it => isCancelled(it) || new Date(it.date).getTime() < dayAgo)
    else {
      list = items.filter(it => !isCancelled(it) && (new Date(it.date).getTime() >= dayAgo || it.status === 'overdue'))
      if (filter !== 'all') list = list.filter(it => it.type === filter)
    }
    return list.sort((a, b) =>
      filter === 'past'
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [items, filter, dayAgo])

  // Group by day.
  const groups = useMemo(() => {
    const g: { key: string; label: string; items: CalendarFeedItem[] }[] = []
    for (const it of filtered) {
      const k = dayKey(new Date(it.date))
      let grp = g.find(x => x.key === k)
      if (!grp) { grp = { key: k, label: fmtDate(it.date), items: [] }; g.push(grp) }
      grp.items.push(it)
    }
    return g
  }, [filtered])

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="font-condensed text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 border transition-colors"
            style={{
              borderColor: filter === f.key ? '#C41E3A' : '#222226',
              color: filter === f.key ? '#f0ece4' : '#7a7672',
              background: filter === f.key ? 'rgba(196,30,58,0.12)' : 'transparent',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="dash-card"><div className="font-condensed text-[12px] text-blood-glow">Calendar failed to load. <button onClick={reload} className="underline">Try again</button></div></div>
      ) : loading ? (
        <div className="dash-card"><div className="dash-sub">Loading calendar…</div></div>
      ) : groups.length === 0 ? (
        <div className="dash-card text-center py-10">
          <div className="font-condensed text-[13px] text-gray-2 mb-1">No {filter === 'past' ? 'past or cancelled items' : 'upcoming items'} yet.</div>
          <div className="font-condensed text-[11px] text-gray-3">Add your next fight, promotion, media day, sponsor activation, or meeting.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.key} className="dash-card">
              <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-1">{g.label}</div>
              {g.items.map(it => <FeedItemRow key={it.id} item={it} onClick={onOpenItem} showDate={false} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CalendarLegend() {
  return (
    <div className="flex gap-3 flex-wrap mt-3 pt-3 border-t border-charcoal-3">
      {(Object.keys(TYPE_COLOR) as FeedItemType[]).map(t => (
        <span key={t} className="flex items-center gap-1.5 font-condensed text-[9px] uppercase tracking-widest text-gray-3">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[t] }} />{TYPE_LABEL[t]}
        </span>
      ))}
    </div>
  )
}

// ── Calendly status line (shared phrasing) ────────────────────────────────────
export function calendlyStatusText(s: CalendlyStatus | null): { text: string; color: string } {
  if (!s || !s.configured) return { text: '', color: '#7a7672' }
  if (!s.connected) return { text: 'Connect Calendly to sync scheduled meetings automatically.', color: '#7a7672' }
  const last = s.last_synced_at ? ` · last synced ${new Date(s.last_synced_at).toLocaleDateString()}` : ''
  return s.auto_sync
    ? { text: `Connected · Auto-sync active${last}`, color: '#00c060' }
    : { text: `Connected · Manual sync enabled${last}`, color: '#00a2c0' }
}

// ── Command Center summary card ───────────────────────────────────────────────
export function CommandCalendarCard({ onOpen }: { onOpen: () => void }) {
  const { items, loading } = useCalendarFeed()
  const [cal, setCal] = useState<CalendlyStatus | null>(null)
  useEffect(() => { getCalendlyStatus().then(setCal).catch(() => setCal(null)) }, [])

  const now = new Date()
  const upcoming = items.filter(it => it.type !== 'deadline' && it.type !== 'obligation' && !isCancelled(it) && new Date(it.date) >= new Date(Date.now() - 3600_000))
  const next = upcoming[0] ?? null
  const thisMonth = items.filter(it =>
    (it.type === 'event' || it.type === 'calendly') && !isCancelled(it) &&
    new Date(it.date).getMonth() === now.getMonth() && new Date(it.date).getFullYear() === now.getFullYear()).length
  const weekEnd = Date.now() + 7 * 86400000
  const dueThisWeek = items.filter(it =>
    (it.type === 'obligation' || it.type === 'deadline') &&
    new Date(it.date).getTime() <= weekEnd &&
    (it.status === 'overdue' || new Date(it.date).getTime() >= Date.now() - 86400000) &&
    it.status !== 'completed').length

  const calLine = calendlyStatusText(cal)

  return (
    <div className="dash-card">
      <div className="dash-label">Event Calendar</div>
      {loading ? (
        <div className="dash-sub py-2">Loading…</div>
      ) : (
        <>
          {next ? (
            <>
              <div className="font-condensed text-[9px] uppercase tracking-[0.25em] text-gray-3 mt-1">Next up</div>
              <div className="font-condensed font-bold text-[14px] text-off-white truncate">{next.title}</div>
              <div className="font-condensed text-[11px] text-gray-3 mb-2">{fmtDate(next.date)} · {fmtTime(next.date)}</div>
            </>
          ) : (
            <div className="font-condensed text-[12px] text-gray-3 my-2">No upcoming events yet.</div>
          )}
          <div className="flex gap-4 py-2 border-t border-charcoal-3">
            <div>
              <div className="font-display text-off-white" style={{ fontSize: 20, lineHeight: 1 }}>{thisMonth}</div>
              <div className="font-condensed text-[9px] uppercase tracking-widest text-gray-3 mt-0.5">This Month</div>
            </div>
            <div>
              <div className="font-display" style={{ fontSize: 20, lineHeight: 1, color: dueThisWeek > 0 ? '#c9a82c' : '#f0ece4' }}>{dueThisWeek}</div>
              <div className="font-condensed text-[9px] uppercase tracking-widest text-gray-3 mt-0.5">Due This Week</div>
            </div>
          </div>
          {calLine.text && (
            <div className="font-condensed text-[10.5px] mb-2" style={{ color: calLine.color }}>{calLine.text}</div>
          )}
          <button onClick={onOpen} className="btn-ghost text-[10px] py-2 px-4 w-full">Open Event Calendar →</button>
        </>
      )}
    </div>
  )
}

// ── Command Center full-width panel (mini month + agenda) ─────────────────────
export function CommandCalendarPanel({ onOpen, onOpenItem }: {
  onOpen: () => void; onOpenItem?: (it: CalendarFeedItem) => void
}) {
  const [month, setMonth] = useState(() => monthStart(new Date()))
  const [selected, setSelected] = useState<string | null>(dayKey(new Date()))
  const from = useMemo(() => { const d = monthStart(month); d.setDate(-7); return d.toISOString() }, [month])
  const to   = useMemo(() => { const d = monthEnd(month);   d.setDate(d.getDate() + 7); return d.toISOString() }, [month])
  const { items, loading, error } = useCalendarFeed({ from, to, includePast: true })

  const dayAgo = Date.now() - 86400000
  const agenda = items
    .filter(it => !isCancelled(it) && (new Date(it.date).getTime() >= dayAgo || it.status === 'overdue'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6)

  return (
    <div className="dash-card">
      <div className="flex items-center justify-between mb-3">
        <div className="dash-label" style={{ marginBottom: 0 }}>Calendar</div>
        <button onClick={onOpen} className="font-condensed text-[10px] text-blood-glow hover:underline">Open Event Calendar →</button>
      </div>
      {error ? (
        <div className="font-condensed text-[12px] text-gray-3">Calendar unavailable right now.</div>
      ) : (
        // Agenda first on mobile (order-1), month grid under it; side-by-side on md+.
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr' }}>
          <div className="grid gap-4 md:[grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="order-2 md:order-1">
              <MiniMonth month={month} items={items} selected={selected}
                onSelectDay={setSelected}
                onPrev={() => setMonth(m => addMonths(m, -1))}
                onNext={() => setMonth(m => addMonths(m, 1))} />
            </div>
            <div className="order-1 md:order-2">
              <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-1">Upcoming</div>
              {loading ? (
                <div className="font-condensed text-[11px] text-gray-3 py-3">Loading…</div>
              ) : agenda.length === 0 ? (
                <div className="font-condensed text-[12px] text-gray-3 py-3">
                  No upcoming events yet. Add your next fight, promotion, media day, sponsor activation, or meeting.
                </div>
              ) : (
                <div>{agenda.map(it => <FeedItemRow key={it.id} item={it} onClick={onOpenItem} showDate />)}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
