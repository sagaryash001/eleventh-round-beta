import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashShell from './DashShell'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { DashSkeleton, EmptyState, ApiError, SectionHeading } from './DashWidgets'
import { getSponsorDashboard, updateSponsorProfile, type SponsorProfile } from '../../lib/api/sponsors'
import { getMyOpportunities, changeOpportunityStatus, type Opportunity } from '../../lib/api/opportunities'
import { getContracts, type Contract } from '../../lib/api/contracts'
import ImageUpload from '../../components/ImageUpload'
import { storageUrl } from '../../lib/api/public'

const NAV = [
  { id: 'overview',    label: 'Overview',    icon: '◈' },
  { id: 'campaigns',   label: 'Campaigns',   icon: '🎯' },
  { id: 'contracts',   label: 'Contracts',   icon: '📄' },
  { id: 'analytics',   label: 'Analytics',   icon: '📊' },
  { id: 'profile',     label: 'Company',     icon: '🏢' },
  { id: 'preferences', label: 'Preferences', icon: '⚙' },
]

const WEIGHT_CLASSES = [
  'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight',
  'Middleweight', 'Light Heavyweight', 'Heavyweight',
  "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight",
]
const PROMOTIONS = ['UFC', 'ONE Championship', 'PFL', 'Bellator', 'Regional / Other']
const GOALS = [
  { value: 'awareness',  label: 'Brand Awareness' },
  { value: 'conversion', label: 'Conversions / Sales' },
  { value: 'content',    label: 'Content Creation' },
  { value: 'hiring',     label: 'Recruiting / Hiring' },
  { value: 'merch',      label: 'Merch & Apparel' },
]

// ── shared UI ──────────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-charcoal border border-charcoal-3 p-6" style={{ borderLeft: '2px solid #8b0000' }}>
      {children}
    </div>
  )
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">{children}</label>
}
function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const [f, setF] = useState(false)
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
      className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all placeholder:text-gray-3"
      style={{ borderColor: f ? '#8b0000' : '#222226' }} />
  )
}
function Chips({ options, selected, onToggle }: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = selected.includes(o.value)
        return (
          <button key={o.value} type="button" onClick={() => onToggle(o.value)}
            className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3.5 py-2 border cursor-pointer transition-all"
            style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : '#141416', color: on ? '#f0ece4' : '#7a7672' }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Sponsor Campaigns tab ─────────────────────────────────────────────────────
const OPP_STATUS_COLOR: Record<string, string> = {
  draft: '#7a7672', published: '#00c060', closed: '#4a4846', archived: '#4a4846',
}

function SponsorCampaigns({ isVerified }: { isVerified: boolean }) {
  const [opps,    setOpps]    = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string|null>(null)
  const [actingId, setActingId] = useState<string|null>(null)
  const [msg, setMsg] = useState<{type:'ok'|'err';text:string}|null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getMyOpportunities()
      .then(d => { setOpps(d.data ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const handleStatus = async (id: string, status: 'closed'|'draft') => {
    setActingId(id); setMsg(null)
    try {
      await changeOpportunityStatus(id, status)
      setMsg({ type:'ok', text: status === 'closed' ? 'Opportunity closed.' : 'Reopened as draft.' })
      load()
    } catch (e: any) {
      setMsg({ type:'err', text: e.message ?? 'Failed.' })
    } finally { setActingId(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeading>Campaigns ({opps.length})</SectionHeading>
        <div className="flex gap-2">
          {!isVerified && (
            <span className="font-condensed text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 border"
              style={{ borderColor:'#c9a82c', color:'#c9a82c' }}>
              Pending Vetting — Cannot Publish
            </span>
          )}
          <Link to="/sponsor/opportunities/new"
            className="btn-primary text-[11px] py-2 px-4 no-underline">+ New Campaign</Link>
        </div>
      </div>

      {msg && <p className={`font-condensed text-[11px] ${msg.type==='ok'?'text-green-400':'text-blood-glow'}`}>{msg.text}</p>}

      {!opps.length ? (
        <EmptyState icon="🎯" title="No Campaigns Yet"
          body="Create your first sponsorship campaign to start connecting with fighters." />
      ) : (
        <div className="space-y-2">
          {opps.map(o => (
            <div key={o.id} className="dash-card flex items-center gap-4"
              style={{ borderLeft:`2px solid ${OPP_STATUS_COLOR[o.status]??'#222226'}` }}>
              <div className="flex-1 min-w-0">
                <div className="font-condensed font-bold text-off-white text-[14px] truncate">{o.title}</div>
                <div className="flex items-center gap-4 mt-1 font-condensed text-[11px]">
                  <span style={{ color: OPP_STATUS_COLOR[o.status]??'#7a7672' }}>{o.status.toUpperCase()}</span>
                  <span className="text-gray-3">{o.application_count??0} applicants</span>
                  <span className="text-gray-3">{o.view_count??0} views</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {o.status === 'published' && (
                  <>
                    <Link to={`/sponsor/opportunities/${o.id}/applicants`}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border border-charcoal-3 text-gray-2 no-underline hover:border-blood hover:text-off-white transition-all">
                      Applicants
                    </Link>
                    <button onClick={() => handleStatus(o.id, 'closed')} disabled={actingId===o.id}
                      className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                      {actingId===o.id?'…':'Close'}
                    </button>
                  </>
                )}
                {(o.status === 'draft' || o.status === 'closed') && (
                  <Link to={`/sponsor/opportunities/${o.id}/edit`}
                    className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border border-charcoal-3 text-gray-2 no-underline hover:border-blood hover:text-off-white transition-all">
                    Edit
                  </Link>
                )}
                {o.status === 'closed' && (
                  <button onClick={() => handleStatus(o.id, 'draft')} disabled={actingId===o.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-off-white transition-all disabled:opacity-40">
                    {actingId===o.id?'…':'Reopen'}
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

// ── Vetting banner ─────────────────────────────────────────────────────────────
function VettingBanner() {
  return (
    <div className="px-5 py-4 border border-charcoal-3 mb-6"
         style={{ borderLeft: '3px solid #c9a82c', background: 'rgba(201,168,44,0.06)' }}>
      <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] mb-2"
           style={{ color: '#c9a82c' }}>Pending Admin Vetting</div>
      <p className="font-body text-gray-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
        Your sponsor profile is under review by our admin team. This usually takes 24–48 hours.
        Once approved, you can publish opportunities and contact fighters.
        You can prepare campaigns in the meantime.
      </p>
    </div>
  )
}

// ── Sponsor Analytics ──────────────────────────────────────────────────────────
function SponsorAnalytics() {
  const { data, loading, error } = useApi<any>('/api/sponsor/marketplace')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const totalOpps    = data?.total_opportunities      ?? 0
  const pubOpps      = data?.published_opportunities  ?? 0
  const totalApps    = data?.total_applications       ?? 0
  const acceptedApps = data?.accepted_applications    ?? 0
  const activeC      = data?.active_contracts         ?? 0
  const totalC       = data?.total_contracts          ?? 0
  const totalSpent   = data?.total_spent_usd          ?? 0
  const byStatus     = data?.applications_by_status   ?? {}

  if (totalOpps === 0 && totalApps === 0) return (
    <EmptyState icon="📊" title="No Activity Yet"
      body="Analytics will appear once you publish an opportunity and receive applications." />
  )

  const spentDisplay = totalSpent >= 1000 ? `$${(totalSpent/1000).toFixed(1)}K` : `$${totalSpent}`

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Opportunities', value: pubOpps,   sub: `${totalOpps} total` },
          { label: 'Applications',  value: totalApps, sub: `${acceptedApps} accepted` },
          { label: 'Active Contracts', value: activeC, sub: `${totalC} total` },
        ].map(s => (
          <div key={s.label} className="dash-card text-center" style={{ borderTop: '2px solid #8b0000' }}>
            <div className="font-condensed text-[10px] font-bold uppercase tracking-widest text-gray-3 mb-1">{s.label}</div>
            <div className="font-display text-off-white" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="font-condensed text-[10px] text-gray-3 mt-0.5">{s.sub}</div>
          </div>
        ))}
        <div className="dash-card text-center" style={{ borderTop: '2px solid #8b0000' }}>
          <div className="font-condensed text-[10px] font-bold uppercase tracking-widest text-gray-3 mb-1">Total Spent</div>
          <div className="font-display text-off-white" style={{ fontSize: 28 }}>{spentDisplay}</div>
          <div className="font-condensed text-[10px] text-gray-3 mt-0.5">Payments succeeded</div>
        </div>
      </div>
      {Object.keys(byStatus).length > 0 && (
        <div className="dash-card">
          <div className="font-condensed text-[10px] font-bold uppercase tracking-[0.3em] text-gray-3 mb-3">Applications by Status</div>
          {Object.entries(byStatus).map(([s, c]) => (
            <div key={s} className="flex items-center justify-between mb-2">
              <span className="dash-sub capitalize">{s.replace('_', ' ')}</span>
              <div className="flex items-center gap-2">
                <div style={{ width: 80, height: 4, background: '#222226', borderRadius: 2 }}>
                  <div style={{ width: `${totalApps > 0 ? Math.round((c as number)/totalApps*100) : 0}%`, height: '100%', background: '#8b0000', borderRadius: 2 }} />
                </div>
                <span className="font-condensed text-[12px] font-bold text-off-white w-5 text-right">{c as number}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sponsor Contracts tab ─────────────────────────────────────────────────────
const CONTRACT_STATUS_COLOR: Record<string, string> = {
  draft: '#4a4846', pending_fighter: '#b45309', active: '#166534',
  in_dispute: '#7f1d1d', completed: '#1e3a5f', terminated: '#374151',
}
const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_fighter: 'Awaiting Fighter', active: 'Active',
  in_dispute: 'In Dispute', completed: 'Completed', terminated: 'Terminated',
}

function SponsorContracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    getContracts()
      .then(r => { setContracts(r.contracts); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed to load contracts.'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />
  if (!contracts.length) return (
    <div className="space-y-4">
      <SectionHeading>Contracts</SectionHeading>
      <EmptyState icon="📄" title="No Contracts Yet"
        body="Accept a fighter application to create a contract. Contracts track deliverables and obligations."
        action={<Link to="/sponsor/opportunities" className="btn-ghost text-[11px] py-2 px-4 no-underline">My Opportunities →</Link>} />
    </div>
  )

  const active    = contracts.filter(c => c.status === 'active').length
  const pending   = contracts.filter(c => c.status === 'pending_fighter').length
  const completed = contracts.filter(c => c.status === 'completed').length

  return (
    <div className="space-y-4">
      <SectionHeading>Contracts ({contracts.length})</SectionHeading>

      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {[
          { label: 'Active',    value: active,    color: '#00c060' },
          { label: 'Pending',   value: pending,   color: '#c9a82c' },
          { label: 'Completed', value: completed, color: '#4a4846' },
        ].map(s => (
          <div key={s.label} className="dash-card text-center" style={{ borderTop: `2px solid ${s.color}` }}>
            <div className="dash-label">{s.label}</div>
            <div className="font-display text-off-white mt-1" style={{ fontSize: 28, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {contracts.map(c => (
          <Link key={c.id} to={`/contracts/${c.id}`}
            className="dash-card flex items-center gap-4 no-underline block"
            style={{ borderLeft: `2px solid ${CONTRACT_STATUS_COLOR[c.status] ?? '#222226'}` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                  style={{ background: CONTRACT_STATUS_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                  {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                </span>
                <span className="font-condensed text-[11px] text-gray-3">
                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="font-condensed font-bold text-off-white text-[14px]">
                ${c.value_usd.toLocaleString()} · {c.payment_schedule}
              </div>
              {c.start_date && c.end_date && (
                <div className="font-condensed text-[11px] text-gray-3 mt-0.5">
                  {new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                  {new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
            <span className="font-condensed text-[11px] text-gray-3 flex-shrink-0">View →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function SponsorDashboard() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [sp, setSp]           = useState<SponsorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    if (!token) return
    getSponsorDashboard()
      .then(d => {
        if (!d.sponsorProfile) { navigate('/onboarding/sponsor', { replace: true }); return }
        setSp(d.sponsorProfile)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [navigate, token])

  const patch = (updates: Partial<SponsorProfile>) => setSp(p => p ? { ...p, ...updates } : p)
  const toggle = (k: 'preferred_weight_classes' | 'preferred_promotions' | 'campaign_goals', v: string) => {
    if (!sp) return
    const cur = sp[k] ?? []
    patch({ [k]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] } as any)
  }

  const save = async () => {
    if (!sp) return
    setSaving(true); setSavedMsg(''); setSaveErr('')
    try {
      await updateSponsorProfile({
        company_name:            sp.company_name,
        website_url:             sp.website_url             ?? undefined,
        industry:                sp.industry                ?? undefined,
        company_size:            sp.company_size            ?? undefined,
        hq_country:              sp.hq_country              ?? undefined,
        hq_region:               sp.hq_region               ?? undefined,
        description:             sp.description             ?? undefined,
        budget_min_usd:          sp.budget_min_usd          ?? undefined,
        budget_max_usd:          sp.budget_max_usd          ?? undefined,
        preferred_weight_classes: sp.preferred_weight_classes ?? [],
        preferred_promotions:    sp.preferred_promotions    ?? [],
        campaign_goals:          sp.campaign_goals          ?? [],
      })
      setSavedMsg('Saved.')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (e: any) {
      setSaveErr(e.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !sp) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
      </div>
    )
  }

  const SaveBar = () => (
    <div className="flex items-center gap-4 mt-6">
      <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
      {savedMsg && <span className="font-condensed text-[12px] text-gray-2">{savedMsg}</span>}
      {saveErr  && <span className="font-condensed text-[12px] text-blood-glow">{saveErr}</span>}
    </div>
  )

  return (
    <DashShell title="Sponsor" subtitle="Sponsor Console" navItems={NAV}>
      {(tab) => {
        if (tab === 'overview') return (
          <div className="space-y-6 max-w-3xl">
            {!sp.is_verified && <VettingBanner />}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-off-white uppercase" style={{ fontSize: 28, lineHeight: 1 }}>
                  {sp.company_name}
                </h2>
                <span className="font-condensed font-bold uppercase text-[10px] tracking-[0.25em] px-3 py-1.5 border"
                  style={{
                    borderColor: sp.is_verified ? '#8b0000' : '#c9a82c',
                    color:       sp.is_verified ? '#C41E3A' : '#c9a82c',
                  }}>
                  {sp.is_verified ? 'Verified' : 'Pending Vetting'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 font-condensed text-[13px]">
                <div><span className="text-gray-3">Industry</span><div className="text-off-white">{sp.industry || '—'}</div></div>
                <div><span className="text-gray-3">Budget</span>
                  <div className="text-off-white">
                    {sp.budget_min_usd || sp.budget_max_usd ? `$${sp.budget_min_usd ?? 0}–$${sp.budget_max_usd ?? '∞'}` : '—'}
                  </div>
                </div>
                <div><span className="text-gray-3">HQ</span>
                  <div className="text-off-white">{[sp.hq_region, sp.hq_country].filter(Boolean).join(', ') || '—'}</div>
                </div>
                <div><span className="text-gray-3">Active Contracts</span>
                  <div className="text-off-white">{sp.total_active_contracts ?? 0}</div>
                </div>
              </div>
            </Card>

            {sp.is_verified && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { to: '/sponsor/opportunities',     label: 'My Opportunities' },
                  { to: '/sponsor/opportunities/new', label: 'Post Opportunity' },
                  { to: '/contracts',                 label: 'My Contracts' },
                  { to: '/inbox',                     label: 'Inbox' },
                ].map(l => (
                  <a key={l.to} href={l.to}
                    className="font-condensed text-[11px] font-bold uppercase tracking-[0.2em] text-center py-3 border border-charcoal-3 text-gray-2 no-underline transition-colors hover:border-blood hover:text-off-white block">
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )

        if (tab === 'campaigns') return (
          <div className="max-w-3xl">
            {!sp.is_verified && <VettingBanner />}
            <SponsorCampaigns isVerified={sp.is_verified ?? false} />
          </div>
        )

        if (tab === 'contracts') return (
          <div className="max-w-3xl">
            <SponsorContracts />
          </div>
        )

        if (tab === 'analytics') return (
          <div className="max-w-3xl">
            {!sp.is_verified && <VettingBanner />}
            <SponsorAnalytics />
          </div>
        )

        if (tab === 'profile') return (
          <div className="max-w-2xl space-y-4">
            <Card>
              <div className="space-y-4">
                {/* Logo upload */}
                <div>
                  <Label>Company Logo</Label>
                  {sp.logo_path && (
                    <div className="mb-2 w-16 h-16 border border-charcoal-3 overflow-hidden" style={{ background: '#141416' }}>
                      <img src={storageUrl(sp.logo_path) ?? ''} alt="Logo" className="w-full h-full object-contain p-1" />
                    </div>
                  )}
                  <ImageUpload
                    uploadType="sponsor-logo"
                    currentPath={sp.logo_path ?? null}
                    label="Company Logo"
                    hint="Square image recommended · max 5 MB"
                    accept="image/jpeg,image/png,image/webp"
                    onUploaded={(path) => {
                      patch({ logo_path: path })
                      updateSponsorProfile({ logo_path: path } as any).catch(() => {})
                    }}
                  />
                </div>
                <div><Label>Company Name</Label><Input value={sp.company_name} onChange={v => patch({ company_name: v })} /></div>
                <div><Label>Website</Label><Input value={sp.website_url ?? ''} onChange={v => patch({ website_url: v })} placeholder="https://…" /></div>
                <div><Label>Industry</Label><Input value={sp.industry ?? ''} onChange={v => patch({ industry: v })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>HQ Country</Label><Input value={sp.hq_country ?? ''} onChange={v => patch({ hq_country: v })} /></div>
                  <div><Label>HQ Region</Label><Input value={sp.hq_region ?? ''} onChange={v => patch({ hq_region: v })} /></div>
                </div>
                <div>
                  <Label>About</Label>
                  <textarea value={sp.description ?? ''} onChange={e => patch({ description: e.target.value })} rows={4}
                    className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-3 outline-none resize-none focus:border-blood" />
                </div>
              </div>
              <SaveBar />
            </Card>
          </div>
        )

        if (tab === 'preferences') return (
          <div className="max-w-2xl space-y-4">
            <Card>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Budget Min (USD/yr)</Label>
                    <Input type="number" value={String(sp.budget_min_usd ?? '')} onChange={v => patch({ budget_min_usd: v ? Number(v) : null })} />
                  </div>
                  <div><Label>Budget Max (USD/yr)</Label>
                    <Input type="number" value={String(sp.budget_max_usd ?? '')} onChange={v => patch({ budget_max_usd: v ? Number(v) : null })} />
                  </div>
                </div>
                <div><Label>Campaign Goals</Label>
                  <Chips options={GOALS} selected={sp.campaign_goals ?? []} onToggle={v => toggle('campaign_goals', v)} />
                </div>
                <div><Label>Preferred Promotions</Label>
                  <Chips options={PROMOTIONS.map(p => ({ value: p, label: p }))} selected={sp.preferred_promotions ?? []} onToggle={v => toggle('preferred_promotions', v)} />
                </div>
                <div><Label>Preferred Weight Classes</Label>
                  <Chips options={WEIGHT_CLASSES.map(w => ({ value: w, label: w }))} selected={sp.preferred_weight_classes ?? []} onToggle={v => toggle('preferred_weight_classes', v)} />
                </div>
              </div>
              <SaveBar />
            </Card>
          </div>
        )

        return null
      }}
    </DashShell>
  )
}
