/**
 * Null Workflow Runner
 *
 * No-op implementation used when WHEATLEY_GLADOS_CMD is not set.
 * All mutating operations throw; read operations return empty results.
 */

import type { WorkflowRunner, WorkflowType, WorkflowContext, WorkflowRun } from './types.js';

export class NullRunner implements WorkflowRunner {
  async start(_type: WorkflowType, _context: WorkflowContext): Promise<string> {
    throw new Error(
      'GLaDOS workflows are not configured. Set WHEATLEY_GLADOS_CMD environment variable ' +
      '(e.g., WHEATLEY_GLADOS_CMD=claude) and restart the server.',
    );
  }

  async getState(_runId: string): Promise<WorkflowRun | null> {
    return null;
  }

  async getOutput(_runId: string, _fromLine?: number): Promise<string[]> {
    return [];
  }

  async cancel(_runId: string): Promise<void> {
    // nothing to cancel
  }

  async listActive(): Promise<WorkflowRun[]> {
    return [];
  }
}
