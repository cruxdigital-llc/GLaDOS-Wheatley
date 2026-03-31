# Plan: Git Adapter

## Architecture

```
src/server/git/
  types.ts          — GitAdapter interface + supporting types
  local-adapter.ts  — LocalGitAdapter (simple-git)
  remote-adapter.ts — RemoteGitAdapter (Octokit)
  factory.ts        — createGitAdapter(config)
  index.ts          — barrel export
  __tests__/
    local-adapter.test.ts   — integration tests with fixture repo
    remote-adapter.test.ts  — integration tests with mocked Octokit
    factory.test.ts         — unit tests for factory
```

## Interface Design

```typescript
interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

interface GitAdapter {
  readFile(path: string, ref?: string): Promise<string | null>;
  listDirectory(path: string, ref?: string): Promise<DirectoryEntry[]>;
  listBranches(): Promise<string[]>;
  getCurrentBranch(): Promise<string>;
  getDefaultBranch(): Promise<string>;
}
```

## Implementation Strategy

1. **Types first**: Define interface and supporting types
2. **LocalGitAdapter**: Use simple-git for branch ops, `fs.readFile` for working tree reads, `git show ref:path` for ref-specific reads
3. **RemoteGitAdapter**: Use Octokit's `repos.getContent()` and `repos.listBranches()`
4. **Factory**: Simple switch on config.mode with validation
5. **Tests**: Fixture-based for local, mock-based for remote

## Dependencies to Install

- `simple-git` — local git operations
- `@octokit/rest` — GitHub REST API client

## Key Decisions

- Adapters return `null`/empty on errors rather than throwing — consistent with parser layer
- `ref` parameter is optional — defaults to current branch (local) or default branch (remote)
- LocalGitAdapter uses filesystem reads for working tree, git show for other refs
- RemoteGitAdapter always requires a ref (defaults to default branch)
