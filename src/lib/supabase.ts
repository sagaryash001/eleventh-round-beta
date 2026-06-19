// ─────────────────────────────────────────────────────────────────────────────
// Supabase — frontend singleton
//
// Uses the ANON key (safe to ship to the browser). The session is persisted
// in localStorage automatically by supabase-js, and refreshed on a timer.
//
// Anything that requires elevated privileges goes through our Express API,
// which uses the service-role key server-side.
//
// ── Supabase Dashboard Auth URL Configuration (REQUIRED for signup + reset) ──
// Authentication → URL Configuration. EVERY origin we send email redirects to
// MUST be allow-listed here, or Supabase rejects the email and NOTHING reaches
// SendGrid (this is a common cause of "confirmation email never arrives"):
//   Site URL:      https://eleventh-rnd.com          (production)
//   Redirect URLs:
//     https://eleventh-rnd.com/**                     (production — REQUIRED)
//     https://eleventh-round-beta.vercel.app/**       (preview)
//     http://localhost:5173/**                        (dev)
//
// The redirect origin is `siteUrl` below — pin it in prod with VITE_SITE_URL so
// it can never accidentally be a preview/local origin.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL  = (import.meta as any).env?.VITE_SUPABASE_URL      as string | undefined
const ANON = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined

// Origin used for auth email redirect links (signup confirmation, password
// reset). Pin to the production domain with VITE_SITE_URL so emails never point
// at a preview/local origin; falls back to the current origin in dev. This value
// MUST be in Supabase Auth → URL Configuration → Redirect URLs, or Supabase will
// refuse to send the email.
export const siteUrl =
  ((import.meta as any).env?.VITE_SITE_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : '')

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
