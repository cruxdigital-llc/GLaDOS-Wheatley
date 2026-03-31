# Tasks: UI/UX Design Overhaul

## 12.3 Terminology Cleanup
- [x] Create `src/shared/display-names.ts` with PHASE_DISPLAY_NAMES mapping
- [x] Update Card.tsx: "Claim"→"Assign to me", "Release"→"Unassign", remove stale/coordination badges
- [x] Update Column.tsx: use PHASE_DISPLAY_NAMES for column titles
- [x] Update Board.tsx: preset labels, filter labels, phase references
- [x] Update ListView.tsx and TimelineView.tsx: use phaseDisplayName

## 12.4 Dark Mode Card & Panel Styling
- [x] Update Card.tsx: dark bg, borders, text, phase badges, action buttons
- [x] Update Column.tsx: dark bg, headers, count badge, empty state
- [x] Update CardDetail.tsx: dark panel bg, header, metadata, spec blocks, forms
- [x] Update ListView.tsx: dark table headers, rows, borders
- [x] Update TimelineView.tsx: dark bg, labels
- [x] Update CalendarView.tsx: verified dark-friendly (zinc scheme)
- [x] Update NotificationBell.tsx: dark dropdown

## 12.5 Button & Label Polish
- [x] Add VIEW_LABELS constant, capitalize view switcher buttons
- [x] Add tooltips to icon-only buttons
- [x] Standardize button classes (primary/secondary/destructive)

## 12.2 Collapsible Filter Drawer
- [x] Create FilterDrawer.tsx component with pill-style status toggles
- [x] Extract filter state/logic from Board.tsx into FilterDrawer
- [x] Add Filter toggle button with active-count badge to Board toolbar
- [x] Add dark mode classes to FilterDrawer

## 12.1 Header Reorganization
- [x] Restructure Board.tsx header into Row 1 (logo / views / user+notifications+settings) and Row 2 (filter+sort / branch+sync)
- [x] Create SettingsMenu.tsx with dark mode, activity, branches, all-branches toggle, display name edit
- [x] Replace inline user identity input with display text
- [x] Move DarkModeToggle, Activity, Branches buttons into SettingsMenu

## 12.6 Visual Hierarchy & Spacing
- [x] Update card styling: rounded-xl, softer shadows, hover lift
- [x] Clean up column headers: remove collapse chevrons, uppercase style
- [x] Adjust header spacing, primary vs secondary button weight
