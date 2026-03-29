# Plan: Source Watching & Sync

## Architecture

```
src/server/watcher/
  types.ts             — SourceWatcher interface, ChangeEvent type
  event-bus.ts         — Generic typed event bus
  debounce.ts          — Debounce utility
  local-watcher.ts     — LocalFileWatcher (fs.watch on .git/)
  remote-poller.ts     — RemotePoller (API polling)
  sync-manager.ts      — Orchestrates watcher + periodic re-sync + event bus
  index.ts             — barrel export
  __tests__/
    event-bus.test.ts
    debounce.test.ts
    local-watcher.test.ts
    remote-poller.test.ts
    sync-manager.test.ts
```

## Key Design Decisions

- **EventBus is generic**: `EventBus<ChangeEvent>` for watcher events, but the class is reusable
- **SyncManager is the public API**: Consumers don't interact with watchers directly — they use SyncManager which handles watcher lifecycle, debounce, and periodic sync
- **Debounce is a standalone utility**: Can be tested independently
- **No chokidar**: Use native `fs.watch` — it's sufficient for watching a few `.git/` paths
- **ChangeEvent carries minimal info**: `{ source: 'watcher' | 'poll' | 'sync' | 'manual', timestamp: number }` — we always do a full board re-parse on any change
