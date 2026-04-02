/**
 * Subprocess Workflow Runner
 *
 * Spawns GLaDOS CLI commands as child processes and tracks their lifecycle.
 * Supports interactive mode with prompt fence detection (:::prompt / :::)
 * and autonomous mode with auto-answer from config.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import crypto from 'node:crypto';
import type {
  WorkflowRunner,
  WorkflowType,
  WorkflowContext,
  WorkflowRun,
  WorkflowState,
  WorkflowMode,
} from './types.js';
import type { EventBus } from '../api/event-bus.js';
import type { WorkflowConfigMap } from './config.js';
import { getWorkflowTypeConfig } from './config.js';

const MAX_OUTPUT_LINES = 500;
const COMPLETED_RUN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_COMPLETED_RUNS = 50;

const PROMPT_OPEN = ':::prompt';
const PROMPT_CLOSE = ':::';
const PHASE_AUTONOMOUS = ':::phase autonomous';

interface RunEntry {
  run: WorkflowRun;
  process: ChildProcess | null;
  stdin: Writable | null;
  /** Full ring-buffer of output lines (max MAX_OUTPUT_LINES). */
  lines: string[];
  /** Prompt fence parser state. */
  inPromptBlock: boolean;
  promptBuffer: string[];
  /** Auto-answers for autonomous mode. */
  autoAnswers: Record<string, string>;
}

function generateRunId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  return `wf-${ts}-${rand}`;
}

const PROMPT_FENCE_INSTRUCTIONS = `
IMPORTANT — Wheatley Interactive Protocol:
You are running through Wheatley's web UI. When you need user input, wrap your question in prompt fences exactly like this:

:::prompt
Your question here?
:::

Wait for the user's response before proceeding. Only use this format for questions that require user input — NOT for status messages or output.

When you have finished all interactive questions and are about to begin long-running autonomous work (e.g., the implementation loop), emit this marker on its own line:

:::phase autonomous

This signals to the UI that the user can step away.
`.trim();

function buildArgs(type: WorkflowType, context: WorkflowContext): string[] {
  const target = context.specDir ?? context.cardId;
  const fenceInstructions = context.mode ? `\n\n${PROMPT_FENCE_INSTRUCTIONS}` : '';

  switch (type) {
    case 'plan':
      return ['-p', `Run /glados:plan-feature for card ${context.cardId}${fenceInstructions}`];
    case 'spec':
      return ['-p', `Run /glados:spec-feature for ${target}${fenceInstructions}`];
    case 'implement':
      return ['-p', `Run /glados:implement-feature for ${target}${fenceInstructions}`];
    case 'verify':
      return ['-p', `Run /glados:verify-feature for ${target}${fenceInstructions}`];
  }
}

export class SubprocessRunner implements WorkflowRunner {
  private readonly runs = new Map<string, RunEntry>();
  private readonly cmd: string;
  private readonly cwd: string;
  private readonly maxConcurrent: number;
  private readonly eventBus: EventBus | undefined;
  private readonly configs: WorkflowConfigMap;

  constructor(eventBus?: EventBus, configs?: WorkflowConfigMap) {
    this.cmd = process.env['WHEATLEY_GLADOS_CMD'] ?? 'claude';
    this.cwd = process.env['WHEATLEY_REPO_PATH'] ?? '.';
    this.maxConcurrent = Math.max(
      1,
      parseInt(process.env['WHEATLEY_MAX_WORKFLOWS'] ?? '3', 10) || 3,
    );
    this.eventBus = eventBus;
    this.configs = configs ?? {};
  }

  async start(type: WorkflowType, context: WorkflowContext): Promise<string> {
    this.evictCompleted();
    const activeCount = this.countActive();
    if (activeCount >= this.maxConcurrent) {
      throw new Error(
        `Concurrent workflow limit reached (${this.maxConcurrent}). Cancel a running workflow first.`,
      );
    }

    const mode: WorkflowMode = context.mode ?? 'interactive';
    const id = generateRunId();
    const now = new Date().toISOString();

    const run: WorkflowRun = {
      id,
      cardId: context.cardId,
      type,
      state: 'queued',
      mode,
      startedAt: now,
      outputTail: [],
    };

    // Build auto-answers from config for autonomous mode
    const typeConfig = getWorkflowTypeConfig(this.configs, type);
    const autoAnswers: Record<string, string> = mode === 'autonomous'
      ? { ...typeConfig.autoAnswers }
      : {};

    const entry: RunEntry = {
      run,
      process: null,
      stdin: null,
      lines: [],
      inPromptBlock: false,
      promptBuffer: [],
      autoAnswers,
    };
    this.runs.set(id, entry);

    // Spawn the process — stdin is now piped for interactive support
    const args = buildArgs(type, context);
    const child = spawn(this.cmd, args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    entry.process = child;
    entry.stdin = child.stdin ?? null;
    entry.run.state = 'running';

    const pushLine = (line: string): void => {
      if (entry.lines.length >= MAX_OUTPUT_LINES) {
        entry.lines.shift();
      }
      entry.lines.push(line);
      entry.run.outputTail = entry.lines.slice();
    };

    const handleLine = (line: string): void => {
      // Check for autonomous phase marker
      if (line.trim() === PHASE_AUTONOMOUS) {
        entry.run.autonomousPhase = true;
        pushLine('[Entering autonomous execution phase]');
        return;
      }

      if (entry.inPromptBlock) {
        // Check for closing fence (a line that is exactly ':::' and not ':::prompt' or ':::phase')
        if (line.trim() === PROMPT_CLOSE) {
          entry.inPromptBlock = false;
          const promptText = entry.promptBuffer.join('\n').trim();
          entry.promptBuffer = [];

          if (promptText) {
            this.handlePromptDetected(entry, promptText);
          }
          return;
        }
        entry.promptBuffer.push(line);
        return;
      }

      // Check for opening fence
      if (line.trim() === PROMPT_OPEN) {
        entry.inPromptBlock = true;
        entry.promptBuffer = [];
        return;
      }

      // Normal output line
      pushLine(line);
    };

    const handleData = (data: Buffer): void => {
      const text = data.toString('utf-8');
      for (const line of text.split('\n')) {
        if (line.length > 0) {
          handleLine(line);
        }
      }
    };

    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);

    child.on('close', (code) => {
      entry.run.exitCode = code ?? undefined;
      entry.run.state = code === 0 ? 'done' : 'error';
      entry.run.finishedAt = new Date().toISOString();
      entry.run.pendingPrompt = undefined;
      entry.process = null;
      entry.stdin = null;

      this.eventBus?.emit({
        type: 'workflow-done',
        timestamp: new Date().toISOString(),
        runId: id,
        detail: `Workflow ${type} ${code === 0 ? 'completed' : 'failed'} for ${context.cardId}`,
      });
    });

    child.on('error', (err) => {
      pushLine(`[spawn error] ${err.message}`);
      entry.run.state = 'error';
      entry.run.finishedAt = new Date().toISOString();
      entry.process = null;
      entry.stdin = null;
    });

    return id;
  }

  async getState(runId: string): Promise<WorkflowRun | null> {
    const entry = this.runs.get(runId);
    return entry ? { ...entry.run } : null;
  }

  async getOutput(runId: string, fromLine?: number): Promise<string[]> {
    const entry = this.runs.get(runId);
    if (!entry) return [];
    const start = fromLine ?? 0;
    return entry.lines.slice(start);
  }

  async sendInput(runId: string, text: string): Promise<void> {
    const entry = this.runs.get(runId);
    if (!entry) {
      throw new Error('Run not found');
    }
    if (entry.run.state !== 'waiting_for_input') {
      throw new Error(`Run is not waiting for input (state: ${entry.run.state})`);
    }
    if (!entry.stdin || entry.stdin.destroyed) {
      throw new Error('stdin is not available');
    }

    // Echo the user response in output
    const pushLine = (line: string): void => {
      if (entry.lines.length >= MAX_OUTPUT_LINES) {
        entry.lines.shift();
      }
      entry.lines.push(line);
      entry.run.outputTail = entry.lines.slice();
    };

    pushLine(`> ${text}`);

    // Write to stdin
    entry.stdin.write(text + '\n');

    // Clear prompt state
    entry.run.pendingPrompt = undefined;
    entry.run.state = 'running';
  }

  async cancel(runId: string): Promise<void> {
    const entry = this.runs.get(runId);
    if (!entry) return;

    if (entry.process && !entry.process.killed) {
      entry.process.kill('SIGTERM');
    }
    entry.run.state = 'cancelled';
    entry.run.finishedAt = new Date().toISOString();
    entry.run.pendingPrompt = undefined;
    entry.process = null;
    entry.stdin = null;
  }

  async listActive(): Promise<WorkflowRun[]> {
    const active: WorkflowRun[] = [];
    for (const entry of this.runs.values()) {
      if (
        entry.run.state === 'queued' ||
        entry.run.state === 'running' ||
        entry.run.state === 'waiting_for_input'
      ) {
        active.push({ ...entry.run });
      }
    }
    return active;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Handle a detected prompt block. In autonomous mode, auto-answer.
   * In interactive mode, set state to waiting_for_input.
   */
  private handlePromptDetected(entry: RunEntry, promptText: string): void {
    const pushLine = (line: string): void => {
      if (entry.lines.length >= MAX_OUTPUT_LINES) {
        entry.lines.shift();
      }
      entry.lines.push(line);
      entry.run.outputTail = entry.lines.slice();
    };

    // In autonomous phase, always auto-answer
    if (entry.run.mode === 'autonomous' || entry.run.autonomousPhase) {
      const answer = this.findAutoAnswer(entry.autoAnswers, promptText);
      if (answer && entry.stdin && !entry.stdin.destroyed) {
        pushLine(`[auto] ${promptText}`);
        pushLine(`> ${answer}`);
        entry.stdin.write(answer + '\n');
        return;
      }
      // No auto-answer available — fall through to waiting_for_input
      // even in autonomous mode so the user can intervene
    }

    // Interactive mode: surface the prompt
    pushLine(`[prompt] ${promptText}`);
    entry.run.pendingPrompt = promptText;
    entry.run.state = 'waiting_for_input';

    this.eventBus?.emit({
      type: 'workflow-prompt',
      timestamp: new Date().toISOString(),
      runId: entry.run.id,
      detail: promptText,
    });
  }

  /**
   * Find an auto-answer by matching prompt text against known substrings.
   */
  private findAutoAnswer(autoAnswers: Record<string, string>, promptText: string): string | undefined {
    const lower = promptText.toLowerCase();
    for (const [substring, answer] of Object.entries(autoAnswers)) {
      if (lower.includes(substring.toLowerCase())) {
        return answer;
      }
    }
    return undefined;
  }

  private countActive(): number {
    let count = 0;
    for (const entry of this.runs.values()) {
      if (
        entry.run.state === 'queued' ||
        entry.run.state === 'running' ||
        entry.run.state === 'waiting_for_input'
      ) {
        count++;
      }
    }
    return count;
  }

  /** Evict completed runs older than TTL and cap total stored runs. */
  private evictCompleted(): void {
    const now = Date.now();
    const completed: Array<[string, RunEntry]> = [];
    for (const [id, entry] of this.runs) {
      const state = entry.run.state;
      if (state === 'done' || state === 'error' || state === 'cancelled') {
        completed.push([id, entry]);
        if (entry.run.finishedAt) {
          const elapsed = now - new Date(entry.run.finishedAt).getTime();
          if (elapsed > COMPLETED_RUN_TTL_MS) {
            this.runs.delete(id);
          }
        }
      }
    }
    // If still over limit, evict oldest completed runs
    if (completed.length > MAX_COMPLETED_RUNS) {
      completed.sort((a, b) => {
        const aTime = a[1].run.finishedAt ?? a[1].run.startedAt;
        const bTime = b[1].run.finishedAt ?? b[1].run.startedAt;
        return aTime.localeCompare(bTime);
      });
      const toEvict = completed.length - MAX_COMPLETED_RUNS;
      for (let i = 0; i < toEvict; i++) {
        this.runs.delete(completed[i][0]);
      }
    }
  }
}
