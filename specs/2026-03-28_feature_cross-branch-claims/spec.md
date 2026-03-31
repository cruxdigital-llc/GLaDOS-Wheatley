# Spec: Cross-Branch Claim Visibility (2.4)

## 1. Type Changes

### 1.1 BoardCard — `stale` field

Add to `BoardCard` in `src/shared/grammar/types.ts`:

```typescript
/**
 * True when this card has an active claim but no spec entry and no status task
 * on the viewed branch. Indicates the claim may be orphaned or premature.
 */
stale?: boolean;
```

## 2. Board Assembler — Stale Detection

### 2.1 Location

After step 4 (status task cross-reference) and before step 5 (column organization) in
`assembleBoardState`.

### 2.2 Algorithm

```typescript
// 4a. Mark stale claims
for (const card of cardMap.values()) {
  if (card.claim && !card.specEntry && !card.statusTask) {
    card.stale = true;
  }
}
```

A card is stale when:
- It has an active claim (`card.claim` is defined), AND
- It has no spec directory entry (`card.specEntry` is undefined), AND
- It has no matching active status task (`card.statusTask` is undefined)

Stale detection intentionally runs on the assembled data for the viewed branch, so
"no spec" means no spec on the viewed branch.

## 3. BoardService — Coordination Branch Parameter

### 3.1 getBoardState signature

```typescript
async getBoardState(branch?: string, coordinationBranch?: string): Promise<BoardState>
```

### 3.2 Read routing

```typescript
const ref = branch ?? undefined;
const claimsRef = coordinationBranch ?? ref;

const [roadmapContent, statusContent, claimsContent, specDirs] = await Promise.all([
  this.adapter.readFile('product-knowledge/ROADMAP.md', ref),
  this.adapter.readFile('product-knowledge/PROJECT_STATUS.md', ref),
  this.adapter.readFile('product-knowledge/claims.md', claimsRef),
  this.adapter.listDirectory('specs', ref),
]);
```

Roadmap, status, and specs use `ref` (the viewed branch).
Claims use `claimsRef` (the coordination branch, or fallback to viewed branch).

### 3.3 getCardDetail signature

```typescript
async getCardDetail(
  cardId: string,
  branch?: string,
  coordinationBranch?: string,
): Promise<{ card: BoardCard; specContents?: Record<string, string> } | null>
```

The inner `getBoardState` call is updated to pass `coordinationBranch` through.

## 4. Board Route — Coordination Branch Resolution

### 4.1 Updated boardRoutes signature

```typescript
import type { ClaimService } from '../claim-service.js';

export function boardRoutes(
  app: FastifyInstance,
  boardService: BoardService,
  claimService: ClaimService,
): void
```

### 4.2 GET /api/board handler

```typescript
app.get<{ Querystring: { branch?: string } }>('/api/board', async (request) => {
  const branch = request.query.branch || undefined;
  const coordinationBranch = await claimService.getCoordinationBranch();
  return boardService.getBoardState(branch, coordinationBranch);
});
```

### 4.3 GET /api/board/card/:id handler

```typescript
const coordinationBranch = await claimService.getCoordinationBranch();
const result = await boardService.getCardDetail(id, branch, coordinationBranch);
```

## 5. Server Wiring

In `src/server/api/server.ts`, update the `boardRoutes` call:

```typescript
boardRoutes(app, boardService, claimService);
```

`claimService` is already instantiated before the routes are registered, so no ordering
change is needed.

## 6. Card Component

### 6.1 Updated CardProps

```typescript
interface CardProps {
  card: BoardCard;
  onClick?: (card: BoardCard) => void;
  currentUser?: string;
  branch?: string;
  coordinationBranch?: string;   // NEW
  onConflict?: (claimedBy: string) => void;
}
```

### 6.2 Cross-branch indicator

Condition: `card.claim && coordinationBranch && branch && coordinationBranch !== branch`

Rendered inside the claim display section, below the claimant badge:

```tsx
{card.claim && coordinationBranch && branch && coordinationBranch !== branch && (
  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 w-fit">
    coordination branch
  </span>
)}
```

### 6.3 Stale claim warning

Condition: `card.stale`

Rendered below the claim display section (or in the absence of it):

```tsx
{card.stale && (
  <div className="mt-1">
    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
      stale claim
    </span>
  </div>
)}
```

## 7. Data Flow Summary

```
GET /api/board?branch=feature/foo
  │
  ├─ claimService.getCoordinationBranch()  → "main"
  │
  └─ boardService.getBoardState("feature/foo", "main")
       │
       ├─ ROADMAP.md        ← from "feature/foo"
       ├─ PROJECT_STATUS.md ← from "feature/foo"
       ├─ specs/            ← from "feature/foo"
       └─ claims.md         ← from "main"   (coordination branch)
            │
            └─ assembleBoardState(roadmap, specs, status, claims)
                 └─ stale detection: items with claims but no spec/status on "feature/foo"
```
