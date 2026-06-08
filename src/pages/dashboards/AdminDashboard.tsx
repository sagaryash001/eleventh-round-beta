import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  StatCard, ListCard, ReadinessRing, BarChart,
  SectionHeading, DashSkeleton, EmptyState, ApiError, ChecklistItem,
} from './DashWidgets'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import {
  getAdminUsers, updateAdminUser,
  getPendingSponsors, verifySponsor,
  getAdminModules, createModule, updateModule,
  getAdminPackages, createPackage, updatePackage,
  getAdminDashboard, getAdminContracts,
  getAdminConversationList, adminLockConversation,
  sendTestEmail,
  type AdminUser, type PendingSponsor, type AdminModule, type AdminPackage,
} from '../../lib/api/admin'
import { adminRecompute } from '../../lib/api/opportunities'
import { getAdminPaymentsList, getAdminMembershipsList } from '../../lib/api/billing'
import { setModuleStatus } from '../../lib/api/education'
import { uploadFile } from '../../lib/api/uploads'
type EduChecklistItem = { id: string; text: string; required: boolean }

const NAV = [
  { id: 'overview',    label: 'Overview',        icon: '◈' },
  { id: 'setup',       label: 'Setup Checklist', icon: '✓' },
  { id: 'users',       label: 'Users',           icon: '👥' },
  { id: 'vetting',     label: 'Sponsor Vetting', icon: '🛡' },
  { id: 'packages',    label: 'Packages',        icon: '📦' },
  { id: 'content',     label: 'Modules',         icon: '📚' },
  { id: 'marketplace', label: 'Marketplace',     icon: '🤝' },
  { id: 'contracts',   label: 'Contracts',       icon: '📄' },
  { id: 'messaging',   label: 'Messaging',       icon: '💬' },
  { id: 'reports',     label: 'Reports',         icon: '📊' },
  { id: 'mentors',     label: 'Mentors',         icon: '🎯' },
  { id: 'sponsorforge',label: 'SponsorForge',    icon: '⚡' },
  { id: 'payments',    label: 'Payments',        icon: '💰' },
]

// ── Small form primitives ─────────────────────────────────────────────────────
function FField({ label, value, onChange, type = 'text', placeholder, hint, required = false }: {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; hint?: string; required?: boolean
}) {
  const [f, setF] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[13px] px-3 py-2 outline-none transition-all placeholder:text-gray-3"
        style={{ borderColor: f ? '#8b0000' : '#222226' }} />
      {hint && <p className="font-condensed text-[10px] text-gray-3 mt-1 tracking-wide">{hint}</p>}
    </div>
  )
}

function FSelect({ label, value, onChange, options, required = false }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; required?: boolean
}) {
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-condensed text-[13px] px-3 py-2 outline-none">
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ActionMsg({ msg }: { msg: { type: 'ok'|'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`font-condensed text-[11px] px-3 py-2 border ${
      msg.type === 'ok'
        ? 'text-green-400 border-green-900 bg-green-950/20'
        : 'text-blood-glow border-blood/25 bg-blood/10'
    }`}>
      {msg.text}
    </div>
  )
}

function Spinner() {
  return <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW — Command Center layout
// ═════════════════════════════════════════════════════════════════════════════
function Overview() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminDashboard()
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const { data: overviewData } = useApi<any>('/api/admin/overview')
  const { data: healthData }   = useApi<any>('/api/health')

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const m              = metrics ?? {}
  const alerts         = overviewData?.alerts ?? []
  const pendingVetting = overviewData?.pending_vetting ?? 0

  const actionItems: { text: string; urgency: 'red' | 'yellow' }[] = []
  if ((m.overdue_obligations  ?? 0) > 0)
    actionItems.push({ text: `${m.overdue_obligations} overdue obligation${m.overdue_obligations > 1 ? 's' : ''}`, urgency: 'red' })
  if (pendingVetting > 0)
    actionItems.push({ text: `${pendingVetting} sponsor${pendingVetting > 1 ? 's' : ''} pending vetting`, urgency: 'yellow' })
  if ((m.proofs_pending_review ?? 0) > 0)
    actionItems.push({ text: `${m.proofs_pending_review} proof${m.proofs_pending_review > 1 ? 's' : ''} pending sponsor review`, urgency: 'yellow' })
  if ((m.disputed_contracts   ?? 0) > 0)
    actionItems.push({ text: `${m.disputed_contracts} contract${m.disputed_contracts > 1 ? 's' : ''} in dispute`, urgency: 'red' })

  const revDisplay = (m.total_revenue_usd ?? 0) > 0
    ? `$${((m.total_revenue_usd) / 100).toFixed(0)}`
    : '$—'

  return (
    <div className="space-y-5">

      {/* ── Vital strip ── */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
        {[
          { label: 'Total Users',  value: m.total_users          ?? 0, accent: '#8b0000' },
          { label: 'Fighters',     value: m.fighters             ?? 0, accent: '#8b0000' },
          { label: 'Managers',     value: m.managers             ?? 0, accent: '#8b0000' },
          { label: 'Sponsors',     value: m.sponsors             ?? 0, accent: pendingVetting > 0 ? '#c9a82c' : '#8b0000' },
          { label: 'Live Opps',    value: m.active_opportunities ?? 0, accent: '#00c060' },
          { label: 'Contracts',    value: m.active_contracts     ?? 0, accent: '#00c060' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-charcoal-2 border border-charcoal-3 px-3 py-3 text-center"
            style={{ borderTop: `2px solid ${accent}` }}>
            <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.3em] text-gray-3 mb-1">{label}</div>
            <div className="font-display text-off-white" style={{ fontSize: 28, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Two-col operational panels ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Action Required */}
        <div className="dash-card" style={{ borderLeft: '3px solid #c00000' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase"
              style={{ color: '#c00000' }}>Action Required</span>
            {actionItems.length > 0 && (
              <span className="font-condensed text-[9px] font-bold px-1.5 py-0.5"
                style={{ background: '#c0000022', color: '#c00000', border: '1px solid #c0000044' }}>
                {actionItems.length}
              </span>
            )}
          </div>
          {actionItems.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#00c060', boxShadow: '0 0 5px #00c06055' }} />
              <span className="font-condensed text-[12px] text-gray-2">All clear — no pending actions</span>
            </div>
          ) : (
            <ul className="space-y-0">
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5 py-2 border-b border-charcoal-3 last:border-0">
                  <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                    style={{ background: item.urgency === 'red' ? '#c00000' : '#c9a82c' }} />
                  <span className="font-condensed text-[12px] text-gray-1 flex-1">{item.text}</span>
                  <span className={`badge ${item.urgency === 'red' ? 'badge-red' : 'badge-yellow'}`}>
                    {item.urgency === 'red' ? 'Urgent' : 'Review'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Platform Health */}
        <div className="dash-card" style={{ borderLeft: '3px solid #222226' }}>
          <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-3">Platform Health</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Supabase', ok: !!healthData?.supabase,                       na: false },
              { label: 'Email',    ok: !!(healthData?.sendgrid || healthData?.email), na: false },
              { label: 'API',      ok: true,                                          na: false },
              { label: 'Stripe',   ok: false,                                         na: true  },
            ].map(s => (
              <div key={s.label}
                className="flex items-center gap-2.5 bg-charcoal-2 px-3 py-2 border border-charcoal-3">
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000',
                  boxShadow:  s.na ? 'none' : s.ok ? '0 0 5px #00c06055' : '0 0 5px #c0000055',
                }} />
                <span className="font-condensed text-[11px] text-gray-2 flex-1">{s.label}</span>
                <span className="font-condensed text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000' }}>
                  {s.na ? 'N/A' : s.ok ? 'OK' : 'ERR'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Metric row ── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>

        <div className="dash-card">
          <div className="dash-label">Lifetime Revenue</div>
          <div className="font-display mt-1" style={{ fontSize: 34, lineHeight: 1,
            color: (m.total_revenue_usd ?? 0) > 0 ? '#f0ece4' : '#4a4846' }}>
            {revDisplay}
          </div>
          <div className="dash-sub">From succeeded payments</div>
        </div>

        <div className="dash-card">
          <div className="dash-label">Obligations</div>
          <div className="flex items-end gap-3 mt-1">
            <div>
              <div className="font-display text-off-white" style={{ fontSize: 34, lineHeight: 1 }}>
                {m.total_obligations ?? 0}
              </div>
              <div className="dash-sub">Total · {m.completed_obligations ?? 0} completed</div>
            </div>
            {(m.overdue_obligations ?? 0) > 0 && (
              <div className="mb-0.5 ml-2">
                <div className="font-display" style={{ fontSize: 26, lineHeight: 1, color: '#c00000' }}>
                  {m.overdue_obligations}
                </div>
                <div className="font-condensed text-[9px] uppercase tracking-widest text-blood-glow">Overdue</div>
              </div>
            )}
          </div>
          <div className="dash-bar-track mt-2">
            <div className="dash-bar-fill" style={{
              width: `${(m.total_obligations ?? 0) > 0
                ? Math.round((m.completed_obligations ?? 0) / m.total_obligations * 100) : 0}%`,
              background: '#00c060',
            }} />
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-label">Marketplace</div>
          <div className="font-display text-off-white mt-1" style={{ fontSize: 34, lineHeight: 1 }}>
            {m.total_applications ?? 0}
          </div>
          <div className="dash-sub">Applications · {m.active_opportunities ?? 0} live opportunities</div>
          <div className="dash-bar-track mt-2">
            <div className="dash-bar-fill" style={{ width: `${Math.min((m.active_opportunities ?? 0) * 10, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* ── Alerts feed ── */}
      {alerts.length > 0 && (
        <div className="dash-card p-0 overflow-hidden">
          <div className="px-4 py-2 border-b border-charcoal-3 flex items-center gap-2">
            <span className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">System Alerts</span>
            <span className="font-condensed text-[9px] px-1.5 py-0.5"
              style={{ background: '#c0000022', color: '#c00000', border: '1px solid #c0000033' }}>
              {alerts.length}
            </span>
          </div>
          <ul className="dc-list px-4 py-2">
            {alerts.map((a: any, i: number) => (
              <li key={i} className="dash-list-item">
                <span className="dash-item-name">{a.name ?? a}</span>
                <span className={`badge badge-${a.type ?? 'red'}`}>{a.badge ?? 'Alert'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SETUP CHECKLIST
// ═════════════════════════════════════════════════════════════════════════════
function Setup() {
  const { user }                        = useAuth()
  const { data: usersData }             = useApi<any>('/api/admin/users')
  const { data: mentorsData }           = useApi<any>('/api/admin/mentors')
  const { data: contentData }           = useApi<any>('/api/admin/content')
  const { data: pkgData }               = useApi<any>('/api/admin/packages')
  const { data: healthData, loading }   = useApi<any>('/api/health')
  const { data: sponsorData }           = useApi<any>('/api/admin/sponsors/pending')

  const [testEmailState, setTestEmailState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [testEmailMsg,   setTestEmailMsg]   = useState('')

  const hasUsers         = (usersData?.total ?? 0) > 0
  const hasMentors       = (mentorsData?.active_consultants ?? 0) > 0
  const hasModules       = (contentData?.published_modules ?? contentData?.total_modules ?? 0) > 0
  const hasPackages      = (pkgData?.packages?.length ?? 0) > 0
  const emailConfigured  = !!healthData?.email
  const sendgridOk       = !!healthData?.sendgrid
  const anyEmailOk       = sendgridOk || emailConfigured
  const supabaseOk       = !!healthData?.supabase
  const pendingVetting   = (sponsorData?.pending?.length ?? 0)
  const noPendingVetting = pendingVetting === 0

  const checklist = [
    { done: true,            label: 'Admin account active',          detail: `Signed in as ${user?.email}` },
    { done: supabaseOk,      label: 'Supabase connected',            detail: supabaseOk ? 'Auth and database live' : 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on Render' },
    { done: sendgridOk,      label: 'SendGrid configured',           detail: sendgridOk ? 'Transactional emails active via SendGrid' : 'Set SENDGRID_API_KEY + SENDGRID_FROM_EMAIL on Render' },
    { done: emailConfigured, label: 'SMTP fallback configured',      detail: emailConfigured ? 'SMTP transport available' : 'Optional — set EMAIL_HOST, EMAIL_USER, EMAIL_PASS (SendGrid preferred)' },
    { done: hasUsers,        label: 'First users registered',        detail: hasUsers ? `${usersData?.total ?? '?'} users in the system` : 'Share /register to invite fighters, managers, sponsors' },
    { done: hasModules,      label: 'Education modules published',   detail: hasModules ? `${contentData?.published_modules ?? contentData?.total_modules} published` : 'Go to Modules tab and publish the seeded modules' },
    { done: hasPackages,     label: 'Packages created',              detail: hasPackages ? `${pkgData?.packages?.length} packages in catalogue` : 'Packages were seeded — verify in Packages tab' },
    { done: hasMentors,      label: 'Consultants / mentors added',   detail: hasMentors ? `${mentorsData?.active_consultants} active` : 'Add consultants via Supabase or the Mentors tab' },
    { done: noPendingVetting,label: 'Sponsor vetting queue clear',   detail: noPendingVetting ? 'No sponsors awaiting review' : `${pendingVetting} sponsor${pendingVetting > 1 ? 's' : ''} waiting for approval` },
    { done: false,           label: 'Stripe connected (future)',     detail: 'Stripe integration — do this after packages are confirmed' },
  ]

  const completed = checklist.filter(c => c.done).length

  const handleTestEmail = async () => {
    setTestEmailState('sending')
    setTestEmailMsg('')
    try {
      const r = await sendTestEmail(user?.email)
      setTestEmailState('ok')
      setTestEmailMsg(`Sent to ${r.sent_to}`)
    } catch (e: any) {
      setTestEmailState('err')
      setTestEmailMsg(e.message ?? 'Send failed.')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeading>Setup Checklist</SectionHeading>

      <div className="dash-card">
        <div className="flex items-center justify-between mb-4">
          <div className="dash-label">Progress</div>
          <div className="font-condensed font-bold text-off-white" style={{ fontSize: 13 }}>
            {completed} / {checklist.length} complete
          </div>
        </div>
        <div className="dash-bar-track mb-4">
          <div className="dash-bar-fill" style={{
            width: `${Math.round(completed / checklist.length * 100)}%`,
            background: completed === checklist.length ? '#00c060' : '#c00000',
          }} />
        </div>
        {loading
          ? <div className="flex justify-center py-4"><Spinner /></div>
          : checklist.map((item, i) => (
              <ChecklistItem key={i} done={item.done} label={item.label} detail={item.detail} />
            ))
        }
      </div>

      {/* Email test — only shown when some email transport is configured */}
      {anyEmailOk && (
        <div className="dash-card" style={{ borderLeft: '2px solid #222226' }}>
          <div className="dash-label mb-3">Email Delivery Test</div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleTestEmail}
              disabled={testEmailState === 'sending'}
              className="font-condensed font-bold uppercase text-[11px] tracking-[0.15em] px-4 py-2.5 border cursor-pointer transition-all disabled:opacity-40"
              style={{ borderColor: '#8b0000', color: '#C41E3A', background: 'rgba(139,0,0,0.08)' }}
            >
              {testEmailState === 'sending' ? 'Sending…' : `Send test email to ${user?.email}`}
            </button>
            {testEmailMsg && (
              <span className="font-condensed text-[12px]"
                style={{ color: testEmailState === 'ok' ? '#00c060' : '#C41E3A' }}>
                {testEmailMsg}
              </span>
            )}
          </div>
          <p className="font-condensed text-[11px] text-gray-3 mt-2">
            {sendgridOk ? 'Using SendGrid' : 'Using SMTP fallback'}
          </p>
        </div>
      )}

      <div className="dash-card" style={{ borderLeft: '2px solid #8b0000' }}>
        <div className="dash-label mb-2">Kevin's Handoff Notes</div>
        <ul className="space-y-2 font-body text-gray-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <li>• Your admin email is <strong className="text-off-white">lekakevin679@gmail.com</strong></li>
          <li>• To change your password: Supabase Dashboard → Authentication → Users → find your email → Reset password</li>
          <li>• To vet a sponsor: go to <strong className="text-off-white">Sponsor Vetting</strong> tab → Approve</li>
          <li>• To publish education modules: go to <strong className="text-off-white">Modules</strong> tab → toggle Published</li>
          <li>• Packages are seeded with starter prices. Edit them in the <strong className="text-off-white">Packages</strong> tab. Stripe integration comes later.</li>
        </ul>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// USERS
// ═════════════════════════════════════════════════════════════════════════════
function Users() {
  const { user: me }                 = useAuth()
  const [roleFilter, setRoleFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]          = useState('')
  const [users, setUsers]            = useState<AdminUser[]>([])
  const [total, setTotal]            = useState(0)
  const [loading, setLoading]        = useState(true)
  const [error, setError]            = useState<string | null>(null)
  const [msg, setMsg]                = useState<{ id: string; type: 'ok'|'err'; text: string } | null>(null)
  const [acting, setActing]          = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getAdminUsers({ role: roleFilter || undefined, status: statusFilter || undefined, search: search || undefined })
      .then(d => { setUsers(d.users); setTotal(d.total); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [roleFilter, statusFilter, search])

  useEffect(() => { load() }, [load])

  const act = async (id: string, updates: Parameters<typeof updateAdminUser>[1], label: string) => {
    setActing(id); setMsg(null)
    try {
      await updateAdminUser(id, updates)
      setMsg({ id, type: 'ok', text: `${label} — done.` })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } as AdminUser : u))
    } catch (e: any) {
      setMsg({ id, type: 'err', text: e.message ?? 'Failed.' })
    } finally {
      setActing(null)
    }
  }

  const ROLES = ['fighter', 'manager', 'sponsor', 'admin']

  return (
    <div className="space-y-4">
      <SectionHeading>Users & Roles — {total} total</SectionHeading>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none w-56"
          style={{ borderColor: search ? '#8b0000' : '#222226' }} />

        <div className="flex gap-1.5">
          {['', ...ROLES].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-2.5 py-1.5 border transition-all cursor-pointer"
              style={{
                borderColor: roleFilter === r ? '#8b0000' : '#222226',
                background:  roleFilter === r ? 'rgba(139,0,0,0.12)' : '#141416',
                color:       roleFilter === r ? '#f0ece4' : '#7a7672',
              }}>{r || 'All'}</button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {[{ v: '', l: 'All Status' }, { v: 'active', l: 'Active' }, { v: 'suspended', l: 'Suspended' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-2.5 py-1.5 border transition-all cursor-pointer"
              style={{
                borderColor: statusFilter === s.v ? '#8b0000' : '#222226',
                background:  statusFilter === s.v ? 'rgba(139,0,0,0.12)' : '#141416',
                color:       statusFilter === s.v ? '#f0ece4' : '#7a7672',
              }}>{s.l}</button>
          ))}
        </div>
      </div>

      {loading && <DashSkeleton />}
      {error   && <ApiError message={error} />}
      {!loading && !error && !users.length && (
        <EmptyState icon="👥" title="No Users Found" body="No users match the current filter." />
      )}

      {!loading && users.map(u => {
        const isSelf    = u.id === me?.id
        const suspended = u.status === 'suspended'
        const rowMsg    = msg?.id === u.id ? { type: msg.type, text: msg.text } : null

        return (
          <div key={u.id} className="dash-card space-y-2">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-charcoal-3 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-condensed text-[11px] font-bold text-gray-2">{(u.name ?? '?')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-condensed text-[13px] font-bold text-off-white truncate">
                  {u.name} {isSelf && <span className="text-blood-glow text-[10px]">(you)</span>}
                </div>
                <div className="font-condensed text-[10px] text-gray-3">{u.email}</div>
              </div>

              <span className={`badge ${u.role==='fighter'?'badge-yellow':u.role==='manager'?'badge-green':u.role==='sponsor'?'badge-red':'badge-yellow'}`}>
                {u.role}
              </span>
              <span className={`badge ${!u.status || u.status==='active'?'badge-green':u.status==='suspended'?'badge-red':'badge-yellow'}`}>
                {u.status || 'active'}
              </span>
              <span className={`font-condensed text-[9px] uppercase tracking-widest ${u.onboarding_complete?'text-green-500':'text-gray-3'}`}>
                {u.onboarding_complete ? '✓ Onboarded' : '○ Onboarding'}
              </span>
              <span className="font-condensed text-[10px] text-gray-3">
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>

              {/* Quick actions */}
              {!isSelf && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => act(u.id, { status: suspended ? 'active' : 'suspended' }, suspended ? 'Reactivated' : 'Suspended')}
                    disabled={acting === u.id}
                    className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-50"
                    style={{
                      borderColor: suspended ? '#2a5c2a' : '#4a0000',
                      color:       suspended ? '#00c060' : '#c00000',
                      background:  'transparent',
                    }}>
                    {acting === u.id ? <Spinner /> : suspended ? 'Reactivate' : 'Suspend'}
                  </button>
                </div>
              )}
            </div>
            {rowMsg && <ActionMsg msg={rowMsg} />}
          </div>
        )
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SPONSOR VETTING
// ═════════════════════════════════════════════════════════════════════════════
function SponsorVetting() {
  const [pending,  setPending]  = useState<PendingSponsor[]>([])
  const [verified, setVerified] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [acting,   setActing]   = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, { type:'ok'|'err'; text:string }>>({})

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getPendingSponsors()
      .then(d => { setPending(d.pending ?? []); setVerified(d.verified ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (userId: string, approved: boolean) => {
    setActing(userId)
    try {
      await verifySponsor(userId, approved)
      setMessages(prev => ({
        ...prev,
        [userId]: { type: 'ok', text: approved ? '✓ Sponsor approved — they can now contact fighters.' : '✗ Sponsor rejected and suspended.' },
      }))
      load()
    } catch (e: any) {
      setMessages(prev => ({ ...prev, [userId]: { type: 'err', text: e.message ?? 'Action failed.' } }))
    } finally {
      setActing(null)
    }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  return (
    <div className="space-y-6">
      <SectionHeading>Sponsor Vetting</SectionHeading>

      {/* Pending */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="dash-label mb-0">Pending Review ({pending.length})</div>
          {pending.length > 0 && (
            <span className="font-condensed font-bold text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: '#c9a82c22', color: '#c9a82c', border: '1px solid #c9a82c44' }}>
              Requires Action
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <EmptyState icon="✓" title="No Pending Sponsors" body="All sponsors have been reviewed. The queue is clear." />
        ) : (
          <div className="space-y-4">
            {pending.map(sp => (
              <div key={sp.user_id} className="dash-card space-y-3" style={{ borderLeft: '2px solid #c9a82c' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-condensed font-bold text-off-white" style={{ fontSize: 16 }}>
                      {sp.company_name}
                    </div>
                    <div className="font-condensed text-[11px] text-gray-3 mt-0.5">
                      {sp.profiles?.email} · {sp.profiles?.name}
                    </div>
                    <div className="font-condensed text-[11px] text-gray-2 mt-2 space-y-0.5">
                      {sp.industry   && <div><span className="text-gray-3">Industry: </span>{sp.industry}</div>}
                      {sp.website_url && <div><span className="text-gray-3">Website: </span>
                        <a href={sp.website_url} target="_blank" rel="noopener noreferrer" className="text-blood-glow no-underline hover:underline">{sp.website_url}</a>
                      </div>}
                      {(sp.budget_min_usd || sp.budget_max_usd) && (
                        <div><span className="text-gray-3">Budget: </span>${sp.budget_min_usd ?? 0} – ${sp.budget_max_usd ?? '∞'} / yr</div>
                      )}
                      {sp.campaign_goals?.length > 0 && (
                        <div><span className="text-gray-3">Goals: </span>{sp.campaign_goals.join(', ')}</div>
                      )}
                    </div>
                    {sp.description && (
                      <p className="font-body text-gray-2 mt-2 text-[12px] leading-relaxed" style={{ maxWidth: 480 }}>
                        {sp.description}
                      </p>
                    )}
                    <div className="font-condensed text-[10px] text-gray-3 mt-2">
                      Applied {new Date(sp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => act(sp.user_id, true)}
                      disabled={acting === sp.user_id}
                      className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-4 py-2 border cursor-pointer transition-all disabled:opacity-50"
                      style={{ borderColor: '#2a5c2a', color: '#00c060', background: 'rgba(0,192,96,0.08)' }}>
                      {acting === sp.user_id ? <Spinner /> : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => act(sp.user_id, false)}
                      disabled={acting === sp.user_id}
                      className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-4 py-2 border cursor-pointer transition-all disabled:opacity-50"
                      style={{ borderColor: '#4a0000', color: '#c00000', background: 'rgba(139,0,0,0.08)' }}>
                      {acting === sp.user_id ? <Spinner /> : '✗ Reject'}
                    </button>
                  </div>
                </div>
                {messages[sp.user_id] && <ActionMsg msg={messages[sp.user_id]} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified */}
      {verified.length > 0 && (
        <div>
          <div className="dash-label mb-3">Already Verified ({verified.length})</div>
          <div className="space-y-2">
            {verified.map(sp => (
              <div key={sp.user_id} className="dash-card flex items-center gap-4">
                <div className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
                     style={{ borderColor: '#2a5c2a', background: 'rgba(0,192,96,0.12)' }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <polyline points="2 6 5 9 10 3" stroke="#00c060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-condensed font-bold text-off-white text-[13px]">{sp.company_name}</div>
                  <div className="font-condensed text-[10px] text-gray-3">{sp.profiles?.email}</div>
                </div>
                <div className="font-condensed text-[10px] text-gray-3">
                  {sp.industry || '—'}
                </div>
                <span className="badge badge-green">Verified</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// EDUCATION MODULES
// ═════════════════════════════════════════════════════════════════════════════
const CATEGORIES = ['business', 'finance', 'contracts', 'branding', 'nil', 'camp', 'sponsor', 'transition']
const MODULE_TYPES = [
  { value: 'lesson',    label: 'Text Lesson' },
  { value: 'video',     label: 'Video' },
  { value: 'pdf',       label: 'PDF' },
  { value: 'link',      label: 'External Link' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'mixed',     label: 'Mixed' },
]

const BLANK_MODULE = {
  name: '', description: '', category: '', order_num: '100', is_published: false,
  estimated_mins: '', module_type: 'lesson', content_url: '', content_body: '',
  is_required: false, audience: 'all_fighters', status: 'draft',
}

// PDF upload field — uses signed URL upload to education-content bucket (admin only)
function PdfUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setErr('Only PDF files are allowed.'); return }
    setErr(''); setUploading(true)
    try {
      const { path } = await uploadFile('module-pdf', file)
      onChange(path)
    } catch (ex: any) {
      setErr(ex.message ?? 'Upload failed.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
        PDF File * <span className="font-normal normal-case tracking-normal text-gray-3 text-[10px]">(max 10 MB)</span>
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-2 border border-charcoal-3 text-gray-2 hover:text-off-white hover:border-gray-2 disabled:opacity-40 cursor-pointer">
          {uploading ? 'Uploading…' : 'Choose PDF'}
        </button>
        <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
        {value && !uploading && (
          <span className="font-condensed text-[11px] text-green-400 truncate max-w-xs">
            ✓ {value.split('/').pop()}
          </span>
        )}
      </div>
      {/* Also allow pasting a direct URL as fallback */}
      <FField label="" value={value} onChange={onChange} placeholder="or paste PDF URL / storage path"
        hint="Upload above or paste a URL" />
      {err && <p className="font-condensed text-[11px] text-blood-glow mt-1">{err}</p>}
    </div>
  )
}

function ChecklistBuilder({ items, onChange }: {
  items: EduChecklistItem[]
  onChange: (items: EduChecklistItem[]) => void
}) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), text: '', required: true }])
  const remove  = (id: string) => onChange(items.filter(i => i.id !== id))
  const update  = (id: string, field: keyof EduChecklistItem, val: string | boolean) =>
    onChange(items.map(i => i.id === id ? { ...i, [field]: val } : i))

  return (
    <div className="space-y-2">
      <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-1.5">Checklist Items</div>
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="font-condensed text-[10px] text-gray-3 w-4">{idx + 1}.</span>
          <input value={item.text} onChange={e => update(item.id, 'text', e.target.value)}
            placeholder="Checklist item text…"
            className="flex-1 bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-1.5 outline-none" />
          <label className="flex items-center gap-1 cursor-pointer shrink-0">
            <input type="checkbox" checked={item.required} onChange={e => update(item.id, 'required', e.target.checked)}
              className="w-3 h-3 accent-red-700" />
            <span className="font-condensed text-[10px] text-gray-3">Req</span>
          </label>
          <button onClick={() => remove(item.id)} className="font-condensed text-[10px] text-blood-glow px-1">✕</button>
        </div>
      ))}
      <button onClick={addItem} className="font-condensed text-[10px] tracking-[0.15em] uppercase text-gray-3 hover:text-gray-1 py-1">
        + Add Item
      </button>
    </div>
  )
}

function ModuleEditor({ initial, onSave, onCancel }: {
  initial?: Partial<AdminModule>
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    ...BLANK_MODULE,
    ...(initial ? {
      name:           initial.name ?? '',
      description:    initial.description ?? '',
      category:       initial.category ?? '',
      order_num:      String(initial.order_num ?? 100),
      is_published:   initial.is_published ?? false,
      estimated_mins: initial.estimated_mins ? String(initial.estimated_mins) : '',
      module_type:    initial.module_type ?? 'lesson',
      content_url:    initial.content_url ?? '',
      content_body:   initial.content_body ?? '',
      is_required:    initial.is_required ?? false,
      audience:       initial.audience ?? 'all_fighters',
      status:         initial.status ?? 'draft',
    } : {}),
  })

  const parseRawChecklist = (): EduChecklistItem[] => {
    try {
      const meta = initial?.metadata
      const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta
      return Array.isArray(parsed?.checklist_items) ? parsed.checklist_items : []
    } catch { return [] }
  }
  const [checklistItems, setChecklistItems] = useState<EduChecklistItem[]>(parseRawChecklist)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const sf = (k: string) => (v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const needsUrl  = ['video','pdf','link'].includes(form.module_type)
  const needsBody = ['lesson','mixed'].includes(form.module_type)
  const needsList = ['checklist','mixed'].includes(form.module_type)

  const submit = async () => {
    if (!form.name.trim()) { setErr('Module name is required.'); return }
    if (needsUrl && !form.content_url.trim()) { setErr('Content URL is required for this module type.'); return }
    setSaving(true); setErr(null)
    try {
      const isPublished = form.status === 'published'
      await onSave({
        name:           form.name.trim(),
        description:    form.description.trim() || null,
        category:       form.category || null,
        order_num:      Number(form.order_num) || 100,
        is_published:   isPublished,
        estimated_mins: form.estimated_mins ? Number(form.estimated_mins) : null,
        content_url:    form.content_url.trim() || null,
        module_type:    form.module_type,
        content_body:   form.content_body.trim() || null,
        metadata:       { checklist_items: needsList ? checklistItems : [] },
        is_required:    form.is_required,
        audience:       form.audience,
        status:         form.status,
      })
    } catch (e: any) {
      setErr(e.message ?? 'Save failed.')
      setSaving(false)
    }
  }

  return (
    <div className="dash-card space-y-4" style={{ borderLeft: '2px solid #8b0000' }}>
      <div className="dash-label">{isEdit ? 'Edit Module' : 'New Module'}</div>

      <div className="grid grid-cols-2 gap-3">
        <FField label="Module Name *" value={form.name} onChange={sf('name')} placeholder="e.g. Taxes & Filing" required />
        <FField label="Order #" type="number" value={form.order_num} onChange={sf('order_num')} hint="Lower = shown first" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FSelect label="Category" value={form.category} onChange={sf('category') as any}
          options={CATEGORIES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
        <FSelect label="Module Type *" value={form.module_type} onChange={sf('module_type') as any}
          options={MODULE_TYPES} />
      </div>

      <div>
        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">Description</label>
        <textarea value={form.description} onChange={e => sf('description')(e.target.value)} rows={2}
          placeholder="What will fighters learn in this module?"
          className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
      </div>

      {/* Dynamic content fields */}
      {needsUrl && form.module_type === 'pdf' && (
        <PdfUploadField value={form.content_url} onChange={sf('content_url')} />
      )}
      {needsUrl && form.module_type !== 'pdf' && (
        <FField label={form.module_type === 'video' ? 'Video URL (YouTube / Vimeo / Loom) *' : 'External URL *'}
          value={form.content_url} onChange={sf('content_url')} placeholder="https://…" />
      )}
      {needsBody && (
        <div>
          <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
            Lesson Body {form.module_type === 'mixed' ? '(optional)' : '*'}
          </label>
          <textarea value={form.content_body} onChange={e => sf('content_body')(e.target.value)} rows={6}
            placeholder="Write the lesson content here…"
            className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-y" />
        </div>
      )}
      {needsBody && form.module_type === 'mixed' && (
        <FField label="Supplementary URL (video / PDF / link)" value={form.content_url} onChange={sf('content_url')} placeholder="https://…" />
      )}
      {needsList && (
        <ChecklistBuilder items={checklistItems} onChange={setChecklistItems} />
      )}

      <div className="grid grid-cols-3 gap-3">
        <FField label="Est. Minutes" type="number" value={form.estimated_mins} onChange={sf('estimated_mins')} placeholder="30" />
        <FSelect label="Status" value={form.status} onChange={sf('status') as any}
          options={[{ value:'draft', label:'Draft' }, { value:'published', label:'Published' }, { value:'archived', label:'Archived' }]} />
        <FSelect label="Audience" value={form.audience} onChange={sf('audience') as any}
          options={[{ value:'all_fighters', label:'All Fighters' }, { value:'fighters_only', label:'Fighters Only' }]} />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_required} onChange={e => sf('is_required')(e.target.checked)}
            className="w-4 h-4 accent-red-700 cursor-pointer" />
          <span className="font-condensed text-[11px] text-gray-2 uppercase tracking-widest">Required for all fighters</span>
        </label>
      </div>

      {err && <p className="font-condensed text-[12px] text-blood-glow">{err}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50"
          style={{ display:'flex', alignItems:'center', gap:8 }}>
          {saving ? <><Spinner /> Saving…</> : isEdit ? 'Save Changes' : 'Create Module'}
        </button>
        <button onClick={onCancel} className="btn-ghost text-[11px] py-2 px-4">Cancel</button>
      </div>
    </div>
  )
}

function Content() {
  const [modules,  setModules]  = useState<AdminModule[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [msg,      setMsg]      = useState<{ type:'ok'|'err'; text:string }|null>(null)
  const [editId,   setEditId]   = useState<string|null>(null)   // module id being edited, 'new' for create
  const [actingId, setActingId] = useState<string|null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getAdminModules()
      .then(d => { setModules(d.modules); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async (data: any) => {
    await createModule(data)
    setMsg({ type:'ok', text:'Module created.' })
    setEditId(null)
    load()
  }

  const handleUpdate = async (id: string, data: any) => {
    await updateModule(id, data)
    setMsg({ type:'ok', text:'Module saved.' })
    setEditId(null)
    load()
  }

  const handleStatus = async (m: AdminModule, status: 'draft'|'published'|'archived') => {
    setActingId(m.id); setMsg(null)
    try {
      await setModuleStatus(m.id, status)
      setModules(prev => prev.map(x => x.id === m.id ? { ...x, status, is_published: status === 'published' } : x))
      setMsg({ type:'ok', text:`Module ${status}.` })
    } catch (e: any) { setMsg({ type:'err', text: e.message }) }
    finally { setActingId(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  const editingModule = editId && editId !== 'new' ? modules.find(m => m.id === editId) : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Education Modules ({modules.length})</SectionHeading>
        <button onClick={() => { setEditId(editId === 'new' ? null : 'new'); setMsg(null) }}
          className="btn-ghost text-[11px] py-2 px-4">
          {editId === 'new' ? 'Cancel' : '+ New Module'}
        </button>
      </div>

      {msg && <p className={`font-condensed text-[12px] ${msg.type==='ok'?'text-green-400':'text-blood-glow'}`}>{msg.text}</p>}

      {editId === 'new' && (
        <ModuleEditor onSave={handleCreate} onCancel={() => setEditId(null)} />
      )}

      {editId && editId !== 'new' && editingModule && (
        <ModuleEditor initial={editingModule} onSave={d => handleUpdate(editId, d)} onCancel={() => setEditId(null)} />
      )}

      {!modules.length ? (
        <EmptyState icon="📚" title="No Modules Yet" body="Create your first education module above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['#', 'Name', 'Type', 'Cat.', 'Req', 'Enrolled', 'Avg %', 'Status', 'Actions'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(m => (
                <tr key={m.id} className="border-b border-charcoal-3 last:border-0 hover:bg-charcoal-2/20 transition-colors">
                  <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5">{m.order_num}</td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <div className="font-condensed font-bold text-[12px] text-off-white truncate">{m.name}</div>
                    {m.is_required && <span className="font-condensed text-[9px] text-blood-glow uppercase tracking-widest">Required</span>}
                  </td>
                  <td className="font-condensed text-[10px] text-gray-2 px-3 py-2.5 capitalize">{(m.module_type || 'lesson').replace('_',' ')}</td>
                  <td className="font-condensed text-[10px] text-gray-2 px-3 py-2.5 capitalize">{m.category || '—'}</td>
                  <td className="font-condensed text-[10px] px-3 py-2.5" style={{ color: m.is_required ? '#C41E3A' : '#4a4846' }}>{m.is_required ? '✓' : '—'}</td>
                  <td className="font-condensed text-[11px] text-gray-2 px-3 py-2.5">{m.enrolled_count}</td>
                  <td className="font-condensed text-[11px] text-gray-2 px-3 py-2.5">{m.avg_completion}%</td>
                  <td className="px-3 py-2.5">
                    <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border"
                      style={{
                        borderColor: m.status==='published' ? '#00c060' : m.status==='archived' ? '#4a4846' : '#c9a82c',
                        color:       m.status==='published' ? '#00c060' : m.status==='archived' ? '#4a4846' : '#c9a82c',
                      }}>
                      {m.status ?? (m.is_published ? 'published' : 'draft')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => { setEditId(m.id); setMsg(null) }} disabled={editId === m.id}
                        className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border border-charcoal-3 text-gray-2 hover:text-off-white hover:border-gray-2 disabled:opacity-40">
                        Edit
                      </button>
                      {(m.status || (m.is_published ? 'published' : 'draft')) !== 'published' ? (
                        <button onClick={() => handleStatus(m, 'published')} disabled={actingId === m.id}
                          className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border disabled:opacity-40"
                          style={{ borderColor:'#2a5c2a', color:'#00c060' }}>
                          {actingId===m.id ? <Spinner /> : 'Publish'}
                        </button>
                      ) : (
                        <button onClick={() => handleStatus(m, 'draft')} disabled={actingId === m.id}
                          className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border disabled:opacity-40"
                          style={{ borderColor:'#4a0000', color:'#c00000' }}>
                          {actingId===m.id ? <Spinner /> : 'Unpublish'}
                        </button>
                      )}
                      {(m.status || '') !== 'archived' && (
                        <button onClick={() => handleStatus(m, 'archived')} disabled={actingId === m.id}
                          className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border border-charcoal-3 text-gray-3 hover:border-gray-2 disabled:opacity-40">
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PACKAGES
// ═════════════════════════════════════════════════════════════════════════════
function Packages() {
  const [packages, setPackages] = useState<AdminPackage[]>([])
  const [stats,    setStats]    = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{type:'ok'|'err';text:string}|null>(null)
  const [editId,   setEditId]   = useState<string|null>(null)
  const [editForm, setEditForm] = useState<Partial<Omit<AdminPackage, 'features'>> & { features?: string[] }>({})
  const [actingId, setActingId] = useState<string|null>(null)

  const [form, setForm] = useState({
    name:'', audience:'fighter', description:'', price_cents:'', billing_interval:'monthly', features:'', sort_order:'100',
  })
  const setF = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getAdminPackages()
      .then(d => { setPackages(d.packages ?? []); setStats(d.stats); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const features = (f: string[] | string) => Array.isArray(f) ? f : (typeof f === 'string' ? JSON.parse(f || '[]') : [])

  const submit = async () => {
    if (!form.name.trim())  { setMsg({ type:'err', text:'Name is required.' }); return }
    if (!form.price_cents)  { setMsg({ type:'err', text:'Price is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await createPackage({
        name:             form.name.trim(),
        audience:         form.audience,
        description:      form.description.trim() || null,
        price_cents:      Math.round(Number(form.price_cents) * 100),
        billing_interval: form.billing_interval,
        features:         form.features.split('\n').map(s => s.trim()).filter(Boolean),
        sort_order:       Number(form.sort_order) || 100,
      })
      setMsg({ type:'ok', text:'Package created.' })
      setShowForm(false)
      setForm({ name:'', audience:'fighter', description:'', price_cents:'', billing_interval:'monthly', features:'', sort_order:'100' })
      load()
    } catch (e: any) {
      setMsg({ type:'err', text: e.message ?? 'Create failed.' })
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (id: string) => {
    setActingId(id)
    try {
      const updates = { ...editForm }
      if (typeof updates.price_cents === 'string') updates.price_cents = Math.round(Number(updates.price_cents) * 100)
      if (Array.isArray(updates.features)) {/* ok */}
      else if (typeof updates.features === 'string') updates.features = (updates.features as any).split('\n').map((s:string)=>s.trim()).filter(Boolean)
      await updatePackage(id, updates)
      setPackages(prev => prev.map(p => p.id === id ? { ...p, ...updates } as any : p))
      setEditId(null)
    } catch (e: any) {
      setMsg({ type:'err', text: e.message })
    } finally {
      setActingId(null)
    }
  }

  const toggleActive = async (pkg: AdminPackage) => {
    setActingId(pkg.id)
    try {
      await updatePackage(pkg.id, { active: !pkg.active })
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, active: !p.active } : p))
    } catch (e: any) {
      setMsg({ type:'err', text: e.message })
    } finally {
      setActingId(null)
    }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  const fmtPrice = (p: AdminPackage) => {
    const dollars = (p.price_cents / 100).toFixed(2)
    return `$${dollars}/${p.billing_interval === 'monthly' ? 'mo' : p.billing_interval === 'annual' ? 'yr' : ''}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Packages ({packages.length})</SectionHeading>
        <button onClick={() => { setShowForm(v=>!v); setMsg(null) }} className="btn-ghost text-[11px] py-2 px-4">
          {showForm ? 'Cancel' : '+ New Package'}
        </button>
      </div>

      {stats && (stats.total_active_subscriptions > 0 || stats.mrr_usd > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Active Subscriptions" value={String(stats.total_active_subscriptions)} sub="Across all tiers" barPct={50} />
          <StatCard label="MRR (est.)" value={`$${stats.mrr_usd}`} sub="Monthly recurring revenue" barPct={50} />
        </div>
      )}

      {showForm && (
        <div className="dash-card space-y-4" style={{ borderLeft: '2px solid #8b0000' }}>
          <div className="dash-label">New Package</div>
          <div className="grid grid-cols-2 gap-3">
            <FField label="Name" value={form.name} onChange={setF('name')} placeholder="e.g. Pro Fighter" required />
            <FSelect label="Audience" value={form.audience} onChange={setF('audience')}
              options={[{value:'fighter',label:'Fighter'},{value:'manager',label:'Manager'},{value:'sponsor',label:'Sponsor'},{value:'all',label:'All'}]} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FField label="Price (USD)" type="number" value={form.price_cents} onChange={setF('price_cents')} placeholder="99" hint="Whole dollars, e.g. 99" required />
            <FSelect label="Billing" value={form.billing_interval} onChange={setF('billing_interval')}
              options={[{value:'monthly',label:'Monthly'},{value:'annual',label:'Annual'},{value:'one_time',label:'One-time'}]} required />
            <FField label="Sort Order" type="number" value={form.sort_order} onChange={setF('sort_order')} />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setF('description')(e.target.value)} rows={2}
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">Features (one per line)</label>
            <textarea value={form.features} onChange={e => setF('features')(e.target.value)} rows={4}
              placeholder={'Feature one\nFeature two\nFeature three'}
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <ActionMsg msg={msg} />
          <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50"
            style={{ display:'flex', alignItems:'center', gap:8 }}>
            {saving ? <><Spinner /> Creating…</> : 'Create Package'}
          </button>
        </div>
      )}

      {!showForm && <ActionMsg msg={msg} />}

      {!packages.length ? (
        <EmptyState icon="📦" title="No Packages Yet" body="Create your first package above or apply migration 0010 to seed starter packages." />
      ) : (
        <div className="space-y-3">
          {packages.map(pkg => (
            <div key={pkg.id} className="dash-card" style={{ borderLeft: `2px solid ${pkg.active ? '#8b0000' : '#2a2a2e'}` }}>
              {editId === pkg.id ? (
                /* Inline edit mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <FField label="Name" value={editForm.name ?? pkg.name}
                      onChange={v => setEditForm(p => ({ ...p, name: v }))} />
                    <FField label="Price (USD)" type="number" value={editForm.price_cents !== undefined ? String((editForm.price_cents as number)/100) : String(pkg.price_cents/100)}
                      onChange={v => setEditForm(p => ({ ...p, price_cents: Number(v) * 100 as any }))} />
                    <FSelect label="Billing" value={editForm.billing_interval ?? pkg.billing_interval}
                      onChange={v => setEditForm(p => ({ ...p, billing_interval: v }))}
                      options={[{value:'monthly',label:'Monthly'},{value:'annual',label:'Annual'},{value:'one_time',label:'One-time'}]} />
                  </div>
                  <div>
                    <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">Features (one per line)</label>
                    <textarea
                      value={Array.isArray(editForm.features) ? (editForm.features as string[]).join('\n') : features(pkg.features).join('\n')}
                      onChange={e => setEditForm(p => ({ ...p, features: e.target.value.split('\n') as any }))}
                      rows={4}
                      className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(pkg.id)} disabled={actingId === pkg.id} className="btn-primary text-[11px] py-2 disabled:opacity-50">
                      {actingId === pkg.id ? <Spinner /> : 'Save'}
                    </button>
                    <button onClick={() => { setEditId(null); setEditForm({}) }} className="btn-ghost text-[11px] py-2">Cancel</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-condensed font-bold text-off-white" style={{ fontSize: 15 }}>{pkg.name}</span>
                      <span className={`badge ${pkg.active ? 'badge-green' : 'badge-yellow'}`}>{pkg.active ? 'Active' : 'Inactive'}</span>
                      <span className="font-condensed text-[11px] text-gray-3 capitalize">{pkg.audience}</span>
                    </div>
                    <div className="font-condensed text-[13px] font-bold" style={{ color: '#c00000' }}>{fmtPrice(pkg)}</div>
                    {pkg.description && <p className="font-body text-gray-2 text-[12px] mt-1">{pkg.description}</p>}
                    {features(pkg.features).length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {features(pkg.features).map((f: string, i: number) => (
                          <li key={i} className="font-condensed text-[11px] text-gray-2">• {f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => { setEditId(pkg.id); setEditForm({ name: pkg.name, billing_interval: pkg.billing_interval, features: features(pkg.features) }) }}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border border-charcoal-3 text-gray-2 cursor-pointer hover:border-blood hover:text-off-white transition-all">
                      Edit
                    </button>
                    <button onClick={() => toggleActive(pkg)} disabled={actingId === pkg.id}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-50"
                      style={{
                        borderColor: pkg.active ? '#4a0000' : '#2a5c2a',
                        color:       pkg.active ? '#c00000' : '#00c060',
                        background:  'transparent',
                      }}>
                      {actingId === pkg.id ? <Spinner /> : pkg.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// REMAINING READ-ONLY TABS (unchanged structure, improved data)
// ═════════════════════════════════════════════════════════════════════════════

function Marketplace() {
  const { data, loading, error }  = useApi<any>('/api/admin/marketplace')
  const { data: analytics }       = useApi<any>('/api/admin/analytics')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const gmv             = data?.gmv_usd           ?? 0
  const activeContracts = data?.active_contracts  ?? 0
  const totalContracts  = data?.total_contracts   ?? 0
  const sponsorCount    = data?.sponsor_count     ?? 0
  const verifiedSponsors= data?.verified_sponsors ?? 0
  const totalApps       = data?.total_applications ?? 0
  const funnel          = data?.applications_funnel ?? {}
  const recent          = data?.recent_contracts   ?? []
  const monthlyGmv      = analytics?.monthly_gmv  ?? []
  const gmvDisplay      = gmv >= 1000 ? `$${(gmv/1000).toFixed(1)}K` : `$${gmv}`

  if (totalContracts === 0 && sponsorCount === 0) return (
    <div className="space-y-4">
      <SectionHeading>Marketplace</SectionHeading>
      <EmptyState icon="🤝" title="No Marketplace Activity Yet"
        body="Marketplace data appears once sponsors are vetted and opportunities are published." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Marketplace</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center">
          <div className="dash-label">GMV</div>
          <div className="font-display text-off-white" style={{ fontSize:28 }}>{gmvDisplay}</div>
          <div className="dash-sub">Payments succeeded</div>
        </div>
        <StatCard label="Active Contracts" value={String(activeContracts)} sub={`${totalContracts} total`}
          barPct={totalContracts>0?Math.round(activeContracts/totalContracts*100):0} />
        <StatCard label="Sponsors" value={String(sponsorCount)} sub={`${verifiedSponsors} verified`}
          barPct={sponsorCount>0?Math.round(verifiedSponsors/sponsorCount*100):0} />
        <StatCard label="Applications" value={String(totalApps)} sub="All time" barPct={50} />
      </div>
      {monthlyGmv.length > 0 && (
        <div className="dash-card">
          <div className="dash-label mb-3">Monthly GMV (6 months)</div>
          <BarChart height={100} data={monthlyGmv} />
        </div>
      )}
      <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Applications Funnel</div>
          {Object.keys(funnel).length > 0
            ? Object.entries(funnel).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between mb-2">
                  <span className="dash-sub capitalize">{status.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="dash-bar-track" style={{ width:80 }}>
                      <div className="dash-bar-fill" style={{ width:`${totalApps>0?Math.round((count as number)/totalApps*100):0}%` }} />
                    </div>
                    <span className="dash-sub w-6 text-right">{count as number}</span>
                  </div>
                </div>
              ))
            : <div className="dash-sub">No applications yet.</div>
          }
        </div>
        <ListCard label="Recent Contracts"
          items={recent.length>0 ? recent : [{name:'No contracts yet',badge:'—',type:'yellow' as const}]} />
      </div>
    </div>
  )
}

function Reports() {
  const { data, loading, error } = useApi<any>('/api/admin/reports')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const avgReadiness = data?.avg_readiness    ?? 0
  const oblRate      = data?.obligations_rate ?? 100
  const sfMatches    = data?.sf_matches       ?? 0

  return (
    <div className="space-y-4">
      <SectionHeading>System Reports</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
        <div className="dash-card text-center">
          <div className="dash-label">Avg Fighter Readiness</div>
          <ReadinessRing pct={avgReadiness} size={80} />
        </div>
        <StatCard label="Obligations Rate (90d)" value={`${oblRate}%`} barPct={oblRate} />
        <StatCard label="SF Eligible Fighters"   value={String(sfMatches)} sub="Unlocked" barPct={55} />
      </div>
    </div>
  )
}

function Mentors() {
  const { data, loading, error } = useApi<any>('/api/admin/mentors')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />
  const consultants = data?.consultants ?? []

  return (
    <div className="space-y-4">
      <SectionHeading>Mentors & Consultants</SectionHeading>
      {!consultants.length
        ? <EmptyState icon="🎯" title="No Consultants Yet"
            body="Add consultants directly in Supabase (consultants table) for now. A create form is planned for a future update." />
        : <>
            <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 1fr 160px' }}>
              <StatCard label="Active" value={String(data?.active_consultants ?? 0)} sub="Available" barPct={80} />
              <StatCard label="Sessions This Month" value={String(data?.sessions_this_month ?? 0)} sub="Completed bookings" barPct={50} />
              <div className="dash-card text-center"><div className="dash-label">Booking Rate</div><ReadinessRing pct={data?.booking_rate ?? 0} size={70} /></div>
            </div>
            <ListCard label="Consultant Roster" items={consultants.map((c: any) => ({
              name: `${c.name} — ${c.specialty ?? ''}`, badge: c.badge, type: c.type,
            }))} />
          </>
      }
    </div>
  )
}

function SponsorForgeAdmin() {
  const { data, loading, error } = useApi<any>('/api/admin/sponsorforge')
  const [recomputing, setRecomputing]   = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState<{type:'ok'|'err';text:string}|null>(null)

  const recompute = async () => {
    setRecomputing(true); setRecomputeMsg(null)
    try {
      const r = await adminRecompute()
      setRecomputeMsg({ type:'ok', text:`Recomputed ${r.computed} matches across ${r.opportunities} opportunities.` })
    } catch (e: any) {
      setRecomputeMsg({ type:'err', text: e.message ?? 'Recompute failed.' })
    } finally { setRecomputing(false) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const matchCount = data?.active_matches       ?? 0
  const activeOpps = data?.active_opportunities ?? 0
  const sponsors   = data?.sponsors             ?? 0
  const eligible   = data?.eligible_fighters    ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeading>SponsorForge Network</SectionHeading>
        <div className="flex items-center gap-3">
          {recomputeMsg && (
            <p className={`font-condensed text-[11px] ${recomputeMsg.type==='ok'?'text-green-400':'text-blood-glow'}`}>
              {recomputeMsg.text}
            </p>
          )}
          <button onClick={recompute} disabled={recomputing}
            className="btn-ghost text-[11px] py-2 px-4 disabled:opacity-50">
            {recomputing ? '↻ Computing…' : '↻ Recompute All'}
          </button>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center">
          <div className="dash-label">Verified Sponsors</div>
          <div className="dash-stat mt-1">{sponsors}</div>
        </div>
        <StatCard label="Eligible Fighters"  value={String(eligible)}   sub="Profile unlocked"   barPct={eligible   > 0 ? 60 : 0} />
        <StatCard label="Active Matches"     value={String(matchCount)} sub="Non-dismissed"       barPct={matchCount > 0 ? 50 : 0} />
        <StatCard label="Live Opportunities" value={String(activeOpps)} sub="Published campaigns" barPct={activeOpps > 0 ? 80 : 0} />
      </div>

      {matchCount === 0 ? (
        <div className="dash-card text-center py-6">
          <div className="font-condensed text-gray-3 text-[13px] mb-3">
            {sponsors === 0 ? 'No verified sponsors yet.' : 'No matches computed — click Recompute All to generate.'}
          </div>
          {sponsors > 0 && (
            <button onClick={recompute} disabled={recomputing} className="btn-primary text-[11px] py-2 px-6">
              {recomputing ? 'Computing…' : 'Compute Matches Now'}
            </button>
          )}
        </div>
      ) : (
        <div className="dash-card">
          <div className="dash-label mb-1">Match Engine</div>
          <div className="font-condensed text-[13px] text-gray-2">
            V1 rule engine · {matchCount} active matches across {activeOpps} opportunit{activeOpps === 1 ? 'y' : 'ies'}
          </div>
          <div className="font-condensed text-[11px] text-gray-3 mt-1.5">
            Readiness 40% · Brand Fit 20% · Audience 15% · Location 10% · Availability 10% · Content 5%
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTRACTS TAB
// ═════════════════════════════════════════════════════════════════════════════
const AC_COLOR: Record<string, string> = {
  draft:'#4a4846', pending_fighter:'#b45309', active:'#166534',
  in_dispute:'#7f1d1d', completed:'#1e3a5f', terminated:'#374151',
}
const AC_LABEL: Record<string, string> = {
  draft:'Draft', pending_fighter:'Awaiting Fighter', active:'Active',
  in_dispute:'In Dispute', completed:'Completed', terminated:'Terminated',
}

function AdminContracts() {
  const { data: metrics, loading: mLoad } = useApi<any>('/api/admin/dashboard')
  const [contracts, setContracts]         = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [statusFilter, setStatusFilter]   = useState('')

  const load = useCallback((status?: string) => {
    setLoading(true); setError('')
    getAdminContracts({ status: status || undefined, limit: 50 })
      .then(r => { setContracts(r.contracts ?? []); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed.'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const handleFilter = (s: string) => {
    setStatusFilter(s)
    load(s || undefined)
  }

  if (mLoad || loading) return <DashSkeleton />
  if (error) return <ApiError message={error} retry={() => load(statusFilter || undefined)} />

  const m = metrics ?? {}

  return (
    <div className="space-y-4">
      <SectionHeading>Contracts</SectionHeading>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard label="Total Contracts"       value={String(m.total_contracts ?? 0)}          sub="All time"         barPct={100} />
        <StatCard label="Active Contracts"       value={String(m.active_contracts ?? 0)}         sub="Live"             barPct={50} barColor="#00c060" />
        <StatCard label="Proofs Pending Review"  value={<span className={(m.proofs_pending_review??0)>0?'text-blood-glow':''}>{m.proofs_pending_review ?? 0}</span>}
          sub="Awaiting sponsor review" barPct={(m.proofs_pending_review??0)>0?30:0} barColor="#c9a82c" />
        <StatCard label="Disputed Contracts"     value={<span className={(m.disputed_contracts??0)>0?'text-blood-glow':''}>{m.disputed_contracts ?? 0}</span>}
          sub="In dispute" barPct={(m.disputed_contracts??0)>0?30:0} barColor="#c00000" />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <StatCard label="Overdue Obligations"   value={<span className={(m.overdue_obligations??0)>0?'text-blood-glow':''}>{m.overdue_obligations ?? 0}</span>}
          sub="Need attention" barPct={(m.overdue_obligations??0)>0?25:0} barColor="#c00000" />
        <StatCard label="Total Obligations"     value={String(m.total_obligations ?? 0)}         sub="All active"       barPct={100} />
        <StatCard label="Completed Obligations" value={String(m.completed_obligations ?? 0)}      sub="All time"         barPct={100} barColor="#00c060" />
      </div>

      {/* Filter + list */}
      <div className="flex gap-2 flex-wrap">
        {['', 'draft', 'pending_fighter', 'active', 'in_dispute', 'completed', 'terminated'].map(s => (
          <button key={s} onClick={() => handleFilter(s)}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{
              borderColor: statusFilter === s ? '#8b0000' : '#222226',
              color:       statusFilter === s ? '#f0ece4' : '#7a7672',
              background:  statusFilter === s ? 'rgba(139,0,0,0.1)' : 'transparent',
            }}>
            {s ? AC_LABEL[s] ?? s : 'All'}
          </button>
        ))}
      </div>

      {!contracts.length ? (
        <EmptyState icon="📄" title="No Contracts" body="No contracts match the current filter." />
      ) : (
        <div className="space-y-2">
          {contracts.map((c: any) => {
            const oblPct = c.obligations_total > 0
              ? Math.round(c.obligations_completed / c.obligations_total * 100) : 0
            return (
              <div key={c.id} className="dash-card flex items-center gap-4"
                style={{ borderLeft: `2px solid ${AC_COLOR[c.status] ?? '#222226'}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                      style={{ background: AC_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                      {AC_LABEL[c.status] ?? c.status}
                    </span>
                    {c.fighter && <span className="font-condensed text-[12px] font-bold text-off-white">{c.fighter.name}</span>}
                    {c.sponsor_detail && <span className="font-condensed text-[11px] text-gray-3">{c.sponsor_detail.company_name}</span>}
                  </div>
                  <div className="font-condensed text-[12px] text-gray-2">
                    ${c.value_usd?.toLocaleString()} · {c.payment_schedule}
                  </div>
                  {c.obligations_total > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div style={{ width: 80, height: 3, background: '#222226', borderRadius: 2 }}>
                        <div style={{ width: `${oblPct}%`, height: '100%', background: oblPct === 100 ? '#00c060' : '#8b0000', borderRadius: 2 }} />
                      </div>
                      <span className="font-condensed text-[10px] text-gray-3">{c.obligations_completed}/{c.obligations_total} obligations</span>
                    </div>
                  )}
                </div>
                <a href={`/contracts/${c.id}`}
                  className="font-condensed text-[10px] text-gray-3 hover:text-off-white no-underline flex-shrink-0 transition-colors">
                  View →
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGING TAB
// ═════════════════════════════════════════════════════════════════════════════
const CONV_STATUS_COLOR: Record<string, string> = {
  open: '#00c060', archived: '#4a4846', locked: '#7f1d1d',
}

function AdminMessaging() {
  const [convs, setConvs]         = useState<any[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setFilter] = useState('')
  const [actingId, setActingId]   = useState<string | null>(null)
  const [msg, setMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback((s?: string) => {
    setLoading(true); setMsg(null)
    getAdminConversationList({ status: s || undefined, limit: 30 })
      .then(r => { setConvs(r.conversations ?? []); setTotal(r.total ?? 0); setLoading(false) })
      .catch(e => { setMsg({ type: 'err', text: e.message ?? 'Failed to load.' }); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const changeStatus = async (id: string, status: 'open' | 'archived' | 'locked') => {
    setActingId(id)
    try {
      await adminLockConversation(id, status)
      setConvs(prev => prev.map(c => c.id === id ? { ...c, status } : c))
      setMsg({ type: 'ok', text: `Conversation ${status}.` })
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Failed.' })
    } finally { setActingId(null) }
  }

  return (
    <div className="space-y-4">
      <SectionHeading>Conversations ({total})</SectionHeading>

      <div className="flex gap-2 flex-wrap">
        {(['', 'open', 'archived', 'locked'] as const).map(s => (
          <button key={s} onClick={() => { setFilter(s); load(s || undefined) }}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{
              borderColor: statusFilter === s ? '#8b0000' : '#222226',
              color:       statusFilter === s ? '#f0ece4' : '#7a7672',
              background:  statusFilter === s ? 'rgba(139,0,0,0.1)' : 'transparent',
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {msg && <ActionMsg msg={msg} />}

      {loading ? <DashSkeleton /> : !convs.length ? (
        <EmptyState icon="💬" title="No Conversations" body="No conversations match the current filter." />
      ) : (
        <div className="space-y-2">
          {convs.map((c: any) => (
            <div key={c.id} className="dash-card flex items-center gap-4"
              style={{ borderLeft: `2px solid ${CONV_STATUS_COLOR[c.status] ?? '#222226'}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                    style={{ background: CONV_STATUS_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                    {c.status ?? 'open'}
                  </span>
                  <span className="font-condensed text-[10px] text-gray-3">{c.context_type}</span>
                </div>
                <div className="font-condensed font-bold text-off-white text-[13px] truncate">
                  {c.subject || `${c.context_type} conversation`}
                </div>
                {c.last_message_at && (
                  <div className="font-condensed text-[10px] text-gray-3 mt-0.5">
                    {new Date(c.last_message_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {c.status !== 'locked' && (
                  <button onClick={() => changeStatus(c.id, 'locked')} disabled={actingId === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                    {actingId === c.id ? <Spinner /> : 'Lock'}
                  </button>
                )}
                {c.status !== 'archived' && (
                  <button onClick={() => changeStatus(c.id, 'archived')} disabled={actingId === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-charcoal-3 transition-all disabled:opacity-40">
                    Archive
                  </button>
                )}
                {c.status !== 'open' && (
                  <button onClick={() => changeStatus(c.id, 'open')} disabled={actingId === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-off-white transition-all disabled:opacity-40">
                    Re-open
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Admin Payments + Memberships ──────────────────────────────────────────────
function AdminPayments() {
  const [payments,    setPayments]    = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [summary,     setSummary]     = useState<{ total_revenue_cents: number; successful: number; failed: number; pending: number } | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getAdminPaymentsList({ limit: 20 }),
      getAdminMembershipsList({ limit: 20 }),
    ])
      .then(([pRes, mRes]) => {
        setPayments(pRes.payments ?? [])
        setSummary(pRes.summary ?? null)
        setMemberships(mRes.memberships ?? [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  const revUsd = ((summary?.total_revenue_cents ?? 0) / 100).toFixed(2)

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Revenue', value: `$${revUsd}` },
          { label: 'Successful', value: summary?.successful ?? 0 },
          { label: 'Failed', value: summary?.failed ?? 0 },
          { label: 'Active Members', value: memberships.filter(m => m.status === 'active').length },
        ].map(s => (
          <div key={s.label} className="dash-card text-center">
            <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">{s.label}</div>
            <div className="font-display text-off-white mt-1" style={{ fontSize: 28 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Payments list */}
      <div>
        <SectionHeading>Recent Package Payments</SectionHeading>
        {!payments.length ? (
          <EmptyState icon="💰" title="No Payments Yet" body="Package payments will appear here after checkout." />
        ) : (
          <div className="space-y-2 mt-3">
            {payments.map(p => (
              <div key={p.id} className="dash-card flex items-center gap-4 flex-wrap text-[13px] font-condensed">
                <div className="flex-1 min-w-0">
                  <div className="text-off-white">{p.user?.name ?? p.user_id}</div>
                  <div className="text-gray-3 text-[11px]">{p.user?.email ?? ''}</div>
                </div>
                <div className="text-gray-2">{p.packages?.name ?? '—'}</div>
                <div className="text-off-white">${((p.amount ?? 0) / 100).toFixed(2)}</div>
                <div style={{ color: p.status === 'succeeded' ? '#00c060' : p.status === 'failed' ? '#C41E3A' : '#c9a82c' }}>
                  {p.status}
                </div>
                <div className="text-gray-3">{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Memberships list */}
      <div>
        <SectionHeading>Active Memberships</SectionHeading>
        {!memberships.length ? (
          <EmptyState icon="🎫" title="No Memberships Yet" body="Memberships will appear here after checkout." />
        ) : (
          <div className="space-y-2 mt-3">
            {memberships.map(m => (
              <div key={m.id} className="dash-card flex items-center gap-4 flex-wrap text-[13px] font-condensed">
                <div className="flex-1 min-w-0">
                  <div className="text-off-white">{m.user?.name ?? m.user_id}</div>
                  <div className="text-gray-3 text-[11px]">{m.user?.email ?? ''}</div>
                </div>
                <div className="text-gray-2">{m.packages?.name ?? '—'}</div>
                <div style={{ color: m.status === 'active' ? '#00c060' : m.status === 'past_due' ? '#c9a82c' : '#C41E3A' }}>
                  {m.status}
                </div>
                {m.current_period_end && (
                  <div className="text-gray-3">expires {new Date(m.current_period_end).toLocaleDateString()}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
const VIEWS: Record<string, React.FC> = {
  overview:     Overview,
  setup:        Setup,
  users:        Users,
  vetting:      SponsorVetting,
  packages:     Packages,
  content:      Content,
  marketplace:  Marketplace,
  contracts:    AdminContracts,
  messaging:    AdminMessaging,
  reports:      Reports,
  mentors:      Mentors,
  sponsorforge: SponsorForgeAdmin,
  payments:     AdminPayments,
}

export default function AdminDashboard() {
  const [active, setActive] = useState(NAV[0].id)
  const { user, logout }    = useAuth()
  const navigate            = useNavigate()
  const V = VIEWS[active] ?? Overview

  return (
    <div className="min-h-screen bg-black flex flex-col" style={{ fontFamily:"'Barlow',sans-serif" }}>

      {/* ── Command Bar ── */}
      <header className="bg-near-black border-b border-charcoal-3 flex items-stretch flex-shrink-0">
        <div className="flex items-center px-5 py-3 border-r border-charcoal-3 flex-shrink-0">
          <Link to="/" className="no-underline inline-block">
            <img src="/logo-white.png" alt="Eleventh Round" style={{ height: 22, width: 'auto' }} />
          </Link>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-charcoal-3 flex-shrink-0">
          <div>
            <div className="font-condensed text-[8px] font-bold tracking-[0.4em] uppercase leading-none mb-0.5"
              style={{ color: '#C41E3A' }}>Platform Admin</div>
            <div className="font-display text-off-white uppercase leading-none" style={{ fontSize: 14 }}>
              Command Center
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-5 px-5 py-3">
          {user && (
            <div className="text-right hidden sm:block">
              <div className="font-condensed text-[11px] font-bold text-off-white leading-tight">{user.name}</div>
              <div className="font-condensed text-[9px] text-gray-3 leading-tight">{user.email}</div>
            </div>
          )}
          <div className="relative cursor-pointer">
            <span className="text-gray-3 hover:text-off-white transition-colors" style={{ fontSize: 17 }}>🔔</span>
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#C41E3A' }} />
          </div>
          <Link to="/" className="font-condensed font-bold uppercase text-gray-3 hover:text-off-white transition-colors no-underline"
            style={{ fontSize: 10, letterSpacing:'0.2em' }}>← Home</Link>
          <button onClick={() => { logout(); navigate('/login') }}
            className="font-condensed font-bold uppercase text-gray-3 hover:text-blood-glow transition-colors bg-transparent border-0 cursor-pointer"
            style={{ fontSize: 10, letterSpacing:'0.25em' }}>Sign Out</button>
        </div>
      </header>

      {/* ── Tab strip ── */}
      <div className="bg-near-black border-b border-charcoal-3 px-4 flex overflow-x-auto flex-shrink-0"
        style={{ scrollbarWidth: 'none' }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)}
            className="font-condensed text-[10px] font-bold tracking-[0.12em] uppercase px-3.5 py-3.5 cursor-pointer border-0 bg-transparent whitespace-nowrap transition-all duration-150 flex items-center gap-1.5"
            style={{
              color:        active === item.id ? '#f0ece4' : '#4a4846',
              borderBottom: active === item.id ? '2px solid #C41E3A' : '2px solid transparent',
              marginBottom: -1,
            }}>
            <span style={{ fontSize: 12 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto p-6 bg-black">
        <V />
      </main>
    </div>
  )
}
