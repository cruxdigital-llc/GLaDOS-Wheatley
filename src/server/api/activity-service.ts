/**
 * Activity Service
 *
 * Reads and writes the global activity feed (product-knowledge/activity.md).
 * Append-only, like ClaimService.
 */

import type { GitAdapter } from '../git/types.js';
import type { TraceEntry, ParsedActivityFeed, TraceAction } from '../../shared/grammar/types.js';
import { parseActivityFeed } from '../../shared/parsers/activity-parser.js';
import { identifyAgent } from '../../shared/parsers/agent-identity.js';

const ACTIVITY_FILE = 'product-knowledge/activity.md';

const ACTIVITY_FILE_HEADER = `<!--
GLaDOS-MANAGED DOCUMENT
To modify: Append entries using the format below.
-->

# Activity Log

`;

export interface ActivityQuery {
  limit?: number;
  actor?: string;
  action?: TraceAction;
  branch?: string;
}

export class ActivityService {
  private writeLock: Promise<void> = Promise.resolve();

  constructor(private readonly adapter: GitAdapter) {}

  private acquireWriteLock(): Promise<() => void> {
    let release: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    const prev = this.writeLock;
    this.writeLock = next;
    return prev.then(() => release!);
  }

  /**
   * Read and parse the activity feed from the repo.
   */
  async getActivityFeed(query?: ActivityQuery): Promise<ParsedActivityFeed> {
    const content = await this.adapter.readFile(ACTIVITY_FILE, query?.branch);
    const feed = parseActivityFeed(content ?? '');

    let entries = feed.entries;

    if (query?.actor) {
      entries = entries.filter((e) => e.actor === query.actor);
    }
    if (query?.action) {
      entries = entries.filter((e) => e.action === query.action);
    }
    if (query?.limit && query.limit > 0) {
      entries = entries.slice(0, query.limit);
    }

    return { entries, actors: feed.actors };
  }

  /**
   * Append a trace entry to activity.md.
   */
  async recordTrace(
    action: TraceAction,
    target: string,
    actor: string,
    detail?: string,
    branch?: string,
  ): Promise<TraceEntry> {
    const release = await this.acquireWriteLock();
    try {
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const actorType = identifyAgent(actor);

      const detailSuffix = detail ? ` | ${detail}` : '';
      const line = `- [${action}] ${target} | ${actor} | ${timestamp}${detailSuffix}`;

      const existingContent = await this.adapter.readFile(ACTIVITY_FILE, branch);
      const base = existingContent?.trim()
        ? existingContent.trimEnd()
        : ACTIVITY_FILE_HEADER.trimEnd();
      const newContent = `${base}\n${line}`;

      await this.adapter.writeFile(
        ACTIVITY_FILE,
        newContent,
        `activity: ${action} ${target} by ${actor}`,
        branch,
      );

      return { action, target, actor, actorType, timestamp, detail };
    } finally {
      release();
    }
  }
}
