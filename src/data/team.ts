// ─────────────────────────────────────────────────────────────────────────────
// Team data — The Eleventh Round
//
// Founder name sourced from site testimonial (Patrick Sullivan, eleventh-rnd.com).
// All other fields marked TODO — fill in before launch.
// Headshots go in: public/team/
// ─────────────────────────────────────────────────────────────────────────────

export interface Founder {
  name: string
  title: string   // TODO: confirm official title
  tagline: string // TODO: short punchy tagline (1 sentence)
  bio: string     // TODO: 2-3 sentence bio paragraph
  photo: string   // TODO: drop headshot at public/team/kevin-leka.jpg
}

export interface Manager {
  id: number
  name: string   // TODO: fill in
  role: string   // TODO: fill in (e.g. "Director of Fighter Relations")
  bio: string    // TODO: 1-2 sentence description
  photo: string  // TODO: drop headshot at the path below
}

// ── Founder ──────────────────────────────────────────────────────────────────
// Kevin Leka is referenced by name in fighter testimonials on eleventh-rnd.com.
// All other details are TODO placeholders.
export const FOUNDER: Founder = {
  name:    'Kevin Leka',
  title:   'TODO — Founder & CEO',   // TODO: confirm official title
  tagline: 'TODO — Add a one-sentence founder tagline here.',
  bio:
    'Kevin Leka is the founder of The Eleventh Round, a platform dedicated to helping ' +
    'combat athletes build resilience, structure, and opportunity beyond the fight. A former ' +
    'amateur combat sports athlete, Kevin understands firsthand the physical and mental demands ' +
    'of the fight game. After overcoming personal adversity and navigating the realities of ' +
    'competition, he built The Eleventh Round to bridge the gap between talent and opportunity, ' +
    'equipping fighters with the tools, discipline, and exposure needed to succeed both in and ' +
    'out of competition. As a host, Kevin brings raw honesty, lived experience, and a relentless ' +
    'pursuit of growth — creating conversations that go beyond surface-level success and dive into ' +
    'the mindset, struggles, and resilience required to keep fighting, inside and outside the ring.',
  photo: '/team/kevin-leka.png',
}

// ── Managers ─────────────────────────────────────────────────────────────────
// No manager names or roles were publicly listed on eleventh-rnd.com at time of
// build. Add real entries below when ready; remove the placeholder slots.
export const MANAGERS: Manager[] = [
  {
    id:    0,
    name:  'TODO — Manager Name',
    role:  'TODO — Role / Title',
    bio:   'TODO — Short description of this person\'s background and role at The Eleventh Round.',
    photo: '/team/manager-01.jpg',   // TODO: add headshot image
  },
  {
    id:    1,
    name:  'TODO — Manager Name',
    role:  'TODO — Role / Title',
    bio:   'TODO — Short description of this person\'s background and role at The Eleventh Round.',
    photo: '/team/manager-02.jpg',   // TODO: add headshot image
  },
  {
    id:    2,
    name:  'Gwen Legge',
    role:  'Owner, Eruption Boxing & MMA Management · Mentor',
    bio:
      'Owner of Eruption Boxing & MMA Management and Executive Producer of the upcoming film ' +
      '"Legacy in the Ring." With over 40 years of experience in sales, marketing, business ' +
      'development, and strategy, Gwen is a current Hall of Famer at the Universal Martial Arts ' +
      'Hall of Fame and one of the most widely respected women in combat sports. As a mentor with ' +
      'The Eleventh Round, she educates fighters on personal branding, financial literacy in contracts, ' +
      'career strategy, and sponsorship acquisition.',
    photo: '/team/manager-03.jpg',
  },
]
