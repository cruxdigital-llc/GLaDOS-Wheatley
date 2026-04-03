/**
 * Workflow Configuration
 *
 * Loads per-workflow-type configuration from `.wheatley/workflows.json`
 * in the repository. Defines parameter schemas, autonomous context templates,
 * and preamble/postamble boilerplate for each workflow type.
 */

import type { GitAdapter } from '../git/types.js';
import type { WorkflowType } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowParamConfig {
  key: string;
  label: string;
  type: 'text' | 'select';
  default?: string;
  options?: string[];
}

export interface WorkflowConfig {
  /** Whether to show the launch panel (false = auto-run with defaults). */
  showLaunchPanel: boolean;
  /** Parameters to present in the launch panel. */
  params: WorkflowParamConfig[];
  /**
   * Template for autonomous execution context. Supports placeholders:
   * {{cardId}}, {{cardTitle}}, {{specDir}}, and any key from contextHints.
   * Appended to the prompt to pre-supply answers that Claude would
   * normally ask the user for.
   */
  autonomousContext?: string;
  /**
   * Instructions prepended to every run of this workflow type.
   * Use for persistent boilerplate: "run in Docker", "use vitest", etc.
   * Supports {{placeholders}}.
   */
  preamble?: string;
  /**
   * Instructions appended after the workflow's main work.
   * Use for post-run steps: "commit changes", "push to branch", etc.
   * Supports {{placeholders}}.
   */
  postamble?: string;
}

export type WorkflowConfigMap = Partial<Record<WorkflowType, WorkflowConfig>>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: WorkflowConfig = {
  showLaunchPanel: true,
  params: [],
};

export const DEFAULT_WORKFLOW_CONFIGS: WorkflowConfigMap = {
  plan: {
    showLaunchPanel: true,
    params: [
      { key: 'featureName', label: 'Feature Name', type: 'text' },
      { key: 'goal', label: 'Goal', type: 'text' },
      { key: 'personas', label: 'Personas', type: 'text', default: 'all' },
    ],
    autonomousContext: [
      'Pre-supplied answers (do NOT ask the user for these — use them directly):',
      '- Feature Name: {{featureName}}',
      '- Goal: {{goal}}',
      '- Personas: {{personas}}',
      '- Success Criteria: Derive from the goal and card context.',
      'Proceed through all steps without asking questions.',
    ].join('\n'),
  },
  spec: {
    showLaunchPanel: true,
    params: [
      { key: 'focusAreas', label: 'Focus Areas', type: 'text', default: 'data models, API interface, edge cases' },
    ],
    autonomousContext: [
      'Pre-supplied answers (do NOT ask the user — use them directly):',
      '- Feature directory: {{specDir}}',
      '- Focus areas for the specification: {{focusAreas}}',
      '- For any clarifying questions, make reasonable decisions based on the existing plan.md and requirements.md.',
      'Proceed through all steps without asking questions.',
    ].join('\n'),
  },
  implement: {
    showLaunchPanel: true,
    params: [
      { key: 'approachNotes', label: 'Approach Notes', type: 'text' },
    ],
    autonomousContext: [
      'Pre-supplied answers (do NOT ask the user — use them directly):',
      '- Feature directory: {{specDir}}',
      '- Approach notes: {{approachNotes}}',
      '- Task breakdown: Create the breakdown and proceed without waiting for review.',
      'Proceed through all steps without asking questions.',
    ].join('\n'),
  },
  verify: {
    showLaunchPanel: true,
    params: [
      { key: 'verifyFocus', label: 'Verification Focus', type: 'text', default: 'test coverage, edge cases, spec alignment' },
    ],
    autonomousContext: [
      'Pre-supplied answers (do NOT ask the user — use them directly):',
      '- Feature directory: {{specDir}}',
      '- Verification focus: {{verifyFocus}}',
      'Proceed through all verification steps without asking questions.',
    ].join('\n'),
  },
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const CONFIG_PATH = '.wheatley/workflows.json';

/**
 * Load workflow configuration from the repository.
 * Returns merged config (repo overrides on top of defaults).
 */
export async function loadWorkflowConfig(adapter: GitAdapter): Promise<WorkflowConfigMap> {
  try {
    const raw = await adapter.readFile(CONFIG_PATH);
    if (!raw) return { ...DEFAULT_WORKFLOW_CONFIGS };
    const parsed = JSON.parse(raw) as Partial<Record<string, Partial<WorkflowConfig>>>;
    const result: WorkflowConfigMap = { ...DEFAULT_WORKFLOW_CONFIGS };

    for (const [key, overrides] of Object.entries(parsed)) {
      if (overrides && isValidWorkflowType(key)) {
        const base = result[key] ?? DEFAULT_CONFIG;
        result[key] = {
          ...base,
          ...overrides,
          params: overrides.params ?? base.params,
        };
      }
    }

    return result;
  } catch {
    // File doesn't exist or is invalid — use defaults
    return { ...DEFAULT_WORKFLOW_CONFIGS };
  }
}

/**
 * Get config for a specific workflow type.
 */
export function getWorkflowTypeConfig(
  configs: WorkflowConfigMap,
  type: WorkflowType,
): WorkflowConfig {
  return configs[type] ?? DEFAULT_CONFIG;
}

function isValidWorkflowType(key: string): key is WorkflowType {
  return key === 'plan' || key === 'spec' || key === 'implement' || key === 'verify';
}
