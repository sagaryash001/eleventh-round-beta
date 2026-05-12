import React, { useEffect, useRef, useState, useCallback } from 'react'

interface IntroSequenceProps {
  onComplete: () => void
}

interface Flash {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  blur: number
}

const FLASH_ORIGINS = [
  [12, 8], [88, 6], [48, 4], [22, 88], [76, 12],
  [92, 48], [8, 68], [58, 84], [33, 22], [82, 72],
  [65, 18], [18, 55], [70, 62], [42, 90], [95, 32],
]

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [count, setCount]         = useState(1)
  const [progress, setProgress]   = useState(0)
  const [flashes, setFlashes]     = useState<Flash[]>([])
  const [exiting, setExiting]     = useState(false)
  const [labelVisible, setLabel]  = useState(false)
  const flashIdRef                = useRef(0)
  const startRef                  = useRef<number | null>(null)
  const rafRef                    = useRef<number>(0)

  const DURATION = 4200

  const spawnFlash = useCallback(() => {
    const origin = FLASH_ORIGINS[Math.floor(Math.random() * FLASH_ORIGINS.length)]
    const jx     = origin[0] + (Math.random() - 0.5) * 18
    const jy     = origin[1] + (Math.random() - 0.5) * 18
    const size   = 60 + Math.random() * 160
    const blur   = 18 + Math.random() * 40
    const id     = ++flashIdRef.current
    setFlashes(prev => [...prev, { id, x: jx, y: jy, size, opacity: 1, blur }])
    setTimeout(() => {
      setFlashes(prev => prev.filter(f => f.id !== id))
    }, 280 + Math.random() * 180)
  }, [])

  useEffect(() => {
    const labelTimer = setTimeout(() => setLabel(true), 500)

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now
      const elapsed  = now - startRef.current
      const progress = Math.min(elapsed / DURATION, 1)
      const eased    = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

      const n = Math.round(1 + eased * 99)
      setCount(n)
      setProgress(progress)

      const flashChance = 0.015 + progress * 0.11
      if (Math.random() < flashChance) spawnFlash()

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        for (let i = 0; i < 10; i++) setTimeout(spawnFlash, i * 50)
        setTimeout(() => {
          setExiting(true)
          setTimeout(onComplete, 900)
        }, 420)
      }
    }

    const initTimer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, 200)

    return () => {
      clearTimeout(labelTimer)
      clearTimeout(initTimer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [onComplete, spawnFlash])

  // Derived visual values
  const redOpacity   = Math.pow(progress, 0.65) * 0.82
  const redScale     = 0.82 + progress * 0.32
  const numGlow      = progress * 80
  const numGlowAlpha = progress * 0.8
  // "ELEVENTH ROUND" wordmark appears in final stretch
  const wordmarkAlpha = Math.max(0, (progress - 0.82) * 5.5)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
      style={{
        opacity:   exiting ? 0 : 1,
        transform: exiting ? 'scale(1.06)' : 'scale(1)',
        filter:    exiting ? 'blur(3px)' : 'blur(0px)',
        transition: exiting
          ? 'opacity 0.9s cubic-bezier(0.77,0,0.175,1), transform 0.9s cubic-bezier(0.77,0,0.175,1), filter 0.9s'
          : 'none',
        pointerEvents: exiting ? 'none' : 'all',
      }}
    >
      {/* Scan-line texture */}
      <div className="scan-lines" />

      {/* Base ambient haze */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(60,0,0,0.22) 0%, transparent 65%)',
      }} />

      {/* Red seep — top-right corner, scales with progress */}
      <div className="absolute pointer-events-none" style={{
        right: '-12%', top: '-12%', width: '85%', height: '115%',
        background: 'radial-gradient(ellipse at 80% 38%, rgba(139,0,0,0.7) 0%, rgba(100,0,0,0.3) 32%, transparent 68%)',
        opacity: redOpacity,
        transform: `scale(${redScale})`,
        transition: 'opacity 0.08s linear, transform 0.08s linear',
      }} />

      {/* Left pillar — arena side lighting */}
      <div className="absolute pointer-events-none" style={{
        left: 0, top: 0, bottom: 0, width: 160,
        background: `linear-gradient(90deg, rgba(139,0,0,${0.18 * redOpacity}) 0%, transparent 100%)`,
      }} />

      {/* Right pillar */}
      <div className="absolute pointer-events-none" style={{
        right: 0, top: 0, bottom: 0, width: 120,
        background: `linear-gradient(-90deg, rgba(100,0,0,${0.12 * redOpacity}) 0%, transparent 100%)`,
      }} />

      {/* Bottom floor glow — arena lights from below */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: 200,
        background: `linear-gradient(to top, rgba(80,0,0,${0.3 * redOpacity}) 0%, transparent 100%)`,
      }} />

      {/* Flash lights */}
      {flashes.map(f => (
        <div
          key={f.id}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: f.size,
            height: f.size,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(255,220,220,0.35) 38%, transparent 72%)',
            filter: `blur(${f.blur}px)`,
            animation: 'flashPulse 0.28s ease-in-out forwards',
          }}
        />
      ))}

      {/* ── Center composition ── */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">

        {/* "ROUND" — fight-card position label */}
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.55em',
          textTransform: 'uppercase',
          color: '#4a4846',
          opacity: labelVisible ? 1 : 0,
          transform: labelVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.7s, transform 0.7s',
        }}>
          Round
        </div>

        {/* Thin red rule above number */}
        <div style={{
          width: 28, height: 1,
          background: 'linear-gradient(90deg, transparent, #8b0000, transparent)',
          opacity: labelVisible ? 1 : 0,
          transition: 'opacity 0.7s 0.1s',
        }} />

        {/* The counter — Bebas Neue, massive */}
        <div
          className="font-display text-off-white leading-none min-w-[3ch] text-center select-none gpu"
          style={{
            fontSize: 'clamp(140px, 22vw, 320px)',
            letterSpacing: '-0.02em',
            textShadow: `0 0 ${numGlow}px rgba(139,0,0,${numGlowAlpha}),
                         0 0 ${numGlow * 0.4}px rgba(200,0,0,${numGlowAlpha * 0.55}),
                         0 2px 80px rgba(0,0,0,0.9)`,
          }}
        >
          {count}
        </div>

        {/* Progress bar */}
        <div
          className="overflow-hidden"
          style={{ width: 'clamp(180px,24vw,300px)', height: 1, background: '#1a1a1d' }}
        >
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #8b0000, #c00000)',
              boxShadow: '0 0 8px #a80000',
              width: `${progress * 100}%`,
              transition: 'width 0.05s linear',
            }}
          />
        </div>

        {/* System label */}
        <div
          className="font-condensed uppercase"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.35em',
            color: '#4a4846',
            opacity: progress > 0.2 ? 0.6 + progress * 0.4 : 0,
            transition: 'opacity 0.4s',
          }}
        >
          Readiness Building
        </div>

        {/* "ELEVENTH ROUND" wordmark — appears in final stretch */}
        <div
          className="font-display uppercase"
          style={{
            fontSize: 'clamp(16px,2.4vw,32px)',
            letterSpacing: '0.16em',
            color: '#c00000',
            marginTop: 8,
            opacity: wordmarkAlpha,
            textShadow: '0 0 24px rgba(192,0,0,0.5)',
          }}
        >
          Eleventh Round
        </div>
      </div>

      {/* Eyebrow — "The Eleventh Round" brand ID */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 font-condensed font-bold uppercase text-gray-3"
        style={{
          fontSize: 10,
          letterSpacing: '0.45em',
          opacity: labelVisible ? 0.4 : 0,
          transition: 'opacity 0.7s',
        }}
      >
        The Eleventh Round
      </div>

      <style>{`
        @keyframes flashPulse {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
