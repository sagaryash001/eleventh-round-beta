# Graph Report - er-app  (2026-05-31)

## Corpus Check
- 99 files · ~5,211,026 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 786 nodes · 1196 edges · 56 communities (50 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a8792667`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 37 edges
2. `useApi()` - 30 edges
3. `apiGet()` - 30 edges
4. `apiPost()` - 28 edges
5. `Eleventh Round — Sponsor ↔ Fighter Marketplace` - 22 edges
6. `childLogger()` - 17 edges
7. `apiPatch()` - 15 edges
8. `requireAuth()` - 13 edges
9. `4. Schema design — new tables` - 11 edges
10. `The Eleventh Round — React App` - 10 edges

## Surprising Connections (you probably didn't know these)
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/hooks/useAuth.tsx
- `Navbar()` --calls--> `useAuth()`  [EXTRACTED]
  src/components/Navbar.tsx → src/hooks/useAuth.tsx
- `RegisterPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/RegisterPage.tsx → src/hooks/useAuth.tsx
- `VerifyEmailPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/VerifyEmailPage.tsx → src/hooks/useAuth.tsx
- `InboxPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/InboxPage.tsx → src/hooks/useAuth.tsx

## Communities (56 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (60): Application, applyToOpportunity(), getMyApplications(), inviteFighter(), updateApplicationStatus(), apiGet(), apiPatch(), apiPost() (+52 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (41): Content(), Marketplace(), Mentors(), NAV, Overview(), Packages(), Reports(), SponsorForgeAdmin() (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (37): computeMatchesForOpp(), computeMatchScore(), WEIGHTS, allowed, APPLICATION_COLS, data, fetches, FIGHTER_TRANSITIONS (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (31): BATCH_SIZE, getTransport(), handleMessageReceived(), handlePaymentSucceeded(), HANDLERS, log, POLL_MS, processBatch() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (32): 4.10 Migrations strategy, 4.1 Profile-extension tables, 4.2 Marketplace tables, 4.3 Obligations & deliverables, 4.4 Messaging, 4.5 Payments, 4.6 Notifications, 4.7 Reviews & reputation (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (20): getSponsorDashboard(), getSponsorStatus(), onboardSponsor(), SponsorOnboardInput, SponsorProfile, updateSponsorProfile(), DEMO_PROFILE, GOALS (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (28): Admin Dashboard, Backend, Backend setup, code:bash (npm install), code:block2 (src/), code:bash (# 1. Copy the example env and fill in the keys you have), code:bash (curl http://localhost:3001/api/health), code:block5 (server/) (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (26): active, activity, alertItems, byStatus, closed, consultants, d, end (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (20): CartDrawer(), Props, Action, CartContext, CartContextType, CartItem, CartProvider(), loadCart() (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (23): actionItems, chartData, d, eligibility_progress, FIGHTER_WRITABLE, guard, log, media (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (20): actionItems, camps, fids, fighters, fpMap, fulfillmentByFighter, guard, log (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (12): childLogger(), limit, log, query, router, line_items, log, router (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (12): requireSupabase(), log, requireAdmin(), requireAuth(), log, OBLIGATION_COLS, PROOF_COLS, router (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (16): assertContractTransition(), assertObligationTransition(), CONTRACT_FIGHTER_TRANSITIONS, CONTRACT_SPONSOR_TRANSITIONS, OBLIGATION_ADMIN_TRANSITIONS, OBLIGATION_OWNER_TRANSITIONS, CONTRACT_COLS, CONTRACT_LIST_COLS (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (16): allParticipants, allUserIds, convIds, convQ, lastMsgMap, limit, log, page (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (11): createOpportunity(), getOpportunity(), OppInput, Opportunity, publishOpportunity(), updateOpportunity(), OpportunityDetailPage(), CAMPAIGN_TYPES (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (13): Conversation, ConversationParticipant, createConversation(), getConversations(), getMessages(), markConversationRead(), Message, sendMessage() (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (10): base, byStatus, company_name, guard, log, router, row, totalSpent (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (10): CONN, getClient(), IDLE, MAX, query(), withTransaction(), logger, app (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards, Colors, Components, Elevation & Depth, Input Fields, Layout & Spacing (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (5): getOpportunities(), CAMPAIGN_TYPES, DemoBanner(), EPISODES, TOPICS

### Community 21 - "Community 21"
Cohesion: 0.21
Nodes (7): ApiState, apiFetch(), apiUrl(), ANON, URL, Status, VerifyEmailPage()

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (3): Founder, Manager, MANAGERS

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (3): Role, TABS, tabVariants

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (6): RegisterData, FormState, GOAL_OPTIONS, RegisterPage(), Step, STEPS

### Community 25 - "Community 25"
Cohesion: 0.2
Nodes (8): AuthContext, AuthContextValue, AuthProvider(), AuthUser, DEMO, DEMO_USERS, loadLocal(), UserRole

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (9): ContractDetailPage(), DashShell(), NavItem, Props, FighterProfileEditPage(), useAuth(), DEMO_CREDENTIALS, LoginPage() (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (11): 5.1 Cross-cutting middleware, 5.2 Validation, 5.3 State machines (the part most teams get wrong), 5. API surface (REST under `/api`), Application, code:block2 (# Phase 1), code:block3 (applied ──┬─► under_review ──┬─► shortlisted ──► accepted ──), code:block4 (draft ──► pending_fighter ──► pending_sponsor ──► active ──┬) (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.2
Nodes (3): ErrorBoundary, ProtectedRoute(), lenis

### Community 29 - "Community 29"
Cohesion: 0.2
Nodes (9): 0. TL;DR for stakeholders, 15. Open questions / decisions — RESOLVED 2026-05-30, 16. Risks & mitigations, 17. What we are NOT changing, 18. Appendix — file map (where new code will land), 19. Acceptance for this TDD, code:block9 (server/), Eleventh Round — Sponsor ↔ Fighter Marketplace (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (4): CHAPTERS, HERO_FRAMES, POSITIONS, HERO_FRAMES

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (4): ChildNode, Detail, ROOTS, TreeNode

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (9): 14. Implementation roadmap (10-week target, single-dev cadence; double-up with Atharv to halve), Cross-phase: ops, Phase 1 — Profiles & roles (~2 weeks), Phase 2 — Opportunities + applications + matching (~2 weeks), Phase 3 — Messaging + notifications (~2 weeks), Phase 4 — Contracts + obligations (~2 weeks), Phase 5a — Stripe payments (~1.5 weeks), Phase 5b — Connect payout (~1 week, optional / can defer) (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (9): 7.1 Profile-extension tables, 7.2 Opportunities, 7.3 Applications, contracts, messages — the sensitive ones, 7.4 Notifications, audit_log, outbox, 7.5 Storage buckets to create, 7. Row Level Security policies, code:sql (-- sponsor_profiles), code:sql ("public reads published opps"             SELECT  USING (sta) (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.4
Nodes (3): getMyOpportunities(), SponsorOpportunitiesPage(), STATUS_COLORS

### Community 38 - "Community 38"
Cohesion: 0.4
Nodes (3): Flash, FLASH_ORIGINS, IntroSequenceProps

### Community 39 - "Community 39"
Cohesion: 0.4
Nodes (5): 8.1 Inputs, 8.2 Scoring function (deterministic, transparent), 8.3 When recomputation runs, 8.4 Pluggability for ML v2, 8. Matching engine (v1 rule-based)

### Community 40 - "Community 40"
Cohesion: 0.4
Nodes (5): 13.1 Background work, 13.2 Observability, 13.3 Backups & disaster recovery, 13.4 Rate-limit buckets, 13. Operational concerns

### Community 41 - "Community 41"
Cohesion: 0.4
Nodes (5): 9.1 v1 (Phases 1–5a): Direct card capture, manual payout, 9.2 v1b (Phase 5b): Stripe Connect Custom for fighter payouts, 9.3 Webhook safety, 9.4 Money invariants, 9. Payments architecture

### Community 42 - "Community 42"
Cohesion: 0.5
Nodes (4): 3.1 Actors (= `profiles.role` values, EXTENDED), 3.2 Why role-extension tables instead of one fat `profiles`?, 3. Domain model (conceptual), code:block1 (┌──────────┐)

### Community 43 - "Community 43"
Cohesion: 0.5
Nodes (4): 1.1 What's already in production, 1.2 Existing 25 tables (today), 1.3 Architectural debt to acknowledge before we layer on more, 1. Existing system audit (what we're building on)

### Community 44 - "Community 44"
Cohesion: 0.5
Nodes (4): 12.1 What stays, 12.2 What's new, 12.3 Pattern, 12. Frontend impact

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (4): 6.1 What's published, 6.2 Patterns, 6.3 What's NOT realtime, 6. Realtime

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (3): 2.1 Principles, 2.2 Explicit non-goals (v1), 2. Product principles & non-goals

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (3): 11.1 v1: Postgres-native, 11.2 v2 (when listings > ~50k), 11. Search & discovery

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (3): 10.1 Channels per event type, 10.2 Worker, 10. Notifications fan-out

## Knowledge Gaps
- **383 isolated node(s):** `app`, `extraOrigins`, `publicLimiter`, `log`, `CONTRACT_SPONSOR_TRANSITIONS` (+378 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 26` to `Community 0`, `Community 1`, `Community 5`, `Community 37`, `Community 15`, `Community 16`, `Community 20`, `Community 21`, `Community 24`, `Community 25`, `Community 28`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Eleventh Round — Sponsor ↔ Fighter Marketplace` connect `Community 29` to `Community 32`, `Community 33`, `Community 4`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 48`, `Community 49`, `Community 50`, `Community 27`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `childLogger()` connect `Community 11` to `Community 2`, `Community 3`, `Community 7`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 17`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `app`, `extraOrigins`, `publicLimiter` to the rest of the system?**
  _383 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._