import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

interface Detail    { title:string; desc:string; features:string[]; cta:string; ctaRoute:string }
interface ChildNode { id:string; label:string; point:string; detail:Detail }
interface TreeNode  { id:string; label:string; sublabel:string; point:string; color:string; children:ChildNode[]; detail:Detail }

const ROOTS: TreeNode[] = [
  {
    id:'fighters', label:'Fighters', sublabel:'Pipeline', point:'Build a career, not just a record', color:'#a00000',
    detail:{title:'Fighter Platform',desc:'For amateurs, early pros, and fighters who think long-term. Build a real career — stabilize income, protect your future, move with strategy.',features:['Eleventh Round Ready Pipeline','SponsorForge access','Financial Literacy','Brand & digital readiness','Mentorship & consulting','Transition planning'],cta:'Start for Fighters',ctaRoute:'/login'},
    children:[
      {id:'career',    label:'Career Strategy',    point:'Map your path, control your timeline',      detail:{title:'Career Strategy',    desc:'Build a five-year vision with milestones, pace, and strategy.',              features:['Multi-year roadmap','Fight pace planning','Goal tracking','Manager co-view'],         cta:'Start Pipeline',    ctaRoute:'/login'}},
      {id:'financial', label:'Financial Literacy', point:'Budgeting, taxes, stability between fights', detail:{title:'Financial Literacy',  desc:'Real education on budgeting, taxes, and building financial stability.',      features:['Budget templates','Tax basics','Camp cost planning','Income smoothing'],            cta:'Access Module',    ctaRoute:'/login'}},
      {id:'brand',     label:'Brand Readiness',    point:'Build the profile sponsors want',           detail:{title:'Brand & Sponsorship', desc:"Build a professional digital identity so when opportunity arrives, you're ready.", features:['Digital audit','Social guide','Media kit builder','NIL education'],            cta:'Build Profile',    ctaRoute:'/login'}},
      {id:'sf',        label:'SponsorForge',        point:'Unlock vetted sponsor opportunities',       detail:{title:'SponsorForge',        desc:'Connects readiness-verified fighters with vetted sponsors.',                  features:['Sponsor matching','Deal structuring','Obligation tracking','Vetted network'],      cta:'Check Eligibility',ctaRoute:'/login'}},
      {id:'transition',label:'Transition Plan',    point:'Life and career beyond the ring',           detail:{title:'Transition Blueprint', desc:'Strategic planning for the career beyond active competition.',                features:['Career mapping','Skills inventory','Business pathways','Financial runway'],       cta:'Start Planning',   ctaRoute:'/login'}},
    ],
  },
  {
    id:'managers', label:'Managers', sublabel:'MGMT-SUITE', point:'Better systems. Fewer fires. Stronger fighters.', color:'#7a0a0a',
    detail:{title:'Manager System',desc:'MGMT-SUITE Lite is the operational backbone independent managers never had. Better systems. Fewer fires.',features:['Fighter onboarding','Obligation tracking','Crisis playbooks','Budget planning','SponsorForge monitoring','Professionalism ratings'],cta:'Start for Managers',ctaRoute:'/login'},
    children:[
      {id:'onboarding',label:'Onboarding',      point:'White-labeled structured fighter intake',    detail:{title:'Fighter Onboarding',  desc:'Capture everything managers need from day one. No more blind spots.', features:['White-labeled intake','Medical history','Financial snapshot','Goal alignment'],    cta:'Setup Roster',     ctaRoute:'/login'}},
      {id:'oblig',     label:'Obligations',      point:'Never miss a sponsor or media commitment',   detail:{title:'Obligation Tracking', desc:'Every commitment logged, monitored, surfaced before it becomes a problem.',features:['Auto-reminders','Fulfillment tracking','Per-fighter view','Sponsor reporting'], cta:'Track Obligations',ctaRoute:'/login'}},
      {id:'playbooks', label:'Crisis Playbooks', point:'Handle conduct incidents professionally',    detail:{title:'Crisis Playbooks',    desc:'Ready-to-use processes for every management scenario.',               features:['Conduct protocol','Media crisis guide','Suspension playbook','Legal referral'],   cta:'Access Playbooks', ctaRoute:'/login'}},
      {id:'budget',    label:'Budget & Camp',    point:'Operational infrastructure for fight prep',  detail:{title:'Budget & Camp',       desc:'Plan every camp with full financial visibility.',                     features:['Camp budget builder','Cost tracking','Multi-fighter view','Historical compare'],cta:'Plan Camp',        ctaRoute:'/login'}},
    ],
  },
  {
    id:'promotions', label:'Promotions', sublabel:'PRMTN-HUB', point:'Track professionalism. Build a credible operation.', color:'#5a1010',
    detail:{title:'Promotions Hub',desc:'Infrastructure for event operators. Track professionalism, monitor compliance, and build a more credible fight organization.',features:['Event professionalism logs','Sponsor compliance','Fighter evaluation','Post-event reports','Integrity scoring','Promotion analytics'],cta:'Start for Promotions',ctaRoute:'/login'},
    children:[
      {id:'compliance',label:'Compliance Suite',point:'Full tracking of fighter obligations per event',detail:{title:'Event Compliance',   desc:'Ensure every fighter obligation is documented and fulfilled.',       features:['Pre-event checklist','Obligation log','Post-event audit','Sponsor reporting'],  cta:'Setup Events',    ctaRoute:'/login'}},
      {id:'integrity', label:'Integrity Board', point:'Real-time promotion professionalism score',    detail:{title:'Integrity Dashboard',desc:"Real-time view of your promotion's professionalism score.",           features:['Live integrity score','Event log','Flag tracking','Trend analysis'],             cta:'View Dashboard',  ctaRoute:'/login'}},
      {id:'evaluation',label:'Fighter Eval.',   point:'Baseline data for booking decisions',          detail:{title:'Fighter Evaluation', desc:'Objective readiness data to inform booking and development decisions.',features:['Readiness scoring','Conduct history','Media performance','Sponsor reliability'],cta:'Evaluate Roster', ctaRoute:'/login'}},
    ],
  },
]

// Tooltip — always above the node to avoid overlapping adjacent nodes
function Tooltip({ text, visible }: { text:string; visible:boolean }) {
  return (
    <div className="absolute pointer-events-none z-50 whitespace-nowrap" style={{
      top:'calc(100% + 10px)',
      left:'50%',
      transform:`translateX(-50%) translateY(${visible?0:-4}px)`,
      opacity:visible?1:0,
      transition:'opacity 0.2s, transform 0.2s',
    }}>
      <span className="font-condensed italic text-gray-2"
        style={{fontSize:11, letterSpacing:'0.05em'}}>
        {text}
      </span>
    </div>
  )
}

function CircleNode({ label, sublabel, point, active, hovered, onEnter, onLeave, onClick, size, color }:{
  label:string; sublabel?:string; point:string; active:boolean; hovered:boolean
  onEnter:()=>void; onLeave:()=>void; onClick:()=>void
  size:number; color:string
}) {
  return (
    <div className="relative flex flex-col items-center cursor-pointer select-none"
      style={{minWidth:size}} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
      <Tooltip text={point} visible={hovered} />
      <div className="rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0"
        style={{
          width:size, height:size,
          background:active?color:hovered?`${color}22`:'#141416',
          border:`2px solid ${active?color:hovered?color:'#2a2a2e'}`,
          boxShadow:active?`0 0 24px ${color}55,0 0 48px ${color}20`:hovered?`0 0 12px ${color}33`:'none',
          transform:(hovered||active)?'scale(1.1)':'scale(1)',
        }}>
        <span className="font-condensed font-bold text-center px-1.5 leading-tight"
          style={{fontSize:size>72?12:10,color:active?'#f0ece4':hovered?'#b8b4ae':'#7a7672',letterSpacing:'0.04em'}}>
          {label}
        </span>
      </div>
      {sublabel&&(
        <div className="font-condensed font-bold uppercase mt-1.5 text-center transition-colors duration-300"
          style={{fontSize:9,letterSpacing:'0.3em',color:active?color:'#4a4846'}}>
          {sublabel}
        </div>
      )}
    </div>
  )
}

function DetailModal({ node, color, onClose }:{ node:ChildNode|TreeNode; color:string; onClose:()=>void }) {
  const navigate = useNavigate()
  const [vis,setVis]=useState(false)
  useEffect(()=>{const t=setTimeout(()=>setVis(true),10);return()=>clearTimeout(t)},[])
  const d=node.detail
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center px-5"
      style={{background:`rgba(0,0,0,${vis?0.8:0})`,backdropFilter:vis?'blur(10px)':'none',transition:'background 0.3s,backdrop-filter 0.3s'}}
      onClick={onClose}>
      <div className="relative bg-charcoal border border-charcoal-3 overflow-hidden w-full max-w-[540px]"
        style={{transform:vis?'translateY(0)':'translateY(24px)',opacity:vis?1:0,transition:'transform 0.35s cubic-bezier(.25,.46,.45,.94),opacity 0.3s'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:color,opacity:0.9}} />
        <div className="absolute inset-0 pointer-events-none" style={{background:`radial-gradient(ellipse at 85% 10%,${color}18 0%,transparent 55%)`}} />
        <div className="relative z-10 p-10">
          <button onClick={onClose} className="absolute top-5 right-5 text-gray-3 hover:text-off-white transition-colors bg-transparent border-0 cursor-pointer" style={{fontSize:22,lineHeight:1}}>×</button>
          <h2 className="font-display text-off-white uppercase mb-5" style={{fontSize:'clamp(30px,3.5vw,50px)',lineHeight:0.92}}>{d.title}</h2>
          <p className="font-body font-light text-gray-1 leading-relaxed mb-7" style={{fontSize:14}}>{d.desc}</p>
          <div className="grid grid-cols-2 gap-0 mb-8">
            {d.features.map((f,i)=>(
              <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-charcoal-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blood-glow mt-1.5 flex-shrink-0"/>
                <span className="font-condensed font-medium text-gray-1" style={{fontSize:12,letterSpacing:'0.04em'}}>{f}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button className="btn-primary" onClick={()=>navigate(d.ctaRoute)}>{d.cta}</button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductsSection() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const sectionRef    = useRef<HTMLElement>(null)
  const headerRef     = useRef<HTMLDivElement>(null)
  const line1Ref      = useRef<HTMLSpanElement>(null)
  const line2Ref      = useRef<HTMLSpanElement>(null)
  const leaveTimer    = useRef<ReturnType<typeof setTimeout>|null>(null)
  const [cw, setCw]   = useState(1100)
  const [activeRoot,  setActiveRoot]  = useState<string|null>(null)
  const [hovRoot,     setHovRoot]     = useState<string|null>(null)
  const [hovChild,    setHovChild]    = useState<string|null>(null)
  const [detail,      setDetail]      = useState<{node:ChildNode|TreeNode;color:string}|null>(null)

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }
  }, [])

  const scheduleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => { setHovRoot(null); setHovChild(null) }, 120)
  }, [])

  useEffect(()=>{
    const obs=new ResizeObserver(e=>setCw(e[0].contentRect.width))
    if(containerRef.current) obs.observe(containerRef.current)
    return()=>obs.disconnect()
  },[])

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || !headerRef.current) return
    const ctx = gsap.context(() => {
      gsap.from([line1Ref.current, line2Ref.current], {
        y: '110%',
        duration: 1.1,
        stagger: 0.09,
        ease: 'power4.out',
        scrollTrigger: { trigger: headerRef.current, start: 'top 80%' },
      })
    }, headerRef)
    return () => ctx.revert()
  }, [])

  // ── Layout math ────────────────────────────────────────────
  // Tree is a compact centered group — NOT edge-to-edge
  const ROOT_SIZE  = 80
  const CHILD_SIZE = 58
  const ROOT_GAP   = Math.min(220, cw * 0.22)  // gap between root centers, capped
  const TREE_W     = ROOT_GAP * (ROOTS.length - 1)  // total span of roots
  const CENTER_X   = cw / 2
  const ROOT_Y     = 108   // center Y
  const CHILD_Y    = 252   // center Y of children
  const SVG_H      = 330

  // Root X positions — centered as a compact group
  const rootXs = ROOTS.map((_,i) => CENTER_X - TREE_W/2 + i*ROOT_GAP)

  // Child positions — fan from parent, clamped inside container
  const getChildXs = (rootIdx: number, n: number) => {
    const cx      = rootXs[rootIdx]
    const spacing = Math.min(84, (cw * 0.3) / Math.max(n-1,1))
    const total   = (n-1) * spacing
    return Array.from({length:n},(_,i) => {
      const x = cx - total/2 + i*spacing
      const margin = CHILD_SIZE/2 + 4
      return Math.max(margin, Math.min(cw-margin, x))
    })
  }

  const openRoot = activeRoot ?? hovRoot
  const openData = openRoot ? ROOTS.find(r=>r.id===openRoot) : null

  return (
    <section ref={sectionRef} id="products" className="bg-black py-32 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{background:'radial-gradient(ellipse at 50% 70%,rgba(60,0,0,0.07) 0%,transparent 60%)'}}/>

      <div className="max-w-[1300px] mx-auto px-10">
        <div ref={headerRef}>
          <div className="sec-label reveal mb-5">The Ecosystem</div>
          <h2 className="font-display text-off-white uppercase mb-2"
            style={{fontSize:'clamp(52px,7.5vw,116px)',lineHeight:0.87,letterSpacing:'-0.02em'}}>
            <div className="line-clip"><span ref={line1Ref} className="block">Built for</span></div>
            <div className="line-clip"><span ref={line2Ref} className="block">Every Role.</span></div>
          </h2>
        </div>
        <p className="reveal font-narrow italic text-gray-3 mb-14 uppercase"
          style={{fontSize:12,letterSpacing:'0.2em',marginTop:'1rem'}}>
          Hover to preview · Click a node to expand
        </p>
      </div>

      {/* Tree */}
      <div ref={containerRef} className="relative w-full" style={{height:SVG_H}}>
        <svg className="absolute inset-0 w-full pointer-events-none" style={{height:SVG_H}}>
          {/* Root spine */}
          <line
            x1={rootXs[0]} y1={ROOT_Y}
            x2={rootXs[ROOTS.length-1]} y2={ROOT_Y}
            stroke="#222226" strokeWidth="1" strokeDasharray="4 4"/>

          {/* Top → roots */}
          {ROOTS.map((r,i)=>(
            <path key={`t${i}`}
              d={`M ${CENTER_X} 0 Q ${CENTER_X} ${ROOT_Y*0.42} ${rootXs[i]} ${ROOT_Y-ROOT_SIZE/2-2}`}
              fill="none"
              stroke={openRoot===r.id?r.color:'#2a2a2e'}
              strokeWidth={openRoot===r.id?1.5:1}
              strokeDasharray={openRoot===r.id?'none':'4 4'}
              style={{transition:'stroke 0.3s,stroke-width 0.3s'}}/>
          ))}

          {/* Root → children */}
          {openData&&getChildXs(ROOTS.findIndex(r=>r.id===openData.id),openData.children.length).map((cx,ci)=>(
            <line key={`cl${ci}`}
              x1={rootXs[ROOTS.findIndex(r=>r.id===openData.id)]} y1={ROOT_Y+ROOT_SIZE/2}
              x2={cx} y2={CHILD_Y-CHILD_SIZE/2-2}
              stroke={openData.color} strokeWidth="1.5" strokeDasharray="5 4"
              style={{animation:`fadeInLine 0.3s ease ${ci*0.04}s both`}}/>
          ))}
        </svg>

        {/* "THE ECOSYSTEM" label */}
        <div className="absolute flex flex-col items-center" style={{left:'50%',top:0,transform:'translateX(-50%)'}}>
          <div className="font-condensed font-bold uppercase text-off-white border border-charcoal-3 bg-charcoal px-5 py-1.5 whitespace-nowrap"
            style={{fontSize:10,letterSpacing:'0.45em'}}>THE ECOSYSTEM</div>
          <div className="w-px bg-charcoal-3" style={{height:22}}/>
        </div>

        {/* Root nodes */}
        {ROOTS.map((root,i)=>(
          <div key={root.id} className="absolute" style={{left:rootXs[i],top:ROOT_Y-ROOT_SIZE/2,transform:'translateX(-50%)',zIndex:10}}
            onMouseEnter={()=>{ cancelLeave(); setHovRoot(root.id) }}
            onMouseLeave={scheduleLeave}>
            <CircleNode
              label={root.label} sublabel={root.sublabel} point={root.point}
              active={activeRoot===root.id || hovRoot===root.id}
              hovered={false}
              onEnter={()=>{ cancelLeave(); setHovRoot(root.id) }} onLeave={scheduleLeave}
              onClick={()=>setActiveRoot(p=>p===root.id?null:root.id)}
              size={ROOT_SIZE} color={root.color}/>
          </div>
        ))}

        {/* Children */}
        {openData&&(()=>{
          const ri=ROOTS.findIndex(r=>r.id===openData.id)
          const childXs=getChildXs(ri,openData.children.length)
          return openData.children.map((child,ci)=>(
            <div key={child.id} className="absolute" style={{left:childXs[ci],top:CHILD_Y-CHILD_SIZE/2,transform:'translateX(-50%)',zIndex:10,animation:`nodeAppear 0.32s cubic-bezier(.25,.46,.45,.94) ${ci*0.05}s both`}}
              onMouseEnter={()=>{ cancelLeave(); setHovChild(child.id) }} onMouseLeave={()=>{ setHovChild(null); scheduleLeave() }}>
              <CircleNode
                label={child.label} point={child.point}
                active={false} hovered={hovChild===child.id}
                onEnter={()=>setHovChild(child.id)} onLeave={()=>setHovChild(null)}
                onClick={()=>setDetail({node:child,color:openData.color})}
                size={CHILD_SIZE} color={openData.color}/>
            </div>
          ))
        })()}
      </div>

      {/* Info strip — hover OR active keeps it open */}
      <div className="max-w-[1300px] mx-auto px-10 mt-2" style={{minHeight:openData?'auto':0}}>
        {openData&&(
          <div className="border border-charcoal-3 p-8 relative overflow-hidden"
            style={{background:'#0c0c0d',animation:'fadeIn 0.3s ease'}}
            onMouseEnter={()=>{ cancelLeave(); setHovRoot(openData.id) }}
            onMouseLeave={scheduleLeave}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:openData.color,opacity:0.85}} />
            <div className="absolute inset-0 pointer-events-none" style={{background:`radial-gradient(ellipse at 5% 50%,${openData.color}12 0%,transparent 50%)`}}/>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div>
                <div className="font-condensed font-bold uppercase text-blood-glow mb-2" style={{fontSize:9,letterSpacing:'0.5em'}}>{openData.sublabel}</div>
                <h3 className="font-display text-off-white uppercase mb-4" style={{fontSize:'clamp(28px,3vw,46px)',lineHeight:0.92}}>{openData.detail.title}</h3>
                <p className="font-body font-light text-gray-1 leading-relaxed" style={{fontSize:14}}>{openData.detail.desc}</p>
              </div>
              <div>
                <div className="grid grid-cols-2 gap-0 mb-6">
                  {openData.detail.features.map((f,i)=>(
                    <div key={i} className="flex items-start gap-2 py-2.5 border-b border-charcoal-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blood-glow mt-1.5 flex-shrink-0"/>
                      <span className="font-condensed font-medium text-gray-1" style={{fontSize:12,letterSpacing:'0.04em'}}>{f}</span>
                    </div>
                  ))}
                </div>
                <button className="btn-primary text-[10px] py-2.5 px-6" onClick={()=>setDetail({node:openData,color:openData.color})}>{openData.detail.cta}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Podcast & Apparel — dedicated home sections ── */}
      <div className="max-w-[1300px] mx-auto px-10 mt-24">
        <div className="red-rule mb-16"/>

        {/* Podcast */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24 reveal">
          <div>
            <div className="sec-label mb-5">Ecosystem · Audio</div>
            <h2 className="font-display text-off-white uppercase mb-5" style={{fontSize:'clamp(48px,6.5vw,104px)',lineHeight:0.87,letterSpacing:'-0.02em'}}>
              The<br/>Podcast
            </h2>
            <p className="font-body font-light text-gray-1 leading-relaxed mb-4" style={{fontSize:15,maxWidth:480}}>
              Culture. Credibility. Access. Conversations with fighters, managers, attorneys, and business minds who move with substance — not empty hype.
            </p>
            <p className="font-condensed text-gray-3 mb-8" style={{fontSize:13,letterSpacing:'0.06em'}}>
              Fighter stories · Career lessons · Contracts & business · Sponsor strategy
            </p>
            <Link to="/podcast" className="btn-primary">Browse Episodes →</Link>
          </div>
          <div className="border border-charcoal-3 p-10 relative overflow-hidden" style={{background:'#0c0c0d'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,#6a0000,transparent)'}} />
            <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse at 80% 20%,rgba(60,20,20,0.18) 0%,transparent 60%)'}}/>
            <div className="relative z-10">
              <div style={{fontSize:56,opacity:0.15,lineHeight:1,marginBottom:16}}>🎙</div>
              <div className="font-display text-off-white uppercase mb-2" style={{fontSize:28,lineHeight:1}}>New Episodes Weekly</div>
              <div className="font-condensed text-gray-3 mb-6" style={{fontSize:12,letterSpacing:'0.1em'}}>Every conversation earns its place.</div>
              <div className="space-y-2">
                {['E012 — Building a Career After the Belt','E011 — What Sponsors Actually Want','E010 — Managing a Roster Without Burning Out'].map(ep=>(
                  <div key={ep} className="font-condensed text-gray-2 border-b border-charcoal-3 pb-2" style={{fontSize:12}}>{ep}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Apparel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center reveal reveal-delay-1">
          {/* Photo grid */}
          <div className="order-last lg:order-first relative overflow-hidden">
            <div className="grid grid-cols-3 gap-1">
              {[
                '/apparel/IMG_4669.jpeg',
                '/apparel/IMG_4670.jpeg',
                '/apparel/IMG_4671.jpeg',
                '/apparel/IMG_4672.jpeg',
                '/apparel/IMG_4673 (2).jpeg',
                '/apparel/IMG_4674.jpeg',
              ].map((src, i) => (
                <div key={i} className="relative overflow-hidden" style={{aspectRatio:'1/1',background:'#0c0c0d'}}>
                  <img
                    src={src}
                    alt={`Eleventh Round apparel ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  {/* subtle dark overlay */}
                  <div className="absolute inset-0 pointer-events-none" style={{background:'rgba(0,0,0,0.15)'}}/>
                </div>
              ))}
            </div>
            {/* bottom-left badge */}
            <div className="absolute bottom-3 left-3 font-condensed font-bold uppercase px-3 py-1" style={{fontSize:9,letterSpacing:'0.4em',background:'rgba(8,8,8,0.82)',color:'#C41E3A',border:'1px solid #C41E3A44'}}>
              Collections Live Now
            </div>
          </div>

          <div>
            <div className="sec-label mb-5">Ecosystem · Apparel</div>
            <h2 className="font-display text-off-white uppercase mb-5" style={{fontSize:'clamp(48px,6.5vw,104px)',lineHeight:0.87,letterSpacing:'-0.02em'}}>
              Apparel
            </h2>
            <p className="font-body font-light text-gray-1 leading-relaxed mb-4" style={{fontSize:15,maxWidth:480}}>
              Not random merch. Identity. Discipline. Resilience. Collections built around combat sports culture with real meaning behind every piece.
            </p>
            <p className="font-condensed text-gray-3 mb-8" style={{fontSize:13,letterSpacing:'0.06em'}}>
              By sport · By ethos · Premium quality · Worn with purpose
            </p>
            <Link to="/apparel" className="btn-primary">Shop Collections →</Link>
          </div>
        </div>
      </div>

      {detail&&<DetailModal node={detail.node} color={detail.color} onClose={()=>setDetail(null)}/>}

      <style>{`
        @keyframes nodeAppear{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeInLine{from{opacity:0}to{opacity:1}}
      `}</style>
    </section>
  )
}
