// Typed wrappers for the fighter API (server/routes/fighter.js)
import { apiGet, apiPatch } from './client'

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'facebook' | 'twitch'

export interface SocialAccount {
  platform: SocialPlatform
  handle: string
  profile_url?: string
  follower_count?: number | null
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
  manager: string | null
  weight_class: string | null
  current_promotion: string | null
  pro_status: 'amateur' | 'pro' | 'retired' | null
  nationality: string | null
  visibility: 'private' | 'sponsors_only' | 'public'
  is_open_to_sponsorship: boolean
  public_slug: string | null
  socials: SocialAccount[]
  profile_completeness: number
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
    'nickname' | 'bio' | 'gym_name' | 'coach_name' |
    'headshot_path' | 'banner_path' | 'media_kit_url' | 'highlight_video_urls'>>
    & { division?: string; base_city?: string; name?: string },
) => apiPatch<{ ok: boolean }>('/api/fighter/profile', updates)

export const updateFighterSocials = (socials: SocialAccount[]) =>
  apiPatch<{ ok: boolean }>('/api/fighter/socials', { socials })
