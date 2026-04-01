# Requirements: UI/UX Design Overhaul

## Goal
Transform Wheatley from a developer-centric prototype into a clean, intuitive project board that anyone can use without knowing GLaDOS terminology.

## Success Criteria
1. A new user can understand the board and perform basic actions (assign a card, change its status, filter) within 30 seconds of opening it
2. Zero jargon visible in the default UI — no "claim", "claimant", "spec", "coordination branch", "stale claim"
3. Header has clear visual hierarchy with controls logically grouped
4. Dark mode is fully supported — cards, panels, and all UI elements adapt
5. The filter bar doesn't compete for attention with the main content
6. All button labels are properly capitalized and self-explanatory

## Problems to Solve

### P1: Header Overload
The header currently contains 12+ controls in a flat row: user identity, quick filters, sort, view switcher, branch mode, dark mode toggle, sync, notifications, repo selector, activity, health, branch selector. There's no grouping or hierarchy.

### P2: Jargon-Heavy Terminology
- "Claim" / "Release" → Should be "Assign to me" / "Unassign"
- "Claimant" filter → "Assigned to"
- "Mine" preset → "Assigned to me"
- "Unclaimed" column/preset → "Unassigned"
- "stale claim" badge → "No recent activity" or remove
- "coordination branch" badge → hide or simplify
- "speccing" phase → "Spec" or "Design"
- "Health" button → "Branch Status" or similar

### P3: Filter Bar Placement
The phase multi-select, claimant input, priority dropdown, and label checkbox sit in a permanent second row below the header. This wastes vertical space and is confusingly disconnected from the header controls.

### P4: Dark Mode Card Styling
Cards remain white (`bg-white`) in dark mode. They should adapt to dark backgrounds.

### P5: View Switcher & Button Capitalization
View buttons show lowercase ("board", "list", "timeline", "calendar"). All action buttons and labels should be properly capitalized.

### P6: Visual Hierarchy
No distinction between primary actions (view switcher, filters) and secondary actions (sync, health, activity). Everything is the same visual weight.

## Non-Goals
- No new features — this is a polish/redesign pass only
- No backend changes (API endpoints stay the same)
- No changes to drag-and-drop behavior
- No changes to the data model
