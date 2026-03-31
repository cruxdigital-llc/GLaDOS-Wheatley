# Requirements: Drag-and-Drop UI (3.2)

## Functional Requirements

### FR-1 — Draggable cards
Cards rendered on the board must be draggable. The `draggable="true"` attribute
must be set and `dragstart` must store the card ID and source phase in the
dataTransfer payload.

### FR-2 — Drop zone validation
Each column must listen for `dragover`. It must only accept the drop (call
`preventDefault`) when the target phase is a valid transition from the card's
current phase (as determined by `VALID_TRANSITIONS`).

### FR-3 — Visual feedback
While a drag is in progress:
- Valid target columns are highlighted with a coloured ring
- Invalid target columns are dimmed / cursor shows "not-allowed"
- The card being dragged is shown at reduced opacity

### FR-4 — Optimistic update with rollback
On drop:
1. Immediately move the card in local state (optimistic)
2. Call `POST /api/transitions`
3. On success: invalidate the board query so the server state wins
4. On failure: revert the local move and show an inline error toast

### FR-5 — Confirmation dialog for file-creating transitions
Transitions that generate files (unclaimed→planning, planning→speccing,
speccing→implementing, unclaimed→implementing) must show a confirmation dialog
before executing. The user may cancel without side effects.

### FR-6 — API function
`src/client/api.ts` must export `executeTransition(itemId, from, to, branch?)`
that calls `POST /api/transitions`.

### FR-7 — Hook
`src/client/hooks/use-transitions.ts` must export `useExecuteTransition(branch?)`
returning a React Query mutation.
