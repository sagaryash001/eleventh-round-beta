// ─────────────────────────────────────────────────────────────────────────────
// Supabase — frontend singleton
//
// Uses the ANON key (safe to ship to the browser). The session is persisted
// in localStorage automatically by supabase-js, and refreshed on a timer.
//
// Anything that requires elevated privileges goes through our Express API,
// which uses the service-role key server-side.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL  = (import.meta as any).env?.VITE_SUPABASE_URL      as string | undefined
const ANON = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined

if (!URL || !ANON) {
  // Don't crash the app — useAuth's demo flow still works without Supabase.
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing — ' +
    'auth and database calls will be disabled. Fill .env to enable.',
  )
}

export const supabase: SupabaseClient | null = (URL && ANON)
  ? createClient(URL, ANON, {
      auth: {
        autoRefreshToken: true,
        persistSession:   true,
        detectSessionInUrl: true,        // handle verification redirect automatically
        storageKey:       'er-supabase-auth',
      },
    })
  : null

/** Throws a friendly error if Supabase isn't configured. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase not configured. Add VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY to your .env, then restart `npm run dev`.',
    )
  }
  return supabase
}
