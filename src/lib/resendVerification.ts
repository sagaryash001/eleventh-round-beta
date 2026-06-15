// ─────────────────────────────────────────────────────────────────────────────
// resendVerification — (re)send the Supabase "signup" confirmation email.
//
// This goes through Supabase Auth's configured SMTP (SendGrid) — NOT this app's
// own email transport (server/services/email.js). That matters: registration
// creates the auth user via the backend admin API, which never sends an email by
// itself. The browser triggers the confirmation here so the message is delivered
// through the same SMTP that the Supabase dashboard "Invite user" flow uses.
//
// Used by: RegisterPage (first send + manual resend on "Check your inbox"),
// the "account already exists" prompt, LoginPage (unconfirmed login), and
// VerifyEmailPage (error state). Never logs passwords or tokens.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

export interface ResendResult {
  ok: boolean
  error?: string
}

export async function resendVerification(email: string): Promise<ResendResult> {
  const trimmed = email.trim()
  if (!trimmed)   return { ok: false, error: 'Enter your email address first.' }
  if (!supabase)  return { ok: false, error: 'Auth is not configured.' }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmed,
    options: { emailRedirectTo: `${window.location.origin}/verify-email` },
  })

  if (error) {
    // Log message only — never the email body, password, or any token.
    console.error('[auth] resend verification failed:', error.message)

    // A user who is already verified can't be "re-sent" a signup link; from the
    // user's point of view there's nothing to do, so treat it as success.
    if (/already (confirmed|registered|verified)/i.test(error.message)) {
      return { ok: true }
    }
    return { ok: false, error: error.message || 'Could not resend verification email.' }
  }

  return { ok: true }
}
