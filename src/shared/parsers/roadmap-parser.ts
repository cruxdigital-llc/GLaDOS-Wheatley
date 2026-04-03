/**
 * ROADMAP.md Parser
 *
 * Extracts structured roadmap data following the parsing grammar standard.
 * Pure function: string in, ParsedRoadmap out. Never throws.
 */

import type {
  ParsedRoadmap,
  ParseWarning,
  RoadmapPhase,
  RoadmapSection,
  RoadmapItem,
} from '../grammar/types.js';
import { normalize, stripHeader } from './utils.js';

const PHASE_HEADING_RE = /^## Phase (\d+):\s*(.+)$/;
const GOAL_RE = /^\*\*Goal\*\*:\s*(.+)$/;
const SECTION_HEADING_RE = /^### (\d+)\.(\d+)\s+(.+)$/;
const TASK_ITEM_RE = /^-\s*\[([ xX])\]\s*(\d+)\.(\d+)\.(\d+)\s+(.+)$/;

/** Detect lines that look like task items but don't match the strict pattern. */
const LOOSE_TASK_RE = /^-\s*\[[ xX]\]\s+\S/;

export function parseRoadmap(content: string): ParsedRoadmap {
  const phases: RoadmapPhase[] = [];
  const allItems: RoadmapItem[] = [];
  const warnings: ParseWarning[] = [];

  if (!content.trim()) {
    return { phases, allItems, warnings };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  let currentPhase: RoadmapPhase | null = null;
  let currentSection: RoadmapSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd();
    const lineNum = i + 1;

    // Skip blank lines, comments, and the title line
    if (!trimmed || trimmed === '# Roadmap' || trimmed.startsWith('<!--')) continue;

    // Phase heading
    const phaseMatch = trimmed.match(PHASE_HEADING_RE);
    if (phaseMatch) {
      currentPhase = {
        number: parseInt(phaseMatch[1], 10),
        title: phaseMatch[2].trim(),
        goal: '',
        sections: [],
      };
      phases.push(currentPhase);
      currentSection = null;
      continue;
    }

    // Goal line
    const goalMatch = trimmed.match(GOAL_RE);
    if (goalMatch && currentPhase) {
      currentPhase.goal = goalMatch[1];
      continue;
    }

    // Section heading
    const sectionMatch = trimmed.match(SECTION_HEADING_RE);
    if (sectionMatch && currentPhase) {
      currentSection = {
        id: `${sectionMatch[1]}.${sectionMatch[2]}`,
        title: sectionMatch[3].trim(),
        items: [],
      };
      currentPhase.sections.push(currentSection);
      continue;
    }

    // Task item
    const taskMatch = trimmed.match(TASK_ITEM_RE);
    if (taskMatch && currentPhase && currentSection) {
      const item: RoadmapItem = {
        id: `${taskMatch[2]}.${taskMatch[3]}.${taskMatch[4]}`,
        phase: parseInt(taskMatch[2], 10),
        section: parseInt(taskMatch[3], 10),
        item: parseInt(taskMatch[4], 10),
        title: taskMatch[5].trim(),
        completed: taskMatch[1].toLowerCase() === 'x',
        sectionTitle: currentSection.title,
        phaseTitle: `Phase ${currentPhase.number}: ${currentPhase.title}`,
      };
      currentSection.items.push(item);
      allItems.push(item);
      continue;
    }

    // Detect near-miss task lines and emit a warning
    if (LOOSE_TASK_RE.test(trimmed) && currentPhase) {
      warnings.push({
        file: 'ROADMAP.md',
        message: `Line looks like a task item but doesn't match expected format (- [x] N.N.N Title): "${trimmed.slice(0, 80)}"`,
        line: lineNum,
      });
    }
  }

  return { phases, allItems, warnings: warnings.length > 0 ? warnings : undefined };
}
