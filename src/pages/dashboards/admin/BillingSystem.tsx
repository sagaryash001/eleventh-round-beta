import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { useApi } from '../../../hooks/useApi'
import {
  getAdminPackages, createPackage, updatePackage,
  sendTestEmail, type AdminPackage,
} from '../../../lib/api/admin'
import { getAdminPaymentsList, getAdminMembershipsList } from '../../../lib/api/billing'
import { DashSkeleton, ApiError, EmptyState, StatCard, ChecklistItem } from '../DashWidgets'
import { TrendLine, StatusPie } from './AdminCharts'
import { SubNav, FField, FSelect, ActionMsg, Spinner } from './AdminUtils'

const TABS = [
  { id: 'packages',     label: 'Packages'     },
  { id: 'payments',     label: 'Payments'     },
  { id: 'memberships',  label: 'Memberships'  },
  { id: 'setup',        label: 'Setup'        },
  { id: 'integrations', label: 'Integrations' },
]

// ── Packages ──────────────────────────────────────────────────────────────────
function PackagesTab() {
  const [packages, setPackages] = useState<AdminPackage[]>([])
  const [stats,    setStats]    = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Omit<AdminPackage, 'features'>> & { features?: string[] }>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', audience: 'fighter', description: '', price_cents: '', billing_interval: 'monthly', features: '', sort_order: '100',
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
    if (!form.name.trim())  { setMsg({ type: 'err', text: 'Name is required.' }); return }
    if (!form.price_cents)  { setMsg({ type: 'err', text: 'Price is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await createPackage({
        name: form.name.trim(), audience: form.audience,
        description: form.description.trim() || null,
        price_cents: Math.round(Number(form.price_cents) * 100),
        billing_interval: form.billing_interval,
        features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
        sort_order: Number(form.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Package created.' })
      setShowForm(false)
      setForm({ name: '', audience: 'fighter', description: '', price_cents: '', billing_interval: 'monthly', features: '', sort_order: '100' })
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Create failed.' })
    } finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    setActingId(id)
    try {
      const updates = { ...editForm }
      if (typeof updates.price_cents === 'string') updates.price_cents = Math.round(Number(updates.price_cents) * 100)
      if (Array.isArray(updates.features)) {/* ok */}
      else if (typeof updates.features === 'string')
        updates.features = (updates.features as any).split('\n').map((s: string) => s.trim()).filter(Boolean)
      await updatePackage(id, updates)
      setPackages(prev => prev.map(p => p.id === id ? { ...p, ...updates } as any : p))
      setEditId(null)
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setActingId(null) }
  }

  const toggleActive = async (pkg: AdminPackage) => {
    setActingId(pkg.id)
    try {
      await updatePackage(pkg.id, { active: !pkg.active })
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, active: !p.active } : p))
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setActingId(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  const fmtPrice = (p: AdminPackage) =>
    `$${(p.price_cents / 100).toFixed(2)}/${p.billing_interval === 'monthly' ? 'mo' : p.billing_interval === 'annual' ? 'yr' : ''}`

  return (
    <div className="space-y-4">
      {stats && (stats.total_active_subscriptions > 0 || stats.mrr_usd > 0) && (
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <StatCard label="Active Subscriptions" value={String(stats.total_active_subscriptions)} sub="Across all tiers" barPct={50} />
          <StatCard label="MRR (est.)" value={`$${stats.mrr_usd}`} sub="Monthly recurring revenue" barPct={50} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">{packages.length} Packages</span>
        <button onClick={() => { setShowForm(v => !v); setMsg(null) }} className="btn-ghost text-[11px] py-2 px-4">
          {showForm ? 'Cancel' : '+ New Package'}
        </button>
      </div>

      {showForm && (
        <div className="dash-card space-y-4" style={{ borderLeft: '2px solid #8b0000' }}>
          <div className="dash-label">New Package</div>
          <div className="grid grid-cols-2 gap-3">
            <FField label="Name" value={form.name} onChange={setF('name')} placeholder="e.g. Pro Fighter" required />
            <FSelect label="Audience" value={form.audience} onChange={setF('audience')}
              options={[{ value: 'fighter', label: 'Fighter' }, { value: 'manager', label: 'Manager' }, { value: 'sponsor', label: 'Sponsor' }, { value: 'all', label: 'All' }]} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FField label="Price (USD)" type="number" value={form.price_cents} onChange={setF('price_cents')} placeholder="99" hint="Whole dollars" required />
            <FSelect label="Billing" value={form.billing_interval} onChange={setF('billing_interval')}
              options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }, { value: 'one_time', label: 'One-time' }]} required />
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
              placeholder={'Feature one\nFeature two'} className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <ActionMsg msg={msg} />
          <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? <><Spinner /> Creating…</> : 'Create Package'}
          </button>
        </div>
      )}

      {!showForm && <ActionMsg msg={msg} />}

      {!packages.length ? (
        <EmptyState icon="○" title="No Packages Yet" body="Create packages above or apply migration 0010 to seed starter packages." />
      ) : (
        <div className="space-y-3">
          {packages.map(pkg => (
            <div key={pkg.id} className="dash-card" style={{ borderLeft: `2px solid ${pkg.active ? '#8b0000' : '#2a2a2e'}` }}>
              {editId === pkg.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <FField label="Name" value={editForm.name ?? pkg.name}
                      onChange={v => setEditForm(p => ({ ...p, name: v }))} />
                    <FField label="Price (USD)" type="number"
                      value={editForm.price_cents !== undefined ? String((editForm.price_cents as number) / 100) : String(pkg.price_cents / 100)}
                      onChange={v => setEditForm(p => ({ ...p, price_cents: Number(v) * 100 as any }))} />
                    <FSelect label="Billing" value={editForm.billing_interval ?? pkg.billing_interval}
                      onChange={v => setEditForm(p => ({ ...p, billing_interval: v }))}
                      options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }, { value: 'one_time', label: 'One-time' }]} />
                  </div>
                  <div>
                    <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">Features (one per line)</label>
                    <textarea
                      value={Array.isArray(editForm.features) ? (editForm.features as string[]).join('\n') : features(pkg.features).join('\n')}
                      onChange={e => setEditForm(p => ({ ...p, features: e.target.value.split('\n') as any }))}
                      rows={4} className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(pkg.id)} disabled={actingId === pkg.id} className="btn-primary text-[11px] py-2 disabled:opacity-50">
                      {actingId === pkg.id ? <Spinner /> : 'Save'}
                    </button>
                    <button onClick={() => { setEditId(null); setEditForm({}) }} className="btn-ghost text-[11px] py-2">Cancel</button>
                  </div>
                </div>
              ) : (
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
                    <button onClick={() => { setEditId(pkg.id); setEditForm({ name: pkg.name, billing_interval: pkg.billing_interval, features: features(pkg.features) }) }}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border border-charcoal-3 text-gray-2 cursor-pointer hover:border-blood hover:text-off-white transition-all">
                      Edit
                    </button>
                    <button onClick={() => toggleActive(pkg)} disabled={actingId === pkg.id}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-50"
                      style={{ borderColor: pkg.active ? '#4a0000' : '#2a5c2a', color: pkg.active ? '#c00000' : '#00c060' }}>
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

// ── Payments ──────────────────────────────────────────────────────────────────
function PaymentsTab() {
  const [payments,  setPayments]  = useState<any[]>([])
  const [summary,   setSummary]   = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const { data: analytics }       = useApi<any>('/api/admin/analytics')

  useEffect(() => {
    setLoading(true)
    getAdminPaymentsList({ limit: 25 })
      .then(r => { setPayments(r.payments ?? []); setSummary(r.summary ?? null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const revUsd    = ((summary?.total_revenue_cents ?? 0) / 100).toFixed(2)
  const monthlyGmv= (analytics?.monthly_gmv ?? []) as { label: string; value: number }[]
  const revenueData = monthlyGmv.map(d => ({ month: d.label, value: d.value }))

  const statusData = [
    { name: 'Succeeded', value: summary?.successful ?? 0, color: '#00c060' },
    { name: 'Failed',    value: summary?.failed     ?? 0, color: '#c00000' },
    { name: 'Pending',   value: summary?.pending    ?? 0, color: '#c9a82c' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="dash-card text-center" style={{ borderTop: '2px solid #00c060' }}>
          <div className="dash-label">Revenue</div>
          <div className="font-display text-off-white mt-1" style={{ fontSize: 28 }}>${revUsd}</div>
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Successful</div>
          <div className="font-display mt-1" style={{ fontSize: 28, color: '#00c060' }}>{summary?.successful ?? 0}</div>
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Failed</div>
          <div className="font-display mt-1" style={{ fontSize: 28, color: (summary?.failed ?? 0) > 0 ? '#c00000' : '#4a4846' }}>{summary?.failed ?? 0}</div>
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Pending</div>
          <div className="font-display mt-1" style={{ fontSize: 28, color: '#c9a82c' }}>{summary?.pending ?? 0}</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Monthly GMV</div>
          <TrendLine data={revenueData} label="GMV $" height={120} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Payment Status</div>
          <StatusPie data={statusData} />
        </div>
      </div>

      {!payments.length ? (
        <EmptyState icon="○" title="No Payments Yet" body="Package payments appear here after checkout." />
      ) : (
        <div className="space-y-2">
          <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">Recent Payments</div>
          {payments.map((p, i) => (
            <div key={p.id ?? i} className="dash-card flex items-center gap-4 flex-wrap text-[13px] font-condensed">
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
  )
}

// ── Memberships ───────────────────────────────────────────────────────────────
function MembershipsTab() {
  const [memberships, setMemberships] = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminMembershipsList({ limit: 30 })
      .then(r => { setMemberships(r.memberships ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const active  = memberships.filter(m => m.status === 'active').length
  const pastDue = memberships.filter(m => m.status === 'past_due').length

  if (!memberships.length) return (
    <EmptyState icon="○" title="No Memberships Yet" body="Memberships appear here after package checkout." />
  )

  const pieData = [
    { name: 'Active',   value: active,                             color: '#00c060' },
    { name: 'Past Due', value: pastDue,                            color: '#c9a82c' },
    { name: 'Other',    value: memberships.length - active - pastDue, color: '#4a4846' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="dash-card text-center" style={{ borderTop: '2px solid #00c060' }}>
          <div className="dash-label">Active Members</div>
          <div className="font-display mt-1" style={{ fontSize: 30, color: '#00c060' }}>{active}</div>
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Past Due</div>
          <div className="font-display mt-1" style={{ fontSize: 30, color: pastDue > 0 ? '#c9a82c' : '#4a4846' }}>{pastDue}</div>
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Total</div>
          <div className="font-display text-off-white mt-1" style={{ fontSize: 30 }}>{memberships.length}</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Status Distribution</div>
          <StatusPie data={pieData} />
        </div>
        <div className="space-y-2">
          {memberships.map((m, i) => (
            <div key={m.id ?? i} className="dash-card flex items-center gap-3 flex-wrap text-[13px] font-condensed">
              <div className="flex-1 min-w-0">
                <div className="text-off-white">{m.user?.name ?? m.user_id}</div>
                <div className="text-gray-3 text-[10px]">{m.user?.email ?? ''}</div>
              </div>
              <div className="text-gray-2">{m.packages?.name ?? '—'}</div>
              <div style={{ color: m.status === 'active' ? '#00c060' : m.status === 'past_due' ? '#c9a82c' : '#C41E3A' }}>
                {m.status}
              </div>
              {m.current_period_end && (
                <div className="text-gray-3 text-[11px]">expires {new Date(m.current_period_end).toLocaleDateString()}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function SetupTab() {
  const { user }                      = useAuth()
  const { data: usersData }           = useApi<any>('/api/admin/users')
  const { data: mentorsData }         = useApi<any>('/api/admin/consultants')
  const { data: contentData }         = useApi<any>('/api/admin/content')
  const { data: pkgData }             = useApi<any>('/api/admin/packages')
  const { data: healthData, loading } = useApi<any>('/api/health')
  const { data: sponsorData }         = useApi<any>('/api/admin/sponsors/pending')

  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [testMsg,   setTestMsg]   = useState('')

  const hasUsers        = (usersData?.total       ?? 0) > 0
  const activeConsultants = (mentorsData?.consultants ?? []).filter((c: any) => c.status === 'active').length
  const hasMentors        = activeConsultants > 0
  const hasModules      = (contentData?.published_modules ?? contentData?.total_modules ?? 0) > 0
  const hasPackages     = (pkgData?.packages?.length ?? 0) > 0
  const emailOk         = !!healthData?.email
  const sendgridOk      = !!healthData?.sendgrid
  const anyEmailOk      = sendgridOk || emailOk
  const supabaseOk      = !!healthData?.supabase
  const noPendingVet    = (sponsorData?.pending?.length ?? 0) === 0
  const pendingVetting  = sponsorData?.pending?.length ?? 0

  const checklist = [
    { done: true,           label: 'Admin account active',        detail: `Signed in as ${user?.email}` },
    { done: supabaseOk,     label: 'Supabase connected',          detail: supabaseOk ? 'Auth and database live' : 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on Render' },
    { done: sendgridOk,     label: 'SendGrid configured',         detail: sendgridOk ? 'Transactional emails active' : 'Set SENDGRID_API_KEY + SENDGRID_FROM_EMAIL' },
    { done: emailOk,        label: 'SMTP fallback configured',    detail: emailOk ? 'SMTP transport available' : 'Optional — set EMAIL_HOST, EMAIL_USER, EMAIL_PASS' },
    { done: hasUsers,       label: 'First users registered',      detail: hasUsers ? `${usersData?.total ?? '?'} users in the system` : 'Share /register to invite users' },
    { done: hasModules,     label: 'Education modules published', detail: hasModules ? `${contentData?.published_modules ?? contentData?.total_modules} published` : 'Go to Education → Modules' },
    { done: hasPackages,    label: 'Packages created',            detail: hasPackages ? `${pkgData?.packages?.length} packages in catalogue` : 'Verify in Billing & System → Packages' },
    { done: hasMentors,     label: 'Consultants / mentors added', detail: hasMentors ? `${activeConsultants} active` : 'Add via Content → Consultants' },
    { done: noPendingVet,   label: 'Sponsor vetting queue clear', detail: noPendingVet ? 'No sponsors awaiting review' : `${pendingVetting} waiting — Users & Vetting → Sponsor Vetting` },
    { done: false,          label: 'Stripe connected (future)',   detail: 'Stripe integration — after packages are confirmed' },
  ]

  const completed = checklist.filter(c => c.done).length

  const handleTestEmail = async () => {
    setTestState('sending'); setTestMsg('')
    try {
      const r = await sendTestEmail(user?.email)
      setTestState('ok'); setTestMsg(`Sent to ${r.sent_to}`)
    } catch (e: any) {
      setTestState('err'); setTestMsg(e.message ?? 'Send failed.')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="dash-card">
        <div className="flex items-center justify-between mb-4">
          <div className="dash-label">Platform Setup Progress</div>
          <div className="font-condensed font-bold text-off-white" style={{ fontSize: 13 }}>
            {completed} / {checklist.length}
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

      {anyEmailOk && (
        <div className="dash-card" style={{ borderLeft: '2px solid #222226' }}>
          <div className="dash-label mb-3">Email Delivery Test</div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleTestEmail} disabled={testState === 'sending'}
              className="font-condensed font-bold uppercase text-[11px] tracking-[0.15em] px-4 py-2.5 border cursor-pointer transition-all disabled:opacity-40"
              style={{ borderColor: '#8b0000', color: '#C41E3A', background: 'rgba(139,0,0,0.08)' }}>
              {testState === 'sending' ? 'Sending…' : `Send test to ${user?.email}`}
            </button>
            {testMsg && (
              <span className="font-condensed text-[12px]"
                style={{ color: testState === 'ok' ? '#00c060' : '#C41E3A' }}>
                {testMsg}
              </span>
            )}
          </div>
          <p className="font-condensed text-[11px] text-gray-3 mt-2">
            {sendgridOk ? 'Using SendGrid' : 'Using SMTP fallback'}
          </p>
        </div>
      )}

      <div className="dash-card" style={{ borderLeft: '2px solid #8b0000' }}>
        <div className="dash-label mb-2">Handoff Notes</div>
        <ul className="space-y-2 font-body text-gray-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <li>• Admin email: <strong className="text-off-white">lekakevin679@gmail.com</strong></li>
          <li>• Change password: Supabase → Auth → Users → Reset password</li>
          <li>• Vet sponsors: <strong className="text-off-white">Users & Vetting → Sponsor Vetting</strong></li>
          <li>• Publish modules: <strong className="text-off-white">Education → Modules</strong></li>
          <li>• Edit packages: <strong className="text-off-white">Billing & System → Packages</strong></li>
        </ul>
      </div>
    </div>
  )
}

// ── Integrations ──────────────────────────────────────────────────────────────
function IntegrationsTab() {
  const { data: health, loading } = useApi<any>('/api/health')
  if (loading) return <DashSkeleton />

  const integrations = [
    {
      name: 'Supabase', ok: !!health?.supabase, na: false,
      detail: health?.supabase ? 'Auth + Postgres DB + Storage connected' : 'Not connected',
      env: 'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    },
    {
      name: 'SendGrid', ok: !!health?.sendgrid, na: false,
      detail: health?.sendgrid ? 'Transactional email active' : 'Not configured',
      env: 'SENDGRID_API_KEY, SENDGRID_FROM_EMAIL',
    },
    {
      name: 'SMTP Fallback', ok: !!health?.email, na: false,
      detail: health?.email ? 'SMTP transport available' : 'Not configured (optional)',
      env: 'EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_FROM',
    },
    {
      name: 'Stripe', ok: false, na: true,
      detail: 'Payout integration not connected',
      env: 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET',
    },
    {
      name: 'API Server', ok: true, na: false,
      detail: 'Express backend running',
      env: 'PORT, NODE_ENV, CLIENT_URL',
    },
  ]

  return (
    <div className="space-y-3">
      {integrations.map(s => (
        <div key={s.name} className="dash-card"
          style={{ borderLeft: `3px solid ${s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000'}` }}>
          <div className="flex items-start gap-3">
            <span style={{
              width: 9, height: 9, borderRadius: '50%', flexShrink: 0, display: 'inline-block', marginTop: 3,
              background: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000',
              boxShadow:  s.na ? 'none' : s.ok ? '0 0 6px #00c06055' : '0 0 6px #c0000055',
            }} />
            <div className="flex-1 min-w-0">
              <div className="font-condensed text-[13px] font-bold text-off-white">{s.name}</div>
              <div className="font-condensed text-[11px] text-gray-2 mt-0.5">{s.detail}</div>
              <div className="font-condensed text-[10px] text-gray-3 mt-1">
                Env vars: <code className="text-off-white/70">{s.env}</code>
              </div>
            </div>
            <span className="font-condensed text-[9px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5"
              style={{ color: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000' }}>
              {s.na ? 'N/A' : s.ok ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Zone export ───────────────────────────────────────────────────────────────
export default function BillingSystem() {
  const [sub, setSub] = useState('packages')
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'packages'     && <PackagesTab />}
      {sub === 'payments'     && <PaymentsTab />}
      {sub === 'memberships'  && <MembershipsTab />}
      {sub === 'setup'        && <SetupTab />}
      {sub === 'integrations' && <IntegrationsTab />}
    </div>
  )
}
