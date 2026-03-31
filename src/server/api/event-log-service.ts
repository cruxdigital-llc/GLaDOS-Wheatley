/**
 * Event Log Service
 *
 * Persists board events (syncs, claims, transitions, webhooks) to
 * product-knowledge/events.md. Supports rotation and replay.
 */

import type { GitAdapter } from '../git/types.js';
import type { EventBus, BoardEvent } from './event-bus.js';

const EVENTS_FILE = 'product-knowledge/events.md';
const EVENTS_HEADER = `<!--
GLaDOS-MANAGED DOCUMENT — Wheatley Event Log
-->

# Event Log

`;

/** Maximum events to keep before rotating (default 500). */
const MAX_EVENTS = parseInt(process.env['WHEATLEY_MAX_EVENTS'] ?? '500', 10);

export interface StoredEvent {
  type: string;
  timestamp: string;
  detail?: string;
}

export class EventLogService {
  private writeLock: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly adapter: GitAdapter,
    private readonly eventBus: EventBus,
  ) {}

  /** Start listening to the event bus and persisting events. */
  start(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      void this.append(event);
    });
  }

  /** Stop listening. */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private acquireWriteLock(): Promise<() => void> {
    let release: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    const prev = this.writeLock;
    this.writeLock = next;
    return prev.then(() => release!);
  }

  /** Append an event to the log file. Rotates if over MAX_EVENTS. */
  async append(event: BoardEvent): Promise<void> {
    const release = await this.acquireWriteLock();
    try {
      const line = `- [${event.type}] ${event.timestamp}${event.detail ? ` | ${event.detail}` : ''}`;

      const existing = await this.adapter.readFile(EVENTS_FILE);
      let content: string;

      if (existing?.trim()) {
        const lines = existing.split('\n');
        // Count event lines (start with "- [")
        const eventLines = lines.filter(l => l.startsWith('- ['));

        if (eventLines.length >= MAX_EVENTS) {
          // Rotate: keep the most recent half
          const keepCount = Math.floor(MAX_EVENTS / 2);
          const recentEvents = eventLines.slice(-keepCount);
          content = `${EVENTS_HEADER.trimEnd()}\n${recentEvents.join('\n')}\n${line}`;
        } else {
          content = `${existing.trimEnd()}\n${line}`;
        }
      } else {
        content = `${EVENTS_HEADER.trimEnd()}\n${line}`;
      }

      await this.adapter.writeFile(
        EVENTS_FILE,
        content,
        `event: ${event.type}`,
      );
    } catch (err) {
      console.warn('[EventLogService] append failed:', err instanceof Error ? err.message : err);
    } finally {
      release();
    }
  }

  /** Read all events from the log (for replay/debugging). */
  async getEvents(limit?: number): Promise<StoredEvent[]> {
    const content = await this.adapter.readFile(EVENTS_FILE);
    if (!content) return [];

    const events: StoredEvent[] = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^- \[(\w[\w-]*)\] (\d{4}-\d{2}-\d{2}T[^\s|]+)(?:\s*\|\s*(.+))?$/);
      if (match) {
        events.push({
          type: match[1],
          timestamp: match[2],
          detail: match[3]?.trim(),
        });
      }
    }

    // Most recent first
    events.reverse();

    if (limit && limit > 0) {
      return events.slice(0, limit);
    }
    return events;
  }
}
