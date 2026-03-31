# Tasks

- [ ] Create WorktreeManager class with init/destroy/getGit/getPath/isReady
- [ ] Add worktree stale-cleanup logic (detect and remove leftover worktrees)
- [ ] Refactor LocalGitAdapter constructor to accept optional WorktreeManager
- [ ] Change readFile (no ref) from fs.readFile to git show HEAD:path
- [ ] Change listDirectory (no ref) from fs.readdir to git ls-tree HEAD
- [ ] Rewrite _writeFileImpl to use worktree when available
- [ ] Add safeWorktreePath method for path traversal prevention in worktree
- [ ] Add fallback mode: log warning and use legacy single-repo writes when no worktree
- [ ] Update factory.ts — keep return type, document worktree setup in server
- [ ] Update server.ts — create WorktreeManager on startup, destroy on shutdown
- [ ] Add .wheatley-worktree to .gitignore
- [ ] Write WorktreeManager unit tests (lifecycle, stale cleanup, fallback)
- [ ] Write LocalGitAdapter worktree integration tests (write while main is dirty)
- [ ] Update existing write tests to work with worktree mode
