/**
 * Null Workflow Runner
 *
 * No-op implementation used when WHEATLEY_GLADOS_CMD is not set.
 * All mutating operations throw; read operations return empty results.
 */

import type { WorkflowRunner, WorkflowType, WorkflowContext, WorkflowRun } from './types.js';

export class NullRunner implements WorkflowRunner {
  async start(_type: WorkflowType, _context: WorkflowContext): Promise<string> {
    throw new Error('Workflows not configured');
  }

  async getState(_runId: string): Promise<WorkflowRun | null> {
    return null;
  }

  async getOutput(_runId: string, _fromLine?: number): Promise<string[]> {
    return [];
  }

  async sendInput(_runId: string, _text: string): Promise<void> {
    throw new Error('Workflows not configured');
  }

  async cancel(_runId: string): Promise<void> {
    // nothing to cancel
  }

  async listActive(): Promise<WorkflowRun[]> {
    return [];
  }
}
