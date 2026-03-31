# Requirements: Claim Operations Backend (2.2)

## Functional Requirements

### FR-1: GitAdapter Write Interface
- The `GitAdapter` interface must gain a `writeFile(path, content, message, branch?)` method
- `writeFile` must accept an optional target branch; when omitted, the adapter uses the coordination branch
- `writeFile` must throw a `ConflictError` (a typed error class) when a concurrent write conflict is detected
- `writeFile` must throw a plain `Error` for all other failures

### FR-2: LocalGitAdapter Write
- Must fetch latest from the remote before writing (to reduce conflicts on shared repos)
- Must stage the target file, commit with the provided message, and push to the target branch
- Must detect non-fast-forward push rejections and throw `ConflictError`
- User identity for commits is configurable via standard git config; the adapter must not override it

### FR-3: RemoteGitAdapter Write
- Must read the current file SHA before writing (required by the GitHub API)
- Must use `octokit.repos.createOrUpdateFileContents` with the current SHA
- A 409 HTTP response from the GitHub API must be translated to `ConflictError`
- The file content must be base64-encoded before sending

### FR-4: POST /api/claims
- Body: `{ itemId: string, claimant: string }`
- Validates that `itemId` matches `/^\d+\.\d+\.\d+$/` — returns 400 if not
- Validates that `claimant` is non-empty and contains no pipe character — returns 400 if not
- Reads current `claims.md` from coordination branch; parses it
- Returns 409 if `itemId` already has an active claim (`activeClaims` map)
- Appends a `[claimed]` entry with the current UTC timestamp
- Commits the updated file to the coordination branch
- Returns 409 with `{ conflict: true }` on write conflict
- Returns 201 with the new `ClaimEntry` on success

### FR-5: DELETE /api/claims/:id
- `:id` is the `itemId` (roadmap item ID)
- Returns 404 if there is no active claim for that item
- The `claimant` to release can be optionally passed as a query param `?claimant=`; if provided, returns 403 if the active claim belongs to a different claimant
- Appends a `[released]` entry with both `claimedAt` (from existing claim) and `releasedAt` (current UTC timestamp)
- Commits the updated file to the coordination branch
- Returns 409 with `{ conflict: true }` on write conflict
- Returns 200 with the `ClaimEntry` on success

### FR-6: Conflict Detection
- Conflict errors from the adapter must be surfaced to the client as HTTP 409
- Response body: `{ statusCode: 409, error: 'Conflict', message: 'claims.md was modified concurrently; retry the operation', conflict: true }`

### FR-7: Coordination Branch Configuration
- The coordination branch is read from `WHEATLEY_COORDINATION_BRANCH` environment variable
- If the env var is absent, the coordination branch defaults to the adapter's `getDefaultBranch()` result
- Both `ClaimService` and the adapters must respect this configuration

## Non-Functional Requirements

- `writeFile` must be safe to call concurrently from a single process (no shared mutable state on the adapter)
- All errors from the git layer must be logged server-side; the client never receives raw git error output
- Timestamps must be UTC ISO 8601 with second precision (`YYYY-MM-DDTHH:MM:SSZ`)
