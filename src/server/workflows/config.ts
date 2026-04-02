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
    ],
    autoAnswers: {},
  },
  spec: {
    defaultMode: 'interactive',
    showLaunchPanel: true,
    params: [],
    autoAnswers: {},
  },
  implement: {
    defaultMode: 'interactive',
    showLaunchPanel: true,
    params: [],
    autoAnswers: {},
  },
  verify: {
    defaultMode: 'autonomous',
    showLaunchPanel: false,
    params: [],
    autoAnswers: {},
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
