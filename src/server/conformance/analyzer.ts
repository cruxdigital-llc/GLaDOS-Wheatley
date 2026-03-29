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
