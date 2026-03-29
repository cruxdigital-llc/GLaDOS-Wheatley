/**
 * Source Watching Types
 *
 * Defines the interfaces for change detection and sync.
 */

export interface ChangeEvent {
  /** What triggered the change detection. */
  source: 'watcher' | 'poll' | 'sync' | 'manual';
  /** Unix timestamp (ms) when the change was detected. */
  timestamp: number;
}

export interface SourceWatcher {
  /** Begin watching for changes. */
  start(): void;
  /** Stop watching and clean up resources. */
  stop(): void;
}

export interface SyncManagerOptions {
  /** Debounce window in ms. Default: 500. */
  debounceMs?: number;
  /** Periodic full re-sync interval in ms. Default: 300000 (5 min). */
  syncIntervalMs?: number;
}
