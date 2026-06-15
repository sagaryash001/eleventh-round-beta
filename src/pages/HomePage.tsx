import React, { useEffect } from 'react'
import IntroWalkout from '../components/home/IntroWalkout'
import Navbar from '../components/Navbar'
import CinematicHero from '../components/home/CinematicHero'
import ProblemsSection from '../components/ProblemsSection'
import ProductsCarousel from '../components/ProductsCarousel'
import TestimonialsSection from '../components/TestimonialsSection'
import DashboardPreview from '../components/DashboardPreview'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

export default function HomePage() {
  // Scroll reveal observer — runs on mount. The homepage now renders underneath
  // the IntroWalkout overlay (which fades out to reveal the hero), so the page is
  // always present in the DOM rather than gated behind an intro.
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target) }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      {/* Premium walkout intro — overlays the hero on the first visit of a session. */}
      <IntroWalkout />
      <Navbar />
      <main>
        {/* "One platform. Four corners." now lives inside CinematicHero as the
            pinned finale (the dock bridges into it) — no separate section. */}
        <CinematicHero />
        <ProblemsSection />
        <ProductsCarousel />
        <TestimonialsSection />
        <DashboardPreview />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
