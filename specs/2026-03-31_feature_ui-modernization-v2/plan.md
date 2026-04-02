# Plan: UI Modernization v2

## Approach

Additive CSS-first approach. We modify `styles.css` to establish the design token layer, then update components to use tokens instead of hardcoded Tailwind colors. No structural component rewrites — we're reskinning, not restructuring.

## Phase 1: Design Token Foundation (styles.css)

1. Add CSS custom properties for colors (light + dark), shadows, radii, and spacing
2. Add `.dark {}` override block for dark mode tokens
3. Add `.wh-card` glass-morphism class
4. Add `.wh-phase-*` left-border accent classes
5. Add `.wh-animate-in` / `.wh-stagger` entrance animations
6. Add custom scrollbar styling
7. Add `.wh-focus-ring` focus utility

## Phase 2: Font Loading (index.html)

1. Add Inter font via Google Fonts with `display=swap`
2. Set `font-family: 'Inter', system-ui, sans-serif` as base in CSS

## Phase 3: Component Token Adoption

Update components to use CSS variables instead of hardcoded Tailwind colors. Minimal diffs — swap class names, don't restructure.

Target files (in priority order):
1. `Card.tsx` — biggest visual impact (`.wh-card`, phase borders, token colors)
2. `Column.tsx` — column backgrounds, headers
3. `Board.tsx` — board background, header elements
4. `CardDetail.tsx` — detail panel colors
5. `FilterDrawer.tsx` — filter panel colors
6. `SearchBar.tsx` / `DarkModeToggle.tsx` — if they exist as separate components

## Phase 4: UAT

1. Boot server, check light mode board
2. Toggle dark mode, verify
3. Check card hover animations
4. Check entrance animations
5. Verify no broken states (empty columns, error states, loading)
6. Mobile viewport check

## Risk

- Tailwind purge may strip classes that are now only referenced as CSS variables. Safeguard: keep Tailwind classes as fallbacks where possible.
- `backdrop-filter` not supported in older browsers. Fallback: solid background color that still looks good.
