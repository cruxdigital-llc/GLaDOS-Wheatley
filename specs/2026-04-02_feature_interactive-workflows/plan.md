# Plan: Autonomous Workflow Execution

## Overview

Enable GLaDOS workflows to run autonomously from the Wheatley board with all necessary context pre-supplied in a single-shot `claude -p` execution. A unified WorkflowLaunchPanel collects per-workflow parameters and assembles them into the prompt alongside configurable preamble/postamble instructions.

## Architecture

```
┌─────────────────────────────────────┐
│  WorkflowLaunchPanel (modal)        │  ← Unified entry point
│  Params + Instructions + Run        │     (drag-and-drop or button)
└──────────────┬──────────────────────┘
               │ contextHints
┌──────────────▼──────────────────────┐
│  SubprocessRunner                   │
│  buildArgs():                       │
│    preamble                         │  ← From config or per-run override
│    + workflow command                │  ← /glados:plan-feature for card X
│    + autonomousContext({{params}})   │  ← Template with resolved placeholders
│    + postamble                      │  ← From config or per-run override
│  → claude -p "<assembled prompt>"   │
└──────────────┬──────────────────────┘
               │ stdout/stderr
┌──────────────▼──────────────────────┐
│  WorkflowPanel (terminal output)    │  ← Monitor progress, cancel, history
└─────────────────────────────────────┘
```

## Design Decisions

### Single-Shot Execution (not multi-turn)
CLI testing confirmed that `claude -p` completes in one shot — there is no reliable way to send follow-up messages within the same invocation. The `--input-format stream-json` flag exists but does not work reliably. All context must be front-loaded in the prompt.

### Prompt Assembly Layers
Three configurable layers, each supporting `{{placeholder}}` resolution:
1. **Preamble** — Persistent instructions (e.g., "run in Docker"). Same every time.
2. **autonomousContext** — Per-run context from launch panel params. Varies per execution.
3. **Postamble** — Post-run instructions (e.g., "commit when done"). Same every time.

### Config in Repository
`.wheatley/workflows.json` is checked into the repo so workflow conventions travel with the codebase. Missing or invalid file falls back to built-in defaults.

## Implementation Summary

### Backend
| File | Change |
|------|--------|
| `src/server/workflows/types.ts` | WorkflowRun, WorkflowContext (with contextHints), WorkflowRunner interface |
| `src/server/workflows/config.ts` | Config types, loader, defaults with per-workflow params and autonomousContext templates |
| `src/server/workflows/subprocess-runner.ts` | resolveTemplate(), buildArgs() with preamble/context/postamble assembly, process lifecycle |
| `src/server/workflows/null-runner.ts` | No-op fallback |
| `src/server/api/routes/workflows.ts` | POST /api/workflows (with cardTitle, contextHints), GET output, DELETE cancel |
| `src/server/api/routes/config.ts` | GET /api/config/workflows |
| `src/server/api/transition-service.ts` | Returns workflowSuggestion from executeTransition |
| `src/server/api/event-bus.ts` | workflow-done event type |
| `src/server/api/server.ts` | Wires EventBus + config into SubprocessRunner |

### Frontend
| File | Change |
|------|--------|
| `src/client/components/WorkflowLaunchPanel.tsx` | New modal: params, collapsible preamble/postamble, Run button |
| `src/client/components/WorkflowPanel.tsx` | Launch intent → launch panel, terminal output, cancel, history |
| `src/client/components/CardDetail.tsx` | Passes cardTitle to WorkflowPanel |
| `src/client/components/Board.tsx` | Opens launch panel from transition workflowSuggestion |
| `src/client/api.ts` | startWorkflow with cardTitle/contextHints, fetchWorkflowConfig |
| `src/client/hooks/use-sse.ts` | Handles workflow-done events |

### Config
| File | Purpose |
|------|---------|
| `.wheatley/workflows.json` | Per-workflow params, preamble, postamble, autonomousContext templates |
