# Trace Log: Interactive Workflows

**Feature**: Interactive Workflows
**Created**: 2026-04-02
**Status**: Planning

## Active Personas
- Architect
- Product Manager
- QA Engineer

## Session Log

### 2026-04-02 — Planning Session
- Initialized feature directory
- Selected all three personas (Architect, Product Manager, QA)
- Context: GLaDOS workflow commands (plan-feature, spec-feature, implement-feature, verify-feature) are interactive — they ask users questions. The current subprocess runner spawns Claude CLI with stdin closed, so interactive workflows can't receive input. This feature adds a unified workflow launch experience with autonomous and interactive modes.
- Created requirements.md — 6 FRs, 3 NFRs, 6 success criteria
- Created plan.md — 10 work breakdown items, prompt fencing protocol, 3-layer architecture
- Handoff: Proceeding to implementation

### 2026-04-02 — Implementation Session
- Resumed trace, read plan.md and requirements.md
- Note: Skipped formal spec-feature; plan.md + requirements.md serve as specification
- Implemented all 10 work breakdown items:
  - Backend: types.ts, null-runner.ts, config.ts, subprocess-runner.ts (prompt fence parser, stdin pipe, sendInput, EventBus, autonomous mode)
  - API: POST /api/workflows/:runId/input, mode param, GET /api/config/workflows, workflowSuggestion in transition response
  - Frontend: WorkflowLaunchPanel (new), WorkflowPanel (chat UI rewrite), Board integration, SSE workflow events
  - Config: .wheatley/workflows.json, prompt fencing instructions in buildArgs()
  - Tests: 18 new tests (prompt parser + config loader), 492 total passing
- Files modified: types.ts, subprocess-runner.ts, null-runner.ts, config.ts (new), event-bus.ts, server.ts, routes/workflows.ts, routes/config.ts, routes/transitions.ts, transition-service.ts, api.ts, WorkflowPanel.tsx, WorkflowLaunchPanel.tsx (new), CardDetail.tsx, Board.tsx, use-sse.ts, use-transitions.ts
