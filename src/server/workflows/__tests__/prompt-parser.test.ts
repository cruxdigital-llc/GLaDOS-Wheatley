import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowRun, WorkflowMode } from '../types.js';

/**
 * Tests for the prompt fence parsing logic used by SubprocessRunner.
 *
 * The parser detects :::prompt / ::: fences in workflow output and
 * transitions the run state to 'waiting_for_input'.
 */

// ---------------------------------------------------------------------------
// Minimal simulation of the parser logic from SubprocessRunner
// ---------------------------------------------------------------------------

interface ParseState {
  inPromptBlock: boolean;
  promptBuffer: string[];
  lines: string[];
  state: WorkflowRun['state'];
  pendingPrompt?: string;
  autonomousPhase?: boolean;
}

function createParseState(): ParseState {
  return {
    inPromptBlock: false,
    promptBuffer: [],
    lines: [],
    state: 'running',
  };
}

function handleLine(ps: ParseState, line: string): void {
  // Check for autonomous phase marker
  if (line.trim() === ':::phase autonomous') {
    ps.autonomousPhase = true;
    ps.lines.push('[Entering autonomous execution phase]');
    return;
  }

  if (ps.inPromptBlock) {
    // Check for closing fence
    if (line.trim() === ':::') {
      ps.inPromptBlock = false;
      const promptText = ps.promptBuffer.join('\n').trim();
      ps.promptBuffer = [];
      if (promptText) {
        ps.lines.push(`[prompt] ${promptText}`);
        ps.pendingPrompt = promptText;
        ps.state = 'waiting_for_input';
      }
      return;
    }
    ps.promptBuffer.push(line);
    return;
  }

  // Check for opening fence
  if (line.trim() === ':::prompt') {
    ps.inPromptBlock = true;
    ps.promptBuffer = [];
    return;
  }

  // Normal line
  ps.lines.push(line);
}

function feedLines(ps: ParseState, text: string): void {
  for (const line of text.split('\n')) {
    if (line.length > 0) {
      handleLine(ps, line);
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Prompt Fence Parser', () => {
  let ps: ParseState;

  beforeEach(() => {
    ps = createParseState();
  });

  it('passes normal output lines through unchanged', () => {
    feedLines(ps, 'Hello world\nStarting workflow...\nDone.');
    expect(ps.lines).toEqual(['Hello world', 'Starting workflow...', 'Done.']);
    expect(ps.state).toBe('running');
    expect(ps.pendingPrompt).toBeUndefined();
  });

  it('detects a simple prompt block', () => {
    feedLines(ps, ':::prompt\nWhat is the feature name?\n:::');
    expect(ps.state).toBe('waiting_for_input');
    expect(ps.pendingPrompt).toBe('What is the feature name?');
    expect(ps.lines).toContain('[prompt] What is the feature name?');
  });

  it('handles multi-line prompt blocks', () => {
    feedLines(ps, ':::prompt\nSelect a persona:\n1. Architect\n2. QA\n:::');
    expect(ps.state).toBe('waiting_for_input');
    expect(ps.pendingPrompt).toBe('Select a persona:\n1. Architect\n2. QA');
  });

  it('handles output before and after a prompt', () => {
    feedLines(ps, 'Loading context...\n:::prompt\nGoal?\n:::\nMore output');
    expect(ps.lines).toEqual([
      'Loading context...',
      '[prompt] Goal?',
      'More output',
    ]);
    // State should be running again since more output came after
    // (In real usage, state resets via sendInput, but parser doesn't auto-reset)
    expect(ps.pendingPrompt).toBe('Goal?');
  });

  it('ignores empty prompt blocks', () => {
    feedLines(ps, ':::prompt\n:::');
    expect(ps.state).toBe('running');
    expect(ps.pendingPrompt).toBeUndefined();
  });

  it('detects :::phase autonomous marker', () => {
    feedLines(ps, 'Setup done.\n:::phase autonomous\nImplementing...');
    expect(ps.autonomousPhase).toBe(true);
    expect(ps.lines).toEqual([
      'Setup done.',
      '[Entering autonomous execution phase]',
      'Implementing...',
    ]);
  });

  it('handles :::prompt with leading/trailing whitespace', () => {
    feedLines(ps, '  :::prompt  \n  What now?  \n  :::  ');
    expect(ps.state).toBe('waiting_for_input');
    expect(ps.pendingPrompt).toBe('What now?');
  });

  it('does not treat ::: inside normal text as a fence', () => {
    // A line containing ::: but not as the only content should not trigger
    feedLines(ps, 'Use ::: for fences\nAnother line');
    expect(ps.lines).toEqual(['Use ::: for fences', 'Another line']);
    expect(ps.state).toBe('running');
  });

  it('handles multiple sequential prompt blocks', () => {
    feedLines(ps, ':::prompt\nFirst question?\n:::');
    expect(ps.state).toBe('waiting_for_input');
    expect(ps.pendingPrompt).toBe('First question?');

    // Simulate user answering (reset state)
    ps.state = 'running';
    ps.pendingPrompt = undefined;

    feedLines(ps, ':::prompt\nSecond question?\n:::');
    expect(ps.state).toBe('waiting_for_input');
    expect(ps.pendingPrompt).toBe('Second question?');
  });
});

describe('Autonomous Context Template Resolution', () => {
  // Simulates the resolveTemplate function from subprocess-runner
  function resolveTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? `[${key}]`);
  }

  it('resolves known placeholders', () => {
    const template = 'Feature: {{featureName}}, Goal: {{goal}}';
    const result = resolveTemplate(template, { featureName: 'Auth', goal: 'Add login' });
    expect(result).toBe('Feature: Auth, Goal: Add login');
  });

  it('replaces unknown placeholders with [key] marker', () => {
    const template = 'Unknown: {{unknown}}';
    const result = resolveTemplate(template, {});
    expect(result).toBe('Unknown: [unknown]');
  });

  it('resolves card context variables', () => {
    const template = 'Card {{cardId}}: {{cardTitle}} in {{specDir}}';
    const result = resolveTemplate(template, {
      cardId: '1.2.3',
      cardTitle: 'My Feature',
      specDir: 'specs/2026-04-02_feature_my-feature',
    });
    expect(result).toBe('Card 1.2.3: My Feature in specs/2026-04-02_feature_my-feature');
  });

  it('handles template with no placeholders', () => {
    const result = resolveTemplate('No placeholders here', {});
    expect(result).toBe('No placeholders here');
  });
});

describe('Prompt Fence Parser — edge cases', () => {
  it('handles chunked delivery (split across buffers)', () => {
    const ps = createParseState();

    // First chunk: opening fence + start of prompt
    feedLines(ps, ':::prompt');
    expect(ps.inPromptBlock).toBe(true);

    // Second chunk: prompt text
    feedLines(ps, 'What is your name?');
    expect(ps.inPromptBlock).toBe(true);

    // Third chunk: closing fence
    feedLines(ps, ':::');
    expect(ps.state).toBe('waiting_for_input');
    expect(ps.pendingPrompt).toBe('What is your name?');
  });

  it('does not confuse :::prompt inside a prompt block', () => {
    const ps = createParseState();
    feedLines(ps, ':::prompt\nUse :::prompt to ask questions\n:::');
    // The inner :::prompt is just text inside the block
    expect(ps.pendingPrompt).toBe('Use :::prompt to ask questions');
  });
});
