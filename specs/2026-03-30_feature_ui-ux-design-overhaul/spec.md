# Specification: UI/UX Design Overhaul

## Scope
Client-side only. No backend/API changes. All work in `src/client/`.

---

## 12.1 Header Reorganization

### Current State
Board.tsx header (~lines 575-750) is a single `<header>` with 12+ controls in a flat `flex items-center gap-4 flex-wrap` row. No grouping, no hierarchy.

### Target Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Logo] Wheatley          [Board|List|Timeline|Calendar]    [👤][🔔][⚙] │
│                                                                         │
│ [Filter ▾ (2)]  [Sort: Default ▾]   [🔀 main ▾]        [↻ Sync]       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Row 1 — Primary Bar:**
- **Left**: `<h1>Wheatley</h1>` + RepoSelector (if multi-repo)
- **Center**: View switcher — `Board | List | Timeline | Calendar` (properly capitalized, prominent pill-style)
- **Right**: User display (show name, not editable input), NotificationBell, settings menu (gear icon → dropdown with: Dark mode toggle, Activity feed, Branches panel, "All Branches" toggle)

**Row 2 — Toolbar:**
- **Left**: Filter toggle button (with active count badge), Sort dropdown
- **Center**: (empty — breathing room)
- **Right**: Branch selector dropdown, Sync button

### Component Changes

**Board.tsx:**
- Split header into two sub-rows with `justify-between`
- Remove inline `<input>` for user identity — show `currentUser` as text (editable on click, or via settings)
- Move Activity, Health/Branches, DarkModeToggle, branch-mode toggle into a settings/gear dropdown
- Row 1 className: `flex items-center justify-between px-4 py-2`
- Row 2 className: `flex items-center justify-between px-4 py-1 border-t border-gray-100 dark:border-gray-700 text-sm`

### New Component: SettingsMenu.tsx
A gear icon button that opens a dropdown with:
- Dark mode selector (Light / Dark / Auto)
- "Show activity feed" toggle
- "Show branch status" toggle
- "View all branches" toggle
- Divider
- "Edit display name" (opens inline edit)

---

## 12.2 Collapsible Filter Drawer

### Current State
Filter bar is a permanent second row in Board.tsx (lines ~750-900) with `Phase:` multi-select, `Claimant:` input, `Priority:` dropdown, `Has labels` checkbox, and Presets menu. No dark mode classes. Always visible.

### Target

Replace with a `Filter` button in the toolbar row that toggles a slide-down drawer.

**Filter button:**
```tsx
<button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border ...">
  <FunnelIcon className="w-4 h-4" />
  Filter
  {activeFilterCount > 0 && (
    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-600 text-white">
      {activeFilterCount}
    </span>
  )}
</button>
```

**Drawer (when open):**
```
┌─────────────────────────────────────────────────────────────────┐
│ Status:  [All] [Unassigned] [Planning] [Spec] [Building] ...   │
│ Assigned to: [____________]   Priority: [Any][P0][P1][P2][P3]  │
│ Labels: [☐ Has labels]                                          │
│                                                                  │
│ Quick: [All] [Assigned to me] [Unassigned]    [Clear] [Presets] │
└─────────────────────────────────────────────────────────────────┘
```

### New Component: FilterDrawer.tsx
Extract from Board.tsx into its own component. Props:
```typescript
interface FilterDrawerProps {
  isOpen: boolean;
  filter: CompoundFilter;
  onFilterChange: (filter: CompoundFilter) => void;
  currentUser: string;
  presets: FilterPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: FilterPreset) => void;
  onDeletePreset: (name: string) => void;
}
```

### Status Pills (renamed from Phase)
Replace the multi-select `<select>` with pill toggle buttons:
```tsx
{phases.map(phase => (
  <button
    key={phase}
    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
      selected ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
               : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
    }`}
  >
    {PHASE_DISPLAY_NAMES[phase]}
  </button>
))}
```

### Phase Display Name Mapping
```typescript
const PHASE_DISPLAY_NAMES: Record<string, string> = {
  unclaimed: 'Unassigned',
  planning: 'Planning',
  speccing: 'Spec',
  implementing: 'Building',
  verifying: 'Review',
  done: 'Done',
};
```

---

## 12.3 Terminology Cleanup

### Mapping Table

| Location | Old Term | New Term |
|----------|----------|----------|
| Card.tsx buttons | "Claim" | "Assign to me" |
| Card.tsx buttons | "Claiming…" | "Assigning…" |
| Card.tsx buttons | "Release" | "Unassign" |
| Card.tsx buttons | "Releasing…" | "Unassigning…" |
| Card.tsx badge | "stale claim" | Remove entirely |
| Card.tsx badge | "coordination branch" | Remove entirely |
| Board.tsx preset | "Mine" | "Assigned to me" |
| Board.tsx preset | "Unclaimed" | "Unassigned" |
| Board.tsx filter | "Phase:" | "Status:" |
| Board.tsx filter | "Claimant:" | "Assigned to:" |
| Board.tsx button | "Health" | "Branches" |
| Column headers | "Unclaimed" | "Unassigned" |
| Column headers | "Speccing" | "Spec" |
| Column headers | "Implementing" | "Building" |
| Column headers | "Verifying" | "Review" |
| Phase badges (Card.tsx) | Same as column headers | Same new names |
| hooks/use-claims.ts | No UI text changes | Keep API params as-is |

### Implementation Notes
- The backend API still uses "claim"/"claimant" — only the UI display text changes
- `BoardPhase` type and API field names stay as-is
- Add a `PHASE_DISPLAY_NAMES` constant used everywhere phases are shown
- Filter URL params can keep `phases=unclaimed` — only the displayed label changes

### Test Impact
- `src/client/components/__tests__/` — update any snapshot or text-matching assertions
- Server tests are NOT affected (terminology stays the same on the API)

---

## 12.4 Dark Mode Card & Panel Styling

### Card.tsx Changes

**Main card container:**
```
Old: bg-white rounded-lg shadow-sm border p-3 ... border-gray-200
New: bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-3 ... border-gray-200 dark:border-gray-700
```

**Card title:**
```
Old: text-gray-900
New: text-gray-900 dark:text-gray-100
```

**Card ID text:**
```
Old: text-gray-400
New: text-gray-400 dark:text-gray-500
```

**Phase badges** — add dark variants for each:
```typescript
const PHASE_COLORS: Record<string, string> = {
  unclaimed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  planning: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  speccing: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  implementing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  verifying: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};
```

**Claim/Release buttons** — add dark variants for bg, text, border, hover.

### Column.tsx Changes
- Column wrapper: add `dark:bg-gray-800 dark:border-gray-700`
- Column header text: `text-gray-700` → `text-gray-700 dark:text-gray-200`
- Card count badge: `bg-gray-200 text-gray-400` → add `dark:bg-gray-700 dark:text-gray-400`
- Empty state text: add `dark:text-gray-500`

### CardDetail.tsx Changes
- Panel background: `bg-white` → `bg-white dark:bg-gray-900`
- Header section: `bg-white border-b` → `bg-white dark:bg-gray-900 border-b dark:border-gray-700`
- Title text: add `dark:text-gray-100`
- Metadata section: add `dark:border-gray-700`
- Section titles (h3): `text-gray-700` → add `dark:text-gray-300`
- Spec content blocks: `bg-gray-50 border` → add `dark:bg-gray-800 dark:border-gray-700`
- All form inputs: add dark border/bg/text classes

### Board.tsx Filter Bar (or new FilterDrawer.tsx)
- Container: add `dark:bg-gray-800 dark:border-gray-700`
- All labels: add `dark:text-gray-300`
- All inputs/selects: add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200`

### CalendarView.tsx
- Grid cells: ensure proper `dark:bg-gray-800` backgrounds
- Day numbers: ensure `dark:text-gray-300`
- Empty cells: `dark:bg-gray-900`

### ListView.tsx
- Table headers: add dark bg/text
- Table rows: add dark alternating backgrounds
- Table borders: add dark variants

### TimelineView.tsx
- Background: add dark variant
- Labels: add dark text

---

## 12.5 Button & Label Polish

### Capitalize View Switcher
In Board.tsx view buttons, change from `capitalize` CSS class to explicit capitalized strings:
```typescript
const VIEW_LABELS: Record<BoardView, string> = {
  board: 'Board',
  list: 'List',
  timeline: 'Timeline',
  calendar: 'Calendar',
};
```

### Tooltips
Add `title` attribute to icon-only buttons:
- NotificationBell: `title="Notifications"`
- DarkModeToggle: already has `title={`Theme: ${theme}`}`
- Sync button: `title="Sync with repository"`
- Settings menu: `title="Settings"`

### Button Consistency
All action buttons should follow this pattern:
- Primary: `bg-blue-600 text-white hover:bg-blue-700 rounded-md px-3 py-1.5 text-sm font-medium`
- Secondary: `border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md px-3 py-1.5 text-sm`
- Destructive: `border border-red-200 text-red-600 hover:bg-red-50 rounded-md px-3 py-1.5 text-sm`

---

## 12.6 Visual Hierarchy & Spacing

### Header Spacing
- Row 1: `px-4 py-3` (more vertical breathing room)
- Row 2: `px-4 py-2`
- Gap between controls: `gap-3` (consistent)

### Column Headers
- Remove collapse chevron by default (keep expand functionality via double-click or right-click context)
- Cleaner look: `text-sm font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400`
- Card count: smaller, more subtle

### Card Styling
- Softer shadow: `shadow-sm` → `shadow` (slightly larger, softer)
- Hover: `hover:shadow-md` → `hover:shadow-lg hover:-translate-y-0.5 transition-all`
- Border radius: `rounded-lg` → `rounded-xl` (slightly softer corners)
- Padding: keep `p-3`
- Gap between cards: `gap-2` → `gap-3`

### Primary vs Secondary Actions
- View switcher: filled pill style, prominent
- Filter button: outlined with icon, medium weight
- Sort: simple dropdown, secondary
- Sync: icon-only or small text, tertiary
- Branch selector: simple dropdown, secondary

### Overall
- Remove unnecessary borders between sections
- Use whitespace instead of dividers where possible
- Consistent rounding: `rounded-md` for buttons, `rounded-xl` for cards, `rounded-lg` for panels

---

## Edge Cases

1. **Long user names**: Truncate with ellipsis at 20 chars in header display
2. **Many active filters**: Badge shows count, drawer stays scrollable
3. **Empty board**: "No cards to display" message adapts to dark mode
4. **Mobile/narrow viewport**: Header wraps gracefully (already uses flex-wrap)
5. **Phase name backward compatibility**: API params unchanged, only display labels change
6. **Existing saved filter presets**: Old presets use `phases` key which still works — only the displayed label changes
7. **Keyboard navigation**: All new interactive elements must be focusable and operable via keyboard

---

## Files Modified

| File | Type of Change |
|------|---------------|
| Board.tsx | Header restructure, filter extraction, terminology |
| Card.tsx | Dark mode, terminology, visual polish |
| Column.tsx | Dark mode, terminology, visual polish |
| CardDetail.tsx | Dark mode throughout |
| DarkModeToggle.tsx | Move into settings menu |
| ListView.tsx | Dark mode |
| TimelineView.tsx | Dark mode |
| CalendarView.tsx | Dark mode fix |
| NotificationBell.tsx | Dark mode |
| **NEW** FilterDrawer.tsx | Extracted filter drawer component |
| **NEW** SettingsMenu.tsx | Gear icon dropdown for secondary controls |
| **NEW** shared/display-names.ts | Phase display name mapping, shared constants |
