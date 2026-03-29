# Branch Diff & Health (4.3)

Per-branch health indicators for commit lag, age, unique specs, and conflict risk.

## Features

- `GitAdapter` extended with `getCommitsBehind(branch, base)` and `getLastCommitDate(branch)`
- `BranchHealthService.computeHealth()` returns one `BranchHealth` entry per branch
- `conflictRisk` is set when two branches share the same unique spec directory
- `GET /api/branches/health?base=main` returns health for all branches
- Frontend "Health" button opens `BranchHealthPanel` slide-in panel

## BranchHealth shape

```ts
interface BranchHealth {
  branch: string;
  commitsBehind: number;
  lastCommitDate: string | null;
  uniqueSpecs: string[];
  conflictRisk: boolean;
}
```
