export interface ProductCard {
  id: string
  tag: string
  title: string
  subtitle: string
  desc: string
  color: string
  features: string[]
  offers: { name: string; desc: string }[]
  link?: string
}

export const PRODUCTS: ProductCard[] = [
  {
    id: 'fighters',
    tag: 'Eleventh Round Ready Pipeline',
    title: 'Fighter',
    subtitle: 'Platform',
    desc: 'For amateurs, early pros, and fighters who think long-term. Build a real career — stabilize income, protect your future, and move with strategy instead of chaos.',
    color: '#8b0000',
    features: [
      'Career Strategy & Pace Control',
      'Financial Literacy for Fighters',
      'Brand & Sponsorship Readiness',
      'SponsorForge Access',
      'Transition Planning Beyond Fighting',
      'One-on-One Mentorship & Consulting',
    ],
    offers: [
      { name: 'Amateur / Early Pro Pipeline', desc: 'Foundational readiness for fighters entering the professional pathway' },
      { name: 'SponsorForge', desc: 'Vetted, athlete-first sponsor positioning and deal guidance' },
      { name: 'Transition Blueprint', desc: 'Strategic planning for life and career beyond the ring' },
      { name: '1-on-1 Mentorship', desc: 'Direct access to consultants and strategic advisors' },
      { name: 'Education & Community', desc: 'Structured learning on business, brand, contracts, and leverage' },
    ],
  },
  {
    id: 'managers',
    tag: 'MGMT-SUITE Lite',
    title: 'Manager',
    subtitle: 'System',
    desc: 'Better systems. Fewer fires. Stronger fighters. We support independent managers to operate like professionals without burning out.',
    color: '#6b0000',
    features: [
      'White-Labeled Fighter Onboarding',
      'Sponsor & Media Obligation Tracking',
      'Crisis & Conduct Playbooks',
      'Budget & Camp Planning Tools',
      'NIL & Digital Brand Education',
      'SponsorForge Readiness Monitoring',
    ],
    offers: [
      { name: 'Roster Management', desc: "Full visibility into every fighter's status, progress, and obligations" },
      { name: 'Professionalism Ratings', desc: 'Event-by-event conduct tracking and accountability systems' },
      { name: 'NIL & Brand Education', desc: 'Help fighters build their digital footprint and personal brand value' },
      { name: 'Operational Playbooks', desc: 'Ready-to-use processes for every management scenario' },
      { name: 'Financial Literacy Education', desc: 'Ensure fighters understand money, taxes, and stability' },
    ],
  },
  {
    id: 'sponsorforge',
    tag: 'Opportunity Platform',
    title: 'Sponsor',
    subtitle: 'Forge',
    desc: 'The opportunity unlock. Connect fighters with vetted sponsors who value professionalism, readiness, and authentic representation.',
    color: '#7a1500',
    features: [
      'Vetted Sponsor Network',
      'Readiness-Gated Access',
      'Deal Structuring Guidance',
      'Athlete-First Positioning',
      'Post-Deal Obligation Tracking',
      'Transparent Match Process',
    ],
    offers: [
      { name: 'Sponsor Matching', desc: 'Algorithm-assisted matching based on readiness score and profile' },
      { name: 'Deal Guidance', desc: 'Support through negotiation, structuring, and signing' },
      { name: 'Obligation Tracker', desc: 'Automated tracking of all post-deal requirements' },
    ],
  },
  {
    id: 'prmtn',
    tag: 'PRMTN-HUB',
    title: 'Promotions',
    subtitle: 'Hub',
    desc: 'Infrastructure for event operators. Track professionalism, monitor compliance, and build a more credible fight organization.',
    color: '#5a0000',
    features: [
      'Event Professionalism Logs',
      'Sponsor / Media Compliance',
      'Fighter Evaluation Baselines',
      'Post-Event Operational Reports',
      'Integrity Scoring',
      'Promotion-Wide Analytics',
    ],
    offers: [
      { name: 'Event Compliance Suite', desc: 'Full tracking of all fighter obligations per event' },
      { name: 'Integrity Dashboard', desc: 'Real-time view of your promotion\'s professionalism score' },
      { name: 'Fighter Evaluation', desc: 'Baseline data for booking decisions and fighter development' },
    ],
  },
]
