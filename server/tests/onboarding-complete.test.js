import { describe, it, expect } from 'vitest'
import { computeOnboardingComplete } from '../routes/auth.js'

// At registration, sponsors must NOT be marked fully onboarded just because they
// answered the marketing questionnaire — they still need a company profile.
// Other roles keep the prior "complete once the questionnaire is present" rule.

describe('computeOnboardingComplete (registration onboarding flag)', () => {
  it('is always false for sponsors, even with questionnaire answers', () => {
    expect(computeOnboardingComplete('sponsor', { q1: 'sponsor' })).toBe(false)
    expect(computeOnboardingComplete('sponsor', undefined)).toBe(false)
    expect(computeOnboardingComplete('sponsor', {})).toBe(false)
  })

  it('is true for non-sponsors when a questionnaire object is present', () => {
    expect(computeOnboardingComplete('fighter', { q1: 'fighter' })).toBe(true)
    expect(computeOnboardingComplete('manager', { q1: 'management' })).toBe(true)
  })

  it('is false for non-sponsors when no questionnaire was provided', () => {
    expect(computeOnboardingComplete('fighter', undefined)).toBe(false)
    expect(computeOnboardingComplete('manager', null)).toBe(false)
  })
})
