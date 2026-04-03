# Trace Log: Autonomous Workflow Execution

**Feature**: Interactive Workflows (renamed: Autonomous Workflow Execution)
**Created**: 2026-04-02
**Status**: Verified

## Active Personas
- Architect
- Product Manager
- QA Engineer

## Session Log

### 2026-04-02 — Planning Session
- Initialized feature directory
- Selected all three personas (Architect, Product Manager, QA)
- Context: GLaDOS workflow commands are interactive — they ask users questions. The subprocess runner spawns Claude CLI with stdin closed, so workflows can't receive input. This feature adds a unified workflow launch experience.
- Created requirements.md and plan.md
- Handoff: Proceeded to implementation

### 2026-04-02 — Implementation Session
- Implemented initial version with interactive mode (prompt fencing, chat UI, sendInput)
- CLI testing revealed `claude -p` is single-shot — no multi-turn support
- Stripped interactive mode entirely; simplified to autonomous single-shot execution
- Added per-workflow params, preamble/postamble, autonomousContext templates
- Key architectural decisions:
  - Prompt assembled from: preamble + command + autonomousContext({{params}}) + postamble
  - All context front-loaded in `-p` argument since CLI doesn't support follow-up messages
  - `.wheatley/workflows.json` for repo-level workflow config
  - Transition API returns `workflowSuggestion` to trigger launch panel

### 2026-04-02 — Verification Session
- Full test suite: 494 tests passing, 45 test files
- TypeScript: 0 new type errors (4 pre-existing)
- Architect review findings addressed:
  - Fixed outputTail copy inefficiency (lazy snapshot in getState instead of per-line copy)
  - Fixed double-fetch in output endpoint (single fetch + slice)
- Spec retrospection: Updated requirements.md and plan.md to reflect final architecture (removed all interactive mode references)
- Test synchronization: All test imports valid, no stale references, coverage adequate

### Files Modified
**New files:**
- `src/server/workflows/config.ts` — Config types, loader, defaults
- `src/client/components/WorkflowLaunchPanel.tsx` — Launch modal with params + instructions
- `src/server/workflows/__tests__/prompt-parser.test.ts` — Template resolution + prompt assembly tests
- `src/server/workflows/__tests__/workflow-config.test.ts` — Config loading tests
- `.wheatley/workflows.json` — Default workflow configuration

**Modified files:**
- `src/server/workflows/types.ts` — WorkflowContext with contextHints
- `src/server/workflows/subprocess-runner.ts` — resolveTemplate, buildArgs with preamble/context/postamble
- `src/server/workflows/null-runner.ts` — Kept minimal
- `src/server/api/routes/workflows.ts` — cardTitle, contextHints params
- `src/server/api/routes/config.ts` — GET /api/config/workflows
- `src/server/api/routes/transitions.ts` — workflowSuggestion in response
- `src/server/api/transition-service.ts` — PHASE_WORKFLOW mapping, TransitionResult
- `src/server/api/event-bus.ts` — workflow-done event type
- `src/server/api/server.ts` — EventBus + config wired into SubprocessRunner
- `src/client/api.ts` — startWorkflow with cardTitle/contextHints, fetchWorkflowConfig
- `src/client/components/WorkflowPanel.tsx` — Launch intent, terminal output
- `src/client/components/CardDetail.tsx` — Passes cardTitle to WorkflowPanel
- `src/client/components/Board.tsx` — workflowLaunchIntent from transition response
- `src/client/hooks/use-sse.ts` — workflow-done event handling
