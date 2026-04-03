/**
 * Subprocess Workflow Runner
 *
 * Spawns GLaDOS CLI commands as child processes and tracks their lifecycle.
 * All workflows run as single-shot autonomous executions via `claude -p`.
 * The prompt is assembled from: preamble + command + autonomousContext + postamble,
 * with {{placeholders}} resolved from card context and launch panel params.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import type {
  WorkflowRunner,
  WorkflowType,
  WorkflowContext,
  WorkflowRun,
} from './types.js';
import type { EventBus } from '../api/event-bus.js';
import type { WorkflowConfigMap } from './config.js';
import { getWorkflowTypeConfig } from './config.js';

const MAX_OUTPUT_LINES = 500;
const COMPLETED_RUN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_COMPLETED_RUNS = 50;

interface RunEntry {
  run: WorkflowRun;
  process: ChildProcess | null;
  /** Full ring-buffer of output lines (max MAX_OUTPUT_LINES). */
  lines: string[];
}

function generateRunId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  return `wf-${ts}-${rand}`;
}

/**
 * Resolve placeholders like {{cardTitle}} in a template string using
 * WorkflowContext fields and contextHints.
 */
function resolveTemplate(template: string, context: WorkflowContext): string {
  const vars: Record<string, string> = {
    cardId: context.cardId,
    cardTitle: context.cardTitle ?? context.cardId,
    specDir: context.specDir ?? context.cardId,
    ...context.contextHints,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? `[${key}]`);
}

interface PromptConfig {
  autonomousContext?: string;
  preamble?: string;
  postamble?: string;
}

/**
 * Build CLI args for a single-shot workflow execution.
 * Assembles: preamble → command → autonomousContext → postamble.
 */
function buildArgs(
  type: WorkflowType,
  context: WorkflowContext,
  config: PromptConfig,
): string[] {
  const target = context.specDir ?? context.cardId;

  // Core workflow command
  let command: string;
  switch (type) {
    case 'plan':
      command = `Run /glados:plan-feature for card ${context.cardId}`;
      break;
    case 'spec':
      command = `Run /glados:spec-feature for ${target}`;
      break;
    case 'implement':
      command = `Run /glados:implement-feature for ${target}`;
      break;
    case 'verify':
      command = `Run /glados:verify-feature for ${target}`;
      break;
  }

  // Assemble prompt: preamble → command → autonomous context → postamble
  const parts: string[] = [];

  if (config.preamble) {
    parts.push(resolveTemplate(config.preamble, context));
  }

  parts.push(command);

  if (config.autonomousContext) {
    parts.push(resolveTemplate(config.autonomousContext, context));
  }

  if (config.postamble) {
    parts.push(resolveTemplate(config.postamble, context));
  }

  return ['-p', parts.join('\n\n')];
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

    const id = generateRunId();
    const now = new Date().toISOString();

    const run: WorkflowRun = {
      id,
      cardId: context.cardId,
      type,
      state: 'queued',
      startedAt: now,
      outputTail: [],
    };

    const entry: RunEntry = { run, process: null, lines: [] };
    this.runs.set(id, entry);

    // Resolve preamble/postamble: per-run overrides via contextHints, else config
    const typeConfig = getWorkflowTypeConfig(this.configs, type);
    const preamble = context.contextHints?.['_preamble'] ?? typeConfig.preamble;
    const postamble = context.contextHints?.['_postamble'] ?? typeConfig.postamble;

    const args = buildArgs(type, context, {
      autonomousContext: typeConfig.autonomousContext,
      preamble,
      postamble,
    });

    const child = spawn(this.cmd, args, {
      cwd: this.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    entry.process = child;
    entry.run.state = 'running';

    const pushLine = (line: string): void => {
      if (entry.lines.length >= MAX_OUTPUT_LINES) {
        entry.lines.shift();
      }
      entry.lines.push(line);
      // Defer outputTail snapshot to getState/getOutput to avoid copying on every line
    };

    const handleData = (data: Buffer): void => {
      const text = data.toString('utf-8');
      for (const line of text.split('\n')) {
        if (line.length > 0) {
          pushLine(line);
        }
      }
    };

    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);

    child.on('close', (code) => {
      entry.run.exitCode = code ?? undefined;
      entry.run.state = code === 0 ? 'done' : 'error';
      entry.run.finishedAt = new Date().toISOString();
      entry.process = null;

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
    });

    return id;
  }

  async getState(runId: string): Promise<WorkflowRun | null> {
    const entry = this.runs.get(runId);
    if (!entry) return null;
    return { ...entry.run, outputTail: entry.lines.slice() };
  }

  async getOutput(runId: string, fromLine?: number): Promise<string[]> {
    const entry = this.runs.get(runId);
    if (!entry) return [];
    const start = fromLine ?? 0;
    return entry.lines.slice(start);
  }

  async cancel(runId: string): Promise<void> {
    const entry = this.runs.get(runId);
    if (!entry) return;

    if (entry.process && !entry.process.killed) {
      entry.process.kill('SIGTERM');
    }
    entry.run.state = 'cancelled';
    entry.run.finishedAt = new Date().toISOString();
    entry.process = null;
  }

  async listActive(): Promise<WorkflowRun[]> {
    const active: WorkflowRun[] = [];
    for (const entry of this.runs.values()) {
      if (entry.run.state === 'queued' || entry.run.state === 'running') {
        active.push({ ...entry.run });
      }
    }
    return active;
  }

  private countActive(): number {
    let count = 0;
    for (const entry of this.runs.values()) {
      if (entry.run.state === 'queued' || entry.run.state === 'running') {
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
