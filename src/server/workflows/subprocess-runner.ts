/**
 * Subprocess Workflow Runner
 *
 * Spawns GLaDOS CLI commands as child processes and tracks their lifecycle.
 * Supports interactive mode via stream-json I/O with prompt fence detection
 * (:::prompt / :::) and autonomous mode with auto-answer from config.
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
  /** Whether this run uses stream-json protocol. */
  streamJson: boolean;
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

/**
 * Build CLI args. When mode is set, uses stream-json output for structured
 * parsing. Autonomous mode injects pre-supplied context so Claude doesn't
 * need to ask interactive questions.
 */
interface PromptConfig {
  autonomousContext?: string;
  preamble?: string;
  postamble?: string;
}

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

  // Assemble prompt: preamble → command → autonomous context → fence instructions → postamble
  const parts: string[] = [];

  // Preamble: persistent boilerplate (e.g., "run in Docker", "use vitest")
  if (config.preamble) {
    parts.push(resolveTemplate(config.preamble, context));
  }

  parts.push(command);

  // For autonomous mode: inject pre-supplied context so Claude doesn't
  // need to ask questions (since -p is single-shot).
  if (context.mode === 'autonomous' && config.autonomousContext) {
    parts.push(resolveTemplate(config.autonomousContext, context));
  }

  // For interactive mode: add fence instructions so output is parseable,
  // even though true multi-turn isn't yet possible via CLI.
  if (context.mode === 'interactive') {
    parts.push(PROMPT_FENCE_INSTRUCTIONS);
  }

  // Postamble: post-run steps (e.g., "commit changes", "push to branch")
  if (config.postamble) {
    parts.push(resolveTemplate(config.postamble, context));
  }

  const prompt = parts.join('\n\n');

  if (context.mode) {
    // Stream-json output for structured parsing of Claude's responses.
    return [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
    ];
  }

  // Legacy mode: simple single-shot execution
  return ['-p', prompt];
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
    const useStreamJson = !!context.mode;
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
      streamJson: useStreamJson,
    };
    this.runs.set(id, entry);

    // Allow per-run overrides of preamble/postamble via contextHints
    const preamble = context.contextHints?.['_preamble'] ?? typeConfig.preamble;
    const postamble = context.contextHints?.['_postamble'] ?? typeConfig.postamble;

    // Spawn the process
    const args = buildArgs(type, context, {
      autonomousContext: typeConfig.autonomousContext,
      preamble,
      postamble,
    });
    const child = spawn(this.cmd, args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    entry.process = child;
    entry.stdin = child.stdin ?? null;
    entry.run.state = 'running';

    if (useStreamJson) {
      this.attachStreamJsonHandlers(entry, child, id, type, context);
    } else {
      this.attachLegacyHandlers(entry, child, id, type, context);
    }

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

    this.pushLine(entry, `> ${text}`);

    if (entry.streamJson) {
      // Send as stream-json user_message
      const msg = JSON.stringify({
        type: 'user_message',
        content: text,
      });
      entry.stdin.write(msg + '\n');
    } else {
      // Legacy: raw text to stdin
      entry.stdin.write(text + '\n');
    }

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
  // Stream-JSON I/O handlers (interactive/autonomous mode)
  // ---------------------------------------------------------------------------

  private attachStreamJsonHandlers(
    entry: RunEntry,
    child: ChildProcess,
    runId: string,
    type: WorkflowType,
    context: WorkflowContext,
  ): void {
    let stdoutBuffer = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString('utf-8');
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? ''; // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as { type: string; [key: string]: unknown };
          this.handleStreamJsonMessage(entry, msg);
        } catch {
          // Not valid JSON — treat as raw output
          this.handleTextLine(entry, line);
        }
      }
    });

    // stderr is always raw text
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      for (const line of text.split('\n')) {
        if (line.trim()) this.pushLine(entry, `[stderr] ${line}`);
      }
    });

    this.attachProcessLifecycle(entry, child, runId, type, context);
  }

  /**
   * Parse a stream-json message from Claude CLI stdout.
   * We extract text content from assistant messages and look for prompt fences.
   */
  private handleStreamJsonMessage(
    entry: RunEntry,
    msg: { type: string; [key: string]: unknown },
  ): void {
    if (msg.type === 'assistant') {
      // Full assistant message — extract text content
      const message = msg.message as { content?: Array<{ type: string; text?: string }> } | undefined;
      if (message?.content) {
        for (const block of message.content) {
          if (block.type === 'text' && block.text) {
            // Process text line by line through the fence parser
            for (const line of block.text.split('\n')) {
              this.handleTextLine(entry, line);
            }
          }
        }
      }
    } else if (msg.type === 'result') {
      // Final result — extract any remaining text
      const result = msg.result as string | undefined;
      if (result) {
        for (const line of result.split('\n')) {
          if (line.trim()) this.handleTextLine(entry, line);
        }
      }
    }
    // Ignore other message types (system, rate_limit_event, etc.)
  }

  // ---------------------------------------------------------------------------
  // Legacy text I/O handlers (no mode specified)
  // ---------------------------------------------------------------------------

  private attachLegacyHandlers(
    entry: RunEntry,
    child: ChildProcess,
    runId: string,
    type: WorkflowType,
    context: WorkflowContext,
  ): void {
    const handleData = (data: Buffer): void => {
      const text = data.toString('utf-8');
      for (const line of text.split('\n')) {
        if (line.length > 0) {
          this.handleTextLine(entry, line);
        }
      }
    };

    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);

    this.attachProcessLifecycle(entry, child, runId, type, context);
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private attachProcessLifecycle(
    entry: RunEntry,
    child: ChildProcess,
    runId: string,
    type: WorkflowType,
    context: WorkflowContext,
  ): void {
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
        runId,
        detail: `Workflow ${type} ${code === 0 ? 'completed' : 'failed'} for ${context.cardId}`,
      });
    });

    child.on('error', (err) => {
      this.pushLine(entry, `[spawn error] ${err.message}`);
      entry.run.state = 'error';
      entry.run.finishedAt = new Date().toISOString();
      entry.process = null;
      entry.stdin = null;
    });
  }

  private pushLine(entry: RunEntry, line: string): void {
    if (entry.lines.length >= MAX_OUTPUT_LINES) {
      entry.lines.shift();
    }
    entry.lines.push(line);
    entry.run.outputTail = entry.lines.slice();
  }

  /**
   * Process a line of text through the prompt fence parser.
   */
  private handleTextLine(entry: RunEntry, line: string): void {
    // Check for autonomous phase marker
    if (line.trim() === PHASE_AUTONOMOUS) {
      entry.run.autonomousPhase = true;
      this.pushLine(entry, '[Entering autonomous execution phase]');
      return;
    }

    if (entry.inPromptBlock) {
      // Check for closing fence
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
    if (line.trim()) {
      this.pushLine(entry, line);
    }
  }

  /**
   * Handle a detected prompt block. In autonomous mode, auto-answer.
   * In interactive mode, set state to waiting_for_input.
   */
  private handlePromptDetected(entry: RunEntry, promptText: string): void {
    // In autonomous phase, always auto-answer
    if (entry.run.mode === 'autonomous' || entry.run.autonomousPhase) {
      const answer = this.findAutoAnswer(entry.autoAnswers, promptText);
      if (answer && entry.stdin && !entry.stdin.destroyed) {
        this.pushLine(entry, `[auto] ${promptText}`);
        this.pushLine(entry, `> ${answer}`);

        if (entry.streamJson) {
          const msg = JSON.stringify({ type: 'user_message', content: answer });
          entry.stdin.write(msg + '\n');
        } else {
          entry.stdin.write(answer + '\n');
        }
        return;
      }
      // No auto-answer available — fall through to waiting_for_input
    }

    // Interactive mode: surface the prompt
    this.pushLine(entry, `[prompt] ${promptText}`);
    entry.run.pendingPrompt = promptText;
    entry.run.state = 'waiting_for_input';

    this.eventBus?.emit({
      type: 'workflow-prompt',
      timestamp: new Date().toISOString(),
      runId: entry.run.id,
      detail: promptText,
    });
  }

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
