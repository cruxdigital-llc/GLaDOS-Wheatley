/**
 * Notification Service
 *
 * Configurable outbound webhook system for Wheatley events.
 * Supports custom webhooks and a pre-built Slack formatter.
 * Also maintains an in-memory event log for audit purposes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType =
  | 'claim'
  | 'release'
  | 'transition'
  | 'conflict'
  | 'ttl-warning'
  | 'ttl-expired';

export interface WheatleyEvent {
  type: EventType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Actor who triggered the event */
  actor?: string;
  /** Event payload (varies by type) */
  payload: Record<string, unknown>;
}

export interface WebhookConfig {
  /** Unique identifier for this webhook */
  id: string;
  /** Target URL to POST to */
  url: string;
  /** Which event types to send. Empty = all. */
  events: EventType[];
  /** Whether this webhook is active */
  active: boolean;
  /** Format: 'raw' sends WheatleyEvent JSON; 'slack' sends Slack-formatted message */
  format: 'raw' | 'slack';
}

// ---------------------------------------------------------------------------
// Slack message formatting
// ---------------------------------------------------------------------------

function formatSlackMessage(event: WheatleyEvent): Record<string, unknown> {
  const emoji: Record<EventType, string> = {
    claim: ':raised_hand:',
    release: ':wave:',
    transition: ':arrow_right:',
    conflict: ':warning:',
    'ttl-warning': ':hourglass:',
    'ttl-expired': ':x:',
  };

  const icon = emoji[event.type] || ':bell:';
  const actor = event.actor ?? 'Unknown';
  const payload = event.payload;

  let text: string;
  switch (event.type) {
    case 'claim':
      text = `${icon} *${actor}* claimed \`${payload.itemId}\``;
      break;
    case 'release':
      text = `${icon} *${actor}* released \`${payload.itemId}\``;
      break;
    case 'transition':
      text = `${icon} *${actor}* moved \`${payload.itemId}\` from ${payload.from} to ${payload.to}`;
      break;
    case 'conflict':
      text = `${icon} Potential conflict detected between branches: ${(payload.branches as string[])?.join(', ')}`;
      break;
    case 'ttl-warning':
      text = `${icon} Claim on \`${payload.itemId}\` by *${payload.claimant}* expires in ${payload.hoursRemaining}h`;
      break;
    case 'ttl-expired':
      text = `${icon} Claim on \`${payload.itemId}\` by *${payload.claimant}* has expired and been auto-released`;
      break;
    default:
      text = `${icon} Wheatley event: ${event.type}`;
  }

  return { text };
}

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

/** Max events to keep in the in-memory log. */
const MAX_EVENT_LOG_SIZE = 1000;

export class NotificationService {
  private webhooks: WebhookConfig[] = [];
  private eventLog: WheatleyEvent[] = [];

  constructor(webhooks?: WebhookConfig[]) {
    if (webhooks) {
      this.webhooks = webhooks;
    }

    // Also load from environment
    const envWebhooks = process.env['WHEATLEY_WEBHOOKS'];
    if (envWebhooks) {
      try {
        const parsed = JSON.parse(envWebhooks);
        if (Array.isArray(parsed)) {
          this.webhooks.push(...parsed);
        }
      } catch {
        // Ignore invalid env var
      }
    }

    // Convenience: WHEATLEY_SLACK_WEBHOOK_URL for quick Slack setup
    const slackUrl = process.env['WHEATLEY_SLACK_WEBHOOK_URL'];
    if (slackUrl) {
      this.webhooks.push({
        id: 'slack-default',
        url: slackUrl,
        events: [],
        active: true,
        format: 'slack',
      });
    }
  }

  /** Register a webhook at runtime. */
  addWebhook(config: WebhookConfig): void {
    this.webhooks.push(config);
  }

  /** Remove a webhook by ID. */
  removeWebhook(id: string): boolean {
    const idx = this.webhooks.findIndex((w) => w.id === id);
    if (idx < 0) return false;
    this.webhooks.splice(idx, 1);
    return true;
  }

  /** List configured webhooks. */
  listWebhooks(): WebhookConfig[] {
    return [...this.webhooks];
  }

  /** Get the event log. */
  getEventLog(limit?: number): WheatleyEvent[] {
    const log = [...this.eventLog].reverse(); // newest first
    return limit ? log.slice(0, limit) : log;
  }

  /**
   * Emit an event: record in log and dispatch to matching webhooks.
   * Webhook failures are logged but do not throw.
   */
  async emit(event: WheatleyEvent): Promise<void> {
    // Add to event log
    this.eventLog.push(event);
    if (this.eventLog.length > MAX_EVENT_LOG_SIZE) {
      this.eventLog = this.eventLog.slice(-MAX_EVENT_LOG_SIZE);
    }

    // Dispatch to matching webhooks
    const matching = this.webhooks.filter(
      (w) => w.active && (w.events.length === 0 || w.events.includes(event.type)),
    );

    const dispatches = matching.map(async (webhook) => {
      try {
        const body =
          webhook.format === 'slack' ? formatSlackMessage(event) : event;

        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        // Silently ignore webhook failures — fire-and-forget
      }
    });

    await Promise.allSettled(dispatches);
  }

  /**
   * Convenience: emit a typed event.
   */
  async emitClaim(itemId: string, claimant: string): Promise<void> {
    await this.emit({
      type: 'claim',
      timestamp: utcNow(),
      actor: claimant,
      payload: { itemId, claimant },
    });
  }

  async emitRelease(itemId: string, claimant: string): Promise<void> {
    await this.emit({
      type: 'release',
      timestamp: utcNow(),
      actor: claimant,
      payload: { itemId, claimant },
    });
  }

  async emitTransition(
    itemId: string,
    from: string,
    to: string,
    actor?: string,
  ): Promise<void> {
    await this.emit({
      type: 'transition',
      timestamp: utcNow(),
      actor,
      payload: { itemId, from, to },
    });
  }

  async emitConflict(branches: string[], overlappingSpecs: string[]): Promise<void> {
    await this.emit({
      type: 'conflict',
      timestamp: utcNow(),
      payload: { branches, overlappingSpecs },
    });
  }

  async emitTTLWarning(itemId: string, claimant: string, hoursRemaining: number): Promise<void> {
    await this.emit({
      type: 'ttl-warning',
      timestamp: utcNow(),
      actor: claimant,
      payload: { itemId, claimant, hoursRemaining },
    });
  }

  async emitTTLExpired(itemId: string, claimant: string): Promise<void> {
    await this.emit({
      type: 'ttl-expired',
      timestamp: utcNow(),
      actor: claimant,
      payload: { itemId, claimant },
    });
  }
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
