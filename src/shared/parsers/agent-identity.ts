/**
 * Agent Identity Classifier
 *
 * Maps git committer names / actor strings to agent or human labels.
 * Uses configurable heuristic patterns.
 */

import type { AgentIdentity } from '../grammar/types.js';

/**
 * Default patterns that identify an actor as an AI agent.
 * Case-insensitive matching against the actor name.
 */
const DEFAULT_AGENT_PATTERNS: RegExp[] = [
  /claude/i,
  /\bagent\b/i,
  /bot/i,
  /github-actions/i,
  /copilot/i,
  /gpt/i,
  /glados/i,
  /wheatley/i,
];

/**
 * Classify an actor name as 'agent', 'human', or 'unknown'.
 *
 * Returns 'agent' if the name matches any of the known agent patterns.
 * Returns 'unknown' if the name is empty or whitespace-only.
 * Returns 'human' otherwise.
 */
export function identifyAgent(
  actorName: string,
  customPatterns?: RegExp[],
): AgentIdentity {
  const trimmed = actorName.trim();
  if (!trimmed) return 'unknown';

  const patterns = customPatterns ?? DEFAULT_AGENT_PATTERNS;
  for (const pattern of patterns) {
    if (pattern.test(trimmed)) return 'agent';
  }

  return 'human';
}
