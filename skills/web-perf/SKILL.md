---
name: web-perf
description: Frontend & mobile performance optimization. Use when pages load slowly, bundles are big, animations jank, Lighthouse/Core Web Vitals scores are low, or the user mentions performance, speed, FPS, bundle size, or memory on the client side.
---

# web-perf

Measure → find the biggest cost → fix → re-measure. Never optimize blind.

## Measure first
- Web: Lighthouse (`npx lighthouse <url> --view`), Chrome Performance panel, `web-vitals` lib. Budgets: LCP <2.5s, INP <200ms, CLS <0.1, JS bundle <200KB gz per route.
- Bundle: `npx vite-bundle-visualizer` / `next build` output / `source-map-explorer`. Any single dep >30KB gz must justify itself.
- RN: Flipper/DevTools frame profiler. Flutter: DevTools timeline, aim 16ms/frame.

## Fix order (highest ROI first)
1. **Ship less JS**: route-level code splitting, dynamic `import()` for below-fold/modal code, kill barrel-file imports (`import {x} from 'lib/x'` not `from 'lib'`), replace heavy deps (moment→date-fns/Temporal, lodash→lodash-es per-fn, axios→fetch).
2. **Images**: modern formats (AVIF/WebP), explicit width/height (CLS), lazy-load below fold, responsive `srcset`, CDN resize.
3. **Fonts**: max 2 families, `font-display: swap`, preload the one above-fold font, subset.
4. **Render path**: SSR/SSG for content pages; defer 3rd-party scripts; preconnect to critical origins; inline critical CSS.
5. **Runtime**: virtualize lists >100 rows; memo only after profiling; debounce inputs; move heavy work to Web Workers; animate transform/opacity only (see motion-animation).
6. **Data**: cache (SWR/React Query) with sane staleness; paginate; avoid waterfalls (parallelize requests); prefetch next-likely route.
7. **Mobile-native**: RN — FlatList tuning (`getItemLayout`, `windowSize`), Hermes on, no anonymous fns in hot lists. Flutter — `const` constructors, `RepaintBoundary` around animations, cache images.

## Regression guards
Add budgets to CI: `size-limit` or bundlewatch on PRs; Lighthouse CI on main; fail the build when a route grows >10%.

## Report format
Before/after table (metric, was, now, budget), top 3 remaining opportunities with estimated gain. Log tokens/time saved to the dashboard.
