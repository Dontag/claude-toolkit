---
name: ui-ux-master
description: World-class UI/UX design system knowledge. Use for any interface work — building screens/components, choosing color palettes, layouts, typography, spacing, accessibility, or when the user says "make it look good/professional/modern", mentions design, UX, redesign, landing page, dashboard, or mobile app UI.
---

# ui-ux-master

Design like a senior product designer, not a developer adding CSS at the end. Decide hierarchy → layout → type → color → motion, in that order.

## Layout
- **Grid**: 12-col desktop / 4-col mobile; content max-width 1140–1280px; gutters 16–24px.
- **Spacing scale**: 4-pt system only (4/8/12/16/24/32/48/64). Never arbitrary values.
- **Hierarchy**: one primary action per screen; group with whitespace before borders; borders before backgrounds.
- **Density presets**: marketing = airy (sections 96–128px apart); SaaS dashboard = compact (16–24px); mobile = thumb-zone: primary actions in bottom 40% of screen.
- **Responsive**: design mobile-first; breakpoints 640/768/1024/1280; never let line length exceed ~75ch.

## Typography
- Max 2 typefaces. Safe pairs: Inter/Inter, Geist + Geist Mono, Fraunces (display) + Inter (body), Space Grotesk + IBM Plex Sans.
- Scale (1.25 ratio): 12, 14, 16 (body), 20, 24, 32, 40, 48. Line-height: 1.5 body, 1.1–1.2 headings.
- Weights: 400 body, 500 UI labels, 600–700 headings. Never below 12px; never pure #000 on #FFF (use #111827 / #0A0A0A on off-white).

## Color
- **Structure**: 1 neutral ramp (50–950), 1 brand color, 1 accent, semantic set (success/warn/error/info). That's it.
- **60-30-10 rule**: 60% neutral surface, 30% secondary, 10% brand/accent.
- Proven palettes (light):
  - SaaS: neutral slate + brand `#4F46E5` (indigo) + accent `#06B6D4`
  - Fintech: neutral zinc + brand `#0D9488` (teal) + accent `#F59E0B`
  - Consumer/mobile: neutral stone + brand `#F97316` + accent `#8B5CF6`
  - Dark mode: bg `#0B0F14`→ surface `#151A21` → raised `#1E242C`; text `#E5E7EB`/`#9CA3AF`; desaturate brand by ~10%.
- Contrast: 4.5:1 body text, 3:1 large text/UI — check every pairing, especially text-on-brand.
- Never rely on color alone for state; pair with icon/label.

## Component patterns (feature-wise)
- **Forms**: labels above fields; inline validation on blur; one column; primary button full-width on mobile; show progress on multi-step.
- **Tables/data**: sticky header, right-align numbers, zebra off by default, row hover, empty state with action.
- **Navigation**: ≤7 top-level items; current state visible; mobile = bottom tab bar (3–5 items) not hamburger for core actions.
- **Dashboards**: KPI cards top (max 4), main chart mid, detail table bottom; every metric needs comparison context (vs last period).
- **Onboarding**: value first, signup later where possible; ≤3 steps; skippable.
- **Empty/loading/error**: every list needs all three states designed. Skeletons over spinners for content; spinners only for actions <2s.

## Accessibility (non-negotiable)
- Full keyboard nav + visible focus ring (2px offset, brand color).
- Touch targets ≥44×44px. `aria-label` on icon-only buttons. `prefers-reduced-motion` respected (see motion-animation skill).
- Semantic HTML first: `button`, `nav`, `main`, headings in order.

## Audit checklist (run on any screen you build or review)
1. One clear primary action? 2. Spacing on 4-pt grid? 3. Type scale consistent? 4. Contrast passes? 5. All 3 states (empty/loading/error)? 6. Keyboard + touch targets? 7. Mobile layout actually designed, not just squished?
