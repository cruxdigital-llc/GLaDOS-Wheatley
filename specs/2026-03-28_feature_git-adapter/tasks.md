# Tasks: Git Adapter

- [x] 1. Install dependencies: simple-git, @octokit/rest
- [x] 2. Create src/server/git/types.ts — GitAdapter interface, DirectoryEntry, GitAdapterConfig
- [x] 3. Create src/server/git/local-adapter.ts — LocalGitAdapter implementation
- [x] 4. Create src/server/git/remote-adapter.ts — RemoteGitAdapter implementation
- [x] 5. Create src/server/git/factory.ts — adapter factory
- [x] 6. Create src/server/git/index.ts — barrel export
- [x] 7. Create src/server/git/__tests__/local-adapter.test.ts — integration tests with fixture repo (11 tests)
- [x] 8. Create src/server/git/__tests__/remote-adapter.test.ts — tests with mocked Octokit (15 tests)
- [x] 9. Create src/server/git/__tests__/factory.test.ts — unit tests (11 tests)
- [x] 10. Add git to Dockerfile (required by simple-git)
- [x] 11. Run all tests via Docker — 125/125 passing
