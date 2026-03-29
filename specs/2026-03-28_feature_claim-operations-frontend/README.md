# Feature: Claim Operations Frontend (2.3)

## Summary

This feature adds claim and release interactions to the Wheatley board UI. Users identify themselves with a simple name input (persisted in localStorage) and can claim unclaimed cards or release their own claims directly from the card. Conflict handling is surfaced via a modal when a 409 response is received.

## Goals

- Add a "Your Name" identity input to the board header (localStorage-backed)
- Add "Claim" button on unclaimed cards when the user has an identity set
- Add "Release" button on cards claimed by the current user
- Show visual indicators: claimant name badge and claim timestamp on claimed cards
- Show a ConflictModal when a claim attempt returns 409, displaying who already claimed it
- Add filter dropdown: All / Unclaimed Only / My Claims

## Non-Goals

- Authentication or user accounts (Phase 2 uses plain text identity)
- Optimistic updates (just invalidate and refetch)
- Claim TTL or expiry UI (Phase 5)
- Claiming from the card detail panel (buttons are inline on the card only)

## Design Decisions

- User identity is a free-text input stored at `localStorage.key('wheatley_claimant')`
- The ConflictModal is a centered overlay portal using React's `createPortal`
- Claim/release mutations use `useMutation` from React Query with `onSuccess` invalidating `['board', branch]`
- Filter state lives in `Board` component state; filtering is applied client-side after the board query resolves
- "Unclaimed Only" shows cards where `card.phase === 'unclaimed'`
- "My Claims" shows cards across all columns where `card.claim?.claimant === currentUser`

## Key Files

| File | Role |
|---|---|
| `src/client/api.ts` | Added `claimItem` and `releaseItem` functions |
| `src/client/hooks/use-claims.ts` | `useClaimItem` and `useReleaseItem` mutation hooks |
| `src/client/components/Card.tsx` | Claim/Release buttons and claimant visual indicators |
| `src/client/components/ConflictModal.tsx` | 409 conflict overlay |
| `src/client/components/Board.tsx` | Identity input, filter dropdown, conflict state |
| `src/client/components/Column.tsx` | Passes claimant prop through to Card |
