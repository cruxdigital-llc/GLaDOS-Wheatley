# Spec: Drag-and-Drop UI (3.2)

## 1. Overview

Implements native HTML5 DnD across the three existing components (Card, Column,
Board) and adds two new artefacts: `ConfirmTransitionModal` and the
`use-transitions` hook.

## 2. Data flow

```
User drags Card
  └─ Card.onDragStart → sets dataTransfer("cardId", "fromPhase")

User drops on Column
  └─ Column.onDrop
       ├─ reads dataTransfer
       ├─ checks VALID_TRANSITIONS → reject if invalid
       ├─ if transition creates files → open ConfirmTransitionModal
       └─ on confirm → useExecuteTransition.mutate(...)
            ├─ optimistic: update local BoardState
            ├─ API call: POST /api/transitions
            ├─ success: invalidateQueries(['board', branch])
            └─ failure: revert + show error
```

## 3. New files

| File | Purpose |
|---|---|
| `src/client/components/ConfirmTransitionModal.tsx` | Confirmation dialog |
| `src/client/hooks/use-transitions.ts` | React Query mutation hook |

## 4. Modified files

| File | Change |
|---|---|
| `src/client/api.ts` | Add `executeTransition` |
| `src/client/components/Card.tsx` | Add draggable + drag handle |
| `src/client/components/Column.tsx` | Add drop zone handlers + highlight |
| `src/client/components/Board.tsx` | Wire up drag state + confirmation modal |

## 5. DnD state (lifted to Board)

```ts
interface DragState {
  cardId: string;
  fromPhase: BoardPhase;
}
```

`Board` holds `dragState` and passes `validTargetPhases` down to each Column.

## 6. Transitions that create files

```ts
const FILE_CREATING_TRANSITIONS: Set<string> = new Set([
  'unclaimed→planning',
  'planning→speccing',
  'speccing→implementing',
  'unclaimed→implementing',
]);
```
