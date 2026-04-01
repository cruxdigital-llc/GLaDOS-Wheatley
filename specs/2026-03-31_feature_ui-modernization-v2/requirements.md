# Requirements: UI Modernization v2

## Goal

Upgrade the visual layer from raw Tailwind utility classes to a design-token-based system. Bring in the best architectural ideas from PR #15 while preserving #13's structural layout improvements.

## What to Bring from PR #15

### Keep (high value, low risk)
1. **CSS custom properties (design tokens)** — colors, spacing, radii, shadows as `--var()`. This is the single biggest architectural win. Replaces hundreds of scattered Tailwind color classes with a unified token layer that makes theming trivial.
2. **Dark mode via token swap** — `.dark { --color-bg: ...; }` instead of `dark:bg-gray-800` on every element. Massively reduces class bloat.
3. **Card glass-morphism** — `backdrop-filter: blur()` + semi-transparent backgrounds. Gives depth without heavy shadows. The `.wh-card` class is clean.
4. **Phase-colored left border on cards** — `.wh-phase-*` classes. More elegant than the current top-border-on-columns approach.
5. **Staggered card entrance animations** — `.wh-animate-in` / `.wh-stagger` classes. Adds polish.
6. **Custom scrollbar styling** — Thinner, subtler scrollbars.
7. **Focus ring utility** — `.wh-focus-ring` is cleaner than inline `focus:ring-2 focus:ring-blue-500`.

### Modify (good idea, needs adjustment)
8. **Typography** — Use Inter (single font, widely available) instead of 4 Google Fonts. Audiowide for branding is fine but we don't need 4 font families loading from a CDN. Self-host or use a minimal set.
9. **Noise texture overlay** — Interesting effect but performance cost on mobile. Make it opt-in or very subtle.

### Discard (conflicts with #13 or low value)
10. **Three-zone header layout** — #13 already restructured the header. Redoing it again is churn.
11. **Component-level rewrites (Board, Card, Column)** — #13 already rewrote these. Token adoption should be additive, not a full component rewrite.
12. **`.wh-btn`, `.wh-input` utility classes** — Tailwind already provides these patterns. Adding a parallel class system creates confusion.
13. **`.wh-toggle-group`** — Custom component class that duplicates what Tailwind can do inline.

## Success Criteria

1. The design token system (`styles.css`) provides light/dark themes from one set of CSS variables
2. Components use `var(--token)` for colors instead of hardcoded Tailwind colors
3. Cards have glass-morphism effect and phase-colored left borders
4. Entrance animations on card load
5. One font family (Inter) loaded with `font-display: swap`
6. All 474+ existing tests pass
7. Visual parity on light and dark modes — no broken states
8. No render-blocking font loads — page paints immediately
