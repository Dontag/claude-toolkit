---
description: Audit a screen/component against the ui-ux-master + motion-animation checklists
argument-hint: "<path to component/page or route>"
---

Audit target: $ARGUMENTS

Using the `ui-ux-master` and `motion-animation` skills, review the target and score each item pass/fail with file:line evidence:

1. Single clear primary action; visual hierarchy correct
2. Spacing on the 4-pt scale; layout grid respected; responsive (mobile actually designed)
3. Type scale + weights consistent; line length ≤75ch
4. Color: 60-30-10, contrast ≥4.5:1 body / 3:1 large, state not conveyed by color alone
5. Empty / loading / error states exist for data views
6. Accessibility: keyboard nav, focus ring, aria-labels on icon buttons, touch targets ≥44px
7. Motion: durations ≤ guidelines, transform/opacity only, prefers-reduced-motion respected

Output a compact table (item, pass/fail, evidence, fix), then the top 3 highest-impact fixes. Offer to apply them via the `ui-designer` agent.
