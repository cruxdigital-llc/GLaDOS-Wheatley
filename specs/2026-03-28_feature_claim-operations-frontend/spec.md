# Spec: Claim Operations Frontend (2.3)

## API Client Extensions

### `claimItem(itemId: string, claimant: string): Promise<ClaimEntry>`

```
POST /api/claims
Content-Type: application/json
Body: { itemId, claimant }
```

- Returns the created `ClaimEntry` on 201
- Throws `ClaimConflictError` on 409 (carries `.claimedBy` string parsed from the response if available)
- Throws a generic `Error` on other non-2xx responses

### `releaseItem(itemId: string, claimant?: string): Promise<ClaimEntry>`

```
DELETE /api/claims/:itemId?claimant=X
```

- Returns the released `ClaimEntry` on 200
- Throws on non-2xx responses using the existing `fetchJson` error path

## Hooks

### `useClaimItem(branch?: string)`

```ts
useMutation({
  mutationFn: ({ itemId, claimant }) => claimItem(itemId, claimant),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board', branch] }),
})
```

Returns the standard `UseMutationResult`. Callers inspect `error` to detect `ClaimConflictError`.

### `useReleaseItem(branch?: string)`

```ts
useMutation({
  mutationFn: ({ itemId, claimant }) => releaseItem(itemId, claimant),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board', branch] }),
})
```

## Components

### `ConflictModal`

Props:
```ts
interface ConflictModalProps {
  claimedBy: string;
  onRefresh: () => void;
  onClose: () => void;
}
```

Renders via `ReactDOM.createPortal(…, document.body)`.

Layout:
- Fixed backdrop: `fixed inset-0 bg-black/50 flex items-center justify-center z-50`
- White card: `bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4`
- Title: "Already Claimed"
- Body: "This item is already claimed by **{claimedBy}**."
- Buttons: "Refresh Board" (primary blue) and "Close" (gray)

### `Card` (updated)

New props added to `CardProps`:
```ts
currentUser?: string;
branch?: string;
onConflict?: (claimedBy: string) => void;
```

Button placement: below the phase badge row, inside a `flex gap-2` container.

Claim button:
- Visible when `!card.claim && currentUser`
- Disabled when `claimMutation.isPending`
- Text: "Claim" / "Claiming…"
- Style: `text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200`

Release button:
- Visible when `card.claim?.claimant === currentUser`
- Disabled when `releaseMutation.isPending`
- Text: "Release" / "Releasing…"
- Style: `text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200`

Visual indicators (replacing the existing plain-text claim display):
- Own claim: `bg-green-50 text-green-700 border border-green-200` badge showing claimant name
- Other's claim: `bg-gray-100 text-gray-600` badge showing claimant name
- Timestamp shown below the badge in `text-xs text-gray-400`

### `Board` (updated)

State additions:
```ts
const [currentUser, setCurrentUser] = useState(() =>
  localStorage.getItem('wheatley_claimant') ?? ''
);
const [filter, setFilter] = useState<'all' | 'unclaimed' | 'mine'>('all');
const [conflictInfo, setConflictInfo] = useState<{ claimedBy: string } | null>(null);
```

Identity persistence:
```ts
const handleUserChange = (name: string) => {
  setCurrentUser(name);
  localStorage.setItem('wheatley_claimant', name);
};
```

Filter logic applied to `board.columns`:
- `'all'` — pass columns as-is
- `'unclaimed'` — only include the column where `column.phase === 'unclaimed'`
- `'mine'` — include all columns but filter each column's `cards` to those where `card.claim?.claimant === currentUser`

Header additions (right side, before BranchSelector):
- `<input>` for "Your Name" with placeholder "Your name…"
- `<select>` for filter: All / Unclaimed Only / My Claims

ConflictModal rendered when `conflictInfo !== null`:
```tsx
<ConflictModal
  claimedBy={conflictInfo.claimedBy}
  onRefresh={() => {
    queryClient.invalidateQueries({ queryKey: ['board', branch] });
    setConflictInfo(null);
  }}
  onClose={() => setConflictInfo(null)}
/>
```

### `Column` (updated)

New passthrough props:
```ts
currentUser?: string;
branch?: string;
onConflict?: (claimedBy: string) => void;
```

Each `<Card>` receives these three additional props.
