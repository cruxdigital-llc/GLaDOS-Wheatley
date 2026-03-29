# Requirements: Source Watching & Sync

## Functional Requirements

1. **SourceWatcher Interface**: Common interface for both watching strategies.
   - `start(): void` — begin watching
   - `stop(): void` — stop watching
   - `onChanged(callback): void` — subscribe to change events
   - `forceSync(): void` — trigger an immediate re-parse

2. **LocalFileWatcher**: Watch `.git/HEAD` and `.git/refs/` for filesystem changes.
   - Use `node:fs/promises` `watch()` (or chokidar if needed)
   - Detect branch switches (HEAD change) and new commits (refs change)
   - Must handle rapid git operations (rebase, merge) gracefully via debounce

3. **RemotePoller**: Poll the GitHub API for ref changes on a configurable interval.
   - Compare the latest commit SHA on the watched branch against the cached value
   - Default interval: 30 seconds, configurable via environment variable
   - Use the GitAdapter to read the latest ref

4. **Debounce**: Coalesce multiple change events within a window into a single notification.
   - Default window: 500ms, configurable
   - Trailing-edge debounce (fire after quiet period)

5. **Full Re-sync**: Periodic fallback to catch missed events.
   - Default interval: 5 minutes, configurable
   - Also triggerable on-demand via `forceSync()`

6. **Event Bus**: Simple typed pub/sub for change notifications.
   - `EventBus<T>` with `emit(event)`, `on(callback)`, `off(callback)`
   - Used by both watchers to notify the API layer

## Non-Functional Requirements

- All watchers must be stoppable (clean shutdown, no leaked intervals/handles)
- Memory-safe: no event listener leaks
- Configurable via environment variables
