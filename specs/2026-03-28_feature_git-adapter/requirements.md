# Requirements: Git Adapter

## Functional Requirements

1. **GitAdapter Interface**: Must define methods for:
   - `readFile(path: string, ref?: string): Promise<string | null>` — read a file's content
   - `listDirectory(path: string, ref?: string): Promise<DirectoryEntry[]>` — list directory contents
   - `listBranches(): Promise<string[]>` — list all branches
   - `getCurrentBranch(): Promise<string>` — get the current/default branch
   - `getDefaultBranch(): Promise<string>` — get the repo's default branch

2. **LocalGitAdapter**: Must use `simple-git` to read from a filesystem-mounted repo.
   - Reads from the working tree or a specific ref via `git show`
   - Lists directories via filesystem APIs
   - Lists branches via `git branch -a`

3. **RemoteGitAdapter**: Must use `@octokit/rest` to read from GitHub REST API.
   - Reads files via `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}`
   - Lists directories via the same endpoint
   - Lists branches via `GET /repos/{owner}/{repo}/branches`
   - Requires `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` env vars

4. **Adapter Factory**: `createGitAdapter(config)` must:
   - Return `LocalGitAdapter` when `WHEATLEY_MODE=local`
   - Return `RemoteGitAdapter` when `WHEATLEY_MODE=remote`
   - Throw a clear error for missing/invalid config

## Non-Functional Requirements

- All adapter methods must be async
- Errors must be caught and returned as `null` or empty arrays (not thrown), to match parser conventions
- TypeScript strict mode compliance
- No side effects on construction — adapters should be lazy
