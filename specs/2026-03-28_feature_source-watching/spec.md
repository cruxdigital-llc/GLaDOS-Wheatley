# Spec: Source Watching & Sync

## Types (`types.ts`)

```typescript
interface ChangeEvent {
  source: 'watcher' | 'poll' | 'sync' | 'manual';
  timestamp: number;
}

interface SourceWatcher {
  start(): void;
  stop(): void;
}
```

## EventBus (`event-bus.ts`)

```typescript
class EventBus<T> {
  on(callback: (event: T) => void): void;
  off(callback: (event: T) => void): void;
  emit(event: T): void;
  removeAll(): void;
}
```

## Debounce (`debounce.ts`)

```typescript
function createDebounce(delayMs: number): {
  trigger(callback: () => void): void;
  cancel(): void;
}
```

Trailing-edge: fires `callback` after `delayMs` of quiet. Resets timer on each `trigger()` call.

## LocalFileWatcher (`local-watcher.ts`)

- Watches `.git/HEAD` and `.git/refs/heads/` using `fs.watch()`
- On any change event, emits through the provided callback
- `start()` opens watchers, `stop()` closes them
- Gracefully handles missing `.git/` directory (returns without error)

## RemotePoller (`remote-poller.ts`)

- Uses `GitAdapter.readFile('.git/refs/heads/<branch>')` or similar to get latest SHA
- Polls on a configurable interval (default 30s)
- Compares SHA against cached value; emits change if different
- `start()` begins interval, `stop()` clears interval

## SyncManager (`sync-manager.ts`)

- Constructor: `{ watcher: SourceWatcher | null, pollIntervalMs: number, debounceMs: number, syncIntervalMs: number }`
- Creates `EventBus<ChangeEvent>`, wires up watcher → debounce → emit
- Starts periodic sync timer
- Public API: `start()`, `stop()`, `forceSync()`, `onChange(callback)`
