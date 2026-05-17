---
name: Eleventh Round
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#38393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c4c7c7'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c9c6c5'
  primary: '#c9c6c5'
  on-primary: '#313030'
  primary-container: '#0d0d0d'
  on-primary-container: '#7c7a7a'
  inverse-primary: '#5f5e5e'
  secondary: '#ffb3b4'
  on-secondary: '#680016'
  secondary-container: '#ac012c'
  on-secondary-container: '#ffb7b8'
  tertiary: '#c8c6c5'
  on-tertiary: '#313030'
  tertiary-container: '#0d0d0d'
  on-tertiary-container: '#7c7a7a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#ffdad9'
  secondary-fixed-dim: '#ffb3b4'
  on-secondary-fixed: '#40000a'
  on-secondary-fixed-variant: '#920023'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display-lg:
    fontFamily: bebasNeue
    fontSize: 96px
    fontWeight: '400'
    lineHeight: 90px
    letterSpacing: -0.04em
  headline-xl:
    fontFamily: bebasNeue
    fontSize: 64px
    fontWeight: '400'
    lineHeight: 60px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: bebasNeue
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: bebasNeue
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: bebasNeue
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: archivoNarrow
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: archivoNarrow
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  label-bold:
    fontFamily: archivoNarrow
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  caption:
    fontFamily: archivoNarrow
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style

This design system embodies the intensity of the "Eleventh Round"—the threshold where skill meets pure will. The brand personality is elite, disciplined, and unapologetically aggressive, drawing inspiration from high-end combat sports cinematography and premium athletic training facilities. It balances the raw grit of an underground academy with the prestige of a global fight-night promotion.

The visual style is **High-Contrast & Bold**, utilizing a minimalist structure to allow imagery and typography to command the space. The UI should feel like a piece of high-performance equipment: heavy, precise, and durable. Every element is designed to evoke a sense of high-stakes drama and cinematic luxury. Avoid any elements that soften the impact; the aesthetic must remain sharp, dark, and focused.

## Colors

The palette is strictly limited to four core tones to maintain a cinematic, monolithic feel.

*   **Matte Black (#0D0D0D):** The foundation. It is used for all primary backgrounds to simulate the shadows of a darkened arena.
*   **Deep Crimson Red (#C41E3A):** The strike color. Reserved for primary actions, critical alerts, and branding accents. It represents blood, adrenaline, and the "danger zone."
*   **Graphite Gray (#1A1A1A):** The structural color. Used for containers, dividers, and secondary surfaces to create subtle depth without breaking the dark atmosphere.
*   **Off-White (#F5F5F5):** The illumination. Used exclusively for typography and high-priority icons to provide maximum legibility against the dark void.

Never use gradients. Color transitions should be hard-edged and intentional.

## Typography

The typography in this design system is built for impact. It utilizes a dual-sans-serif pairing that prioritizes verticality and density.

*   **Headlines:** Using `bebasNeue`, headlines should feel like fight posters or cinematic titles. Tracking is intentionally tight to create a "wall of text" effect that feels heavy and aggressive. All headlines must be in Uppercase.
*   **Body & Labels:** Using `archivoNarrow`, the secondary typeface maintains the athletic, condensed aesthetic while ensuring high legibility for technical data and long-form editorial content.
*   **Editorial Treatment:** Large display type should often be used as a background element or clipped by imagery to create layers of depth, mimicking high-end sports magazine layouts.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop to ensure cinematic compositions remain controlled and impactful. We utilize a 12-column grid with generous outer margins to create a "stage" for the content.

*   **Rhythm:** An 8px linear scale governs all padding and margins.
*   **Negative Space:** Significant use of "dead space" is encouraged to draw focus to high-contrast elements. Do not fear large gaps; they contribute to the premium, gallery-like feel.
*   **Responsive Behavior:** On mobile, margins tighten significantly, and the grid shifts to 4 columns. Headlines should scale aggressively to maintain their "full-bleed" impact even on smaller screens.

## Elevation & Depth

Depth in this design system is achieved through **Tonal Layers** rather than shadows. Shadows are strictly prohibited to maintain a raw, flat, and aggressive look.

1.  **Level 0 (Floor):** Matte Black (#0D0D0D). Used for the global canvas.
2.  **Level 1 (Elevated):** Graphite Gray (#1A1A1A). Used for cards, navigation bars, and sectional containers.
3.  **Level 2 (Active):** Deep Crimson Red (#C41E3A). Used to highlight the most important interactive elements.

To simulate "Atmosphere," use high-contrast photography with dramatic lighting (Chiaroscuro). Subtle smoke or grain textures can be applied as an overlay to the Level 0 background to add grit and cinematic quality without using traditional UI depth effects.

## Shapes

The shape language is strictly **Sharp (0px)**.

Every button, card, input field, and container must have 90-degree angles. This reinforces the "Elite Academy" aesthetic—mimicking the sharp edges of a boxing ring, the structure of a cage, and the industrial nature of high-end gyms. Rounded corners are seen as "soft" and are contradictory to the brand’s aggressive stance.

## Components

### Buttons
*   **Primary:** Solid Deep Crimson Red with Off-White text. Rectangular, sharp corners. Uppercase `label-bold`.
*   **Secondary:** Ghost style. No fill, 2px Off-White border. Off-White text.
*   **Interaction:** On hover, primary buttons shift to a darker red; secondary buttons fill with Off-White and invert text to Matte Black.

### Input Fields
*   Background is Graphite Gray with a bottom-only 2px border of Off-White.
*   Placeholders are 50% opacity Off-White.
*   Active state: The bottom border turns Deep Crimson Red.

### Cards
*   Flat Graphite Gray background. No borders.
*   Use "Arena Lighting" for imagery within cards: high-contrast portraits with deep shadows.
*   Content should be padded by at least 24px (3 units).

### Progress Bars & Data
*   Use thick, 8px tall bars.
*   Background: Graphite Gray.
*   Progress: Deep Crimson Red.
*   This represents the "stamina" or "health" of the data being displayed.

### Navigation
*   Top-fixed or side-anchored.
*   Strictly text-based using `label-bold`.
*   No icons unless absolutely necessary for utility (e.g., Search, Account). Icons must be thin-stroke, sharp-angled.