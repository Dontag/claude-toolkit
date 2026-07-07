---
name: motion-animation
description: World-class animation and motion design. Use when building or reviewing any animation — page transitions, micro-interactions, hover states, loaders, scroll effects, 3D (Three.js), physics, or when the user says "animate", "smooth", "polished", "delightful", "like Apple/Stripe/Linear".
---

# motion-animation

Motion must explain (where did this come from?), confirm (did that work?), or delight — in that order. If it does none, delete it.

## Timing & easing (memorize)
- Micro-interactions (hover, toggle): 100–150ms
- UI transitions (dropdown, modal): 200–300ms
- Page/route transitions: 300–450ms
- Never exceed 500ms for anything blocking the user.
- Easing: enter = `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo feel); exit = `cubic-bezier(0.7, 0, 0.84, 0)`; moving within screen = `cubic-bezier(0.65, 0, 0.35, 1)`. Never `linear` except spinners/marquees; never default `ease` for polish work.
- Springs (Framer Motion / RN Reanimated): UI default `stiffness: 400, damping: 30`; playful `stiffness: 260, damping: 20`; snappy drag-release `stiffness: 550, damping: 40`.

## Performance rules
- Animate only `transform` and `opacity`. Width/height/top/left cause layout thrash — use `scale`/`translate` instead.
- `will-change` sparingly, remove after animation. Target 60fps; test on mid-range mobile.
- Stagger lists: 20–40ms per item, cap total at ~400ms (animate first ~10, pop the rest).

## Signature patterns (the "world-class" toolbox)
- **Enter choreography**: parent fades (150ms), children slide-up 8–16px + fade, staggered. Nothing enters from >24px away.
- **Hover lift**: `translateY(-2px)` + shadow deepen, 150ms. Buttons: scale(0.97) on press — always give press feedback.
- **Modal**: overlay fade 200ms; panel scale 0.96→1 + fade, ease-out-expo. Exit faster than enter (150ms).
- **Skeleton shimmer**: gradient sweep 1.2–1.6s loop, subtle (5–8% lightness delta).
- **Success moments**: check-mark stroke-draw (SVG `stroke-dashoffset`, 400ms) beats a green toast.
- **Scroll**: reveal-on-scroll threshold 0.15, once only; parallax ≤10% delta; sticky-shrink headers 60→48px.
- **Number counters**: animate value with ease-out over 800ms–1.2s for stats/dashboards.
- **Shared-element / FLIP** for list→detail transitions (Framer Motion `layoutId`, View Transitions API on plain web).

## Physics & 3D (Three.js / R3F)
- Damped orbit: `rotation += (target - rotation) * 0.08` per frame — never snap.
- Gravity feel: `v += g*dt; y += v*dt` with restitution 0.4–0.6 on bounce; add small random angular velocity for realism.
- Idle scenes: slow auto-rotate (0.1–0.3 rad/s), pause on user interaction, resume after 3s.
- Keep draw calls low: merge geometries, instanced meshes for repeated objects (leaves, particles).
- Lighting default: 1 ambient (0.4) + 1 directional key + 1 rim; soft shadows only where they inform depth.

## Accessibility
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
Provide non-motion equivalents for any information conveyed by animation.

## Library picks
Web: CSS transitions first → Framer Motion (React) → GSAP (complex timelines/scroll) → Three.js/R3F (3D). Mobile: Reanimated 3 + Gesture Handler (RN), implicit animations then `AnimationController` (Flutter). Lottie for designer-made vector animations.
