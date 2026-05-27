import React, { useState, useEffect } from 'react'

interface Props {
  images: string[]
  compact?: boolean
}

// Noise SVG — same subtle grain used site-wide
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

export default function ProductImageViewer({ images, compact = false }: Props) {
  const [idx, setIdx]         = useState(0)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (images.length <= 1) return
    // Card: cycle only while hovered. Modal: cycle always, pause on hover.
    if (compact ? !hovered : hovered) return
    const t = setTimeout(
      () => setIdx(i => (i + 1) % images.length),
      compact ? 1800 : 2500,
    )
    return () => clearTimeout(t)
  }, [idx, hovered, compact, images.length])

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        background: '#0d0d0f',
        cursor: compact ? 'default' : 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={compact ? undefined : () => setIdx(i => (i + 1) % images.length)}
    >
      {/* ── Atmospheric layers (behind garment) ── */}

      {/* Blood red ambient — centered radial, more intense in modal */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: compact
            ? 'radial-gradient(ellipse at 50% 70%, rgba(139,0,0,0.10) 0%, transparent 62%)'
            : 'radial-gradient(ellipse at 50% 65%, rgba(139,0,0,0.16) 0%, transparent 58%), radial-gradient(ellipse at 20% 90%, rgba(100,0,0,0.08) 0%, transparent 40%)',
        }}
      />

      {/* Noise grain — same recipe as the site-wide noise-overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: NOISE,
          backgroundSize: '128px 128px',
          opacity: 0.028,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Edge vignette — keeps garment centre-stage */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(5,5,7,0.72) 100%)',
        }}
      />

      {/* Bottom fade — grounds the garment */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-0"
        style={{
          height: compact ? 60 : 100,
          background: 'linear-gradient(to top, rgba(8,8,10,0.75) 0%, transparent 100%)',
        }}
      />

      {/* ── Garment images ── */}
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full z-10"
          style={{
            objectFit: 'contain',
            opacity: i === idx ? 1 : 0,
            transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1)',
            // Drop-shadow follows the transparent silhouette — adds depth without a box
            filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.7)) drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
            // Slight padding so the shadow has room to breathe
            padding: compact ? '8%' : '6%',
          }}
        />
      ))}

      {/* ── Progress dots — modal only ── */}
      {!compact && images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20 pointer-events-none">
          {images.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 20 : 6,
                height: 2,
                background: i === idx ? '#c41e3a' : 'rgba(255,255,255,0.2)',
                transition: 'width 0.3s ease, background 0.3s ease',
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
