# Tasks: Source Watching & Sync

- [x] 1. Create src/server/watcher/types.ts — ChangeEvent, SourceWatcher interface
- [x] 2. Create src/server/watcher/event-bus.ts — generic EventBus<T>
- [x] 3. Create src/server/watcher/debounce.ts — trailing-edge debounce utility
- [x] 4. Create src/server/watcher/local-watcher.ts — LocalFileWatcher using fs.watch
- [x] 5. Create src/server/watcher/remote-poller.ts — RemotePoller using GitAdapter
- [x] 6. Create src/server/watcher/sync-manager.ts — orchestrator
- [x] 7. Create src/server/watcher/index.ts — barrel export
- [x] 8. Create tests: event-bus (7), debounce (5), local-watcher (5), remote-poller (7), sync-manager (9) = 33 tests
- [x] 9. Run all tests via Docker — 163/163 passing
