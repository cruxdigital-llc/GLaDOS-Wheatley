/**
 * ROADMAP.md Parser
 *
 * Extracts structured roadmap data following the parsing grammar standard.
 * Pure function: string in, ParsedRoadmap out. Never throws.
 */

import type {
  ParsedRoadmap,
  RoadmapPhase,
  RoadmapSection,
  RoadmapItem,
} from '../grammar/types.js';
import { normalize, stripHeader } from './utils.js';

const PHASE_HEADING_RE = /^## Phase (\d+): (.+)$/;
const GOAL_RE = /^\*\*Goal\*\*: (.+)$/;
const SECTION_HEADING_RE = /^### (\d+)\.(\d+) (.+)$/;
const TASK_ITEM_RE = /^- \[([ xX])\] (\d+)\.(\d+)\.(\d+) (.+)$/;

export function parseRoadmap(content: string): ParsedRoadmap {
  const phases: RoadmapPhase[] = [];
  const allItems: RoadmapItem[] = [];

  if (!content.trim()) {
    return { phases, allItems };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  let currentPhase: RoadmapPhase | null = null;
  let currentSection: RoadmapSection | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Phase heading
    const phaseMatch = trimmed.match(PHASE_HEADING_RE);
    if (phaseMatch) {
      currentPhase = {
        number: parseInt(phaseMatch[1], 10),
        title: phaseMatch[2],
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
        title: sectionMatch[3],
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
        title: taskMatch[5],
        completed: taskMatch[1].toLowerCase() === 'x',
        sectionTitle: currentSection.title,
        phaseTitle: `Phase ${currentPhase.number}: ${currentPhase.title}`,
      };
      currentSection.items.push(item);
      allItems.push(item);
    }
  }

  return { phases, allItems };
}
