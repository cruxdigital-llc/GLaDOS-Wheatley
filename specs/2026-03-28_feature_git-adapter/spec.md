# Spec: Git Adapter

## Module: `src/server/git/types.ts`

Exports:
- `DirectoryEntry` — `{ name: string; type: 'file' | 'directory'; path: string }`
- `GitAdapter` — interface with 5 async methods
- `GitAdapterConfig` — `{ mode: 'local' | 'remote'; localPath?: string; github?: { token: string; owner: string; repo: string } }`

## Module: `src/server/git/local-adapter.ts`

`LocalGitAdapter` implements `GitAdapter`:
- Constructor takes `repoPath: string`
- `readFile(path, ref?)`:
  - If no ref or ref is current branch: `fs.readFile(join(repoPath, path), 'utf-8')`
  - If ref specified and differs from current: `git.show([`${ref}:${path}`])`
  - Returns `null` on any error
- `listDirectory(path, ref?)`:
  - Working tree: `fs.readdir` with `withFileTypes`
  - Other ref: `git.raw(['ls-tree', '--name-only', ref, path + '/'])`
  - Returns `[]` on error
- `listBranches()`: `git.branchLocal()` → array of branch names
- `getCurrentBranch()`: `git.revparse(['--abbrev-ref', 'HEAD'])`
- `getDefaultBranch()`: Check for `main`, fall back to `master`, fall back to first branch

## Module: `src/server/git/remote-adapter.ts`

`RemoteGitAdapter` implements `GitAdapter`:
- Constructor takes `{ token, owner, repo }`
- `readFile(path, ref?)`:
  - `octokit.repos.getContent({ owner, repo, path, ref })` → decode base64 content
  - Returns `null` on 404 or error
- `listDirectory(path, ref?)`:
  - Same endpoint, returns array when path is directory
  - Maps to `DirectoryEntry[]`
  - Returns `[]` on error
- `listBranches()`: `octokit.repos.listBranches({ owner, repo })` → map to names
- `getCurrentBranch()`: returns `getDefaultBranch()` (no "current" concept in remote)
- `getDefaultBranch()`: `octokit.repos.get({ owner, repo })` → `data.default_branch`

## Module: `src/server/git/factory.ts`

`createGitAdapter(config: GitAdapterConfig): GitAdapter`:
- `mode === 'local'`: validate `localPath`, return new `LocalGitAdapter(localPath)`
- `mode === 'remote'`: validate `github.*`, return new `RemoteGitAdapter(github)`
- Otherwise: throw `Error('Invalid WHEATLEY_MODE')`
