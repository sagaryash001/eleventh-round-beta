// ─────────────────────────────────────────────────────────────────────────────
// Team data — The Eleventh Round
// Headshots: public/team/don-rudolph.jpg, brian-maieli.jpg, antonio-palmieri.jpeg,
//            nextplay-communications.jpeg, kevin-leka.png, manager-03.jpg
// ─────────────────────────────────────────────────────────────────────────────

export interface Founder {
  name: string
  title: string
  tagline: string
  bio: string
  photo: string
}

export interface Manager {
  id: number
  name: string
  role: string
  bio: string
  photo: string
}

// ── Founder ──────────────────────────────────────────────────────────────────
export const FOUNDER: Founder = {
  name:    'Kevin Leka',
  title:   'Founder & CEO',
  tagline: 'Building the infrastructure combat athletes have always deserved.',
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

// ── Advisors & Consultants ───────────────────────────────────────────────────
// Photo filenames map to public/team/<filename>
export const MANAGERS: Manager[] = [
  {
    id:    0,
    name:  'Don Rudolph',
    role:  'Financial Awareness Consultant',
    bio:
      'Fiduciary wealth management advisor and sports finance consultant with over 26 years of ' +
      'experience in financial planning and athlete advisory services. Founder of Flat Fee CIO and ' +
      'Wealth Management Advisor at LCA Sports Management, with prior leadership at Bank of America ' +
      'and SunTrust. Holds an MBA from Tulane University and specializes in helping athletes build ' +
      'long-term financial stability, investment strategy, and financial literacy systems.',
    photo: '/team/don-rudolph.jpg',
  },
  {
    id:    1,
    name:  'Brian Maieli',
    role:  'Sports Medicine & Injury Consultant',
    bio:
      'Certified Orthopedic Surgery Physician Assistant and sports medicine specialist with over ' +
      '20 years of experience helping athletes navigate injury prevention, recovery, and ' +
      'performance longevity. Founder of ILP Sports Consultants and host of The Injured List ' +
      'Podcast. Holds a Master\'s in Kinesiology from Temple University and PA certification from ' +
      'Weill Cornell Medical College.',
    photo: '/team/brian-maieli.jpg',
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
  {
    id:    3,
    name:  'Antonio Palmieri',
    role:  'Legal & Operations Advisor',
    bio:
      'Sports and entertainment attorney and boxing operations executive with experience spanning ' +
      'legal advisory, fighter operations, matchmaking, and event management. Former Vice President ' +
      'of Operations & Matchmaker at Star Boxing, currently in fighter operations at Overtime. ' +
      'Provides guidance on legal structure, combat sports operations, sponsorship agreements, ' +
      'and fighter professionalism systems.',
    photo: '/team/antonio-palmieri.jpeg',
  },
  {
    id:    4,
    name:  'NextPlay Communications',
    role:  'Communication & Leadership Development',
    bio:
      'Communication and leadership development company founded by Quest Sandel and Charlie Gu, ' +
      'built around the belief that communication is a performance variable in sports and business. ' +
      'With experience coaching national champion debate students, financial professionals, ' +
      'politicians, and athletes, Next Play helps competitors develop confidence, composure, ' +
      'media presence, and storytelling ability. At The Eleventh Round, they lead athlete branding, ' +
      'media training, and long-term professional development initiatives.',
    photo: '/team/nextplay-communications.jpeg',
  },
]
