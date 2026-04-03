/**
 * Workflow Runner Types
 *
 * Defines the interface for triggering and tracking GLaDOS agent workflows
 * from the Wheatley board. All workflows run as single-shot autonomous
 * executions via Claude CLI -p.
 */

export type WorkflowType = 'plan' | 'spec' | 'implement' | 'verify';
export type WorkflowState = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface WorkflowRun {
  id: string;
  cardId: string;
  type: WorkflowType;
  state: WorkflowState;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  /** Last N lines of output for streaming */
  outputTail: string[];
}

export interface WorkflowContext {
  cardId: string;
  cardTitle?: string;
  specDir?: string;
  branch?: string;
  /**
   * Key-value pairs from the launch panel (params + preamble/postamble overrides).
   * These are injected into the prompt via autonomousContext templates.
   * Special keys: _preamble, _postamble override config defaults for this run.
   */
  contextHints?: Record<string, string>;
}

export interface WorkflowRunner {
  /** Start a workflow. Returns the run ID. */
  start(type: WorkflowType, context: WorkflowContext): Promise<string>;

  /** Get the current state of a run. */
  getState(runId: string): Promise<WorkflowRun | null>;

  /** Stream output lines from a running workflow. */
  getOutput(runId: string, fromLine?: number): Promise<string[]>;

  /** Cancel a running workflow. */
  cancel(runId: string): Promise<void>;

  /** List active runs. */
  listActive(): Promise<WorkflowRun[]>;
}
