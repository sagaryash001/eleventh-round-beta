import { apiGet } from './client'

export interface PublicFighter {
  name: string | null
  nickname: string | null
  division: string | null
  weight_class: string | null
  current_promotion: string | null
  pro_status: 'amateur' | 'pro' | 'retired' | null
  nationality: string | null
  base_city: string | null
  gym_name: string | null
  coach_name: string | null
  record: { wins: number; losses: number; draws: number }
  headshot_path: string | null
  banner_path: string | null
  media_kit_url: string | null
  highlight_video_urls: string[]
  sponsorship_interests: string[]
  bio: string | null
  visibility: 'private' | 'sponsors_only' | 'public'
  is_open_to_sponsorship: boolean
  public_slug: string | null
  socials: Array<{ platform: string; handle: string; profile_url: string; follower_count: number | null }>
}

export interface PublicTeam {
  name: string
  slug: string
  fighters: Array<{
    name: string | null
    division: string | null
    weight_class: string | null
    pro_status: string | null
    record: { wins: number; losses: number; draws: number }
    headshot_path: string | null
    public_slug: string | null
  }>
}

export const getPublicFighterProfile = (slug: string) =>
  apiGet<{ ok: boolean; fighter: PublicFighter }>(`/api/public/fighters/${slug}`)

export const getPublicTeam = (slug: string) =>
  apiGet<{ ok: boolean; team: PublicTeam }>(`/api/public/team/${slug}`)

/** Build a Supabase Storage public URL from a storage path. */
export function storageUrl(path: string | null, bucket = 'public-assets'): string | null {
  if (!path) return null
  const base = (import.meta as any).env?.VITE_SUPABASE_URL as string ?? ''
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}
