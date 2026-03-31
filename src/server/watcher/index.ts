/**
 * Source Watching & Sync — barrel export
 */

export type { ChangeEvent, SourceWatcher, SyncManagerOptions } from './types.js';
export { EventBus } from './event-bus.js';
export { createDebounce, type Debouncer } from './debounce.js';
export { LocalFileWatcher } from './local-watcher.js';
export { RemotePoller, type RemotePollerOptions } from './remote-poller.js';
export { SyncManager } from './sync-manager.js';
