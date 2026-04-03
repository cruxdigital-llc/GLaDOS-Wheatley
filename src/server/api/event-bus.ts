/**
 * Event Bus
 *
 * Simple pub/sub for server-sent events. Services emit events,
 * the SSE endpoint streams them to connected clients.
 */

export type BoardEvent = {
  type: 'sync' | 'board-updated' | 'claim' | 'transition' | 'webhook' | 'workflow-done';
  timestamp: string;
  detail?: string;
  runId?: string;
};

type Listener = (event: BoardEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: BoardEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Don't let one bad listener break the bus
      }
    }
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }
}
