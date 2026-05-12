import React, { useState, useEffect } from 'react'
import IntroSequence from '../components/IntroSequence'
import Navbar from '../components/Navbar'
import HeroSection from '../components/HeroSection'
import ProblemsSection from '../components/ProblemsSection'
import ProductsCarousel from '../components/ProductsCarousel'
import DashboardPreview from '../components/DashboardPreview'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

const SESSION_KEY = 'er_intro_played'

export default function HomePage() {
  // Check sessionStorage on mount — if already played this session, skip intro
  const [introComplete, setIntroComplete] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
  })

  const handleIntroComplete = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
    setIntroComplete(true)
  }

  // Scroll reveal observer
  useEffect(() => {
    if (!introComplete) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target) }
      }),
      { threshold: 0.08, rootMargin:'0px 0px -40px 0px' }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [introComplete])

  return (
    <>
      {!introComplete && <IntroSequence onComplete={handleIntroComplete} />}
      {introComplete && (
        <>
          <Navbar />
          <main>
            <HeroSection />
            <ProblemsSection />
            <ProductsCarousel />
            <DashboardPreview />
            <FinalCTA />
          </main>
          <Footer />
        </>
      )}
    </>
  )
}
