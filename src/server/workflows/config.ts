/**
 * Workflow Configuration
 *
 * Loads per-workflow-type configuration from `.wheatley/workflows.json`
 * in the repository. Defines default modes, auto-answer mappings, and
 * parameter schemas for the WorkflowLaunchPanel.
 */

import type { GitAdapter } from '../git/types.js';
import type { WorkflowType, WorkflowMode } from './types.js';

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
  /** Default execution mode when launching this workflow. */
  defaultMode: WorkflowMode;
  /** Whether to show the launch panel (false = auto-run with defaults). */
  showLaunchPanel: boolean;
  /** Parameters to present in the launch panel. */
  params: WorkflowParamConfig[];
  /**
   * Map of prompt substring → auto-response for autonomous mode.
   * When a :::prompt block contains the substring, respond with the value.
   */
  autoAnswers: Record<string, string>;
  /**
   * Template for autonomous execution context. Supports placeholders:
   * {{cardId}}, {{cardTitle}}, {{specDir}}, and any key from contextHints.
   * Appended to the prompt in autonomous mode to pre-supply answers
   * that Claude would normally ask the user for.
   */
  autonomousContext?: string;
  /**
   * Instructions prepended to every run of this workflow type, regardless
   * of mode. Use for persistent boilerplate: "run commands in Docker",
   * "commit to the branch when done", repo-specific conventions, etc.
   * Supports {{placeholders}} same as autonomousContext.
   */
  preamble?: string;
  /**
   * Instructions appended after the workflow completes its main work.
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
  defaultMode: 'interactive',
  showLaunchPanel: true,
  params: [],
  autoAnswers: {},
};

export const DEFAULT_WORKFLOW_CONFIGS: WorkflowConfigMap = {
  plan: {
    defaultMode: 'interactive',
    showLaunchPanel: true,
    params: [
      { key: 'featureName', label: 'Feature Name', type: 'text' },
      { key: 'goal', label: 'Goal', type: 'text' },
      { key: 'personas', label: 'Personas', type: 'text', default: 'all' },
    ],
    autoAnswers: {},
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
    defaultMode: 'interactive',
    showLaunchPanel: true,
    params: [],
    autoAnswers: {},
    autonomousContext: [
      'Pre-supplied answers (do NOT ask the user — use them directly):',
      '- Feature directory: {{specDir}}',
      '- For any clarifying questions, make reasonable decisions based on the existing plan.md and requirements.md.',
      'Proceed through all steps without asking questions.',
    ].join('\n'),
  },
  implement: {
    defaultMode: 'interactive',
    showLaunchPanel: true,
    params: [],
    autoAnswers: {},
    autonomousContext: [
      'Pre-supplied answers (do NOT ask the user — use them directly):',
      '- Feature directory: {{specDir}}',
      '- Task breakdown: Create the breakdown and proceed without waiting for review.',
      'Proceed through all steps without asking questions.',
    ].join('\n'),
  },
  verify: {
    defaultMode: 'autonomous',
    showLaunchPanel: false,
    params: [],
    autoAnswers: {},
    autonomousContext: [
      'Pre-supplied answers (do NOT ask the user — use them directly):',
      '- Feature directory: {{specDir}}',
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
          // Deep-merge params only if provided
          params: overrides.params ?? base.params,
          autoAnswers: { ...base.autoAnswers, ...overrides.autoAnswers },
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
