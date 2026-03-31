/**
 * activity.md Parser
 *
 * Extracts trace entries from the append-only activity log.
 * Pure function: string in, ParsedActivityFeed out. Never throws.
 *
 * Line format:
 *   - [action] target | actor | 2026-03-28T14:30:00Z
 *   - [action] target | actor | 2026-03-28T14:30:00Z | optional detail
 */

import type { ParsedActivityFeed, TraceEntry, TraceAction, AgentIdentity } from '../grammar/types.js';
import { normalize, stripHeader } from './utils.js';
import { identifyAgent } from './agent-identity.js';

const VALID_ACTIONS = new Set<string>([
  'claim', 'release', 'transition', 'file-create', 'file-edit', 'commit', 'comment',
]);

const TRACE_ENTRY_RE =
  /^- \[([a-z-]+)\] (.+?) \| (.+?) \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)(?:\s*\|\s*(.+))?$/;

export function parseActivityFeed(content: string): ParsedActivityFeed {
  const entries: TraceEntry[] = [];
  const actors = new Map<string, AgentIdentity>();

  if (!content.trim()) {
    return { entries, actors };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const match = trimmed.match(TRACE_ENTRY_RE);
    if (!match) continue;

    const action = match[1];
    if (!VALID_ACTIONS.has(action)) continue;

    const actor = match[3].trim();
    const actorType = identifyAgent(actor);

    const entry: TraceEntry = {
      action: action as TraceAction,
      target: match[2].trim(),
      actor,
      actorType,
      timestamp: match[4],
      detail: match[5]?.trim() || undefined,
    };

    entries.push(entry);

    if (!actors.has(actor)) {
      actors.set(actor, actorType);
    }
  }

  // Return newest first
  entries.reverse();

  return { entries, actors };
}
