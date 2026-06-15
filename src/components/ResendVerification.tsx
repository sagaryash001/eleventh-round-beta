import React, { useEffect, useRef, useState } from 'react'
import { resendVerification } from '../lib/resendVerification'

// ─────────────────────────────────────────────────────────────────────────────
// ResendVerification — a self-contained "Resend verification email" button with
// sending / sent / error states and a cooldown to prevent spamming.
//
//  • Pass `email` when it's already known (register done-screen, login). The
//    input is hidden and the button resends to that address.
//  • Omit `email` (VerifyEmailPage error state) to render an email input.
//  • `initialSent` starts the button in the cooled-down "sent" state — used when
//    the caller has ALREADY sent one email (so we don't double-send), e.g. right
//    after registration or after an auto-resend on the login screen.
// ─────────────────────────────────────────────────────────────────────────────

type State = 'idle' | 'sending' | 'sent' | 'error'

export default function ResendVerification({
  email: emailProp,
  initialSent = false,
  cooldownSeconds = 60,
  className = '',
}: {
  email?: string
  initialSent?: boolean
  cooldownSeconds?: number
  className?: string
}) {
  const [email, setEmail]       = useState(emailProp ?? '')
  const [state, setState]       = useState<State>(initialSent ? 'sent' : 'idle')
  const [error, setError]       = useState('')
  const [cooldown, setCooldown] = useState(initialSent ? cooldownSeconds : 0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep the local field in sync if the parent supplies/updates a known email.
  useEffect(() => { if (emailProp !== undefined) setEmail(emailProp) }, [emailProp])

  // Cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return
    timer.current = setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [cooldown])

  const send = async () => {
    if (state === 'sending' || cooldown > 0) return
    setError('')
    setState('sending')
    const res = await resendVerification(email)
    if (res.ok) {
      setState('sent')
      setCooldown(cooldownSeconds)
    } else {
      setState('error')
      setError(res.error ?? 'Could not resend. Please try again.')
    }
  }

  const disabled = state === 'sending' || cooldown > 0 || !email.trim()

  return (
    <div className={className}>
      {emailProp === undefined && (
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-3 mb-3
                     outline-none transition-all duration-200 placeholder:text-gray-3 focus:border-blood"
        />
      )}

      <button
        type="button"
        onClick={send}
        disabled={disabled}
        className="w-full font-condensed text-[11px] font-bold tracking-[0.2em] uppercase px-4 py-3
                   border border-charcoal-3 text-gray-2 hover:border-blood/40 hover:text-off-white
                   transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'sending' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-3 h-3 border border-gray-3/40 border-t-gray-2 rounded-full animate-spin" />
            Sending…
          </span>
        ) : cooldown > 0 ? `Resend in ${cooldown}s`
          : 'Resend verification email'}
      </button>

      {state === 'sent' && (
        <p className="font-condensed text-[10px] tracking-wide mt-2 text-center" style={{ color: '#4a8c4a' }}>
          ✓ Verification email sent. Check your inbox — and your spam folder.
        </p>
      )}
      {state === 'error' && error && (
        <p className="font-condensed text-[10px] text-blood-glow mt-2 text-center">{error}</p>
      )}
    </div>
  )
}
