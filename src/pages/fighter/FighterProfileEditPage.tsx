import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getFighterProfile, updateFighterProfile, updateFighterSocials,
  type FighterProfile, type SocialAccount, type SocialPlatform,
} from '../../lib/api/fighters'
import ImageUpload from '../../components/ImageUpload'
import Navbar from '../../components/Navbar'

const WEIGHT_CLASSES = [
  'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight',
  'Middleweight', 'Light Heavyweight', 'Heavyweight',
  "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight",
]
const PROMOTIONS = ['UFC', 'ONE Championship', 'PFL', 'Bellator', 'Regional / Other']
const PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok', 'youtube', 'x']

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
function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-3 outline-none focus:border-blood">
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export default function FighterProfileEditPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [p, setP]           = useState<FighterProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    getFighterProfile().then(d => { setP(d); setLoading(false) }).catch(() => setLoading(false))
  }, [user, navigate])

  const set = (patch: Partial<FighterProfile>) => setP(prev => prev ? { ...prev, ...patch } : prev)

  const setSocial = (platform: SocialPlatform, field: 'handle' | 'follower_count', value: string) => {
    if (!p) return
    const socials = [...(p.socials ?? [])]
    const i = socials.findIndex(s => s.platform === platform)
    const existing: SocialAccount = i >= 0 ? socials[i] : { platform, handle: '' }
    const updated: SocialAccount = field === 'handle'
      ? { ...existing, handle: value }
      : { ...existing, follower_count: value ? Number(value) : null }
    if (i >= 0) socials[i] = updated; else socials.push(updated)
    set({ socials })
  }
  const socialVal = (platform: SocialPlatform, field: 'handle' | 'follower_count') => {
    const s = p?.socials?.find(x => x.platform === platform)
    if (!s) return ''
    return field === 'handle' ? s.handle : (s.follower_count != null ? String(s.follower_count) : '')
  }

  const save = async () => {
    if (!p) return
    setSaving(true); setMsg('')
    try {
      await updateFighterProfile({
        weight_class:           p.weight_class           ?? undefined,
        current_promotion:      p.current_promotion      ?? undefined,
        pro_status:             p.pro_status             ?? undefined,
        nationality:            p.nationality            ?? undefined,
        visibility:             p.visibility,
        is_open_to_sponsorship: p.is_open_to_sponsorship,
        record_wins:            p.record_wins,
        record_losses:          p.record_losses,
        record_draws:           p.record_draws,
        // public profile text fields
        nickname:               p.nickname               ?? undefined,
        bio:                    p.bio                    ?? undefined,
        gym_name:               p.gym_name               ?? undefined,
        coach_name:             p.coach_name             ?? undefined,
      })
      await updateFighterSocials((p.socials ?? []).filter(s => s.handle?.trim()))
      setMsg('Saved.')
      setTimeout(() => setMsg(''), 2500)
    } catch (e: any) {
      setMsg(e.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !p) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-24 relative z-10">
        <div className="max-w-2xl mx-auto">

          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="sec-label mb-1">Fighter</div>
              <h1 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', lineHeight: 0.92 }}>
                Edit Profile
              </h1>
            </div>
            <Link to="/dashboard/fighter" className="font-condensed font-bold uppercase text-gray-3 hover:text-off-white no-underline" style={{ fontSize: 11, letterSpacing: '0.2em' }}>
              ← Dashboard
            </Link>
          </div>

          {/* Profile media */}
          <div className="bg-charcoal border border-charcoal-3 p-6 mb-4" style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-4">Profile Images</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <ImageUpload
                uploadType="fighter-headshot"
                currentPath={p.headshot_path}
                label="Headshot"
                hint="Square photo, max 5 MB"
                accept="image/jpeg,image/png,image/webp"
                onUploaded={(path) => {
                  set({ headshot_path: path })
                  updateFighterProfile({ headshot_path: path } as any).catch(() => {})
                }}
              />
              <ImageUpload
                uploadType="fighter-banner"
                currentPath={p.banner_path}
                label="Banner"
                hint="Wide image (16:9), max 5 MB"
                accept="image/jpeg,image/png,image/webp"
                onUploaded={(path) => {
                  set({ banner_path: path })
                  updateFighterProfile({ banner_path: path } as any).catch(() => {})
                }}
              />
            </div>
            <ImageUpload
              uploadType="fighter-media-kit"
              currentPath={null}
              bucket="public-assets"
              label="Media Kit PDF"
              hint="PDF, max 10 MB — replaces any existing URL"
              accept="application/pdf"
              onUploaded={(_, publicUrl) => {
                set({ media_kit_url: publicUrl })
                updateFighterProfile({ media_kit_url: publicUrl } as any).catch(() => {})
              }}
            />
            {p.media_kit_url && (
              <p className="font-condensed text-[11px] text-gray-3 mt-2">
                Current: <a href={p.media_kit_url} target="_blank" rel="noopener noreferrer" className="text-blood-glow hover:underline">View PDF</a>
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="bg-charcoal border border-charcoal-3 p-6 mb-4" style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-4">Public Bio</div>
            <div className="space-y-3">
              <div><Label>Nickname</Label><Input value={p.nickname ?? ''} onChange={v => set({ nickname: v })} placeholder='e.g. "The Predator"' /></div>
              <div>
                <Label>Short Bio</Label>
                <textarea
                  value={p.bio ?? ''}
                  onChange={e => set({ bio: e.target.value })}
                  rows={3}
                  maxLength={600}
                  placeholder="A few sentences about your career and what you're looking for in a sponsor…"
                  className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-3 outline-none resize-none focus:border-blood placeholder:text-gray-3"
                />
                <p className="font-condensed text-[10px] text-gray-3 mt-1">{(p.bio ?? '').length}/600 characters</p>
              </div>
              <div><Label>Gym / Team</Label><Input value={p.gym_name ?? ''} onChange={v => set({ gym_name: v })} placeholder="e.g. American Top Team" /></div>
              <div><Label>Coach</Label><Input value={p.coach_name ?? ''} onChange={v => set({ coach_name: v })} placeholder="Head coach name" /></div>
            </div>
          </div>

          {/* Fight identity */}
          <div className="bg-charcoal border border-charcoal-3 p-6 mb-4" style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-4">Fight Data</div>
            <div className="space-y-4">
              <div><Label>Weight Class</Label><Select value={p.weight_class ?? ''} onChange={v => set({ weight_class: v })} options={WEIGHT_CLASSES.map(w => ({ value: w, label: w }))} placeholder="Select weight class" /></div>
              <div><Label>Current Promotion</Label><Select value={p.current_promotion ?? ''} onChange={v => set({ current_promotion: v })} options={PROMOTIONS.map(x => ({ value: x, label: x }))} placeholder="Select promotion" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Status</Label><Select value={p.pro_status ?? ''} onChange={v => set({ pro_status: v as any })} options={[{ value: 'amateur', label: 'Amateur' }, { value: 'pro', label: 'Professional' }, { value: 'retired', label: 'Retired' }]} /></div>
                <div><Label>Nationality (ISO-2)</Label><Input value={p.nationality ?? ''} onChange={v => set({ nationality: v })} placeholder="US" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Wins</Label><Input type="number" value={String(p.record_wins ?? 0)} onChange={v => set({ record_wins: Number(v) || 0 })} /></div>
                <div><Label>Losses</Label><Input type="number" value={String(p.record_losses ?? 0)} onChange={v => set({ record_losses: Number(v) || 0 })} /></div>
                <div><Label>Draws</Label><Input type="number" value={String(p.record_draws ?? 0)} onChange={v => set({ record_draws: Number(v) || 0 })} /></div>
              </div>
            </div>
          </div>

          {/* Socials */}
          <div className="bg-charcoal border border-charcoal-3 p-6 mb-4" style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-4">Social Reach</div>
            <div className="space-y-4">
              {PLATFORMS.map(pl => (
                <div key={pl} className="grid grid-cols-2 gap-3">
                  <div><Label>{pl} Handle</Label><Input value={socialVal(pl, 'handle')} onChange={v => setSocial(pl, 'handle', v)} placeholder="@handle" /></div>
                  <div><Label>{pl} Followers</Label><Input type="number" value={socialVal(pl, 'follower_count')} onChange={v => setSocial(pl, 'follower_count', v)} placeholder="0" /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div className="bg-charcoal border border-charcoal-3 p-6 mb-4" style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-4">Sponsorship Visibility</div>
            <div className="space-y-4">
              <div>
                <Label>Who can see your profile</Label>
                <Select value={p.visibility} onChange={v => set({ visibility: v as any })} options={[
                  { value: 'private', label: 'Private — only me' },
                  { value: 'sponsors_only', label: 'Sponsors only (recommended)' },
                  { value: 'public', label: 'Public — anyone' },
                ]} />
              </div>
              <button type="button" onClick={() => set({ is_open_to_sponsorship: !p.is_open_to_sponsorship })}
                className="flex items-center gap-3 cursor-pointer bg-transparent border-0 p-0">
                <span className="w-10 h-5 rounded-full transition-all relative" style={{ background: p.is_open_to_sponsorship ? '#8b0000' : '#222226' }}>
                  <span className="absolute top-0.5 w-4 h-4 bg-off-white rounded-full transition-all" style={{ left: p.is_open_to_sponsorship ? 22 : 2 }} />
                </span>
                <span className="font-condensed uppercase text-[12px] tracking-[0.1em] text-off-white">Open to sponsorship offers</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Profile'}</button>
            {msg && <span className="font-condensed text-[12px] text-gray-2">{msg}</span>}
            <span className="font-condensed text-[11px] text-gray-3 ml-auto">{p.profile_completeness}% complete</span>
            {p.public_slug && p.visibility === 'public' && (
              <Link to={`/fighters/${p.public_slug}`}
                className="font-condensed text-[11px] text-blood-glow hover:underline no-underline">
                View Public Profile →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
