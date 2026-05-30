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
}

export const getFighterProfile = () =>
  apiGet<FighterProfile>('/api/fighter/profile')

export const updateFighterProfile = (
  updates: Partial<Pick<FighterProfile,
    'weight_class' | 'current_promotion' | 'pro_status' | 'nationality' |
    'visibility' | 'is_open_to_sponsorship' | 'record_wins' | 'record_losses' | 'record_draws'>>
    & { division?: string; base_city?: string; name?: string },
) => apiPatch<{ ok: boolean }>('/api/fighter/profile', updates)

export const updateFighterSocials = (socials: SocialAccount[]) =>
  apiPatch<{ ok: boolean }>('/api/fighter/socials', { socials })
