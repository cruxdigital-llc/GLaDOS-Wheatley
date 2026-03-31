/**
 * Status Writeback
 *
 * Pure function for updating PROJECT_STATUS.md when a board item changes phase.
 * No I/O occurs here — takes the current file content as a string and returns
 * the updated content as a string.
 */

import type { BoardPhase } from '../../shared/grammar/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskLine {
  /** Original full line text */
  raw: string;
  /** Checkbox state: true = [x], false = [ ] */
  completed: boolean;
  /** Bold label extracted from the line */
  label: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update PROJECT_STATUS.md content to reflect an item's new phase.
 *
 * Rules:
 * - Transition to `done`: mark the matching task line as `[x]`
 * - Transition from `unclaimed` into any active phase: move the task from the
 *   backlog section to the first active focus section (or add it if absent)
 * - Other transitions: ensure the task line is `[ ]` (still in-progress)
 *
 * If the file is empty or no matching task is found, the input is returned
 * unchanged (fail-safe — we never corrupt the file).
 *
 * @param currentContent - Current PROJECT_STATUS.md content
 * @param itemId         - Roadmap item ID (e.g. "3.2.1")
 * @param title          - Display title for the item (used when inserting)
 * @param from           - Phase transitioning from
 * @param to             - Phase transitioning to
 */
export function buildStatusWriteback(
  currentContent: string,
  itemId: string,
  title: string,
  from: BoardPhase,
  to: BoardPhase,
): string {
  if (!currentContent.trim()) return currentContent;

  const lines = currentContent.split('\n');

  // Try to update an existing line first
  const updated = tryUpdateExistingLine(lines, itemId, to);
  if (updated !== null) {
    return updated.join('\n');
  }

  // No existing line found.
  // When moving out of unclaimed into an active phase, add to focus section.
  if (from === 'unclaimed' && to !== 'done') {
    const inserted = insertIntoFocusSection(lines, itemId, title, to);
    if (inserted !== null) {
      return inserted.join('\n');
    }
  }

  // Nothing to do — return unchanged
  return currentContent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TASK_LINE_RE = /^(- \[)[ x](\] \*\*)(.+?)(\*\*: .*)$/;

/**
 * Attempt to find and update a task line matching `itemId`.
 * Returns the updated lines array, or null if no match was found.
 */
function tryUpdateExistingLine(
  lines: string[],
  itemId: string,
  to: BoardPhase,
): string[] | null {
  let found = false;
  const updatedLines = lines.map((line) => {
    const match = line.match(TASK_LINE_RE);
    if (!match) return line;

    const label = match[3];
    if (!label.toLowerCase().startsWith(itemId.toLowerCase())) return line;

    found = true;
    const check = to === 'done' ? 'x' : ' ';
    return `${match[1]}${check}${match[2]}${label}${match[4]}`;
  });

  return found ? updatedLines : null;
}

/**
 * Insert a new task line into the first numbered focus section (### 1. ...).
 * Returns the updated lines array, or null if no suitable section was found.
 */
function insertIntoFocusSection(
  lines: string[],
  itemId: string,
  title: string,
  to: BoardPhase,
): string[] | null {
  // Locate "## Current Focus"
  const focusStart = lines.findIndex((l) => l.trim() === '## Current Focus');
  if (focusStart === -1) return null;

  // Find the first "### N. ..." section after the focus header
  const sectionStart = lines.findIndex(
    (l, i) => i > focusStart && /^### \d+\. /.test(l),
  );
  if (sectionStart === -1) return null;

  // Find the end of that section (next ### or ## or end of file)
  let insertAt = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (lines[i].startsWith('### ') || lines[i].startsWith('## ')) {
      insertAt = i;
      break;
    }
  }

  // Insert before a trailing blank line if present
  if (insertAt > sectionStart + 1 && lines[insertAt - 1].trim() === '') {
    insertAt -= 1;
  }

  const phaseTag = to !== 'unclaimed' ? ` (${to})` : '';
  const newLine = `- [ ] **${itemId}**: ${title}${phaseTag}`;
  const result = [...lines];
  result.splice(insertAt, 0, newLine);
  return result;
}
