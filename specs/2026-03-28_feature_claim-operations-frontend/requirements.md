# Requirements: Claim Operations Frontend (2.3)

## Functional Requirements

### 2.3.1 Claim Button
- A "Claim" button MUST appear on cards whose `phase === 'unclaimed'` (i.e., no `card.claim` entry)
- The button MUST only appear when the current user identity is non-empty
- Clicking "Claim" MUST call `POST /api/claims` with `{ itemId: card.id, claimant: currentUser }`
- On success (201), the board query MUST be invalidated and refetched

### 2.3.2 Release Button
- A "Release" button MUST appear on cards where `card.claim?.claimant === currentUser`
- Clicking "Release" MUST call `DELETE /api/claims/:id?claimant=X` where `:id` is `card.id`
- On success (200), the board query MUST be invalidated and refetched

### 2.3.3 Conflict Modal
- When a claim attempt returns a 409 response, a modal overlay MUST be shown
- The modal MUST display who currently holds the claim (from the error context or the card data)
- The modal MUST include a "Refresh Board" button that invalidates the board query and closes the modal
- The modal MUST include a "Close" button that dismisses it without refreshing

### 2.3.4 Visual Indicators
- Cards with an active `claim` MUST display the claimant's name in a visible badge
- Cards with an active `claim` MUST display the claim timestamp in a human-readable format
- Cards claimed by the current user SHOULD use a distinct visual style (e.g., highlighted badge)

### 2.3.5 Filter / Sort
- The board header MUST include a filter dropdown with options: "All", "Unclaimed Only", "My Claims"
- "All" shows all cards across all columns (default behaviour, no change)
- "Unclaimed Only" shows only cards in the `unclaimed` phase column; other columns are hidden or empty
- "My Claims" shows only cards where `card.claim?.claimant === currentUser` across all columns
- The filter MUST be applied client-side; no additional network requests

## Non-Functional Requirements

- All mutations MUST show a loading/disabled state on the button while in-flight
- Claim/release errors other than 409 MUST be surfaced (e.g., console error or inline message)
- User identity MUST persist across page reloads via localStorage
- Tailwind classes MUST be consistent with existing component styling conventions
