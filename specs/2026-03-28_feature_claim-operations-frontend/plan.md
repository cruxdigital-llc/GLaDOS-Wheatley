# Plan: Claim Operations Frontend (2.3)

## Overview

This plan breaks the feature into a bottom-up implementation order: API client first, then hooks, then leaf components, then the board-level integration.

## Implementation Order

### Step 1 — API Client (src/client/api.ts)
Add two functions:
- `claimItem(itemId, claimant)` — POST /api/claims, throws on non-2xx (409 included)
- `releaseItem(itemId, claimant?)` — DELETE /api/claims/:id?claimant=X

The existing `fetchJson` helper throws on non-ok responses. For claims we need to distinguish 409 from other errors, so `claimItem` will use a custom fetch wrapper that throws a typed `ClaimConflictError` on 409.

### Step 2 — Mutation Hooks (src/client/hooks/use-claims.ts)
Create a new hook file with:
- `useClaimItem(branch?)` — wraps `claimItem` in `useMutation`; `onSuccess` invalidates `['board', branch]`
- `useReleaseItem(branch?)` — wraps `releaseItem` in `useMutation`; `onSuccess` invalidates `['board', branch]`

Both hooks accept an optional `branch` parameter so the invalidation targets the correct query key.

### Step 3 — ConflictModal Component (src/client/components/ConflictModal.tsx)
Standalone overlay component:
- Receives `claimedBy: string`, `onRefresh: () => void`, `onClose: () => void`
- Rendered via `ReactDOM.createPortal` into `document.body`
- Matches the `CardDetail` overlay style (fixed inset backdrop)

### Step 4 — Card Component Updates (src/client/components/Card.tsx)
Extend `CardProps` with:
- `currentUser?: string` — identity of the viewing user
- `branch?: string` — forwarded to hooks for query key matching
- `onConflict?: (claimedBy: string) => void` — called when a 409 is caught

Add:
- Claim button (only when `!card.claim && currentUser`)
- Release button (only when `card.claim?.claimant === currentUser`)
- Claimant badge with timestamp; highlight own-claim badges differently

### Step 5 — Board Component Updates (src/client/components/Board.tsx)
- Add `currentUser` state initialised from `localStorage.getItem('wheatley_claimant') ?? ''`
- Persist `currentUser` changes to localStorage
- Add `filter` state: `'all' | 'unclaimed' | 'mine'`
- Add `conflictInfo` state: `{ claimedBy: string } | null`
- Derive filtered columns from `board.columns` based on filter + currentUser
- Pass `currentUser`, `branch`, and `onConflict` down through Column → Card
- Render `ConflictModal` when `conflictInfo !== null`
- Remove the "Read-Only Board" badge from the header

### Step 6 — Column Component Updates (src/client/components/Column.tsx)
Pass through the new `currentUser`, `branch`, and `onConflict` props to each `Card`.

## Risk Notes

- The filter "My Claims" may show cards scattered across many columns; this is acceptable for Phase 2
- Stop-event propagation: Claim/Release buttons are inside the card `<button>`, so `stopPropagation()` is needed to prevent opening the detail panel
