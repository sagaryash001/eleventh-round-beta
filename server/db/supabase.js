// ─────────────────────────────────────────────────────────────────────────────
// Supabase — server-side singleton clients
//
// We expose two clients:
//   - adminSupabase: uses SERVICE_ROLE key, bypasses RLS. Use for writes,
//                    backend reads across users, admin API calls.
//   - publicSupabase: uses ANON key. Use only when you want RLS to apply
//                     server-side (rare; usually the frontend does this).
//
// The SERVICE_ROLE key must NEVER appear in any file that gets bundled
// into the browser (no VITE_* prefix). Only the Express server imports it.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const URL              = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY         = process.env.SUPABASE_ANON_KEY

if (!URL || !SERVICE_ROLE_KEY) {
  // Don't crash at import time — we want the server to boot for health
  // checks even if Supabase isn't configured yet. Routes that need it will
  // throw a clear error when called.
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — ' +
    'routes that depend on Supabase will fail. Fill in .env before testing.',
  )
}

// Service-role client — bypasses RLS. Server-side only.
export const adminSupabase = (URL && SERVICE_ROLE_KEY)
  ? createClient(URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    })
  : null

// Anon-key client — respects RLS. Rarely used server-side.
export const publicSupabase = (URL && ANON_KEY)
  ? createClient(URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    })
  : null

// Helper for routes — throws a clear error if Supabase isn't configured.
export function requireSupabase() {
  if (!adminSupabase) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and ' +
      'SUPABASE_SERVICE_ROLE_KEY in .env, then restart the server.',
    )
  }
  return adminSupabase
}
