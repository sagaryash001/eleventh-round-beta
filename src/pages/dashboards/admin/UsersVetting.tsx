import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import {
  getAdminUsers, updateAdminUser, getPendingSponsors, verifySponsor,
  type AdminUser, type PendingSponsor,
} from '../../../lib/api/admin'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { RoleDonut, DistBar } from './AdminCharts'
import { SubNav, ActionMsg, Spinner } from './AdminUtils'

const TABS = [
  { id: 'users',      label: 'Users'          },
  { id: 'vetting',    label: 'Sponsor Vetting' },
  { id: 'onboarding', label: 'Onboarding'     },
  { id: 'suspended',  label: 'Suspended'       },
]

// ── Users ─────────────────────────────────────────────────────────────────────
function UsersTab() {
  const { user: me }             = useAuth()
  const [roleFilter, setRole]    = useState('')
  const [statusFilter, setStatus]= useState('')
  const [search, setSearch]      = useState('')
  const [users, setUsers]        = useState<AdminUser[]>([])
  const [total, setTotal]        = useState(0)
  const [loading, setLoading]    = useState(true)
  const [error, setError]        = useState<string | null>(null)
  const [msg, setMsg]            = useState<{ id: string; type: 'ok' | 'err'; text: string } | null>(null)
  const [acting, setActing]      = useState<string | null>(null)

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
    } finally { setActing(null) }
  }

  const ROLES = ['fighter', 'manager', 'sponsor', 'admin']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">
          {total} Users
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none w-52"
          style={{ borderColor: search ? '#8b0000' : '#222226' }} />
        <div className="flex gap-1.5 flex-wrap">
          {['', ...ROLES].map(r => (
            <button key={r} onClick={() => setRole(r)}
              className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-2.5 py-1.5 border transition-all cursor-pointer"
              style={{
                borderColor: roleFilter === r ? '#8b0000' : '#222226',
                background:  roleFilter === r ? 'rgba(139,0,0,0.12)' : '#141416',
                color:       roleFilter === r ? '#f0ece4' : '#7a7672',
              }}>
              {r || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[{ v: '', l: 'Any Status' }, { v: 'active', l: 'Active' }, { v: 'suspended', l: 'Suspended' }].map(s => (
            <button key={s.v} onClick={() => setStatus(s.v)}
              className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-2.5 py-1.5 border transition-all cursor-pointer"
              style={{
                borderColor: statusFilter === s.v ? '#8b0000' : '#222226',
                background:  statusFilter === s.v ? 'rgba(139,0,0,0.12)' : '#141416',
                color:       statusFilter === s.v ? '#f0ece4' : '#7a7672',
              }}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {loading && <DashSkeleton />}
      {error   && <ApiError message={error} />}
      {!loading && !error && !users.length && (
        <EmptyState icon="○" title="No Users Found" body="No users match the current filter." />
      )}

      {!loading && users.map(u => {
        const isSelf    = u.id === me?.id
        const suspended = u.status === 'suspended'
        const rowMsg    = msg?.id === u.id ? { type: msg.type, text: msg.text } : null
        return (
          <div key={u.id} className="dash-card space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-7 h-7 bg-charcoal-3 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-condensed text-[10px] font-bold text-gray-2">{(u.name ?? '?')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-condensed text-[13px] font-bold text-off-white truncate">
                  {u.name} {isSelf && <span className="text-blood-glow text-[10px]">(you)</span>}
                </div>
                <div className="font-condensed text-[10px] text-gray-3">{u.email}</div>
              </div>
              <span className={`badge ${u.role === 'fighter' ? 'badge-yellow' : u.role === 'manager' ? 'badge-green' : u.role === 'sponsor' ? 'badge-red' : 'badge-yellow'}`}>
                {u.role}
              </span>
              <span className={`badge ${!u.status || u.status === 'active' ? 'badge-green' : u.status === 'suspended' ? 'badge-red' : 'badge-yellow'}`}>
                {u.status || 'active'}
              </span>
              <span className={`font-condensed text-[9px] uppercase tracking-widest ${u.onboarding_complete ? 'text-green-500' : 'text-gray-3'}`}>
                {u.onboarding_complete ? '✓ Onboarded' : '○ Pending'}
              </span>
              <span className="font-condensed text-[10px] text-gray-3 hidden sm:block">
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {!isSelf && (
                <button
                  onClick={() => act(u.id, { status: suspended ? 'active' : 'suspended' }, suspended ? 'Reactivated' : 'Suspended')}
                  disabled={acting === u.id}
                  className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-50 flex-shrink-0"
                  style={{
                    borderColor: suspended ? '#2a5c2a' : '#4a0000',
                    color:       suspended ? '#00c060' : '#c00000',
                  }}>
                  {acting === u.id ? <Spinner /> : suspended ? 'Reactivate' : 'Suspend'}
                </button>
              )}
            </div>
            {rowMsg && <ActionMsg msg={rowMsg} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Sponsor Vetting ───────────────────────────────────────────────────────────
function VettingTab() {
  const [pending, setPending]   = useState<PendingSponsor[]>([])
  const [verified, setVerified] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [acting, setActing]     = useState<string | null>(null)
  const [msgs, setMsgs]         = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({})

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
      setMsgs(prev => ({ ...prev, [userId]: { type: 'ok', text: approved ? '✓ Approved' : '✗ Rejected' } }))
      load()
    } catch (e: any) {
      setMsgs(prev => ({ ...prev, [userId]: { type: 'err', text: e.message ?? 'Failed.' } }))
    } finally { setActing(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  return (
    <div className="space-y-6">
      {/* Pending */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">
            Pending ({pending.length})
          </span>
          {pending.length > 0 && (
            <span className="font-condensed text-[9px] font-bold px-1.5 py-0.5"
              style={{ background: '#c9a82c22', color: '#c9a82c', border: '1px solid #c9a82c44' }}>
              Requires Action
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <EmptyState icon="✓" title="No Pending Sponsors" body="All sponsors have been reviewed." />
        ) : (
          <div className="space-y-4">
            {pending.map(sp => (
              <div key={sp.user_id} className="dash-card space-y-3" style={{ borderLeft: '2px solid #c9a82c' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-condensed font-bold text-off-white" style={{ fontSize: 15 }}>{sp.company_name}</div>
                    <div className="font-condensed text-[11px] text-gray-3 mt-0.5">{sp.profiles?.email} · {sp.profiles?.name}</div>
                    <div className="font-condensed text-[11px] text-gray-2 mt-2 space-y-0.5">
                      {sp.industry && <div><span className="text-gray-3">Industry: </span>{sp.industry}</div>}
                      {sp.website_url && (
                        <div><span className="text-gray-3">Website: </span>
                          <a href={sp.website_url} target="_blank" rel="noopener noreferrer"
                            className="text-blood-glow no-underline hover:underline">{sp.website_url}</a>
                        </div>
                      )}
                      {(sp.budget_min_usd || sp.budget_max_usd) && (
                        <div><span className="text-gray-3">Budget: </span>${sp.budget_min_usd ?? 0}–${sp.budget_max_usd ?? '∞'}/yr</div>
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
                    <button onClick={() => act(sp.user_id, true)} disabled={acting === sp.user_id}
                      className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-4 py-2 border cursor-pointer transition-all disabled:opacity-50"
                      style={{ borderColor: '#2a5c2a', color: '#00c060', background: 'rgba(0,192,96,0.08)' }}>
                      {acting === sp.user_id ? <Spinner /> : '✓ Approve'}
                    </button>
                    <button onClick={() => act(sp.user_id, false)} disabled={acting === sp.user_id}
                      className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-4 py-2 border cursor-pointer transition-all disabled:opacity-50"
                      style={{ borderColor: '#4a0000', color: '#c00000', background: 'rgba(139,0,0,0.08)' }}>
                      {acting === sp.user_id ? <Spinner /> : '✗ Reject'}
                    </button>
                  </div>
                </div>
                {msgs[sp.user_id] && <ActionMsg msg={msgs[sp.user_id]} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified */}
      {verified.length > 0 && (
        <div>
          <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-3">
            Verified ({verified.length})
          </div>
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
                <div className="font-condensed text-[10px] text-gray-3">{sp.industry || '—'}</div>
                <span className="badge badge-green">Verified</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onboarding Analytics ──────────────────────────────────────────────────────
function OnboardingTab() {
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminUsers({ limit: 200 })
      .then(d => { setUsers(d.users); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />
  if (!users.length) return <EmptyState icon="○" title="No Users Yet" body="Users will appear here once registered." />

  const done     = users.filter(u => u.onboarding_complete).length
  const notDone  = users.length - done
  const byRole   = ['fighter', 'manager', 'sponsor', 'admin'].map(role => ({
    label: role.charAt(0).toUpperCase() + role.slice(1),
    value: users.filter(u => u.role === role).length,
    color: role === 'fighter' ? '#C41E3A' : role === 'manager' ? '#c9a82c' : role === 'sponsor' ? '#00c060' : '#4a4846',
  }))
  const donutData = [
    { name: 'Complete',   value: done,    color: '#00c060' },
    { name: 'Incomplete', value: notDone, color: '#C41E3A' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="dash-card text-center">
          <div className="dash-label">Total Users</div>
          <div className="font-display text-off-white mt-1" style={{ fontSize: 34 }}>{users.length}</div>
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Onboarded</div>
          <div className="font-display mt-1" style={{ fontSize: 34, color: '#00c060' }}>{done}</div>
          <div className="dash-sub">{users.length > 0 ? Math.round(done / users.length * 100) : 0}% complete</div>
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Pending Onboarding</div>
          <div className="font-display mt-1" style={{ fontSize: 34, color: notDone > 0 ? '#c9a82c' : '#4a4846' }}>{notDone}</div>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Completion Rate</div>
          <RoleDonut data={donutData} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Users by Role</div>
          <DistBar data={byRole} />
        </div>
      </div>
    </div>
  )
}

// ── Suspended Users ───────────────────────────────────────────────────────────
function SuspendedTab() {
  const { user: me }         = useAuth()
  const [users, setUsers]    = useState<AdminUser[]>([])
  const [loading, setLoading]= useState(true)
  const [error, setError]    = useState<string | null>(null)
  const [acting, setActing]  = useState<string | null>(null)
  const [msgs, setMsgs]      = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({})

  const load = useCallback(() => {
    setLoading(true)
    getAdminUsers({ status: 'suspended' })
      .then(d => { setUsers(d.users); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const reactivate = async (id: string) => {
    setActing(id)
    try {
      await updateAdminUser(id, { status: 'active' })
      setMsgs(prev => ({ ...prev, [id]: { type: 'ok', text: 'Reactivated.' } }))
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (e: any) {
      setMsgs(prev => ({ ...prev, [id]: { type: 'err', text: e.message ?? 'Failed.' } }))
    } finally { setActing(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />
  if (!users.length) return (
    <EmptyState icon="✓" title="No Suspended Users" body="No users are currently suspended." />
  )

  return (
    <div className="space-y-3">
      <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">{users.length} Suspended</div>
      {users.map(u => (
        <div key={u.id} className="dash-card space-y-2" style={{ borderLeft: '2px solid #4a0000' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="font-condensed text-[13px] font-bold text-off-white truncate">{u.name}</div>
              <div className="font-condensed text-[10px] text-gray-3">{u.email} · {u.role}</div>
            </div>
            <span className="badge badge-red">Suspended</span>
            <span className="font-condensed text-[10px] text-gray-3">
              {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {u.id !== me?.id && (
              <button onClick={() => reactivate(u.id)} disabled={acting === u.id}
                className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border cursor-pointer disabled:opacity-50 flex-shrink-0"
                style={{ borderColor: '#2a5c2a', color: '#00c060' }}>
                {acting === u.id ? <Spinner /> : 'Reactivate'}
              </button>
            )}
          </div>
          {msgs[u.id] && <ActionMsg msg={msgs[u.id]} />}
        </div>
      ))}
    </div>
  )
}

// ── Zone export ───────────────────────────────────────────────────────────────
export default function UsersVetting({ initialTab }: { initialTab?: string }) {
  // Deep-link target (e.g. from the Command Center action queue → Sponsor Vetting).
  const [sub, setSub] = useState(
    TABS.some(t => t.id === initialTab) ? (initialTab as string) : 'users',
  )
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'users'      && <UsersTab />}
      {sub === 'vetting'    && <VettingTab />}
      {sub === 'onboarding' && <OnboardingTab />}
      {sub === 'suspended'  && <SuspendedTab />}
    </div>
  )
}
