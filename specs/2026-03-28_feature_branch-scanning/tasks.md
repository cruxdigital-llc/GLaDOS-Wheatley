# Tasks: Branch Scanning

- [x] 4.1.1 List all active branches (filter: configurable prefix/pattern)
- [x] 4.1.2 Parse board state from each active branch independently
- [x] 4.1.3 Caching layer: avoid re-parsing branches that haven't changed since last scan
- [x] 4.1.4 Configurable scan scope: which branches to include/exclude
- [x] Create src/server/api/branch-scanner.ts — BranchScanner class with SHA-based cache
- [x] Add GET /api/board/consolidated route
- [x] Write tests: mock adapter, caching, filtering
