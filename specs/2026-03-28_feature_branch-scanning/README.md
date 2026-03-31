# Branch Enumeration & Scanning (4.1)

Provides configurable scanning of multiple branches with SHA-based caching.

## Features

- `BranchScanner` enumerates branches via `adapter.listBranches()` and applies include/exclude filters
- SHA-based cache: branches whose latest commit SHA hasn't changed are not re-parsed
- Env-var config: `WHEATLEY_SCAN_INCLUDE` and `WHEATLEY_SCAN_EXCLUDE` (comma-separated regex patterns)
- `GET /api/board/consolidated` endpoint that returns a merged board across all matching branches

## Usage

```ts
const scanner = new BranchScanner(adapter);
const results = await scanner.scanAllBranches({ prefixes: ['feat/'] });
```
