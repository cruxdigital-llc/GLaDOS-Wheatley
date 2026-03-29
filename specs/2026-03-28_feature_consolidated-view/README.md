# Consolidated Board View (4.2)

Merges board states from multiple branches into a single unified view.

## Features

- `mergeBoards(results)` deduplicates cards by ID across branches
- Cards appearing on multiple branches get `branches: string[]` populated
- Frontend toggle: "Single" / "All Branches" view mode in the board header
- Branch badges shown on cards in consolidated view (teal color)

## Card deduplication

When the same card ID appears on multiple branches, it is shown once. The `branches`
field lists every branch the card was found on.  The card's phase/claim metadata comes
from the last scanned branch.
