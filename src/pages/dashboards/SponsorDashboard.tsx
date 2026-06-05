import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashShell from './DashShell'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { getSponsorDashboard, updateSponsorProfile, type SponsorProfile } from '../../lib/api/sponsors'

const NAV = [
  { id: 'overview',    label: 'Overview',    icon: '' },
  { id: 'analytics',   label: 'Analytics',   icon: '📊' },
  { id: 'profile',     label: 'Company',     icon: '' },
  { id: 'preferences', label: 'Preferences', icon: '' },
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

// ── shared bits ────────────────────────────────────────────────────────────────
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
function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const [f, setF] = useState(false)
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
      className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all placeholder:text-gray-3"
      style={{ borderColor: f ? '#8b0000' : '#222226' }} />
  )
}
function Chips({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
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

export default function SponsorDashboard() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [sp, setSp]         = useState<SponsorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    if (!token) return
    getSponsorDashboard()
      .then(d => {
        if (!d.sponsorProfile) { navigate('/sponsor/onboard', { replace: true }); return }
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
    setSaving(true); setSavedMsg('')
    try {
      await updateSponsorProfile({
        company_name: sp.company_name,
        website_url: sp.website_url ?? undefined,
        industry: sp.industry ?? undefined,
        company_size: sp.company_size ?? undefined,
        hq_country: sp.hq_country ?? undefined,
        hq_region: sp.hq_region ?? undefined,
        description: sp.description ?? undefined,
        budget_min_usd: sp.budget_min_usd ?? undefined,
        budget_max_usd: sp.budget_max_usd ?? undefined,
        preferred_weight_classes: sp.preferred_weight_classes ?? [],
        preferred_promotions: sp.preferred_promotions ?? [],
        campaign_goals: sp.campaign_goals ?? [],
      })
      setSavedMsg('Saved.')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (e: any) {
      setSavedMsg(e.message ?? 'Save failed.')
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
    </div>
  )

  return (
    <DashShell title="Sponsor" subtitle="Sponsor Console" navItems={NAV}>
      {(tab) => {
        if (tab === 'overview') return (
          <div className="space-y-6 max-w-3xl">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-off-white uppercase" style={{ fontSize: 28, lineHeight: 1 }}>{sp.company_name}</h2>
                <span className="font-condensed font-bold uppercase text-[10px] tracking-[0.25em] px-3 py-1.5 border"
                  style={{ borderColor: sp.is_verified ? '#8b0000' : '#222226', color: sp.is_verified ? '#C41E3A' : '#7a7672' }}>
                  {sp.is_verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 font-condensed text-[13px]">
                <div><span className="text-gray-3">Industry</span><div className="text-off-white">{sp.industry || '—'}</div></div>
                <div><span className="text-gray-3">Budget</span><div className="text-off-white">{sp.budget_min_usd || sp.budget_max_usd ? `$${sp.budget_min_usd ?? 0}–$${sp.budget_max_usd ?? '∞'}` : '—'}</div></div>
                <div><span className="text-gray-3">HQ</span><div className="text-off-white">{[sp.hq_region, sp.hq_country].filter(Boolean).join(', ') || '—'}</div></div>
                <div><span className="text-gray-3">Active Contracts</span><div className="text-off-white">{sp.total_active_contracts ?? 0}</div></div>
              </div>
            </Card>
            {!sp.is_verified && (
              <Card>
                <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-2">Get Verified</div>
                <p className="font-narrow text-gray-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Verified sponsors can publish opportunities to the public fighter feed and earn a trust badge.
                  Complete your company profile, then request verification — our team reviews within 48h.
                </p>
              </Card>
            )}
          </div>
        )

        if (tab === 'profile') return (
          <div className="max-w-2xl space-y-4">
            <Card>
              <div className="space-y-4">
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
                  <div><Label>Budget Min (USD/yr)</Label><Input type="number" value={String(sp.budget_min_usd ?? '')} onChange={v => patch({ budget_min_usd: v ? Number(v) : null })} /></div>
                  <div><Label>Budget Max (USD/yr)</Label><Input type="number" value={String(sp.budget_max_usd ?? '')} onChange={v => patch({ budget_max_usd: v ? Number(v) : null })} /></div>
                </div>
                <div><Label>Campaign Goals</Label><Chips options={GOALS} selected={sp.campaign_goals ?? []} onToggle={v => toggle('campaign_goals', v)} /></div>
                <div><Label>Preferred Promotions</Label><Chips options={PROMOTIONS.map(p => ({ value: p, label: p }))} selected={sp.preferred_promotions ?? []} onToggle={v => toggle('preferred_promotions', v)} /></div>
                <div><Label>Preferred Weight Classes</Label><Chips options={WEIGHT_CLASSES.map(w => ({ value: w, label: w }))} selected={sp.preferred_weight_classes ?? []} onToggle={v => toggle('preferred_weight_classes', v)} /></div>
              </div>
              <SaveBar />
            </Card>
          </div>
        )

        if (tab === 'analytics') return <SponsorAnalytics />

        return null
      }}
    </DashShell>
  )
}

function SponsorAnalytics() {
  const { data } = useApi<any>('/api/sponsor/marketplace')

  const totalOpps    = data?.total_opportunities      ?? 0
  const pubOpps      = data?.published_opportunities  ?? 0
  const totalApps    = data?.total_applications       ?? 0
  const acceptedApps = data?.accepted_applications    ?? 0
  const activeC      = data?.active_contracts         ?? 0
  const totalC       = data?.total_contracts          ?? 0
  const totalSpent   = data?.total_spent_usd          ?? 0
  const byStatus     = data?.applications_by_status   ?? {}

  const spentDisplay = totalSpent >= 1000 ? `$${(totalSpent / 1000).toFixed(1)}K` : `$${totalSpent}`

  function statRow(label: string, value: number, total: number) {
    const pct = total > 0 ? Math.round(value / total * 100) : 0
    return (
      <div key={label} className="flex items-center justify-between mb-2">
        <span className="font-condensed text-[11px] text-gray-3 capitalize">{label.replace('_', ' ')}</span>
        <div className="flex items-center gap-2">
          <div style={{ width: 80, height: 4, background: '#222226', borderRadius: 2 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#8b0000', borderRadius: 2 }} />
          </div>
          <span className="font-condensed text-[12px] font-bold text-off-white w-5 text-right">{value}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Opportunities', value: pubOpps,      sub: `${totalOpps} total` },
          { label: 'Applications',  value: totalApps,    sub: `${acceptedApps} accepted` },
          { label: 'Active Contracts', value: activeC,   sub: `${totalC} total` },
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

      <div className="grid grid-cols-2 gap-4">
        <div className="dash-card">
          <div className="font-condensed text-[10px] font-bold uppercase tracking-[0.3em] text-gray-3 mb-3">Applications by Status</div>
          {Object.entries(byStatus).map(([s, c]) => statRow(s, c as number, totalApps))}
          {!Object.keys(byStatus).length && <p className="font-condensed text-[12px] text-gray-3">No applications yet.</p>}
        </div>
        <div className="dash-card flex flex-col gap-3">
          <div className="font-condensed text-[10px] font-bold uppercase tracking-[0.3em] text-gray-3">Quick Links</div>
          {[
            { href: '/sponsor/opportunities', label: 'My Opportunities' },
            { href: '/sponsor/opportunities/new', label: 'Post Opportunity' },
            { href: '/contracts', label: 'My Contracts' },
            { href: '/inbox', label: 'Inbox' },
          ].map(l => (
            <a key={l.href} href={l.href}
              className="font-condensed text-[11px] font-bold uppercase tracking-[0.2em] text-center py-2 border border-charcoal-3 text-gray-2 no-underline transition-colors hover:border-blood hover:text-off-white block">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
