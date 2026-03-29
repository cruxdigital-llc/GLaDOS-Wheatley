import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncManager } from '../sync-manager.js';
import type { SourceWatcher, ChangeEvent } from '../types.js';

function createMockWatcher(): SourceWatcher {
  return {
    start: vi.fn(),
    stop: vi.fn(),
  };
}

describe('SyncManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts and stops watcher', () => {
    const watcher = createMockWatcher();
    const manager = new SyncManager(watcher);

    manager.start();
    expect(watcher.start).toHaveBeenCalled();
    expect(manager.isRunning).toBe(true);

    manager.stop();
    expect(watcher.stop).toHaveBeenCalled();
    expect(manager.isRunning).toBe(false);
  });

  it('works without a watcher (null)', () => {
    const manager = new SyncManager(null);
    expect(() => manager.start()).not.toThrow();
    expect(() => manager.stop()).not.toThrow();
  });

  it('emits periodic sync events', () => {
    const manager = new SyncManager(null, { syncIntervalMs: 1000 });
    const callback = vi.fn();
    manager.onChange(callback);
    manager.start();

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'sync' }),
    );

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    manager.stop();
  });

  it('forceSync emits manual event', () => {
    const manager = new SyncManager(null);
    const callback = vi.fn();
    manager.onChange(callback);
    manager.start();

    manager.forceSync();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'manual' }),
    );

    manager.stop();
  });

  it('notifyChange debounces watcher events', () => {
    const manager = new SyncManager(null, { debounceMs: 100 });
    const callback = vi.fn();
    manager.onChange(callback);
    manager.start();

    // Rapid notifications
    manager.notifyChange('watcher');
    manager.notifyChange('watcher');
    manager.notifyChange('watcher');

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'watcher' }),
    );

    manager.stop();
  });

  it('offChange unsubscribes', () => {
    const manager = new SyncManager(null);
    const callback = vi.fn();
    manager.onChange(callback);
    manager.offChange(callback);
    manager.start();

    manager.forceSync();
    expect(callback).not.toHaveBeenCalled();

    manager.stop();
  });

  it('does not double-start', () => {
    const watcher = createMockWatcher();
    const manager = new SyncManager(watcher);

    manager.start();
    manager.start(); // Should be no-op
    expect(watcher.start).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it('change events include timestamp', () => {
    const manager = new SyncManager(null);
    const events: ChangeEvent[] = [];
    manager.onChange((e) => events.push(e));
    manager.start();

    vi.setSystemTime(new Date('2026-03-28T12:00:00Z'));
    manager.forceSync();

    expect(events[0].timestamp).toBe(new Date('2026-03-28T12:00:00Z').getTime());

    manager.stop();
  });

  it('stop cleans up periodic sync timer', () => {
    const manager = new SyncManager(null, { syncIntervalMs: 100 });
    const callback = vi.fn();
    manager.onChange(callback);
    manager.start();
    manager.stop();

    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
  });
});
