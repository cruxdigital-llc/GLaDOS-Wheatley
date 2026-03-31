# Tasks: Cross-Branch Claim Visibility (2.4)

## Implementation Tasks

- [x] **2.4.1 BoardCard.stale type field**: Add `stale?: boolean` to `BoardCard` interface in `src/shared/grammar/types.ts`
- [x] **2.4.1 Stale detection in assembler**: Add pass after step 4 in `assembleBoardState` — sets `card.stale = true` when card has a claim but no `specEntry` and no `statusTask`; in `src/shared/parsers/board-assembler.ts`
- [x] **2.4.1 BoardService coordinationBranch param**: Update `getBoardState(branch?, coordinationBranch?)` to read `claims.md` from `coordinationBranch ?? ref`; update `getCardDetail` to accept and forward it; in `src/server/api/board-service.ts`
- [x] **2.4.1 Board route wiring**: Update `boardRoutes` to accept `ClaimService`, call `claimService.getCoordinationBranch()`, and pass it to `getBoardState` and `getCardDetail`; in `src/server/api/routes/board.ts`
- [x] **2.4.1 Server wiring**: Pass `claimService` to `boardRoutes` in `src/server/api/server.ts`
- [x] **2.4.2 Cross-branch indicator in Card**: Add `coordinationBranch?: string` prop to `Card`; render a "coordination branch" badge when `card.claim && coordinationBranch !== branch`; in `src/client/components/Card.tsx`
- [x] **2.4.3 Stale warning in Card**: Render an amber "stale claim" badge when `card.stale` is true; in `src/client/components/Card.tsx`

## Test Tasks

- [x] **BoardService: cross-branch claim reading**: Add tests verifying that `claims.md` is read from `coordinationBranch` and that roadmap/status/specs are read from the viewed branch; in `src/server/api/__tests__/board-service.test.ts`
- [x] **Board assembler: stale detection**: Add tests for stale flag set on claimed+no-spec+no-task card, stale NOT set when spec exists, stale NOT set when status task exists, stale NOT set on unclaimed card; in `src/shared/parsers/board-assembler.test.ts`

## Verification Checklist

Before marking this feature done, verify:

- [x] `GET /api/board` still returns 200 (no regressions)
- [x] When viewing a non-main branch, claims from the coordination branch appear on cards
- [x] Cards with claims but no spec/status on the viewed branch have `stale: true` in the response
- [x] `Card` component renders "coordination branch" badge when viewed branch differs from coordination branch
- [x] `Card` component renders "stale claim" badge when `card.stale` is true
- [x] All new tests are present and structured consistently with existing test files
- [x] No TypeScript errors introduced (backward-compatible signatures)
