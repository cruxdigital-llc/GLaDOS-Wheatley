# Requirements: Cross-Branch Claim Visibility (2.4)

## Functional Requirements

### FR-1: Claims Always Read from Coordination Branch (2.4.1)

- `BoardService.getBoardState()` must accept an optional `coordinationBranch` parameter
- When `coordinationBranch` is provided and differs from the viewed branch, `claims.md` must be read from `coordinationBranch`
- When `coordinationBranch` is absent, claims are read from the viewed branch (existing behavior, backward-compatible)
- The roadmap, specs, and project status must continue to be read from the viewed branch
- The board route must resolve the coordination branch (via `ClaimService.getCoordinationBranch()`) and pass it to `BoardService.getBoardState()`

### FR-2: Visual Distinction for Cross-Branch Claims (2.4.2)

- When the viewed branch differs from the coordination branch, cards with an active claim must display a cross-branch indicator badge
- The indicator must be visually subtle (secondary styling) and not dominate the claim display
- The `Card` component receives an optional `coordinationBranch` and a `viewedBranch` (or derives "is cross-branch" from a boolean prop) and renders the badge conditionally
- The badge text must convey that the claim originates from the coordination branch (e.g., "coordination branch")

### FR-3: Stale Claim Detection (2.4.3)

- A `stale?: boolean` field must be added to the `BoardCard` type in `src/shared/grammar/types.ts`
- The assembler must set `stale = true` on any card that meets ALL of the following:
  1. Has an active claim (`card.claim` is defined)
  2. Has no `specEntry` (no spec directory found on the viewed branch for this item)
  3. Has no `statusTask` (no active status task found on the viewed branch for this item)
- Cards without a claim must not have `stale` set
- The `Card` component must display a visual warning (e.g., an amber/orange badge "stale claim") when `card.stale` is true

## Non-Functional Requirements

- The change to `getBoardState()` must be backward-compatible: callers that omit `coordinationBranch` see no behavioral change
- No new dependencies introduced
- The stale check must be a single pass over the card map, O(n) in the number of cards
