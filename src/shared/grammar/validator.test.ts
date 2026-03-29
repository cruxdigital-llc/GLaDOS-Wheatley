import { describe, it, expect } from 'vitest';
import {
  validateRoadmap,
  validateSpecDirectory,
  validateProjectStatus,
  validateClaims,
  detectPhaseFromFiles,
  detectPhaseWithContents,
} from './validator.js';

// --- ROADMAP.md Validation ---

describe('validateRoadmap', () => {
  const VALID_ROADMAP = `<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
-->

# Roadmap

## Phase 1: Read-Only Board

**Goal**: Parse GLaDOS artifacts and render a Kanban board.

### 1.1 Parsing Grammar

- [ ] 1.1.1 Define canonical markdown grammar
- [ ] 1.1.2 Define directory naming convention
- [x] 1.1.3 Document the full grammar

### 1.2 Markdown Parsers

- [ ] 1.2.1 ROADMAP.md parser
- [ ] 1.2.2 Spec directory scanner

## Phase 2: Claims

**Goal**: Enable task claiming.

### 2.1 Claims Data Model

- [ ] 2.1.1 Define claims.md format
`;

  it('accepts a valid roadmap', () => {
    const result = validateRoadmap(VALID_ROADMAP);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an empty file', () => {
    const result = validateRoadmap('');
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('non-empty');
  });

  it('rejects a file missing the title', () => {
    const result = validateRoadmap('## Phase 1: Something\n');
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('ROADMAP.title');
  });

  it('rejects a file with no phases', () => {
    const result = validateRoadmap('# Roadmap\n\nSome text but no phases.\n');
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('PHASE.required');
  });

  it('flags out-of-order phases', () => {
    const content = `# Roadmap

## Phase 2: Wrong Start

**Goal**: Should be phase 1.

### 2.1 Something

- [ ] 2.1.1 A task
`;
    const result = validateRoadmap(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'PHASE.sequential')).toBe(true);
  });

  it('flags malformed task items', () => {
    const content = `# Roadmap

## Phase 1: Test

**Goal**: Test.

### 1.1 Section

- [] 1.1.1 Missing space in checkbox
`;
    const result = validateRoadmap(content);
    expect(result.errors.some((e) => e.rule === 'TASK_ITEM.format')).toBe(true);
  });

  it('flags uppercase X in checkbox as malformed', () => {
    const content = `# Roadmap

## Phase 1: Test

**Goal**: Test.

### 1.1 Section

- [X] 1.1.1 Uppercase checkbox
`;
    const result = validateRoadmap(content);
    expect(result.errors.some((e) => e.rule === 'TASK_ITEM.format')).toBe(true);
  });

  it('handles CRLF line endings', () => {
    const content = VALID_ROADMAP.replace(/\n/g, '\r\n');
    const result = validateRoadmap(content);
    expect(result.valid).toBe(true);
  });

  it('handles roadmap without GLaDOS header', () => {
    const content = `# Roadmap

## Phase 1: Simple

**Goal**: Test.

### 1.1 Section

- [ ] 1.1.1 A task
`;
    const result = validateRoadmap(content);
    expect(result.valid).toBe(true);
  });

  it('flags a phase missing its goal', () => {
    const content = `# Roadmap

## Phase 1: No Goal

### 1.1 Section

- [ ] 1.1.1 A task
`;
    const result = validateRoadmap(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'PHASE.goal_required')).toBe(true);
  });

  it('flags cross-phase section mismatch as error', () => {
    const content = `# Roadmap

## Phase 1: First

**Goal**: Test.

### 2.1 Wrong phase section

- [ ] 2.1.1 A task
`;
    const result = validateRoadmap(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'SECTION.phase_mismatch')).toBe(true);
  });

  it('warns on out-of-sequence item numbering', () => {
    const content = `# Roadmap

## Phase 1: Test

**Goal**: Test.

### 1.1 Section

- [ ] 1.1.1 First
- [ ] 1.1.5 Skipped to five
`;
    const result = validateRoadmap(content);
    expect(result.valid).toBe(true); // warnings don't fail validation
    expect(result.warnings.some((w) => w.message.includes('expected 2'))).toBe(true);
  });

  it('flags item ID that does not match current section', () => {
    const content = `# Roadmap

## Phase 1: Test

**Goal**: Test.

### 1.1 Section

- [ ] 1.2.1 Wrong section reference
`;
    const result = validateRoadmap(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'ITEM_ID.section_mismatch')).toBe(true);
  });
});

// --- specs/ Directory Validation ---

describe('validateSpecDirectory', () => {
  it('accepts a valid feature directory', () => {
    const result = validateSpecDirectory(
      '2026-03-28_feature_parsing-grammar',
      ['README.md', 'requirements.md', 'plan.md'],
    );
    expect(result.valid).toBe(true);
  });

  it('accepts a valid fix directory', () => {
    const result = validateSpecDirectory('2026-03-28_fix_broken-parser', [
      'README.md',
    ]);
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid directory name', () => {
    const result = validateSpecDirectory('bad-name', ['README.md']);
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('SPEC_DIR.naming');
  });

  it('rejects a directory missing README.md', () => {
    const result = validateSpecDirectory(
      '2026-03-28_feature_test',
      ['plan.md'],
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('SPEC_DIR.readme_required');
  });

  it('warns when planning phase is missing expected files', () => {
    const result = validateSpecDirectory('2026-03-28_feature_test', [
      'README.md',
      'plan.md',
    ]);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('requirements.md'))).toBe(true);
  });

  it('accepts mission-statement prefix', () => {
    const result = validateSpecDirectory(
      '2026-03-28_mission-statement_initial',
      ['README.md'],
    );
    expect(result.valid).toBe(true);
  });

  it('accepts plan-product prefix', () => {
    const result = validateSpecDirectory('2026-03-28_plan-product_initial', [
      'README.md',
    ]);
    expect(result.valid).toBe(true);
  });
});

// --- Phase Detection ---

describe('detectPhaseFromFiles', () => {
  it('returns unclaimed when only README.md exists', () => {
    expect(detectPhaseFromFiles(['README.md'])).toBe('unclaimed');
  });

  it('returns unclaimed for empty file list', () => {
    expect(detectPhaseFromFiles([])).toBe('unclaimed');
  });

  it('returns planning when plan.md exists', () => {
    expect(detectPhaseFromFiles(['README.md', 'plan.md'])).toBe('planning');
  });

  it('returns planning when requirements.md exists', () => {
    expect(detectPhaseFromFiles(['README.md', 'requirements.md'])).toBe(
      'planning',
    );
  });

  it('returns speccing when spec.md exists', () => {
    expect(
      detectPhaseFromFiles(['README.md', 'plan.md', 'spec.md']),
    ).toBe('speccing');
  });

  it('returns implementing when tasks.md exists', () => {
    expect(
      detectPhaseFromFiles(['README.md', 'plan.md', 'spec.md', 'tasks.md']),
    ).toBe('implementing');
  });
});

describe('detectPhaseWithContents', () => {
  it('returns implementing when tasks.md exists with incomplete tasks', () => {
    const tasks = '- [ ] Task 1\n- [x] Task 2\n';
    expect(
      detectPhaseWithContents(['README.md', 'tasks.md'], tasks),
    ).toBe('implementing');
  });

  it('returns done when all tasks are complete', () => {
    const tasks = '- [x] Task 1\n- [x] Task 2\n';
    expect(
      detectPhaseWithContents(['README.md', 'tasks.md'], tasks),
    ).toBe('done');
  });

  it('falls back to file-only detection when no content provided', () => {
    expect(
      detectPhaseWithContents(['README.md', 'tasks.md']),
    ).toBe('implementing');
  });

  it('returns unclaimed for empty files', () => {
    expect(detectPhaseWithContents([])).toBe('unclaimed');
  });
});

// --- PROJECT_STATUS.md Validation ---

describe('validateProjectStatus', () => {
  const VALID_STATUS = `<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
-->

# GLaDOS System Status

## Project Overview

**Mission**: Some mission
**Current Phase**: Planning

Some description.

## Architecture

Frontend and backend.

## Current Focus

### 1. Phase 1 — MVP

*Lead: TBD*

- [ ] **Parser**: Extract items from ROADMAP.md
- [x] **Scaffold**: Set up project structure

### 2. Backlog / Upcoming

- [ ] **Phase 2**: Claims & Assignment

## Known Issues / Technical Debt

None yet.

## Recent Changes

- 2026-03-28: Project initialized.
`;

  it('accepts a valid PROJECT_STATUS.md', () => {
    const result = validateProjectStatus(VALID_STATUS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an empty file', () => {
    const result = validateProjectStatus('');
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('non-empty');
  });

  it('flags missing required sections', () => {
    const content = `# Status

## Project Overview

Some text.

## Architecture

Some text.
`;
    const result = validateProjectStatus(content);
    expect(result.valid).toBe(false);
    const missingRules = result.errors.filter(
      (e) => e.rule === 'STATUS.required_section',
    );
    expect(missingRules.length).toBeGreaterThan(0);
  });

  it('flags malformed task lines in Current Focus', () => {
    const content = `# Status

## Project Overview

Text.

## Architecture

Text.

## Current Focus

### 1. Active

- [ ] Missing bold label format

## Known Issues / Technical Debt

None.

## Recent Changes

- 2026-03-28: Init.
`;
    const result = validateProjectStatus(content);
    expect(result.errors.some((e) => e.rule === 'STATUS.task_line_format')).toBe(true);
  });

  it('warns on malformed change entries', () => {
    const content = `# Status

## Project Overview

Text.

## Architecture

Text.

## Current Focus

### 1. Active

- [ ] **Task**: Do something

## Known Issues / Technical Debt

None.

## Recent Changes

- No date here, just text
`;
    const result = validateProjectStatus(content);
    expect(result.warnings.some((w) => w.message.includes('Change entry'))).toBe(true);
  });

  it('warns on malformed lead lines', () => {
    const content = `# Status

## Project Overview

Text.

## Architecture

Text.

## Current Focus

### 1. Active

*Lead: Missing closing asterisk

- [ ] **Task**: Do something

## Known Issues / Technical Debt

None.

## Recent Changes

- 2026-03-28: Init.
`;
    const result = validateProjectStatus(content);
    expect(result.warnings.some((w) => w.message.includes('lead line'))).toBe(true);
  });

  it('handles CRLF line endings', () => {
    const content = VALID_STATUS.replace(/\n/g, '\r\n');
    const result = validateProjectStatus(content);
    expect(result.valid).toBe(true);
  });
});

// --- claims.md Validation ---

describe('validateClaims', () => {
  it('accepts an empty claims file', () => {
    const result = validateClaims('');
    expect(result.valid).toBe(true);
  });

  it('accepts valid claims', () => {
    const content = `# Claims

- [claimed] 1.1.1 | jed2nd | 2026-03-28T20:00:00Z
- [released] 1.1.2 | agent-1 | 2026-03-28T18:00:00Z | 2026-03-28T20:00:00Z
- [expired] 1.2.1 | agent-2 | 2026-03-27T10:00:00Z | 2026-03-28T10:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects file missing Claims title', () => {
    const content = `- [claimed] 1.1.1 | someone | 2026-03-28T20:00:00Z\n`;
    const result = validateClaims(content);
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('CLAIMS.title');
  });

  it('flags malformed claim entries', () => {
    const content = `# Claims

- [claimed] bad-id | someone | not-a-date
`;
    const result = validateClaims(content);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.entry_format')).toBe(true);
  });

  it('accepts claims with GLaDOS header', () => {
    const content = `<!--
GLaDOS-MANAGED DOCUMENT
-->

# Claims

- [claimed] 1.1.1 | jed2nd | 2026-03-28T20:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(true);
  });

  it('warns when released/expired claims lack release timestamp', () => {
    const content = `# Claims

- [released] 1.1.1 | agent-1 | 2026-03-28T18:00:00Z
- [expired] 1.2.1 | agent-2 | 2026-03-27T10:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(true); // warnings don't fail validation
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0].message).toContain('missing a release timestamp');
  });

  // --- CLAIMS.timestamp_order ---

  it('flags released entry where RELEASE_TS equals CLAIMED_AT', () => {
    const content = `# Claims

- [released] 1.1.1 | agent-1 | 2026-03-28T20:00:00Z | 2026-03-28T20:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.timestamp_order')).toBe(true);
  });

  it('flags released entry where RELEASE_TS is before CLAIMED_AT', () => {
    const content = `# Claims

- [released] 1.1.1 | agent-1 | 2026-03-28T20:00:00Z | 2026-03-28T19:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.timestamp_order')).toBe(true);
  });

  it('accepts released entry where RELEASE_TS is strictly after CLAIMED_AT', () => {
    const content = `# Claims

- [released] 1.1.1 | agent-1 | 2026-03-28T18:00:00Z | 2026-03-28T21:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.timestamp_order')).toBe(false);
  });

  // --- CLAIMS.claimant_format ---

  it('flags a claimant with an embedded pipe character', () => {
    // Use a line that is close-to-valid but has a pipe in the claimant field.
    // The CLAIM_ENTRY_RE will not match because the claimant regex (.+?) stops
    // at the first pipe, so the loose match path triggers the claimant check.
    const content = `# Claims

- [claimed] 1.1.1 | bad|name | 2026-03-28T20:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.claimant_format')).toBe(true);
  });

  it('accepts a valid claimant without a pipe character', () => {
    const content = `# Claims

- [claimed] 1.1.1 | valid-claimant | 2026-03-28T20:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.claimant_format')).toBe(false);
  });

  // --- CLAIMS.item_id_format ---

  it('flags an item ID with only two segments', () => {
    const content = `# Claims

- [claimed] 1.1 | agent-1 | 2026-03-28T20:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.item_id_format')).toBe(true);
  });

  it('flags an item ID with non-numeric characters', () => {
    const content = `# Claims

- [claimed] 1.a.1 | agent-1 | 2026-03-28T20:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.item_id_format')).toBe(true);
  });

  it('accepts a valid three-segment numeric item ID', () => {
    const content = `# Claims

- [claimed] 2.1.3 | agent-1 | 2026-03-28T20:00:00Z
`;
    const result = validateClaims(content);
    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.rule === 'CLAIMS.item_id_format')).toBe(false);
  });
});
