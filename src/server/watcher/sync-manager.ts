/**
 * Sync Manager
 *
 * Orchestrates source watching, debounce, periodic re-sync, and event emission.
 * This is the public API for the watcher system.
 */

import type { ChangeEvent, SourceWatcher, SyncManagerOptions } from './types.js';
import { EventBus } from './event-bus.js';
import { createDebounce, type Debouncer } from './debounce.js';

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SyncManager {
  private readonly bus: EventBus<ChangeEvent>;
  private readonly debouncer: Debouncer;
  private readonly watcher: SourceWatcher | null;
  private readonly syncIntervalMs: number;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(watcher: SourceWatcher | null, options: SyncManagerOptions = {}) {
    this.watcher = watcher;
    this.bus = new EventBus<ChangeEvent>();
    this.debouncer = createDebounce(options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
    this.syncIntervalMs = options.syncIntervalMs ?? DEFAULT_SYNC_INTERVAL_MS;
  }

  /** Start watching and periodic sync. */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Start the watcher (local fs or remote poller)
    this.watcher?.start();

    // Start periodic full re-sync
    this.syncTimer = setInterval(() => {
      this.emitChange('sync');
    }, this.syncIntervalMs);
  }

  /** Stop watching and clean up all resources. */
  stop(): void {
    this.running = false;
    this.watcher?.stop();
    this.debouncer.cancel();

    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.bus.removeAll();
  }

  /** Trigger an immediate re-sync (e.g., from an API endpoint). */
  forceSync(): void {
    this.emitChange('manual');
  }

  /** Subscribe to change events. */
  onChange(callback: (event: ChangeEvent) => void): void {
    this.bus.on(callback);
  }

  /** Unsubscribe from change events. */
  offChange(callback: (event: ChangeEvent) => void): void {
    this.bus.off(callback);
  }

  /**
   * Called by the watcher when a change is detected.
   * Debounces the emission to coalesce rapid changes.
   */
  notifyChange(source: ChangeEvent['source'] = 'watcher'): void {
    this.debouncer.trigger(() => {
      this.emitChange(source);
    });
  }

  private emitChange(source: ChangeEvent['source']): void {
    this.bus.emit({
      source,
      timestamp: Date.now(),
    });
  }

  /** Whether the manager is currently running. */
  get isRunning(): boolean {
    return this.running;
  }
}
