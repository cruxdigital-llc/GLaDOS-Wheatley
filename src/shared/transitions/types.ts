/**
 * Phase Transition Types
 *
 * Defines valid phase transitions and the action structure used to describe
 * file changes that accompany each transition.
 */

import type { BoardPhase } from '../grammar/types.js';

/**
 * Map of valid forward phase transitions.
 * Each key is a "from" phase; its value is the list of permitted "to" phases.
 *
 * Standard sequence: unclaimed → planning → speccing → implementing → verifying → done
 * Permitted shortcut: unclaimed → implementing (for simple items that skip planning/speccing)
 */
export const VALID_TRANSITIONS: Map<BoardPhase, BoardPhase[]> = new Map([
  ['unclaimed', ['planning', 'implementing']],
  ['planning', ['speccing']],
  ['speccing', ['implementing']],
  ['implementing', ['verifying']],
  ['verifying', ['done']],
  ['done', []],
]);

/**
 * A single file operation produced by a phase transition.
 * The engine generates these; the service writes them via GitAdapter.
 */
export interface TransitionAction {
  /** Repo-relative path of the file to write (e.g., "specs/2026-03-28_feature_3-1-2/README.md") */
  path: string;
  /** Full file content to write verbatim */
  content: string;
  /** True if this is a new file; false if overwriting an existing file */
  create: boolean;
}
