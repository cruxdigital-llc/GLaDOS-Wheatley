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
  let expectedSection = 1;
  let expectedItem = 1;

  for (let i = titleLine + 1; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const lineNum = i + 1;

    // Phase heading
    const phaseMatch = line.match(PHASE_HEADING_RE);
    if (phaseMatch) {
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
      continue;
    }

    // Goal line
    if (GOAL_RE.test(line)) {
      continue;
    }

    // Section heading
    const sectionMatch = line.match(SECTION_HEADING_RE);
    if (sectionMatch) {
      const sectionId = sectionMatch[1];
      const expectedId = `${currentPhase}.${expectedSection}`;
      if (sectionId !== expectedId) {
        warnings.push({
          file,
          line: lineNum,
          message: `Section ID "${sectionId}" — expected "${expectedId}"`,
          suggestion: `Renumber to ${expectedId}`,
        });
      }
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
          message: `Malformed item ID "${itemId}" — expected X.Y.Z format`,
          rule: 'ITEM_ID.format',
        });
      }
      continue;
    }

    // Check for malformed checkboxes
    if (line.match(/^- \[[ x]?\]/)) {
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

const PHASE_FILES: Record<string, BoardPhase> = {
  'tasks.md': 'implementing',
  'spec.md': 'speccing',
  'plan.md': 'planning',
  'requirements.md': 'planning',
  'README.md': 'unclaimed',
};

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

export function detectPhaseFromFiles(files: string[]): BoardPhase {
  const has = (f: string) => files.includes(f);

  if (has('tasks.md')) {
    // Would need to check task completion for verifying/done,
    // but that requires reading file contents — beyond this validator's scope.
    // Parsers (feature 1.2) will handle the full detection.
    return 'implementing';
  }
  if (has('spec.md')) return 'speccing';
  if (has('plan.md') || has('requirements.md')) return 'planning';
  return 'unclaimed';
}

// --- PROJECT_STATUS.md Validator ---

const FOCUS_SECTION_RE = /^### \d+\. .+$/;
const TASK_LINE_RE = /^- \[([ x])\] \*\*(.+?)\*\*: (.+)$/;
const LEAD_RE = /^\*Lead: (.+)\*$/;
const CHANGE_LINE_RE = /^- \d{4}-\d{2}-\d{2}: .+$/;

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

  // Validate task lines in Current Focus
  let inFocus = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const lineNum = i + 1;

    if (line === '## Current Focus') {
      inFocus = true;
      continue;
    }
    if (inFocus && line.startsWith('## ')) {
      inFocus = false;
      continue;
    }

    if (inFocus && line.startsWith('- [')) {
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
      if (!CLAIM_ENTRY_RE.test(line)) {
        errors.push({
          file,
          line: lineNum,
          message: `Malformed claim entry: "${line}"`,
          rule: 'CLAIMS.entry_format',
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
