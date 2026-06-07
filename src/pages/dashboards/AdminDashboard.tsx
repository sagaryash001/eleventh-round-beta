import React, { useState, useEffect, useCallback } from 'react'
import DashShell from './DashShell'
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
  type AdminUser, type PendingSponsor, type AdminModule, type AdminPackage,
} from '../../lib/api/admin'
import { adminRecompute } from '../../lib/api/opportunities'

const NAV = [
  { id: 'overview',    label: 'Overview',        icon: '◈' },
  { id: 'setup',       label: 'Setup Checklist', icon: '✓' },
  { id: 'users',       label: 'Users',           icon: '👥' },
  { id: 'vetting',     label: 'Sponsor Vetting', icon: '🛡' },
  { id: 'packages',    label: 'Packages',        icon: '📦' },
  { id: 'content',     label: 'Modules',         icon: '📚' },
  { id: 'marketplace', label: 'Marketplace',     icon: '🤝' },
  { id: 'contracts',   label: 'Contracts',       icon: '📄' },
  { id: 'reports',     label: 'Reports',         icon: '📊' },
  { id: 'mentors',     label: 'Mentors',         icon: '🎯' },
  { id: 'sponsorforge',label: 'SponsorForge',    icon: '⚡' },
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
// OVERVIEW
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

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const m = metrics ?? {}
  const alerts = overviewData?.alerts ?? []
  const pendingVetting = overviewData?.pending_vetting ?? 0

  return (
    <div className="space-y-4">
      <SectionHeading>Platform Overview</SectionHeading>

      {/* Key counts */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard label="Total Users"    value={String(m.total_users ?? 0)}  sub="All roles"   barPct={Math.min(m.total_users ?? 0, 100)} />
        <StatCard label="Fighters"       value={String(m.fighters ?? 0)}     sub="Registered"  barPct={(m.total_users ?? 0) > 0 ? Math.round((m.fighters ?? 0) / m.total_users * 100) : 0} />
        <StatCard label="Managers"       value={String(m.managers ?? 0)}     sub="Active"      barPct={(m.total_users ?? 0) > 0 ? Math.round((m.managers ?? 0) / m.total_users * 100) : 0} />
        <StatCard label="Sponsors"       value={String(m.sponsors ?? 0)}     sub={pendingVetting > 0 ? `${pendingVetting} pending vetting` : 'Registered'}
          barPct={(m.total_users ?? 0) > 0 ? Math.round((m.sponsors ?? 0) / m.total_users * 100) : 0}
          barColor={pendingVetting > 0 ? '#c9a82c' : '#c00000'} />
      </div>

      {/* Marketplace stats */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard label="Active Opportunities" value={String(m.active_opportunities ?? 0)} sub="Published" barPct={50} />
        <StatCard label="Applications"         value={String(m.total_applications ?? 0)}   sub="All time"  barPct={50} />
        <StatCard label="Active Contracts"     value={String(m.active_contracts ?? 0)}     sub="Live"      barPct={50} />
        <div className="dash-card text-center">
          <div className="dash-label">Revenue</div>
          <div className="font-display text-off-white" style={{ fontSize: 28 }}>
            {(m.total_revenue_usd ?? 0) > 0 ? `$${(m.total_revenue_usd / 100).toFixed(0)}` : '$0'}
          </div>
          <div className="dash-sub">From succeeded payments</div>
        </div>
      </div>

      {/* Obligations */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <StatCard label="Total Obligations" value={String(m.total_obligations ?? 0)}    sub="All active"  barPct={100} />
        <StatCard label="Overdue"           value={<span className={(m.overdue_obligations??0)>0?'text-blood-glow':''}>{m.overdue_obligations ?? 0}</span>}
          sub="Need attention" barPct={(m.overdue_obligations??0)>0?30:0} barColor="#c00000" />
        <StatCard label="Completed"         value={String(m.completed_obligations ?? 0)} sub="All time"   barPct={100} barColor="#00c060" />
      </div>

      {pendingVetting > 0 && (
        <div className="px-4 py-3 border border-charcoal-3" style={{ borderLeft: '3px solid #c9a82c', background: 'rgba(201,168,44,0.06)' }}>
          <p className="font-condensed font-bold text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: '#c9a82c' }}>
            Action Required
          </p>
          <p className="font-body text-gray-2" style={{ fontSize: 13 }}>
            {pendingVetting} sponsor{pendingVetting > 1 ? 's' : ''} pending vetting — go to the <strong className="text-off-white">Sponsor Vetting</strong> tab to review.
          </p>
        </div>
      )}

      {alerts.length > 0
        ? <ListCard label="System Alerts" items={alerts} />
        : <EmptyState icon="✓" title="No Active Alerts" body="The platform has no unresolved alerts." />
      }
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

  const hasUsers          = (usersData?.total ?? 0) > 0
  const hasMentors        = (mentorsData?.active_consultants ?? 0) > 0
  const hasModules        = (contentData?.published_modules ?? contentData?.total_modules ?? 0) > 0
  const hasPackages       = (pkgData?.packages?.length ?? 0) > 0
  const emailConfigured   = !!healthData?.email
  const supabaseOk        = !!healthData?.supabase
  const pendingVetting    = (sponsorData?.pending?.length ?? 0)
  const noPendingVetting  = pendingVetting === 0

  const checklist = [
    { done: true,          label: 'Admin account active',         detail: `Signed in as ${user?.email}` },
    { done: supabaseOk,    label: 'Supabase connected',           detail: supabaseOk ? 'Auth and database live' : 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on Render' },
    { done: emailConfigured,label:'Email (SMTP) configured',      detail: emailConfigured ? 'Verification emails enabled' : 'Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS on Render' },
    { done: hasUsers,      label: 'First users registered',       detail: hasUsers ? `${usersData?.total ?? '?'} users in the system` : 'Share /register to invite fighters, managers, sponsors' },
    { done: hasModules,    label: 'Education modules published',   detail: hasModules ? `${contentData?.published_modules ?? contentData?.total_modules} published` : 'Go to Modules tab and publish the seeded modules' },
    { done: hasPackages,   label: 'Packages created',             detail: hasPackages ? `${pkgData?.packages?.length} packages in catalogue` : 'Packages were seeded — verify in Packages tab' },
    { done: hasMentors,    label: 'Consultants / mentors added',  detail: hasMentors ? `${mentorsData?.active_consultants} active` : 'Add consultants via Supabase or the Mentors tab' },
    { done: noPendingVetting, label: 'Sponsor vetting queue clear', detail: noPendingVetting ? 'No sponsors awaiting review' : `${pendingVetting} sponsor${pendingVetting > 1 ? 's' : ''} waiting for approval` },
    { done: false,         label: 'Stripe connected (future)',    detail: 'Stripe integration — do this after packages are confirmed' },
  ]

  const completed = checklist.filter(c => c.done).length

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

function Content() {
  const [modules,  setModules]  = useState<AdminModule[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ type:'ok'|'err'; text:string }|null>(null)
  const [toggleId, setToggleId] = useState<string|null>(null)

  const [form, setForm] = useState({ name:'', description:'', category:'', order_num:'100', is_published:false, estimated_mins:'' })
  const setF = (k: keyof typeof form) => (v: string|boolean) => setForm(p => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getAdminModules()
      .then(d => { setModules(d.modules); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ type:'err', text:'Module name is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await createModule({
        name:           form.name.trim(),
        description:    form.description.trim() || null,
        category:       form.category || null,
        order_num:      Number(form.order_num) || 100,
        is_published:   form.is_published,
        estimated_mins: form.estimated_mins ? Number(form.estimated_mins) : null,
      })
      setMsg({ type:'ok', text:'Module created.' })
      setShowForm(false)
      setForm({ name:'', description:'', category:'', order_num:'100', is_published:false, estimated_mins:'' })
      load()
    } catch (e: any) {
      setMsg({ type:'err', text: e.message ?? 'Create failed.' })
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (m: AdminModule) => {
    setToggleId(m.id)
    try {
      await updateModule(m.id, { is_published: !m.is_published })
      setModules(prev => prev.map(x => x.id === m.id ? { ...x, is_published: !m.is_published } : x))
    } catch (e: any) {
      setMsg({ type:'err', text: e.message })
    } finally {
      setToggleId(null)
    }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Education Modules ({modules.length})</SectionHeading>
        <button onClick={() => { setShowForm(v => !v); setMsg(null) }}
          className="btn-ghost text-[11px] py-2 px-4">
          {showForm ? 'Cancel' : '+ New Module'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="dash-card space-y-4" style={{ borderLeft: '2px solid #8b0000' }}>
          <div className="dash-label">New Module</div>
          <div className="grid grid-cols-2 gap-3">
            <FField label="Module Name" value={form.name} onChange={setF('name')} placeholder="e.g. Taxes & Filing" required />
            <FField label="Order #" type="number" value={form.order_num} onChange={setF('order_num')} hint="Lower = shown first" />
          </div>
          <FSelect label="Category" value={form.category} onChange={setF('category') as any}
            options={CATEGORIES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setF('description')(e.target.value)} rows={3}
              placeholder="What will fighters learn in this module?"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FField label="Est. Minutes" type="number" value={form.estimated_mins} onChange={setF('estimated_mins')} placeholder="30" />
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_published} onChange={e => setF('is_published')(e.target.checked)}
                  className="w-4 h-4 accent-red-700 cursor-pointer" />
                <span className="font-condensed text-[11px] text-gray-2 uppercase tracking-widest">Publish immediately</span>
              </label>
            </div>
          </div>
          <ActionMsg msg={msg} />
          <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50"
            style={{ display:'flex', alignItems:'center', gap:8 }}>
            {saving ? <><Spinner /> Creating…</> : 'Create Module'}
          </button>
        </div>
      )}

      {!showForm && <ActionMsg msg={msg} />}

      {!modules.length ? (
        <EmptyState icon="📚" title="No Modules Yet" body="Create your first education module above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['#', 'Name', 'Category', 'Enrolled', 'Avg %', 'Status', 'Actions'].map(h => (
                  <th key={h} className="font-condensed text-[10px] font-bold uppercase tracking-[0.2em] text-gray-3 px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(m => (
                <tr key={m.id} className="border-b border-charcoal-3 last:border-0 hover:bg-charcoal-2/30 transition-colors">
                  <td className="font-condensed text-[12px] text-gray-3 px-4 py-3">{m.order_num}</td>
                  <td className="font-condensed font-bold text-[13px] text-off-white px-4 py-3">{m.name}</td>
                  <td className="font-condensed text-[11px] text-gray-2 px-4 py-3 capitalize">{m.category || '—'}</td>
                  <td className="font-condensed text-[12px] text-gray-2 px-4 py-3">{m.enrolled_count}</td>
                  <td className="font-condensed text-[12px] text-gray-2 px-4 py-3">{m.avg_completion}%</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${m.is_published ? 'badge-green' : 'badge-yellow'}`}>
                      {m.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublish(m)}
                      disabled={toggleId === m.id}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-50"
                      style={{
                        borderColor: m.is_published ? '#4a0000' : '#2a5c2a',
                        color:       m.is_published ? '#c00000' : '#00c060',
                        background:  'transparent',
                      }}>
                      {toggleId === m.id ? <Spinner /> : m.is_published ? 'Unpublish' : 'Publish'}
                    </button>
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
const VIEWS: Record<string, React.FC> = {
  overview:    Overview,
  setup:       Setup,
  users:       Users,
  vetting:     SponsorVetting,
  packages:    Packages,
  content:     Content,
  marketplace: Marketplace,
  contracts:   AdminContracts,
  reports:     Reports,
  mentors:     Mentors,
  sponsorforge:SponsorForgeAdmin,
}

export default function AdminDashboard() {
  return (
    <DashShell navItems={NAV} title="Admin Dashboard" subtitle="Platform Administration">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
