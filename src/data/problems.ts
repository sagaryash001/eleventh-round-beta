export interface Problem {
  id: number
  num: string
  title: string
  why: string
  solution: string
}

export const PROBLEMS: Problem[] = [
  {
    id: 0,
    num: '01',
    title: 'No Standardized Onboarding',
    why: 'Fighters enter gyms and sign with teams with no structured intake process. Critical information — medical history, mental health, finances, preferences — is never properly gathered or tracked, creating operational blind spots from day one.',
    solution: 'MGMT-SUITE Lite provides white-labeled onboarding systems that capture everything managers need. Fighters enter the ecosystem fully documented, professionally ready, and tracked from the start.',
  },
  {
    id: 1,
    num: '02',
    title: 'Sponsorship Chaos',
    why: 'Sponsor deals are mismanaged, obligations are forgotten, and relationships are destroyed because no system tracks commitments. Fighters lose money. Managers lose credibility. Everyone loses.',
    solution: 'SponsorForge and the obligation-tracking system ensure every sponsor relationship is documented, monitored, and fulfilled — protecting value on both sides of every deal.',
  },
  {
    id: 2,
    num: '03',
    title: 'Missed Media Obligations',
    why: 'Post-fight media, social content, and promotional appearances are missed because no system exists to track them. Promotions and sponsors lose trust. Fighters lose future opportunities.',
    solution: "The platform's obligation tracker surfaces every commitment before it becomes a problem — with alerts, timelines, and built-in accountability at every level.",
  },
  {
    id: 3,
    num: '04',
    title: 'Financial Instability',
    why: 'Most fighters have no financial plan between fights. Without budgeting support and literacy education, inconsistent income becomes a crisis — affecting performance, mental health, and decision-making.',
    solution: 'The Financial Literacy pipeline delivers real education on budgeting, taxes, and building stability — so money stops being a distraction and starts being a foundation.',
  },
  {
    id: 4,
    num: '05',
    title: 'Weak Personal Brand',
    why: "Fighters don't understand their digital footprint. No profile. No presence. When sponsors look them up, there is nothing there. Opportunity passes to fighters who built their brand intentionally.",
    solution: 'Brand & Sponsorship Readiness walks fighters through building a professional digital identity — so when opportunity arrives, they are already ready to receive it.',
  },
  {
    id: 5,
    num: '06',
    title: 'No Long-Term Roadmap',
    why: 'Fighters live fight to fight with no career architecture. No one has sat down to build a five-year vision — which means every decision is reactive instead of strategic.',
    solution: 'Career Strategy & Pace Control gives fighters and their managers a shared roadmap — milestones, pacing, goals, and transition planning built into the platform.',
  },
  {
    id: 6,
    num: '07',
    title: 'Poor Conduct & Professionalism',
    why: "Incidents happen because there are no standards. No code of conduct. No accountability system. One bad interaction can end a career or destroy a promotion's credibility overnight.",
    solution: 'Conduct logs, professionalism ratings, and crisis playbooks give managers the tools to set standards, track incidents, and address issues before they escalate.',
  },
  {
    id: 7,
    num: '08',
    title: 'Managers Overwhelmed',
    why: 'Independent managers are talented but unsupported. Preventable issues — administrative chaos, sponsor fires, fighter unpreparedness — eat all their time and energy.',
    solution: 'MGMT-SUITE Lite is the operational backbone managers never had. White-labeled systems, playbooks, and tracking tools that let them focus on strategy instead of fires.',
  },
  {
    id: 8,
    num: '09',
    title: 'No Education on Contracts',
    why: "Fighters sign deals they don't understand. Contract language, exclusivity clauses, and NIL rights are unknown territory. Education was never part of the game — until now.",
    solution: 'The Education & Community module covers contracts, leverage, NIL, and business fundamentals — so fighters can advocate for themselves with real knowledge and confidence.',
  },
]
