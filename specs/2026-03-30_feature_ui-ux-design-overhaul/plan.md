# Plan: UI/UX Design Overhaul

## Approach
Six focused tasks, each independently verifiable. All changes are client-side only (React components + CSS). No backend or API changes.

## Tasks

### 12.1 Header Reorganization
Restructure the header into clear visual groups:
- **Left**: Logo/title, repo selector
- **Center**: View switcher (Board / List / Timeline / Calendar) — prominently placed, properly capitalized
- **Right**: User avatar/name, notifications, dark mode, settings menu

Move branch selector, sync, activity, and health into a collapsible toolbar or settings area. Remove the inline user identity text input — replace with a cleaner user display.

### 12.2 Collapsible Filter Drawer
Replace the always-visible filter bar with a "Filter" button that toggles a slide-down drawer. Show an active-filter indicator (badge count) when filters are applied. Inside the drawer:
- "Status" (renamed from Phase) — pill toggle buttons instead of multi-select
- "Assigned to" (renamed from Claimant) — text input
- "Priority" — pill toggle buttons (Any / P0 / P1 / P2 / P3)
- "Labels" — checkbox
- Quick presets: "All", "Assigned to me", "Unassigned"
- Clear all button

### 12.3 Terminology Cleanup
Global find-and-replace across all client components:
- "Claim" → "Assign to me"
- "Release" → "Unassign"
- "Claiming…" → "Assigning…"
- "Releasing…" → "Unassigning…"
- "Claimant" → "Assigned to"
- "Mine" → "Assigned to me"
- "Unclaimed" (column title) → "Unassigned"
- "stale claim" → "Inactive" or remove
- "coordination branch" → remove badge (too much jargon)
- "speccing" → "Spec" (in phase badges)
- "Health" → "Branches"
- Phase filter label: "Phase:" → "Status:"

### 12.4 Dark Mode Card & Panel Styling
- Cards: `bg-white` → `bg-white dark:bg-gray-800` with `text-gray-900 dark:text-gray-100`
- Card borders: `border-gray-200 dark:border-gray-700`
- Phase badges: ensure contrast in dark mode
- Priority badges: verify readability
- Card detail panel: full dark mode treatment
- Calendar view cells: fix the dark appearance
- All modals and overlays: dark mode support

### 12.5 Button & Label Polish
- Capitalize view switcher: "Board", "List", "Timeline", "Calendar"
- Capitalize column headers consistently
- Ensure all buttons have hover/focus states
- Add tooltips to icon-only buttons (notifications bell, dark mode toggle)
- Consistent button sizing and spacing

### 12.6 Visual Hierarchy & Spacing
- Primary actions (view switcher, filter toggle) get prominent styling
- Secondary actions (sync, branches, activity) get subdued styling
- Increase padding in header for breathing room
- Column headers: cleaner typography, remove collapse arrows by default
- Card spacing: consistent gaps, softer shadows
- Overall: fewer borders, more whitespace, modern feel

## Roadmap Item Format
```
### 12.x UI/UX Design Overhaul
- [ ] 12.1 Header reorganization
- [ ] 12.2 Collapsible filter drawer
- [ ] 12.3 Terminology cleanup
- [ ] 12.4 Dark mode card & panel styling
- [ ] 12.5 Button & label polish
- [ ] 12.6 Visual hierarchy & spacing
```

## Risk
- Renaming "Claim" affects test assertions (need to update test strings)
- Header reorganization is the largest change — may need iterative refinement
- Dark mode changes span many components
