/**
 * Generic Typed Event Bus
 *
 * Simple pub/sub for decoupled event notification.
 * Memory-safe: provides removeAll() for clean shutdown.
 */

export class EventBus<T> {
  private listeners = new Set<(event: T) => void>();

  /** Subscribe to events. */
  on(callback: (event: T) => void): void {
    this.listeners.add(callback);
  }

  /** Unsubscribe from events. */
  off(callback: (event: T) => void): void {
    this.listeners.delete(callback);
  }

  /** Emit an event to all subscribers. A throwing listener does not prevent others from being notified. */
  emit(event: T): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Don't let one bad listener break the others
      }
    }
  }

  /** Remove all listeners (for clean shutdown). */
  removeAll(): void {
    this.listeners.clear();
  }

  /** Current number of listeners. */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
