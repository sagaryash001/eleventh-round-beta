# The Eleventh Round — React App

Premium cinematic platform website for The Eleventh Round combat sports ecosystem.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Tech Stack

- **React 18** + **TypeScript**
- **Vite 5**
- **Tailwind CSS 3**
- **React Router DOM 6**
- **GSAP 3** + ScrollTrigger (hero scroll sequence)
- **Google Fonts** — Bebas Neue · Barlow Condensed · Barlow

---

## Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Full landing page with intro, hero, problems, products, dashboard preview, CTA |
| `/login` | Unified login — role auto-detected from credentials |
| `/podcast` | Podcast ecosystem page |
| `/apparel` | Apparel collections page |
| `/dashboard/fighter` | Fighter dashboard (protected) |
| `/dashboard/manager` | Manager dashboard (protected) |
| `/dashboard/admin` | Admin dashboard (protected) |

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Fighter | `fighter@demo.com` | `fighter123` |
| Manager | `manager@demo.com` | `manager123` |
| Admin | `admin@demo.com` | `admin123` |

---

## Landing Page Sections

1. **Intro Sequence** — Animated 1→100 counter with soft diffuse strobe lights, red seep gradient, cinematic exit
2. **Hero** — GSAP ScrollTrigger canvas frame sequence (40 video frames, scroll-driven)
3. **Problems** — Zigzag hexagon map, staggered scroll reveal, click-to-expand detail panels
4. **Products Carousel** — Drag/swipe horizontal carousel, click-to-expand product cards, Podcast + Apparel ecosystem cards link to dedicated pages
5. **Dashboard Preview** — Role-tab switcher showing Command Center, Fighter, Manager, Promotions mock UIs
6. **Final CTA** — Ghost XI number, bold closing copy, three CTAs

---

## Dashboard Features

### Fighter Dashboard
- Personal readiness score ring
- Pipeline stage tracker (5 stages)
- Obligations tracker (sponsor + media)
- Education module progress grid
- SponsorForge access (gated)
- Mentorship session management
- Transition planning (gated)
- Profile management

### Manager Dashboard (MGMT-SUITE Lite)
- Operations overview
- Roster management with readiness per fighter
- Sponsor/media obligation tracking
- SponsorForge eligibility per fighter
- Operations playbooks
- Budget & camp planning
- Reporting & export

### Admin Dashboard
- Platform-wide overview
- User/role management
- Mentor & consultant management
- SponsorForge network admin
- Package & subscription overview
- Content & education module management
- System reports & exports

---

## Project Structure

```
src/
  components/
    IntroSequence.tsx     # Animated intro with soft strobes
    HeroSection.tsx       # GSAP ScrollTrigger canvas frames
    ProblemsSection.tsx   # Zigzag hex map with scroll reveal
    ProductsCarousel.tsx  # Drag/swipe carousel
    DashboardPreview.tsx  # Landing page dashboard preview
    FinalCTA.tsx
    Navbar.tsx
    Footer.tsx
  pages/
    HomePage.tsx
    LoginPage.tsx
    PodcastPage.tsx
    ApparelPage.tsx
    dashboards/
      DashShell.tsx       # Shared sidebar + topbar shell
      DashWidgets.tsx     # Reusable dashboard UI components
      FighterDashboard.tsx
      ManagerDashboard.tsx
      AdminDashboard.tsx
  hooks/
    useAuth.tsx           # Auth context with demo credentials
    useScrollReveal.ts    # Intersection observer helper
  data/
    frames.ts             # Base64 hero frame sequence (40 frames)
    problems.ts           # 9 problem definitions
    products.ts           # 4 product cards
  index.css               # Tailwind + design system
  App.tsx                 # Router + auth provider
  main.tsx
```
