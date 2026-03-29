# Tasks: Claim Operations Frontend (2.3)

## Implementation Tasks

- [x] **2.3.1 API client — claimItem**: Add `claimItem(itemId, claimant)` to `src/client/api.ts`; POST /api/claims; throw `ClaimConflictError` on 409
- [x] **2.3.2 API client — releaseItem**: Add `releaseItem(itemId, claimant?)` to `src/client/api.ts`; DELETE /api/claims/:id?claimant=X
- [x] **2.3.3 useClaimItem hook**: Create `src/client/hooks/use-claims.ts`; `useMutation` wrapping `claimItem`; invalidates `['board', branch]` on success
- [x] **2.3.4 useReleaseItem hook**: Add `useReleaseItem` to `src/client/hooks/use-claims.ts`; `useMutation` wrapping `releaseItem`; invalidates `['board', branch]` on success
- [x] **2.3.5 ConflictModal component**: Create `src/client/components/ConflictModal.tsx`; portal overlay; shows claimedBy; "Refresh Board" and "Close" buttons
- [x] **2.3.6 Card — Claim button**: Add Claim button to `Card.tsx`; visible when `!card.claim && currentUser`; calls `useClaimItem`; stopPropagation to avoid opening detail panel
- [x] **2.3.7 Card — Release button**: Add Release button to `Card.tsx`; visible when `card.claim?.claimant === currentUser`; calls `useReleaseItem`
- [x] **2.3.8 Card — visual indicators**: Update claim display in `Card.tsx` with claimant badge (own vs. other style) and timestamp; replace existing plain-text claim line
- [x] **2.3.9 Board — identity input**: Add "Your Name" input to `Board.tsx` header; state initialised from localStorage; persists on change
- [x] **2.3.10 Board — filter dropdown**: Add filter select (All / Unclaimed Only / My Claims) to header; derive filtered columns client-side
- [x] **2.3.11 Board — conflict handling**: Add `conflictInfo` state; pass `onConflict` down to cards; render `ConflictModal` on 409
- [x] **2.3.12 Column — prop passthrough**: Update `Column.tsx` to accept and forward `currentUser`, `branch`, `onConflict` to each `Card`

## Verification Checklist

Before marking this feature done, verify:

- [x] Claim button appears on unclaimed cards when a user name is set
- [x] Claim button is absent when user name is empty
- [x] Release button appears only on cards claimed by the current user
- [x] Clicking Claim calls POST /api/claims and refreshes the board
- [x] Clicking Release calls DELETE /api/claims/:id and refreshes the board
- [x] A 409 response from Claim opens the ConflictModal with the correct claimant name
- [x] "Refresh Board" in the modal invalidates the board query and closes the modal
- [x] "Close" in the modal dismisses it without refreshing
- [x] Claimant badge and timestamp are visible on claimed cards
- [x] Own-claim badge uses a distinct (green) style; others use gray
- [x] Filter "Unclaimed Only" shows only the unclaimed column
- [x] Filter "My Claims" shows only cards claimed by the current user
- [x] User name persists across page reload via localStorage
