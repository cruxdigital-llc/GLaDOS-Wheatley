# Spec: Claim Operations Backend (2.2)

## 1. GitAdapter Interface Extension

### 1.1 New Method Signature

```typescript
/**
 * Write a file to the repository on the specified branch.
 * Appends or creates the file with the given content, then commits.
 * Throws ConflictError if a concurrent write conflict is detected.
 * Throws Error for all other failures.
 */
writeFile(path: string, content: string, message: string, branch?: string): Promise<void>;
```

### 1.2 ConflictError

```typescript
/** Thrown by GitAdapter.writeFile when a concurrent write conflict is detected. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
```

`ConflictError` lives in `src/server/git/types.ts` alongside the `GitAdapter` interface so both adapters and consumers import from the same module.

## 2. LocalGitAdapter.writeFile

### 2.1 Behavior

1. Record the current branch via `getCurrentBranch()`
2. Checkout the target branch: `git checkout <branch>`
3. Write `content` to `<repoPath>/<path>` using `fs.writeFile` (creates intermediate directories if needed)
4. Stage: `git add <path>`
5. Commit: `git commit -m <message>`
6. Push: `git push origin <branch>`
7. On push rejection containing "non-fast-forward" or "rejected" → throw `ConflictError('Push rejected: non-fast-forward conflict on claims.md')`
8. On any other push error → rethrow as-is
9. On success: checkout the original branch

### 2.2 Error Recovery

If any step from 3 onward throws, the implementation attempts `git checkout <originalBranch>` before rethrowing. This is best-effort; if the checkout also fails, the original error is still thrown.

### 2.3 No Fetch

We do not `git fetch` before writing. In local dev mode, the coordination branch is not shared concurrently. Adding a fetch would require network access and could hang in offline environments. Conflict detection via push rejection is sufficient.

## 3. RemoteGitAdapter.writeFile

### 3.1 Behavior

1. Resolve branch: `branch ?? await this.getDefaultBranch()`
2. Read current file SHA:
   - Call `octokit.repos.getContent({ owner, repo, path, ref: branch })`
   - If the file exists: extract `data.sha`
   - If the file does not exist (404): proceed with `sha = undefined`
3. Call `octokit.repos.createOrUpdateFileContents`:
   ```
   {
     owner, repo, path,
     message,
     content: Buffer.from(content).toString('base64'),
     branch,
     sha,         // omit if file is new
   }
   ```
4. If the API throws with `status === 409` → throw `ConflictError('GitHub API returned 409: conflict on claims.md')`
5. Any other error → rethrow

### 3.2 SHA Handling

The GitHub API requires the current file SHA to update an existing file. If the SHA we read is stale (another writer updated the file between our read and write), the API returns 409. This is the expected conflict signal.

## 4. ClaimService

### 4.1 Module: `src/server/api/claim-service.ts`

```typescript
export class ClaimService {
  constructor(adapter: GitAdapter, coordinationBranch?: string)

  /** Get the coordination branch (env var → adapter default). */
  async getCoordinationBranch(): Promise<string>

  /** Claim an item. Returns the new ClaimEntry. */
  async claimItem(itemId: string, claimant: string): Promise<ClaimEntry>

  /** Release an item. Returns the release ClaimEntry. */
  async releaseItem(itemId: string, claimant?: string): Promise<ClaimEntry>
}
```

### 4.2 getCoordinationBranch()

```
return process.env.WHEATLEY_COORDINATION_BRANCH ?? await adapter.getDefaultBranch()
```

### 4.3 claimItem(itemId, claimant)

1. Validate `itemId` matches `/^\d+\.\d+\.\d+$/`; throw `Error('Invalid item ID')` if not
2. Validate `claimant` is non-empty and has no `|`; throw `Error('Invalid claimant')` if not
3. Resolve coordination branch
4. Read `claims.md` from coordination branch (treat null as empty string)
5. Parse with `parseClaims(content)`
6. If `activeClaims.has(itemId)`, throw `AlreadyClaimedError` with the active claim entry
7. Build timestamp: `new Date().toISOString()`
8. Build entry line: `- [claimed] ${itemId} | ${claimant} | ${timestamp}\n`
9. Append to content (ensure file ends with newline; add header if file is empty)
10. Call `adapter.writeFile('claims.md', newContent, `claim: ${itemId} by ${claimant}`, branch)`
11. Return the `ClaimEntry` object

### 4.4 releaseItem(itemId, claimant?)

1. Resolve coordination branch
2. Read and parse `claims.md`
3. If `!activeClaims.has(itemId)`, throw `NotClaimedError`
4. If `claimant` is provided and `activeClaim.claimant !== claimant`, throw `ForbiddenError`
5. Build entry line: `- [released] ${itemId} | ${activeClaim.claimant} | ${activeClaim.claimedAt} | ${new Date().toISOString()}\n`
6. Append to content
7. Call `adapter.writeFile('claims.md', newContent, `release: ${itemId} by ${activeClaim.claimant}`, branch)`
8. Return the `ClaimEntry` object

### 4.5 Claims File Header

When creating a new `claims.md` from scratch (empty content), prepend the header:

```
<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: <date>
To modify: Append entries using the format below.
-->

# Claims

```

When the file already exists (non-empty), simply append the new entry line.

## 5. Route Specification

### 5.1 POST /api/claims

**Request**

```
POST /api/claims
Content-Type: application/json

{ "itemId": "2.2.4", "claimant": "agent-claude" }
```

**Responses**

| Status | Body | When |
|---|---|---|
| 201 | `ClaimEntry` | Success |
| 400 | `ApiError` | Invalid `itemId` or `claimant` format |
| 409 | `{ statusCode: 409, error: 'Conflict', message: '...', conflict: true }` | Item already claimed |
| 409 | `{ statusCode: 409, error: 'Conflict', message: '...', conflict: true }` | Git write conflict |

### 5.2 DELETE /api/claims/:id

**Request**

```
DELETE /api/claims/2.2.4
DELETE /api/claims/2.2.4?claimant=agent-claude
```

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | `ClaimEntry` | Success |
| 404 | `ApiError` | No active claim for this item |
| 403 | `ApiError` | `claimant` provided but does not match the active claim |
| 409 | `{ ..., conflict: true }` | Git write conflict |

## 6. Error Classes

All error classes live in `src/server/api/claim-service.ts`:

```typescript
export class AlreadyClaimedError extends Error {
  constructor(public readonly claim: ClaimEntry) {
    super(`Item ${claim.itemId} is already claimed by ${claim.claimant}`);
    this.name = 'AlreadyClaimedError';
  }
}

export class NotClaimedError extends Error {
  constructor(itemId: string) {
    super(`No active claim for item ${itemId}`);
    this.name = 'NotClaimedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
```

## 7. Server Wiring

In `server.ts`, `ClaimService` is instantiated alongside `BoardService` and passed to `claimsRoutes`:

```typescript
const claimService = new ClaimService(options.adapter);
claimsRoutes(app, claimService);
```
