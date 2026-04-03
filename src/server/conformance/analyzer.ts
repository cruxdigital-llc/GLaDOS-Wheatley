/**
 * Conformance Analyzer
 *
 * Analyzes a repository's conformance to the Wheatley parsing grammar.
 * Reports violations and optionally suggests fixes.
 */

import type { GitAdapter } from '../git/types.js';
import { validateRoadmap, validateProjectStatus, validateSpecDirectory, validateClaims } from '../../shared/grammar/validator.js';
import type { ValidationResult } from '../../shared/grammar/types.js';

export interface ConformanceViolation {
  file: string;
  severity: 'error' | 'warning';
  message: string;
  /** Whether this violation can be auto-fixed */
  fixable?: boolean;
  /** Description of the auto-fix that would be applied */
  fixDescription?: string;
}

export interface ConformanceReport {
  conforming: boolean;
  violations: ConformanceViolation[];
  summary: {
    filesChecked: number;
    errors: number;
    warnings: number;
  };
}

export async function analyzeConformance(adapter: GitAdapter, branch?: string): Promise<ConformanceReport> {
  const violations: ConformanceViolation[] = [];
  let filesChecked = 0;

  // Check ROADMAP.md
  const roadmapContent = await adapter.readFile('product-knowledge/ROADMAP.md', branch);
  if (roadmapContent) {
    filesChecked++;
    const result = validateRoadmap(roadmapContent);
    addViolations(violations, 'product-knowledge/ROADMAP.md', result);
  } else {
    violations.push({
      file: 'product-knowledge/ROADMAP.md',
      severity: 'error',
      message: 'File not found — required for board rendering',
    });
  }

  // Check PROJECT_STATUS.md
  const statusContent = await adapter.readFile('product-knowledge/PROJECT_STATUS.md', branch);
  if (statusContent) {
    filesChecked++;
    const result = validateProjectStatus(statusContent);
    addViolations(violations, 'product-knowledge/PROJECT_STATUS.md', result);
  }

  // Check claims.md (optional)
  const claimsContent = await adapter.readFile('product-knowledge/claims.md', branch);
  if (claimsContent) {
    filesChecked++;
    const result = validateClaims(claimsContent);
    addViolations(violations, 'product-knowledge/claims.md', result);
  }

  // Check spec directories
  const specDirs = await adapter.listDirectory('specs', branch);
  for (const dir of specDirs) {
    if (dir.type !== 'directory') continue;
    filesChecked++;

    const files = await adapter.listDirectory(`specs/${dir.name}`, branch);
    const fileNames = files.filter((f) => f.type === 'file').map((f) => f.name);
    const result = validateSpecDirectory(dir.name, fileNames);
    addViolations(violations, `specs/${dir.name}/`, result);
  }

  const errors = violations.filter((v) => v.severity === 'error').length;
  const warnings = violations.filter((v) => v.severity === 'warning').length;

  return {
    conforming: errors === 0,
    violations,
    summary: {
      filesChecked,
      errors,
      warnings,
    },
  };
}

export interface AutoFixResult {
  fixed: number;
  actions: string[];
  remaining: ConformanceReport;
}

/**
 * Attempt to auto-fix conformance violations.
 * Currently supports:
 * - Adding missing "# Roadmap" title
 * - Adding missing "**Goal**:" lines to phases
 * - Adding missing README.md to spec directories
 */
export async function autoFixConformance(
  adapter: GitAdapter,
  branch?: string,
): Promise<AutoFixResult> {
  const actions: string[] = [];

  // Fix ROADMAP.md issues
  const roadmapContent = await adapter.readFile('product-knowledge/ROADMAP.md', branch);
  if (roadmapContent) {
    let fixed = roadmapContent;

    // Add missing "# Roadmap" title
    if (!fixed.includes('# Roadmap')) {
      fixed = `# Roadmap\n\n${fixed}`;
      actions.push('Added missing "# Roadmap" title');
    }

    // Add missing **Goal**: lines after phase headings that lack them
    const lines = fixed.split('\n');
    const result: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      result.push(lines[i]);
      if (/^## Phase \d+:/.test(lines[i])) {
        // Check if next non-blank line is a Goal
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && !/^\*\*Goal\*\*:/.test(lines[j])) {
          result.push('');
          result.push('**Goal**: _TODO: Define the goal for this phase._');
          actions.push(`Added placeholder goal for ${lines[i].trim()}`);
        }
      }
    }
    fixed = result.join('\n');

    if (fixed !== roadmapContent) {
      await adapter.writeFile(
        'product-knowledge/ROADMAP.md',
        fixed,
        'conformance: auto-fix ROADMAP.md structure',
        branch,
      );
    }
  }

  // Fix spec directories missing README.md
  const specDirs = await adapter.listDirectory('specs', branch);
  for (const dir of specDirs) {
    if (dir.type !== 'directory') continue;
    const files = await adapter.listDirectory(`specs/${dir.name}`, branch);
    const fileNames = files.filter((f) => f.type === 'file').map((f) => f.name);
    if (!fileNames.includes('README.md')) {
      const readmeContent = `# ${dir.name.replace(/^\d{4}-\d{2}-\d{2}_\w+_/, '').replace(/-/g, ' ')}\n\n## Summary\n\n_TODO: Describe this feature._\n`;
      await adapter.writeFile(
        `specs/${dir.name}/README.md`,
        readmeContent,
        `conformance: add missing README.md to specs/${dir.name}`,
        branch,
      );
      actions.push(`Added README.md to specs/${dir.name}`);
    }
  }

  // Re-analyze to get remaining violations
  const remaining = await analyzeConformance(adapter, branch);

  return { fixed: actions.length, actions, remaining };
}

function addViolations(
  violations: ConformanceViolation[],
  file: string,
  result: ValidationResult,
): void {
  for (const error of result.errors) {
    violations.push({ file, severity: 'error', message: error.message });
  }
  for (const warning of result.warnings) {
    violations.push({ file, severity: 'warning', message: warning.message });
  }
}
