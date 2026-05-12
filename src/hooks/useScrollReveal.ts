import { useEffect, useRef } from 'react'

export function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view')
          obs.unobserve(e.target)
        }
      }),
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    // observe all .reveal children
    el.querySelectorAll('.reveal').forEach(child => obs.observe(child))
    return () => obs.disconnect()
  }, [threshold])

  return ref
}
