import React, { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// IntroWalkout — premium MMA walkout video overlay shown before the homepage hero.
//
// • Full-screen fixed overlay, plays the walkout video once per browser session.
// • Muted / autoplay / playsInline so it starts without interaction.
// • Black/red gradient on top of the video for a cinematic, premium feel.
// • "Skip Intro" (bottom-right) dismisses immediately.
// • On end: a brief fade-to-black, then a smooth fade-out that reveals the hero
//   underneath (the homepage is always rendered — this is an overlay, not a gate).
// • Respects prefers-reduced-motion (never plays) and a once-per-session flag.
// • Fails open: a missing/broken video or any stall removes the overlay so the
//   homepage is never blocked. No layout shift — it's a fixed overlay.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY    = 'er_intro_walkout_v1'
const VIDEO_SRC      = '/videos/intro-walkout.mp4'
const MAX_INTRO_MS   = 14000   // hard safety cap — the overlay can never get stuck
// Fired the instant the overlay starts fading — the hero listens for this so its
// content enters WHILE the overlay fades out (no black dead-frame between them).
export const INTRO_FADE_EVENT = 'er:intro-fadeout'

type Phase = 'playing' | 'fadeOut'

// Decide synchronously (before first paint) whether the intro should play, so the
// overlay either mounts immediately or not at all — avoiding any flash/shift.
function shouldPlay(): boolean {
  if (typeof window === 'undefined') return false
  try { if (sessionStorage.getItem(SESSION_KEY) === '1') return false } catch { /* private mode */ }
  try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false } catch { /* no matchMedia */ }
  return true
}

export default function IntroWalkout() {
  const [show, setShow]   = useState<boolean>(shouldPlay)
  const [phase, setPhase] = useState<Phase>('playing')
  const videoRef = useRef<HTMLVideoElement>(null)
  const doneRef  = useRef(false)   // guards against double-finish (ended + skip + cap)

  const markDone = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
  }, [])

  // Single dismiss path (end, skip, or error): no black hold — the overlay simply
  // cross-fades away over the hero, which begins entering the moment we fire the
  // handoff event below.
  const dismiss = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    markDone()
    try { window.dispatchEvent(new CustomEvent(INTRO_FADE_EVENT)) } catch { /* ignore */ }
    setPhase('fadeOut')
    window.setTimeout(() => setShow(false), 820)
  }, [markDone])
  const endGracefully = dismiss

  useEffect(() => {
    if (!show) return
    const v = videoRef.current
    if (v) {
      // Muted + playsInline should autoplay; if the browser blocks it, the user
      // can Skip and the safety cap will dismiss it regardless.
      const p = v.play?.()
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked */ })
    }
    const cap = window.setTimeout(endGracefully, MAX_INTRO_MS)
    return () => window.clearTimeout(cap)
  }, [show, endGracefully])

  if (!show) return null

  const fadingOut = phase === 'fadeOut'

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] overflow-hidden bg-black"
      style={{
        opacity:       fadingOut ? 0 : 1,
        transition:    'opacity 0.82s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      {/* The walkout video — covers the viewport, centered, no stretch. */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        autoPlay
        playsInline
        preload="auto"
        onEnded={endGracefully}
        onError={dismiss}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'cover', objectPosition: '50% 50%' }}
      />

      {/* Premium black/red gradient on top of the video. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse at 50% 38%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.34) 70%, rgba(0,0,0,0.72) 100%),' +
          'radial-gradient(ellipse at 82% 16%, rgba(139,0,0,0.22) 0%, transparent 46%),' +
          'radial-gradient(ellipse at 12% 90%, rgba(120,0,0,0.20) 0%, transparent 46%),' +
          'linear-gradient(to bottom, rgba(0,0,0,0.36) 0%, transparent 22%, transparent 58%, rgba(0,0,0,0.62) 100%)',
      }} />

      {/* Skip Intro — bottom-right. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Skip intro"
        className="absolute bottom-6 right-6 z-10 font-condensed font-bold uppercase"
        style={{
          fontSize: 10, letterSpacing: '0.28em', color: '#cfcac2',
          padding: '8px 16px', border: '1px solid rgba(255,255,255,0.22)',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer',
          transition: 'color 0.2s, border-color 0.2s, background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(196,30,58,0.85)' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#cfcac2'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)' }}
      >
        Skip Intro ›
      </button>
    </div>
  )
}
