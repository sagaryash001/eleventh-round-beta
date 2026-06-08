import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { updateSponsorProfile, type SponsorProfile } from '../../../lib/api/sponsors'
import { getBillingPackages, getBillingStatus, startCheckout, type BillingPackage, type BillingMembership } from '../../../lib/api/billing'
import ImageUpload from '../../../components/ImageUpload'
import { storageUrl } from '../../../lib/api/public'
import { DashSkeleton, EmptyState, ApiError } from '../DashWidgets'
import { SubNav, FField } from '../admin/AdminUtils'

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

const TABS = [
  { id: 'company',     label: 'Company Profile' },
  { id: 'preferences', label: 'Preferences'     },
  { id: 'billing',     label: 'Billing'         },
]

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
            className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{
              borderColor: on ? '#8b0000' : '#222226',
              background:  on ? 'rgba(139,0,0,0.12)' : '#141416',
              color:       on ? '#f0ece4' : '#7a7672',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
      {children}
    </label>
  )
}

function Textarea({ value, onChange, rows = 4, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      placeholder={placeholder}
      className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none focus:border-blood transition-colors" />
  )
}

// ── Company Profile ───────────────────────────────────────────────────────────
function CompanyTab({ sp, onUpdate }: { sp: SponsorProfile; onUpdate: (u: Partial<SponsorProfile>) => void }) {
  const [local, setLocal]   = useState<SponsorProfile>(sp)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')
  const [err, setErr]       = useState('')

  const patch = (updates: Partial<SponsorProfile>) => setLocal(p => ({ ...p, ...updates }))

  const save = async () => {
    setSaving(true); setMsg(''); setErr('')
    try {
      await updateSponsorProfile({
        company_name: local.company_name,
        website_url:  local.website_url  ?? undefined,
        industry:     local.industry     ?? undefined,
        company_size: local.company_size ?? undefined,
        hq_country:   local.hq_country   ?? undefined,
        hq_region:    local.hq_region    ?? undefined,
        description:  local.description  ?? undefined,
      })
      onUpdate({ company_name: local.company_name, website_url: local.website_url,
        industry: local.industry, description: local.description })
      setMsg('Saved.')
      setTimeout(() => setMsg(''), 2500)
    } catch (e: any) { setErr(e.message ?? 'Save failed.') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Logo */}
      <div className="dash-card space-y-4">
        <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-3">Company Identity</div>
        <div>
          <FieldLabel>Company Logo</FieldLabel>
          {local.logo_path && (
            <div className="mb-2 w-14 h-14 border border-charcoal-3 overflow-hidden" style={{ background: '#141416' }}>
              <img src={storageUrl(local.logo_path) ?? ''} alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
          )}
          <ImageUpload
            uploadType="sponsor-logo"
            currentPath={local.logo_path ?? null}
            label="Company Logo"
            hint="Square image recommended · max 5 MB"
            accept="image/jpeg,image/png,image/webp"
            onUploaded={(path) => {
              patch({ logo_path: path })
              updateSponsorProfile({ logo_path: path } as any).catch(() => {})
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FField label="Company Name" value={local.company_name} onChange={v => patch({ company_name: v })} required />
          <FField label="Website" value={local.website_url ?? ''} onChange={v => patch({ website_url: v })} placeholder="https://…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FField label="Industry" value={local.industry ?? ''} onChange={v => patch({ industry: v })} />
          <FField label="Company Size" value={local.company_size ?? ''} onChange={v => patch({ company_size: v as any })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FField label="HQ Country" value={local.hq_country ?? ''} onChange={v => patch({ hq_country: v })} />
          <FField label="HQ Region / State" value={local.hq_region ?? ''} onChange={v => patch({ hq_region: v })} />
        </div>
        <div>
          <FieldLabel>About</FieldLabel>
          <Textarea value={local.description ?? ''} onChange={v => patch({ description: v })}
            placeholder="Describe your brand and what you're looking for in a sponsorship…" />
        </div>

        {/* Verification status */}
        <div className="flex items-center gap-3 pt-2 border-t border-charcoal-3">
          <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: local.is_verified ? '#00c060' : '#c9a82c' }}>
            {local.is_verified ? '● Verified Sponsor' : '○ Pending Admin Vetting'}
          </span>
          {!local.is_verified && (
            <span className="font-condensed text-[10px] text-gray-3">
              Usually 24–48 hours after submission.
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          {msg && <span className="font-condensed text-[12px] text-green-400">{msg}</span>}
          {err && <span className="font-condensed text-[12px] text-blood-glow">{err}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Preferences ───────────────────────────────────────────────────────────────
function PreferencesTab({ sp, onUpdate }: { sp: SponsorProfile; onUpdate: (u: Partial<SponsorProfile>) => void }) {
  const [local, setLocal]   = useState<SponsorProfile>(sp)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')
  const [err, setErr]       = useState('')

  const patch = (updates: Partial<SponsorProfile>) => setLocal(p => ({ ...p, ...updates }))
  const toggle = (k: 'preferred_weight_classes' | 'preferred_promotions' | 'campaign_goals', v: string) => {
    const cur = local[k] ?? []
    patch({ [k]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] } as any)
  }

  const save = async () => {
    setSaving(true); setMsg(''); setErr('')
    try {
      await updateSponsorProfile({
        budget_min_usd:           local.budget_min_usd          ?? undefined,
        budget_max_usd:           local.budget_max_usd          ?? undefined,
        preferred_weight_classes: local.preferred_weight_classes ?? [],
        preferred_promotions:     local.preferred_promotions    ?? [],
        campaign_goals:           local.campaign_goals          ?? [],
      })
      onUpdate({
        budget_min_usd: local.budget_min_usd, budget_max_usd: local.budget_max_usd,
        preferred_weight_classes: local.preferred_weight_classes,
        preferred_promotions: local.preferred_promotions,
        campaign_goals: local.campaign_goals,
      })
      setMsg('Saved.')
      setTimeout(() => setMsg(''), 2500)
    } catch (e: any) { setErr(e.message ?? 'Save failed.') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="dash-card space-y-5">
        <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">Sponsorship Preferences</div>

        <div className="grid grid-cols-2 gap-3">
          <FField label="Budget Min (USD/yr)" type="number" value={String(local.budget_min_usd ?? '')}
            onChange={v => patch({ budget_min_usd: v ? Number(v) : null as any })} />
          <FField label="Budget Max (USD/yr)" type="number" value={String(local.budget_max_usd ?? '')}
            onChange={v => patch({ budget_max_usd: v ? Number(v) : null as any })} />
        </div>

        <div>
          <FieldLabel>Campaign Goals</FieldLabel>
          <Chips options={GOALS} selected={local.campaign_goals ?? []} onToggle={v => toggle('campaign_goals', v)} />
        </div>
        <div>
          <FieldLabel>Preferred Promotions</FieldLabel>
          <Chips options={PROMOTIONS.map(p => ({ value: p, label: p }))}
            selected={local.preferred_promotions ?? []} onToggle={v => toggle('preferred_promotions', v)} />
        </div>
        <div>
          <FieldLabel>Preferred Weight Classes</FieldLabel>
          <Chips options={WEIGHT_CLASSES.map(w => ({ value: w, label: w }))}
            selected={local.preferred_weight_classes ?? []} onToggle={v => toggle('preferred_weight_classes', v)} />
        </div>

        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Preferences'}</button>
          {msg && <span className="font-condensed text-[12px] text-green-400">{msg}</span>}
          {err && <span className="font-condensed text-[12px] text-blood-glow">{err}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Billing ───────────────────────────────────────────────────────────────────
function BillingTab() {
  const [searchParams] = useSearchParams()
  const billingStatus  = searchParams.get('billing')
  const billingPkg     = searchParams.get('package')

  const [packages,    setPackages]    = useState<BillingPackage[]>([])
  const [membership,  setMembership]  = useState<BillingMembership | null>(null)
  const [payments,    setPayments]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getBillingPackages(), getBillingStatus()])
      .then(([pkgsRes, statusRes]) => {
        setPackages(pkgsRes.packages ?? [])
        setMembership(statusRes.membership ?? null)
        setPayments(statusRes.payments ?? [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCheckout = async (pkgId: string) => {
    setCheckingOut(pkgId); setCheckoutErr(null)
    try {
      const res = await startCheckout(pkgId)
      window.location.href = res.url
    } catch (e: any) {
      setCheckoutErr(e.message ?? 'Checkout failed.')
      setCheckingOut(null)
    }
  }

  const features = (pkg: BillingPackage): string[] => {
    if (Array.isArray(pkg.features)) return pkg.features
    try { return JSON.parse(pkg.features as string) } catch { return [] }
  }

  const intervalLabel = (interval: string) =>
    interval === 'one_time' ? 'one-time' : `/${interval === 'annual' ? 'yr' : 'mo'}`

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  return (
    <div className="space-y-5 max-w-2xl">
      {billingStatus === 'success' && (
        <div className="font-condensed text-[12px] tracking-[0.15em] uppercase px-4 py-3 border"
          style={{ borderColor: '#00c060', color: '#00c060', background: 'rgba(0,192,96,0.08)' }}>
          Payment complete — welcome to {billingPkg ?? 'your new plan'}!
        </div>
      )}
      {billingStatus === 'cancel' && (
        <div className="font-condensed text-[12px] tracking-[0.15em] uppercase px-4 py-3 border"
          style={{ borderColor: '#c9a82c', color: '#c9a82c', background: 'rgba(201,168,44,0.08)' }}>
          Checkout cancelled — no charge was made.
        </div>
      )}

      {/* Active membership */}
      {membership ? (
        <div className="dash-card" style={{ borderLeft: '3px solid #00c060' }}>
          <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-3">Active Plan</div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 font-condensed text-[13px]">
              <div className="font-bold text-off-white text-[15px]">{membership.packages?.name ?? 'Plan'}</div>
              <div>
                <span className="text-gray-3">Status: </span>
                <span style={{ color: membership.status === 'active' ? '#00c060' : '#c9a82c' }} className="capitalize">
                  {membership.status}
                </span>
              </div>
              {membership.current_period_end && (
                <div>
                  <span className="text-gray-3">Renews: </span>
                  <span className="text-off-white">{new Date(membership.current_period_end).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <span className="badge badge-green flex-shrink-0">Active</span>
          </div>
        </div>
      ) : (
        <div className="dash-card" style={{ borderLeft: '3px solid #c9a82c' }}>
          <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase mb-2" style={{ color: '#c9a82c' }}>
            No Active Plan
          </div>
          <p className="font-condensed text-[12px] text-gray-2">
            Purchase a package below to unlock full platform features.
          </p>
        </div>
      )}

      {checkoutErr && <p className="font-condensed text-[12px] text-blood-glow">{checkoutErr}</p>}

      {/* Packages */}
      {!packages.length ? (
        <EmptyState icon="○" title="No Packages Available"
          body="No packages are currently available for your account type. Check back soon." />
      ) : (
        <div className="space-y-3">
          <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">Available Plans</div>
          {packages.map(pkg => (
            <div key={pkg.id} className="dash-card" style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-display text-off-white uppercase" style={{ fontSize: 17, lineHeight: 1.2 }}>{pkg.name}</div>
                  {pkg.description && <p className="font-condensed text-gray-2 text-[12px] mt-1">{pkg.description}</p>}
                  {features(pkg).length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {features(pkg).map((f, i) => (
                        <li key={i} className="font-condensed text-[11px] text-gray-2 flex items-center gap-2">
                          <span style={{ color: '#8b0000' }}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-display text-off-white" style={{ fontSize: 24 }}>
                      ${(pkg.price_cents / 100).toFixed(0)}
                    </span>
                    <span className="font-condensed text-gray-3 text-[11px]"> {intervalLabel(pkg.billing_interval)}</span>
                  </div>
                  <button onClick={() => handleCheckout(pkg.id)} disabled={!!checkingOut}
                    className="btn-primary text-[11px] py-2 px-5 whitespace-nowrap disabled:opacity-50">
                    {checkingOut === pkg.id ? 'Loading…' : 'Choose Plan'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div>
          <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-3">Payment History</div>
          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={p.id ?? i} className="dash-card flex items-center gap-4 text-[13px] font-condensed">
                <div className="flex-1">{p.packages?.name ?? 'Package'}</div>
                <div className="text-gray-2">${((p.amount ?? 0) / 100).toFixed(2)}</div>
                <div style={{ color: p.status === 'succeeded' ? '#00c060' : p.status === 'failed' ? '#C41E3A' : '#c9a82c' }}>
                  {p.status}
                </div>
                <div className="text-gray-3">{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Zone export ───────────────────────────────────────────────────────────────
export default function CompanyBilling({ sp, onUpdate }: {
  sp: SponsorProfile
  onUpdate: (updates: Partial<SponsorProfile>) => void
}) {
  const [sub, setSub] = useState('company')
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'company'     && <CompanyTab sp={sp} onUpdate={onUpdate} />}
      {sub === 'preferences' && <PreferencesTab sp={sp} onUpdate={onUpdate} />}
      {sub === 'billing'     && <BillingTab />}
    </div>
  )
}
