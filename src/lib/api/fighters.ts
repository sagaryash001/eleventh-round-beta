// Typed wrappers for the fighter API (server/routes/fighter.js)
import { apiGet, apiPatch, apiPost } from './client'

// ── SponsorForge access (unlock checklist + review) ──────────────────────────
export type SFItemStatus = 'complete' | 'incomplete' | 'pending' | 'rejected'
export interface SFChecklistItem {
  id: 'profile' | 'modules' | 'readiness' | 'submit' | 'approval'
  label: string
  status: SFItemStatus
  detail: string
  action: 'continue_profile' | 'continue_modules' | 'view_readiness' | 'submit_review' | 'view_feedback' | null
  action_label: string
}
export interface SponsorForgeStatus {
  locked: boolean
  status: 'not_started' | 'draft' | 'pending' | 'approved' | 'rejected'
  can_submit: boolean
  requirements_met: boolean
  admin_notes: string | null
  threshold: number
  readiness_score: number
  profile_pct: number
  required_modules: { total: number; completed: number }
  checklist: SFChecklistItem[]
}

export const getSponsorForge = () =>
  apiGet<SponsorForgeStatus>('/api/fighter/sponsorforge')

export const submitSponsorForge = () =>
  apiPost<{ ok: boolean; status: string }>('/api/fighter/sponsorforge/submit')

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'facebook' | 'twitch'

export interface SocialAccount {
  platform: SocialPlatform
  handle: string
  profile_url?: string
  follower_count?: number | null
}

export interface ProfileCompletion {
  overall: number
  core_pct: number
  fight_details_pct: number
  sponsorship_pct: number
  social_proof_pct: number
  missing_required: string[]
  recommended_improvements: string[]
  sponsor_ready: boolean
}

export interface FighterProfile {
  name: string
  email: string
  nickname: string | null
  division: string | null
  record: string
  record_wins: number
  record_losses: number
  record_draws: number
  base: string | null
  base_city: string | null
  manager: string | null
  weight_class: string | null
  current_promotion: string | null
  pro_status: 'amateur' | 'pro' | 'retired' | null
  nationality: string | null
  visibility: 'private' | 'sponsors_only' | 'public'
  is_open_to_sponsorship: boolean
  public_slug: string | null
  socials: SocialAccount[]
  sponsorship_interests: string[]
  profile_completeness: number
  completion: ProfileCompletion | null
  // media + public profile
  headshot_path: string | null
  banner_path: string | null
  media_kit_url: string | null
  highlight_video_urls: string[]
  bio: string | null
  gym_name: string | null
  coach_name: string | null
}

export const getFighterProfile = () =>
  apiGet<FighterProfile>('/api/fighter/profile')

export const updateFighterProfile = (
  updates: Partial<Pick<FighterProfile,
    'weight_class' | 'current_promotion' | 'pro_status' | 'nationality' |
    'visibility' | 'is_open_to_sponsorship' | 'record_wins' | 'record_losses' | 'record_draws' |
    'nickname' | 'bio' | 'gym_name' | 'coach_name' | 'sponsorship_interests' |
    'headshot_path' | 'banner_path' | 'media_kit_url' | 'highlight_video_urls'>>
    & { division?: string; base_city?: string; name?: string },
) => apiPatch<{ ok: boolean }>('/api/fighter/profile', updates)

export const updateFighterSocials = (socials: SocialAccount[]) =>
  apiPatch<{ ok: boolean }>('/api/fighter/socials', { socials })
