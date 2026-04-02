# Plan: Interactive Workflows

## Overview

Add interactive workflow support to the Wheatley board so GLaDOS workflows can receive user input through the web UI. Currently, workflows spawn Claude CLI with stdin closed — interactive commands (plan-feature, spec-feature, etc.) can't ask questions. This feature introduces a prompt fencing protocol, a unified launch panel, and a chat-style interactive UI.

## Approach

### Prompt Fencing Protocol
GLaDOS command files get instructions to wrap user-facing questions in `:::prompt` / `:::` delimiters. The subprocess runner parses stdout for these fences. In interactive mode, prompts surface as chat UI. In autonomous mode, prompts are auto-answered from config.

### Architecture: Three Layers

```
┌─────────────────────────────────┐
│  WorkflowLaunchPanel (modal)    │  ← Unified entry point
│  Mode toggle + params + Run     │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  WorkflowPanel (chat UI)        │  ← Interactive terminal
│  Output + prompt bubbles        │
│  Text input when waiting        │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  SubprocessRunner (backend)     │  ← Prompt-aware process mgmt
│  stdin pipe + fence parser      │
│  POST /api/workflows/:id/input  │
└─────────────────────────────────┘
```

## Work Breakdown

### WB-1: Backend Types & Config
- Extend `WorkflowState` with `'waiting_for_input'`
- Add `WorkflowMode`, `pendingPrompt`, `sendInput()` to types
- New `src/server/workflows/config.ts` for loading `.wheatley/workflows.json`
- New `GET /api/config/workflows` endpoint

### WB-2: Prompt-Aware Subprocess Runner
- Change stdio from `['ignore', 'pipe', 'pipe']` to `['pipe', 'pipe', 'pipe']`
- Parse output for `:::prompt` / `:::` fences
- Set state to `waiting_for_input` when prompt detected
- New `sendInput()` method writes to stdin
- In autonomous mode, auto-answer from config
- Emit workflow events via EventBus for SSE push
- Handle `:::phase autonomous` marker for two-phase execution

### WB-3: API Routes
- `POST /api/workflows/:runId/input` — send user response to waiting workflow
- Accept `mode` parameter on existing `POST /api/workflows`
- Wire EventBus into SubprocessRunner

### WB-4: Transition Flow Update
- Remove fire-and-forget `workflowService.triggerWorkflow()` from transition-service
- Return `workflowSuggestion` from transition API response
- Frontend reads suggestion and opens WorkflowLaunchPanel

### WB-5: Client API Updates
- Add `mode`, `pendingPrompt` to `WorkflowRun` type
- New `sendWorkflowInput()`, `fetchWorkflowConfig()` functions
- Update `executeTransition()` return type

### WB-6: WorkflowLaunchPanel Component (New)
- Portal-based modal, same pattern as ConfirmTransitionModal
- Mode toggle: Autonomous / Interactive
- Parameter inputs pre-filled from config
- Cancel + Run buttons

### WB-7: WorkflowPanel Chat UI Rewrite
- Replace terminal-only output with mixed chat view
- Prompt bubbles (left) + user response bubbles (right) + terminal output
- Text input with send button when `state === 'waiting_for_input'`
- Two-phase indicator: switch to background progress view after `:::phase autonomous`
- Stall detection fallback: manual input hint if no output for 30s

### WB-8: Board Integration
- After transition success, check for `workflowSuggestion` → open launch panel
- Update use-transitions hook to return response
- Update use-sse hook to handle workflow events

### WB-9: GLaDOS Command Modifications
- Add Interactive Protocol section to all 4 workflow commands
- Instructions to wrap questions in `:::prompt` / `:::` fences
- Add `:::phase autonomous` markers after setup sections

### WB-10: Default Config & Tests
- Create `.wheatley/workflows.json` with sensible defaults
- Unit tests for prompt fence parsing
- Integration tests for input endpoint
- Docker-based test execution

## Key Risks

| Risk | Mitigation |
|------|------------|
| Claude CLI `-p` flag may not read stdin | Test early; fallback: write initial prompt to stdin instead of using `-p` |
| Claude doesn't always emit `:::prompt` fences | Stall detection fallback with manual input hint |
| stdin backpressure on long responses | Check writable state before writing; buffer if needed |
| Breaking existing workflow behavior | Mode parameter is optional; omitted = current behavior |

## Dependencies
- No new npm packages required
- Existing SSE infrastructure supports new event types
- Existing portal modal pattern reusable for launch panel
