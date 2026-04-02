/**
 * Workflow Runner Types
 *
 * Defines the interface for triggering and tracking GLaDOS agent workflows
 * from the Wheatley board.
 */

export type WorkflowType = 'plan' | 'spec' | 'implement' | 'verify';
export type WorkflowState = 'queued' | 'running' | 'waiting_for_input' | 'done' | 'error' | 'cancelled';
export type WorkflowMode = 'autonomous' | 'interactive';

export interface WorkflowRun {
  id: string;
  cardId: string;
  type: WorkflowType;
  state: WorkflowState;
  mode: WorkflowMode;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  /** The prompt text when state is 'waiting_for_input'. */
  pendingPrompt?: string;
  /** True when the workflow has transitioned to autonomous execution phase. */
  autonomousPhase?: boolean;
  /** Last N lines of output for streaming */
  outputTail: string[];
}

export interface WorkflowContext {
  cardId: string;
  specDir?: string;
  branch?: string;
  mode?: WorkflowMode;
}

export interface WorkflowRunner {
  /** Start a workflow. Returns the run ID. */
  start(type: WorkflowType, context: WorkflowContext): Promise<string>;

  /** Get the current state of a run. */
  getState(runId: string): Promise<WorkflowRun | null>;

  /** Stream output lines from a running workflow. */
  getOutput(runId: string, fromLine?: number): Promise<string[]>;

  /** Send user input to a workflow waiting for input. */
  sendInput(runId: string, text: string): Promise<void>;

  /** Cancel a running workflow. */
  cancel(runId: string): Promise<void>;

  /** List active runs. */
  listActive(): Promise<WorkflowRun[]>;
}
