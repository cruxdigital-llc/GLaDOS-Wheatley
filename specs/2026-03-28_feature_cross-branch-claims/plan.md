# Plan: Cross-Branch Claim Visibility (2.4)

## Implementation Order

Changes proceed from types outward: shared types first, then the assembler, then the service,
then the route, then the client component.

### Step 1: Extend BoardCard type (types.ts)

Add `stale?: boolean` to the `BoardCard` interface. This is the only type change needed.

### Step 2: Stale detection in board-assembler.ts

After step 3 (attach claims) in `assembleBoardState`, add a step 3a:

```
for each card in cardMap:
  if card.claim is defined AND card.specEntry is undefined AND card.statusTask is undefined:
    card.stale = true
```

This must run after both claims are attached and status tasks are cross-referenced, so it
goes at the very end of the assembly pass (after step 4, before step 5).

### Step 3: BoardService.getBoardState() update

Change signature:

```typescript
async getBoardState(branch?: string, coordinationBranch?: string): Promise<BoardState>
```

Inside the parallel `Promise.all`, replace:

```typescript
this.adapter.readFile('product-knowledge/claims.md', ref),
```

with:

```typescript
this.adapter.readFile('product-knowledge/claims.md', coordinationBranch ?? ref),
```

All other reads (roadmap, status, specs) continue using `ref` (the viewed branch).

Also update `getCardDetail()` to accept and forward `coordinationBranch`:

```typescript
async getCardDetail(cardId: string, branch?: string, coordinationBranch?: string)
```

### Step 4: Update board route (routes/board.ts)

The route must resolve the coordination branch. The cleanest approach without adding a
`ClaimService` dependency to the route is to accept it as a query parameter (so the client
can pass it) or to pass it via the `BoardService` constructor.

Chosen approach: pass `ClaimService` into the board route so it can call
`claimService.getCoordinationBranch()`. This mirrors the pattern used by claims routes.

Update `boardRoutes` signature:

```typescript
export function boardRoutes(
  app: FastifyInstance,
  boardService: BoardService,
  claimService: ClaimService,
): void
```

In the `GET /api/board` handler:

```typescript
const coordinationBranch = await claimService.getCoordinationBranch();
return boardService.getBoardState(branch, coordinationBranch);
```

Update `server.ts` to pass `claimService` to `boardRoutes`.

### Step 5: Card component updates

The `Card` component already receives `branch` (the viewed branch). Add a new optional prop
`coordinationBranch?: string`. When both are defined and differ, and the card has a claim,
show a small badge.

Also render a stale warning badge when `card.stale` is true.

The two new UI elements:

1. **Cross-branch badge** (appears below claimant info, when viewed ≠ coordination):
   ```tsx
   <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
     coordination branch
   </span>
   ```

2. **Stale warning** (appears when `card.stale`):
   ```tsx
   <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
     stale claim
   </span>
   ```

### Step 6: Tests

- `board-service.test.ts`: two new tests
  1. Claims are read from `coordinationBranch` when it differs from the viewed branch
  2. Roadmap/status/specs are still read from the viewed branch when `coordinationBranch` is set

- `board-assembler.test.ts`: two new tests
  1. Stale flag is set when card has a claim but no spec and no status task
  2. Stale flag is NOT set when card has a claim and a spec entry

## File Change Summary

| File | Change |
|---|---|
| `src/shared/grammar/types.ts` | Add `stale?: boolean` to `BoardCard` |
| `src/shared/parsers/board-assembler.ts` | Add stale detection pass after claims + status |
| `src/server/api/board-service.ts` | Accept `coordinationBranch`, route claims read |
| `src/server/api/routes/board.ts` | Accept `ClaimService`, resolve coordination branch |
| `src/server/api/server.ts` | Pass `claimService` to `boardRoutes` |
| `src/client/components/Card.tsx` | Add cross-branch badge and stale warning |
| `src/server/api/__tests__/board-service.test.ts` | New tests for 2.4.1 |
| `src/shared/parsers/board-assembler.test.ts` | New tests for 2.4.3 |
