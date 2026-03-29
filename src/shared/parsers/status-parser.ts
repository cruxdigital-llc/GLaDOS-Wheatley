/**
 * PROJECT_STATUS.md Parser
 *
 * Extracts active tasks and backlog from PROJECT_STATUS.md.
 * Pure function: string in, ParsedProjectStatus out. Never throws.
 */

import type { ParsedProjectStatus, StatusTask } from '../grammar/types.js';

/** Normalize CRLF to LF */
function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd();
}

/** Strip the optional GLaDOS HTML comment header */
function stripHeader(content: string): string {
  return content.replace(/^<!--[\s\S]*?-->\s*\n?/, '');
}

const FOCUS_SECTION_RE = /^### (\d+)\. (.+)$/;
const TASK_LINE_RE = /^- \[([ x])\] \*\*(.+?)\*\*: (.+)$/;
const LEAD_RE = /^\*Lead: (.+)\*$/;

export function parseProjectStatus(content: string): ParsedProjectStatus {
  const activeTasks: StatusTask[] = [];
  const backlog: StatusTask[] = [];

  if (!content.trim()) {
    return { activeTasks, backlog };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  let inFocus = false;
  let currentSection = '';
  let currentLead: string | undefined;
  let isBacklog = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Track which ## section we're in
    if (trimmed === '## Current Focus') {
      inFocus = true;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      inFocus = false;
      continue;
    }

    if (!inFocus) continue;

    // Focus section heading
    const sectionMatch = trimmed.match(FOCUS_SECTION_RE);
    if (sectionMatch) {
      currentSection = sectionMatch[2];
      currentLead = undefined;
      isBacklog = /backlog/i.test(currentSection);
      continue;
    }

    // Lead line
    const leadMatch = trimmed.match(LEAD_RE);
    if (leadMatch) {
      currentLead = leadMatch[1];
      continue;
    }

    // Task line
    const taskMatch = trimmed.match(TASK_LINE_RE);
    if (taskMatch) {
      const task: StatusTask = {
        label: taskMatch[2],
        description: taskMatch[3],
        completed: taskMatch[1] === 'x',
        section: currentSection,
        lead: currentLead,
      };

      if (isBacklog) {
        backlog.push(task);
      } else {
        activeTasks.push(task);
      }
    }
  }

  return { activeTasks, backlog };
}
