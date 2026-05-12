import React, { useEffect, useRef, useState } from 'react'
import { HERO_FRAMES } from '../data/frames'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const CHAPTERS = [
  { range:[0,0.18] as [number,number], eyebrow:'Career Infrastructure · Combat Sports', headline:['Build a Career.','Not Just','a Record.'], sub:'A premium ecosystem for fighter readiness, manager systems, and long-term career development.', cta1:{l:'Explore the Ecosystem',h:'#products'}, cta2:{l:'See the Platform',h:'#dashboard'} },
  { range:[0.18,0.36] as [number,number], eyebrow:'The Problem', headline:['Talent Gets','Wasted Without','Infrastructure.'], sub:'No standardized onboarding. No structured support. Fighters enter unprepared — and most never recover.', cta1:{l:'See the Problems',h:'#problems'}, cta2:{l:'How We Fix It',h:'#products'} },
  { range:[0.36,0.55] as [number,number], eyebrow:'The System', headline:['Professionalism','Creates','Opportunity.'], sub:'The Eleventh Round builds the systems that turn raw talent into career-ready professionals.', cta1:{l:'See the Products',h:'#products'}, cta2:{l:'For Managers',h:'#products'} },
  { range:[0.55,0.75] as [number,number], eyebrow:'SponsorForge', headline:['Readiness is','the Key That','Opens Doors.'], sub:'SponsorForge connects fighters who have done the work with sponsors who value professionalism.', cta1:{l:'SponsorForge Access',h:'/login'}, cta2:{l:'Get Eligible',h:'/login'} },
  { range:[0.75,1.0] as [number,number], eyebrow:'The Eleventh Round', headline:['Become','Eleventh Round','Ready.'], sub:'Development is a system. Readiness is the differentiator.', cta1:{l:'Start for Fighters',h:'/login'}, cta2:{l:'Start for Managers',h:'/login'} },
]

const POSITIONS = ['center','left','right','center','right'] as const

function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgsRef   = useRef<HTMLImageElement[]>([])
  const frameRef  = useRef(0)
  const rafRef    = useRef(0)
  const ctxRef    = useRef<CanvasRenderingContext2D|null>(null)
  const loadedRef = useRef(0)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    ctxRef.current = cv.getContext('2d')
    const resize = () => { cv.width=window.innerWidth; cv.height=window.innerHeight; draw(frameRef.current) }
    resize()
    window.addEventListener('resize', resize)
    imgsRef.current = HERO_FRAMES.map(src => {
      const img = new Image()
      img.onload = () => { loadedRef.current++; if (loadedRef.current===1) loop() }
      img.src = `data:image/jpeg;base64,${src}`
      return img
    })
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(rafRef.current) }
  }, [])

  function draw(idx: number) {
    const ctx=ctxRef.current, cv=canvasRef.current, img=imgsRef.current[idx]
    if (!ctx||!cv||!img?.complete) return
    const s=Math.max(cv.width/img.naturalWidth, cv.height/img.naturalHeight)
    ctx.clearRect(0,0,cv.width,cv.height)
    ctx.drawImage(img,(cv.width-img.naturalWidth*s)/2,(cv.height-img.naturalHeight*s)/2,img.naturalWidth*s,img.naturalHeight*s)
  }

  function loop() {
    let last=0
    const tick=(now:number)=>{ rafRef.current=requestAnimationFrame(tick); if(now-last<240)return; last=now; frameRef.current=(frameRef.current+1)%HERO_FRAMES.length; draw(frameRef.current) }
    rafRef.current=requestAnimationFrame(tick)
  }

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
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
    pos==='right'  ? { right:0, paddingRight:'clamp(40px,8vw,120px)', alignItems:'flex-end', textAlign:'right', maxWidth:680 } :
                     { left:0, paddingLeft:'clamp(40px,8vw,120px)', alignItems:'flex-start', textAlign:'left', maxWidth:680 }

  return (
    <section ref={sectionRef} id="hero" style={{height:'600vh'}}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <AmbientCanvas />

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
            className="font-condensed font-bold uppercase text-blood-glow mb-5"
            style={{ fontSize:'clamp(10px,1.1vw,13px)', letterSpacing:'0.5em', ...baseStyle(0.05) }}
          >
            {chapter.eyebrow}
          </div>

          {/* Headline — each line clips from overflow:hidden */}
          <div className="mb-7">
            {chapter.headline.map((line,i) => (
              <div key={`${ch}-${i}`} style={{ overflow:'hidden', lineHeight:0.87 }}>
                <span className="block font-display uppercase" style={{
                  fontSize: 'clamp(56px,8.2vw,128px)',
                  letterSpacing: '0.01em',
                  color: i===1 ? '#c00000' : '#f0ece4',
                  textShadow: '0 2px 60px rgba(0,0,0,0.98)',
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
            className="font-condensed font-light text-gray-1 mb-10"
            style={{ fontSize:'clamp(14px,1.55vw,19px)', letterSpacing:'0.04em', lineHeight:1.65, maxWidth:460, ...baseStyle(0.30) }}
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
