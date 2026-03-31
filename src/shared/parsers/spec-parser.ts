/**
 * Spec Directory Parser
 *
 * Parses spec directory listings into SpecEntry objects with phase detection.
 * Pure function: directory info in, SpecEntry[] out. Never throws.
 */

import type { SpecEntry, BoardPhase } from '../grammar/types.js';
import { detectPhaseWithContents } from '../grammar/validator.js';

const SPEC_DIR_RE =
  /^(\d{4}-\d{2}-\d{2})_(feature|fix|mission-statement|plan-product)_(.+)$/;

export interface SpecDirectoryInput {
  /** Directory name, e.g., "2026-03-28_feature_parsing-grammar" */
  dirName: string;
  /** Files found in the directory */
  files: string[];
  /** Optional: content of tasks.md for verifying/done detection */
  tasksContent?: string;
  /** Optional: content of README.md for done detection */
  readmeContent?: string;
}

export function parseSpecDirectories(
  dirs: SpecDirectoryInput[],
): SpecEntry[] {
  const entries: SpecEntry[] = [];

  for (const dir of dirs) {
    const match = dir.dirName.match(SPEC_DIR_RE);
    if (!match) {
      // Directory doesn't match naming convention — skip
      continue;
    }

    const phase: BoardPhase = detectPhaseWithContents(
      dir.files,
      dir.tasksContent,
      dir.readmeContent,
    );

    entries.push({
      dirName: dir.dirName,
      date: match[1],
      prefix: match[2],
      name: match[3],
      phase,
      files: dir.files,
    });
  }

  return entries;
}
