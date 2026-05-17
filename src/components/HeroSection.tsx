import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Generate frame URLs from public/frames/
const TOTAL_FRAMES = 480
const HERO_FRAMES = Array.from({ length: TOTAL_FRAMES }, (_, i) =>
  `/frames/frame_${String(i).padStart(6, '0')}.webp`
)

const CHAPTERS = [
  { range:[0,0.18] as [number,number], eyebrow:'Career Infrastructure · Combat Sports', headline:['Build a Career.','Not Just','a Record.'], sub:'A premium ecosystem for fighter readiness, manager systems, and long-term career development.', cta1:{l:'Explore the Ecosystem',h:'#products'}, cta2:{l:'See the Platform',h:'#dashboard'} },
  { range:[0.18,0.36] as [number,number], eyebrow:'The Problem', headline:['Talent Gets','Wasted Without','Infrastructure.'], sub:'No standardized onboarding. No structured support. Fighters enter unprepared — and most never recover.', cta1:{l:'See the Problems',h:'#problems'}, cta2:{l:'How We Fix It',h:'#products'} },
  { range:[0.36,0.55] as [number,number], eyebrow:'The System', headline:['Professionalism','Creates','Opportunity.'], sub:'The Eleventh Round builds the systems that turn raw talent into career-ready professionals.', cta1:{l:'See the Products',h:'#products'}, cta2:{l:'For Managers',h:'#products'} },
  { range:[0.55,0.75] as [number,number], eyebrow:'SponsorForge', headline:['Readiness is','the Key That','Opens Doors.'], sub:'SponsorForge connects fighters who have done the work with sponsors who value professionalism.', cta1:{l:'SponsorForge Access',h:'/login'}, cta2:{l:'Get Eligible',h:'/login'} },
  { range:[0.75,1.0] as [number,number], eyebrow:'The Eleventh Round', headline:['Become','Eleventh Round','Ready.'], sub:'Development is a system. Readiness is the differentiator.', cta1:{l:'Start for Fighters',h:'/login'}, cta2:{l:'Start for Managers',h:'/login'} },
]

const POSITIONS = ['center','left','left','center','right'] as const

// How many frames to fetch before starting the animation loop
const EAGER_FRAMES    = 30
// Frames to prefetch ahead of + behind current scroll position
const PREFETCH_WINDOW = 60
// Frames to load per background batch (requestIdleCallback / setTimeout)
const BG_BATCH_SIZE   = 8

function AmbientCanvas({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement> }) {
  const cvRef        = useRef<HTMLCanvasElement>(null)
  const ctxRef       = useRef<CanvasRenderingContext2D | null>(null)
  // GPU-resident decoded bitmaps — null until loaded
  const bitmapsRef   = useRef<(ImageBitmap | null)[]>(Array(TOTAL_FRAMES).fill(null))
  const fetchingRef  = useRef<Set<number>>(new Set())   // in-flight fetches
  const targetRef    = useRef(0)   // target frame (float) from scroll
  const currentRef   = useRef(0)   // smoothed current frame (float)
  const rafRef       = useRef(0)
  const loadedRef    = useRef(0)
  const bgTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cover-fit a bitmap into the canvas, return draw params
  const coverFit = (bm: ImageBitmap, w: number, h: number) => {
    const s = Math.max(w / bm.width, h / bm.height)
    return { x: (w - bm.width * s) / 2, y: (h - bm.height * s) / 2, s }
  }

  // Draw exact float index with sub-frame interpolation.
  // Falls back to nearest loaded frame if the exact one isn't decoded yet.
  const drawFrame = (exactIdx: number) => {
    const cv  = cvRef.current
    const ctx = ctxRef.current
    if (!cv || !ctx) return

    const loIdx = Math.floor(exactIdx)
    const hiIdx = Math.min(loIdx + 1, TOTAL_FRAMES - 1)
    const frac  = exactIdx - loIdx

    // Nearest-loaded fallback — walk outward up to 30 frames
    let lo = bitmapsRef.current[loIdx]
    if (!lo) {
      for (let r = 1; r <= 30; r++) {
        lo = bitmapsRef.current[Math.max(0, loIdx - r)]
          ?? bitmapsRef.current[Math.min(TOTAL_FRAMES - 1, loIdx + r)]
          ?? null
        if (lo) break
      }
    }
    if (!lo) return

    const { width: w, height: h } = cv

    // Base frame at full opacity
    const lc = coverFit(lo, w, h)
    ctx.globalAlpha = 1
    ctx.drawImage(lo, lc.x, lc.y, lo.width * lc.s, lo.height * lc.s)

    // Blend next frame on top — silky sub-frame interpolation
    if (frac > 0.005 && hiIdx !== loIdx) {
      const hi = bitmapsRef.current[hiIdx]
      if (hi) {
        const hc = coverFit(hi, w, h)
        ctx.globalAlpha = frac
        ctx.drawImage(hi, hc.x, hc.y, hi.width * hc.s, hi.height * hc.s)
        ctx.globalAlpha = 1
      }
    }
  }

  const resize = () => {
    const cv = cvRef.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    cv.width  = Math.round(window.innerWidth  * dpr)
    cv.height = Math.round(window.innerHeight * dpr)
    cv.style.width  = window.innerWidth  + 'px'
    cv.style.height = window.innerHeight + 'px'
    const ctx = cv.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | null
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctxRef.current = ctx
    }
    drawFrame(currentRef.current)
  }

  const tick = () => {
    rafRef.current = requestAnimationFrame(tick)
    const diff = targetRef.current - currentRef.current
    if (Math.abs(diff) < 0.001) return
    currentRef.current += diff * 0.22
    drawFrame(currentRef.current)
  }

  const updateFromScroll = () => {
    const sec = sectionRef.current
    if (!sec) return
    const rect     = sec.getBoundingClientRect()
    const scrollable = sec.offsetHeight - window.innerHeight
    const prog     = Math.max(0, Math.min(1, -rect.top / scrollable))
    targetRef.current = prog * (TOTAL_FRAMES - 1)
  }

  // ── Lazy loading helpers ──────────────────────────────────────────────────

  // Fetch & decode a single frame; noop if already loaded or in-flight
  const loadFrame = (i: number, onReady?: (bm: ImageBitmap, i: number) => void) => {
    if (i < 0 || i >= TOTAL_FRAMES) return
    if (bitmapsRef.current[i] || fetchingRef.current.has(i)) return
    fetchingRef.current.add(i)

    const handle = (bm: ImageBitmap) => {
      bitmapsRef.current[i] = bm
      loadedRef.current++
      onReady?.(bm, i)
    }

    fetch(HERO_FRAMES[i])
      .then(r => r.blob())
      .then(blob => createImageBitmap(blob, { premultiplyAlpha:'none', colorSpaceConversion:'none' }))
      .then(handle)
      .catch(() => {
        const img = new Image()
        img.onload = () => createImageBitmap(img).then(handle).catch(() => {})
        img.src = HERO_FRAMES[i]
      })
  }

  // Prefetch PREFETCH_WINDOW frames around the current scroll target
  const prefetchAroundTarget = () => {
    const center = Math.round(targetRef.current)
    const lo = Math.max(0, center - PREFETCH_WINDOW / 2)
    const hi = Math.min(TOTAL_FRAMES - 1, center + PREFETCH_WINDOW / 2)
    for (let i = lo; i <= hi; i++) loadFrame(i)
  }

  // Load remaining frames in small idle batches so we never block the main thread
  const scheduleBgLoad = (startIdx: number) => {
    if (startIdx >= TOTAL_FRAMES) return
    bgTimerRef.current = setTimeout(() => {
      const end = Math.min(TOTAL_FRAMES, startIdx + BG_BATCH_SIZE)
      for (let i = startIdx; i < end; i++) loadFrame(i)
      scheduleBgLoad(end)
    }, 50)   // 50 ms gap keeps the main thread breathing
  }

  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', updateFromScroll, { passive: true })
    window.addEventListener('scroll', prefetchAroundTarget, { passive: true })

    // Called each time a bitmap finishes decoding
    const onEagerReady = (bm: ImageBitmap, i: number) => {
      if (i === 0) drawFrame(0)   // paint instantly when frame 0 arrives
      if (loadedRef.current === EAGER_FRAMES) {
        updateFromScroll()
        rafRef.current = requestAnimationFrame(tick)
        // Hand off the rest to background loading
        scheduleBgLoad(EAGER_FRAMES)
      }
    }

    // Eagerly load only the first N frames — animation starts as soon as they're ready
    for (let i = 0; i < EAGER_FRAMES; i++) loadFrame(i, onEagerReady)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', updateFromScroll)
      window.removeEventListener('scroll', prefetchAroundTarget)
      cancelAnimationFrame(rafRef.current)
      if (bgTimerRef.current !== null) clearTimeout(bgTimerRef.current)
      bitmapsRef.current.forEach(bm => bm?.close())
    }
  }, [])

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* No w-full/h-full on canvas — JS sets exact pixel dimensions for HiDPI */}
      <canvas ref={cvRef} className="absolute inset-0" />
    </div>
  )
}

export default function HeroSection() {
  const sectionRef   = useRef<HTMLDivElement>(null)
  const redLightRef  = useRef<HTMLDivElement>(null)
  const chRef        = useRef(0)
  const [ch, setCh]           = useState(0)
  const [exiting, setExiting] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  // GSAP parallax on the atmospheric red light layer
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || !redLightRef.current || !sectionRef.current) return

    const ctx = gsap.context(() => {
      gsap.to(redLightRef.current, {
        yPercent: -28,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const sec=sectionRef.current; if(!sec) return
      const prog=Math.max(0,Math.min(1,-sec.getBoundingClientRect().top/(sec.offsetHeight-window.innerHeight)))
      const idx=CHAPTERS.findIndex(c=>prog>=c.range[0]&&prog<c.range[1])
      const resolved=idx===-1?CHAPTERS.length-1:idx
      if(resolved!==chRef.current){
        chRef.current=resolved
        setExiting(true)
        if(timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current=setTimeout(()=>{ setCh(resolved); setExiting(false) },300)
      }
    }
    window.addEventListener('scroll',onScroll,{passive:true})
    return ()=>window.removeEventListener('scroll',onScroll)
  },[])

  useEffect(()=>{ const t=setTimeout(()=>setRevealed(true),150); return()=>clearTimeout(t) },[])

  const chapter = CHAPTERS[ch]
  const pos     = POSITIONS[ch]

  const baseStyle = (delay: number): React.CSSProperties => ({
    opacity:   revealed && !exiting ? 1 : 0,
    transform: revealed && !exiting ? 'translateX(0)' : exiting ? 'translateX(60px)' : 'translateX(-60px)',
    transition: exiting
      ? `opacity 0.28s ease, transform 0.28s ease`
      : `opacity 0.6s ${delay}s cubic-bezier(.25,.46,.45,.94), transform 0.6s ${delay}s cubic-bezier(.25,.46,.45,.94)`,
  })

  const wrapStyle: React.CSSProperties =
    pos==='center' ? { left:'50%', transform:'translateX(-50%)', alignItems:'center', textAlign:'center', maxWidth:860 } :
    pos==='right'  ? { right:0, paddingRight:'clamp(40px,8vw,120px)', alignItems:'flex-end', textAlign:'right', maxWidth:700 } :
                     { left:0, paddingLeft:'clamp(40px,8vw,120px)', alignItems:'flex-start', textAlign:'left', maxWidth:'min(92vw, 1000px)' }

  return (
    <section ref={sectionRef} id="hero" style={{height:'600vh'}}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <AmbientCanvas sectionRef={sectionRef} />

        {/* ── Layered atmospheric overlays ── */}

        {/* Base dark gradient — top and bottom vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(to bottom, rgba(8,8,8,0.6) 0%, rgba(8,8,8,0.18) 25%, rgba(8,8,8,0.22) 60%, rgba(8,8,8,0.97) 100%)',
        }} />

        {/* Cinematic vignette — pushes edges dark */}
        <div className="cinematic-vignette" />

        {/* Red atmospheric accent — bottom-left, parallaxed by GSAP */}
        <div ref={redLightRef} className="absolute inset-0 pointer-events-none gpu" style={{
          background: 'radial-gradient(ellipse at 12% 88%, rgba(139,0,0,0.32) 0%, transparent 48%)',
        }} />

        {/* Secondary red accent — top-right (static) */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 88% 18%, rgba(100,0,0,0.16) 0%, transparent 38%)',
        }} />

        {/* Arena floor glow — warm light from below */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
          height: 280,
          background: 'linear-gradient(to top, rgba(60,0,0,0.28) 0%, transparent 100%)',
        }} />

        {/* Copy block */}
        <div className="absolute inset-0 flex flex-col justify-center z-10" style={wrapStyle}>

          {/* Eyebrow */}
          <div
            className="eyebrow mb-5"
            style={{ ...baseStyle(0.05) }}
          >
            {chapter.eyebrow}
          </div>

          {/* Headline — each line clips from overflow:hidden */}
          <div className="mb-7">
            {chapter.headline.map((line,i) => (
              <div key={`${ch}-${i}`} style={{ overflow:'hidden', lineHeight:0.86 }}>
                <span className="block font-display uppercase" style={{
                  fontSize: 'clamp(64px,9.2vw,144px)',
                  letterSpacing: '-0.02em',
                  color: i===1 ? '#C41E3A' : '#f0ece4',
                  textShadow: '0 2px 80px rgba(0,0,0,0.98)',
                  opacity: revealed&&!exiting ? 1 : 0,
                  transform: revealed&&!exiting ? 'translateY(0)' : exiting ? 'translateY(-105%)' : 'translateY(105%)',
                  transition: exiting
                    ? `opacity 0.22s ease, transform 0.22s ease`
                    : `opacity 0.65s ${0.12+i*0.08}s cubic-bezier(.25,.46,.45,.94),
                       transform 0.65s ${0.12+i*0.08}s cubic-bezier(.25,.46,.45,.94)`,
                }}>
                  {line}
                </span>
              </div>
            ))}
          </div>

          {/* Sub */}
          <p
            className="font-narrow text-gray-1 mb-10"
            style={{ fontSize:'clamp(14px,1.5vw,18px)', lineHeight:1.7, maxWidth:460, ...baseStyle(0.30) }}
          >
            {chapter.sub}
          </p>

          {/* CTAs */}
          <div
            className={`flex gap-3 flex-wrap ${pos==='center'?'justify-center':pos==='right'?'justify-end':''}`}
            style={baseStyle(0.42)}
          >
            <a href={chapter.cta1.h} className="btn-primary">{chapter.cta1.l}</a>
            <a href={chapter.cta2.h} className="btn-ghost">{chapter.cta2.l}</a>
          </div>
        </div>

        {/* ── Fight-card chapter progress rail ── */}
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20"
          aria-hidden
        >
          {CHAPTERS.map((_,i) => (
            <div key={i} className="flex items-center gap-2 justify-end">
              {/* Round number — only shown for active chapter */}
              <span
                className="font-condensed font-bold text-blood-glow"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  opacity: i===ch ? 0.8 : 0,
                  transition: 'opacity 0.4s',
                  minWidth: 16,
                  textAlign: 'right',
                }}
              >
                {String(i+1).padStart(2,'0')}
              </span>
              {/* Dash tick */}
              <div style={{
                height: 1.5,
                width: i===ch ? 28 : 10,
                background: i===ch ? '#c00000' : 'rgba(255,255,255,0.13)',
                boxShadow: i===ch ? '0 0 8px rgba(192,0,0,0.7)' : 'none',
                transition: 'width 0.45s cubic-bezier(.25,.46,.45,.94), background 0.4s, box-shadow 0.4s',
              }} />
            </div>
          ))}
        </div>

        {/* ── Cinematic scroll cue ── */}
        {ch===0&&revealed&&(
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-10"
            style={{ animation:'heroCueIn 1s 2.5s both' }}
          >
            {/* Sliding red line */}
            <div style={{ width:1, height:52, position:'relative', overflow:'hidden' }}>
              <div style={{
                position:'absolute', top:0, left:0, right:0, bottom:0,
                background:'linear-gradient(to bottom, transparent 0%, #c00000 30%, #c00000 70%, transparent 100%)',
                animation:'scrollLinePulse 2.4s ease-in-out infinite',
              }} />
            </div>
            <span
              className="font-condensed font-bold uppercase text-gray-3"
              style={{ fontSize:9, letterSpacing:'0.5em' }}
            >
              Scroll
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes heroCueIn { from{opacity:0} to{opacity:1} }
      `}</style>
    </section>
  )
}
