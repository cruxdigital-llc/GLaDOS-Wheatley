/**
 * Wheatley Parsing Grammar — Validation Utility
 *
 * Pure validation functions for each GLaDOS artifact.
 * No I/O — accepts string content and returns structured results.
 *
 * See: product-knowledge/standards/parsing-grammar.md
 */

import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BoardPhase,
} from './types.js';

/** Normalize line endings to LF */
function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd();
}

/** Strip the optional GLaDOS HTML comment header */
function stripHeader(content: string): string {
  return content.replace(/^<!--[\s\S]*?-->\s*\n?/, '');
}

/** Returns true if the string contains any control character (charCode < 32). */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 32) return true;
  }
  return false;
}

// --- ROADMAP.md Validator ---

const PHASE_HEADING_RE = /^## Phase (\d+): (.+)$/;
const GOAL_RE = /^\*\*Goal\*\*: (.+)$/;
const SECTION_HEADING_RE = /^### (\d+\.\d+) (.+)$/;
const TASK_ITEM_RE = /^- \[([ x])\] (\d+\.\d+\.\d+) (.+)$/;

export function validateRoadmap(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const file = 'ROADMAP.md';

  if (!content.trim()) {
    errors.push({ file, message: 'File is empty', rule: 'non-empty' });
    return { valid: false, errors, warnings };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  // Must have "# Roadmap" title
  const titleLine = lines.findIndex((l) => l.trim() === '# Roadmap');
  if (titleLine === -1) {
    errors.push({
      file,
      message: 'Missing "# Roadmap" title',
      rule: 'ROADMAP.title',
    });
    return { valid: false, errors, warnings };
  }

  let expectedPhase = 1;
  let currentPhase = 0;
  let currentSectionNum = 0;
  let expectedSection = 1;
  let expectedItem = 1;
  let hasGoalForCurrentPhase = false;
  let phaseStartLine = 0;

  for (let i = titleLine + 1; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const lineNum = i + 1;

    // Phase heading
    const phaseMatch = line.match(PHASE_HEADING_RE);
    if (phaseMatch) {
      // Check that the previous phase had a goal (if there was a previous phase)
      if (currentPhase > 0 && !hasGoalForCurrentPhase) {
        errors.push({
          file,
          line: phaseStartLine,
          message: `Phase ${currentPhase} is missing a "**Goal**:" line`,
          rule: 'PHASE.goal_required',
        });
      }

      const phaseNum = parseInt(phaseMatch[1], 10);
      if (phaseNum !== expectedPhase) {
        errors.push({
          file,
          line: lineNum,
          message: `Expected Phase ${expectedPhase}, got Phase ${phaseNum}`,
          rule: 'PHASE.sequential',
        });
      }
      expectedPhase = phaseNum + 1;
      currentPhase = phaseNum;
      expectedSection = 1;
      expectedItem = 1;
      hasGoalForCurrentPhase = false;
      phaseStartLine = lineNum;
      continue;
    }

    // Goal line
    if (GOAL_RE.test(line)) {
      hasGoalForCurrentPhase = true;
      continue;
    }

    // Section heading
    const sectionMatch = line.match(SECTION_HEADING_RE);
    if (sectionMatch) {
      const sectionId = sectionMatch[1];
      const [sectionPhase] = sectionId.split('.').map(Number);
      const expectedId = `${currentPhase}.${expectedSection}`;

      // Cross-phase mismatch is an error, not a warning
      if (sectionPhase !== currentPhase) {
        errors.push({
          file,
          line: lineNum,
          message: `Section "${sectionId}" belongs to Phase ${sectionPhase}, but appears under Phase ${currentPhase}`,
          rule: 'SECTION.phase_mismatch',
        });
      } else if (sectionId !== expectedId) {
        warnings.push({
          file,
          line: lineNum,
          message: `Section ID "${sectionId}" — expected "${expectedId}"`,
          suggestion: `Renumber to ${expectedId}`,
        });
      }
      currentSectionNum = parseInt(sectionId.split('.')[1], 10);
      expectedSection++;
      expectedItem = 1;
      continue;
    }

    // Task item
    const taskMatch = line.match(TASK_ITEM_RE);
    if (taskMatch) {
      const itemId = taskMatch[2];
      const parts = itemId.split('.').map(Number);
      if (parts.length !== 3) {
        errors.push({
          file,
          line: lineNum,
          message: `Malformed item ID "${itemId}" �� expected X.Y.Z format`,
          rule: 'ITEM_ID.format',
        });
      } else {
        // Validate item numbering is sequential
        const [itemPhase, itemSection, itemNum] = parts;
        if (itemPhase !== currentPhase || itemSection !== currentSectionNum) {
          errors.push({
            file,
            line: lineNum,
            message: `Item "${itemId}" doesn't match current section ${currentPhase}.${currentSectionNum}`,
            rule: 'ITEM_ID.section_mismatch',
          });
        } else if (itemNum !== expectedItem) {
          warnings.push({
            file,
            line: lineNum,
            message: `Item number ${itemNum} — expected ${expectedItem}`,
            suggestion: `Renumber to ${currentPhase}.${currentSectionNum}.${expectedItem}`,
          });
        }
        expectedItem++;
      }
      continue;
    }

    // Check for malformed checkboxes (including uppercase X)
    if (line.match(/^- \[[ xX]?\]/i)) {
      if (!line.match(/^- \[([ x])\] \d+\.\d+\.\d+ /)) {
        errors.push({
          file,
          line: lineNum,
          message: `Malformed task item: "${line}"`,
          rule: 'TASK_ITEM.format',
        });
      }
    }
  }

  // Check goal for the last phase
  if (currentPhase > 0 && !hasGoalForCurrentPhase) {
    errors.push({
      file,
      line: phaseStartLine,
      message: `Phase ${currentPhase} is missing a "**Goal**:" line`,
      rule: 'PHASE.goal_required',
    });
  }

  if (currentPhase === 0) {
    errors.push({
      file,
      message: 'No phases found',
      rule: 'PHASE.required',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- specs/ Directory Validator ---

const SPEC_DIR_RE = /^(\d{4}-\d{2}-\d{2})_(feature|fix|mission-statement|plan-product)_([a-z0-9]+(-[a-z0-9]+)*)$/;

/**
 * Detect the phase of a spec directory from its file listing.
 *
 * Note: This function can only detect up to 'implementing' from file names alone.
 * Detecting 'verifying' and 'done' requires reading file contents (task completion
 * status and README verify log). Full phase detection including those phases is
 * handled by the parsers in feature 1.2.
 */
export function detectPhaseFromFiles(files: string[]): Exclude<BoardPhase, 'verifying' | 'done'> {
  const has = (f: string) => files.includes(f);

  if (has('tasks.md')) return 'implementing';
  if (has('spec.md')) return 'speccing';
  if (has('plan.md') || has('requirements.md')) return 'planning';
  if (has('README.md')) return 'planning';
  return 'unclaimed';
}

/**
 * Full phase detection that also checks file contents.
 * Can detect all 6 phases including 'verifying' and 'done'.
 */
export function detectPhaseWithContents(
  files: string[],
  tasksContent?: string,
  readmeContent?: string,
): BoardPhase {
  const has = (f: string) => files.includes(f);

  if (has('tasks.md')) {
    if (!tasksContent) {
      // No content provided — can't determine completion, assume implementing
      return 'implementing';
    }
    // Match checkbox lines: - [x], - [X], - [ ] with optional leading whitespace
    const taskLines = tasksContent.split('\n').filter((l) => /^\s*- \[[ xX]\]/.test(l));

    if (taskLines.length === 0) {
      // tasks.md exists but has no checkbox items — treat as implementing
      return 'implementing';
    }

    const allComplete = taskLines.every((l) => /^\s*- \[[xX]\]/.test(l));

    if (allComplete) {
      // Check for verify log in README.md to distinguish verifying vs done
      if (readmeContent && /#{2,3} Verify|#{2,3} Verification|verified|PASSED/i.test(readmeContent)) {
        return 'done';
      }
      // All tasks complete but no verify log — verifying phase
      return 'verifying';
    }
    return 'implementing';
  }
  if (has('spec.md')) return 'speccing';
  if (has('plan.md') || has('requirements.md')) return 'planning';
  if (has('README.md')) return 'planning';
  return 'unclaimed';
}

export function validateSpecDirectory(
  dirName: string,
  files: string[],
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const file = `specs/${dirName}`;

  // Validate directory name
  if (!SPEC_DIR_RE.test(dirName)) {
    errors.push({
      file,
      message: `Directory name "${dirName}" does not match pattern: YYYY-MM-DD_prefix_kebab-name`,
      rule: 'SPEC_DIR.naming',
    });
    return { valid: false, errors, warnings };
  }

  // Must have README.md
  if (!files.includes('README.md')) {
    errors.push({
      file,
      message: 'Missing required file: README.md',
      rule: 'SPEC_DIR.readme_required',
    });
  }

  // Check for expected files based on detected phase
  const phase = detectPhaseFromFiles(files);

  if (phase === 'planning') {
    if (!files.includes('requirements.md')) {
      warnings.push({
        file,
        message: 'Planning phase but missing requirements.md',
        suggestion: 'Create requirements.md with feature requirements',
      });
    }
    if (!files.includes('plan.md')) {
      warnings.push({
        file,
        message: 'Planning phase but missing plan.md',
        suggestion: 'Create plan.md with the high-level plan',
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- PROJECT_STATUS.md Validator ---

const TASK_LINE_RE = /^- \[([ x])\] \*\*(.+?)\*\*: (.+)$/;
const LEAD_RE = /^\*Lead: (.+)\*$/;
const CHANGE_LINE_RE = /^- \d{4}-\d{2}-\d{2}: .+$/;
const FOCUS_SECTION_RE = /^### \d+\. .+$/;

export function validateProjectStatus(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const file = 'PROJECT_STATUS.md';

  if (!content.trim()) {
    errors.push({ file, message: 'File is empty', rule: 'non-empty' });
    return { valid: false, errors, warnings };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  const requiredSections = [
    '## Project Overview',
    '## Architecture',
    '## Current Focus',
    '## Known Issues / Technical Debt',
    '## Recent Changes',
  ];

  const foundSections = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('## ')) {
      foundSections.add(trimmed);
    }
  }

  for (const section of requiredSections) {
    if (!foundSections.has(section)) {
      errors.push({
        file,
        message: `Missing required section: "${section}"`,
        rule: 'STATUS.required_section',
      });
    }
  }

  // Validate task lines in Current Focus, lead lines, and change entries
  let inFocus = false;
  let inChanges = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const lineNum = i + 1;

    if (line === '## Current Focus') {
      inFocus = true;
      inChanges = false;
      continue;
    }
    if (line === '## Recent Changes') {
      inChanges = true;
      inFocus = false;
      continue;
    }
    if (line.startsWith('## ')) {
      inFocus = false;
      inChanges = false;
      continue;
    }

    // Validate focus section contents
    if (inFocus) {
      // Validate focus section headings
      if (line.startsWith('### ') && !FOCUS_SECTION_RE.test(line)) {
        warnings.push({
          file,
          line: lineNum,
          message: `Focus section heading doesn't match "### N. Title" format: "${line}"`,
          suggestion: 'Use format: ### 1. Section Title',
        });
      }

      // Validate lead lines
      if (line.startsWith('*Lead:') && !LEAD_RE.test(line)) {
        warnings.push({
          file,
          line: lineNum,
          message: `Malformed lead line: "${line}"`,
          suggestion: 'Use format: *Lead: Name*',
        });
      }

      // Validate task lines
      if (line.startsWith('- [')) {
        if (!TASK_LINE_RE.test(line)) {
          errors.push({
            file,
            line: lineNum,
            message: `Malformed task line: "${line}"`,
            rule: 'STATUS.task_line_format',
          });
        }
      }
    }

    // Validate Recent Changes entries
    if (inChanges && line.startsWith('- ')) {
      if (!CHANGE_LINE_RE.test(line)) {
        warnings.push({
          file,
          line: lineNum,
          message: `Change entry doesn't match "- YYYY-MM-DD: description" format: "${line}"`,
          suggestion: 'Use format: - 2026-03-28: Description of change',
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- claims.md Validator ---

const CLAIM_ENTRY_RE =
  /^- \[(claimed|released|expired)\] (\d+\.\d+\.\d+) \| (.+?) \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)( \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z))?$/;

export function validateClaims(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const file = 'claims.md';

  if (!content.trim()) {
    // Empty claims file is valid — no claims yet
    return { valid: true, errors, warnings };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  const titleLine = lines.findIndex((l) => l.trim() === '# Claims');
  if (titleLine === -1) {
    errors.push({
      file,
      message: 'Missing "# Claims" title',
      rule: 'CLAIMS.title',
    });
    return { valid: false, errors, warnings };
  }

  for (let i = titleLine + 1; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const lineNum = i + 1;

    if (line === '') continue;

    if (line.startsWith('- [')) {
      const match = line.match(CLAIM_ENTRY_RE);
      if (!match) {
        // Before emitting a general entry_format error, check if the line is
        // close to valid but fails on a specific field — claimant_format or
        // item_id_format. Use a looser regex to extract potential fields.
        const looseMatch = line.match(
          /^- \[(claimed|released|expired)\] (.+?) \| (.+?) \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/,
        );
        if (looseMatch) {
          const itemId = looseMatch[2];
          const claimant = looseMatch[3];
          if (!/^\d+\.\d+\.\d+$/.test(itemId)) {
            errors.push({
              file,
              line: lineNum,
              message: `Invalid item ID "${itemId}": must match \\d+\\.\\d+\\.\\d+`,
              rule: 'CLAIMS.item_id_format',
            });
          } else if (!claimant || claimant.includes('|') || hasControlChar(claimant)) {
            errors.push({
              file,
              line: lineNum,
              message: `Invalid claimant "${claimant}": must be non-empty and contain no pipe or control characters`,
              rule: 'CLAIMS.claimant_format',
            });
          } else {
            errors.push({
              file,
              line: lineNum,
              message: `Malformed claim entry: "${line}"`,
              rule: 'CLAIMS.entry_format',
            });
          }
        } else {
          errors.push({
            file,
            line: lineNum,
            message: `Malformed claim entry: "${line}"`,
            rule: 'CLAIMS.entry_format',
          });
        }
      } else {
        const status = match[1];
        const itemId = match[2];
        const claimant = match[3];
        const claimedAt = match[4];
        const hasReleaseTs = !!match[6];
        const releaseTs = match[6];

        // Check item_id_format (belt-and-suspenders; the regex already enforces
        // this, but emit the named rule for explicit diagnosis)
        if (!/^\d+\.\d+\.\d+$/.test(itemId)) {
          errors.push({
            file,
            line: lineNum,
            message: `Invalid item ID "${itemId}": must match \\d+\\.\\d+\\.\\d+`,
            rule: 'CLAIMS.item_id_format',
          });
        }

        // Check claimant_format
        if (!claimant || claimant.includes('|') || hasControlChar(claimant)) {
          errors.push({
            file,
            line: lineNum,
            message: `Invalid claimant "${claimant}": must be non-empty and contain no pipe or control characters`,
            rule: 'CLAIMS.claimant_format',
          });
        }

        // Warn if released/expired entries lack a release timestamp
        if ((status === 'released' || status === 'expired') && !hasReleaseTs) {
          warnings.push({
            file,
            line: lineNum,
            message: `${status} claim entry is missing a release timestamp`,
            suggestion: `Add a release timestamp: ... | YYYY-MM-DDTHH:MM:SSZ`,
          });
        }

        // Check timestamp_order: RELEASE_TS must be strictly after CLAIMED_AT
        if (hasReleaseTs) {
          const claimedAtDate = new Date(claimedAt);
          const releaseTsDate = new Date(releaseTs);
          if (releaseTsDate <= claimedAtDate) {
            errors.push({
              file,
              line: lineNum,
              message: `Release timestamp "${releaseTs}" must be strictly after claimed timestamp "${claimedAt}"`,
              rule: 'CLAIMS.timestamp_order',
            });
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
