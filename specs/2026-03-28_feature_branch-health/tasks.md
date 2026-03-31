# Tasks: Branch Diff & Health

- [x] 4.3.1 Visual diff: specs that exist on a feature branch but not on main
- [x] 4.3.2 Commits-behind indicator: how far a feature branch is behind main
- [x] 4.3.3 Merge conflict risk: flag branches with overlapping file changes
- [x] 4.3.4 Branch age indicator: last commit timestamp per branch
- [x] Extend GitAdapter with getCommitsBehind(branch, baseBranch) and getLastCommitDate(branch)
- [x] Implement getCommitsBehind and getLastCommitDate on LocalGitAdapter
- [x] Implement getCommitsBehind and getLastCommitDate on RemoteGitAdapter
- [x] Create src/server/api/branch-health.ts — BranchHealthService
- [x] Add GET /api/branches/health route
- [x] Frontend: BranchHealthPanel component
- [x] Write tests for BranchHealthService
