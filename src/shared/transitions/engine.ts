/**
 * Phase Transition Engine
 *
 * Pure functions for validating phase transitions and generating the file
 * actions that accompany each transition. No I/O occurs here.
 */

import type { BoardPhase } from '../grammar/types.js';
import { VALID_TRANSITIONS, type TransitionAction } from './types.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check whether a transition from one phase to another is permitted.
 * Returns { valid: true } on success, or { valid: false, reason } on failure.
 * Never throws.
 */
export function validateTransition(
  from: BoardPhase,
  to: BoardPhase,
): { valid: boolean; reason?: string } {
  const permitted = VALID_TRANSITIONS.get(from);
  if (permitted === undefined) {
    return { valid: false, reason: `Unknown phase: ${from}` };
  }
  if (permitted.includes(to)) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: `Invalid transition: ${from} \u2192 ${to}`,
  };
}

// ---------------------------------------------------------------------------
// Action generation
// ---------------------------------------------------------------------------

/**
 * Generate the list of file actions required to execute a phase transition.
 * Returns an empty array for invalid transitions (use validateTransition separately).
 */
export function getTransitionActions(
  itemId: string,
  from: BoardPhase,
  to: BoardPhase,
  existingSpecDir?: string,
): TransitionAction[] {
  const key = `${from}→${to}`;
  const specDir = existingSpecDir ? `specs/${existingSpecDir}` : buildSpecDir(itemId);

  switch (key) {
    case 'unclaimed→planning':
      return [readmeAction(specDir, itemId)];

    case 'planning→speccing':
      return [specAction(specDir, itemId), requirementsAction(specDir, itemId)];

    case 'speccing→implementing':
      return [tasksAction(specDir, itemId)];

    case 'implementing→verifying':
      return [tasksCompletedAction(specDir, itemId)];

    case 'verifying→done':
      return [roadmapMarkDoneAction(itemId)];

    case 'unclaimed→implementing':
      return [readmeAction(specDir, itemId), tasksAction(specDir, itemId)];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Derive the spec directory path for an item ID. */
function buildSpecDir(itemId: string): string {
  const today = todayString();
  const slug = itemId.replace(/\./g, '-');
  return `specs/${today}_feature_${slug}`;
}

/** Return today's date as YYYY-MM-DD (UTC). */
function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// File content builders
// ---------------------------------------------------------------------------

function readmeAction(specDir: string, itemId: string): TransitionAction {
  return {
    path: `${specDir}/README.md`,
    create: true,
    content: `# Feature: ${itemId}

## Summary

_TODO: Describe what this feature does._

## Goals

- TODO

## Non-Goals

- TODO
`,
  };
}

function specAction(specDir: string, itemId: string): TransitionAction {
  return {
    path: `${specDir}/spec.md`,
    create: true,
    content: `# Spec: ${itemId}

## 1. Overview

_TODO: Describe the technical design._
`,
  };
}

function requirementsAction(specDir: string, itemId: string): TransitionAction {
  return {
    path: `${specDir}/requirements.md`,
    create: true,
    content: `# Requirements: ${itemId}

## Functional Requirements

### FR-1

- TODO
`,
  };
}

function tasksAction(specDir: string, itemId: string): TransitionAction {
  return {
    path: `${specDir}/tasks.md`,
    create: true,
    content: `# Tasks: ${itemId}

## Implementation Tasks

- [ ] **TODO**: Describe first task
`,
  };
}

function tasksCompletedAction(specDir: string, itemId: string): TransitionAction {
  return {
    path: `${specDir}/tasks.md`,
    create: false,
    content: `# Tasks: ${itemId}

## Implementation Tasks

- [x] All implementation tasks completed
`,
  };
}

function roadmapMarkDoneAction(itemId: string): TransitionAction {
  return {
    path: 'ROADMAP.md',
    create: false,
    content: `MARK_DONE:${itemId}`,
  };
}
