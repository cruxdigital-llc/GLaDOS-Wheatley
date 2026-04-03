# Requirements: Autonomous Workflow Execution

## Goal

Enable GLaDOS workflows to run autonomously from the Wheatley board with all necessary context pre-supplied. Whether a user drags a card to a new column or clicks a workflow button in the card detail sidebar, they get the same unified launch experience — configure parameters, review preamble/postamble instructions, and run.

## Functional Requirements

### FR-1: Unified Workflow Launch Panel
- Both drag-and-drop transitions and manual button clicks surface the same WorkflowLaunchPanel modal
- The panel displays: workflow type, card context, configurable parameters per workflow type, and a Run button
- The transition itself (file creation, phase change) happens immediately; the launch panel is for the subsequent workflow run

### FR-2: Autonomous Execution with Pre-Supplied Context
- All workflows run as single-shot `claude -p` executions (no multi-turn)
- The prompt is assembled from: preamble + workflow command + autonomousContext template + postamble
- `autonomousContext` templates use `{{placeholder}}` syntax resolved from card metadata and launch panel params
- The prompt instructs Claude not to ask questions and to use supplied answers directly

### FR-3: Per-Workflow Parameters
- Each workflow type defines relevant parameters collected in the launch panel:
  - plan: Feature Name (auto-filled from card title), Goal, Personas
  - spec: Focus Areas
  - implement: Approach Notes
  - verify: Verification Focus
- Parameter values are resolved into the autonomousContext template before execution

### FR-4: Configurable Preamble and Postamble
- Each workflow type supports preamble (prepended) and postamble (appended) instruction blocks
- Defaults come from `.wheatley/workflows.json` in the repository (e.g., Docker conventions, commit instructions)
- The launch panel shows a collapsible "Instructions" section where users can review and edit preamble/postamble per-run
- Per-run edits override config defaults for that execution only

### FR-5: Workflow Configuration
- Per-workflow-type config stored in `.wheatley/workflows.json` in the repository
- Configurable: whether to show launch panel, parameter definitions, autonomousContext template, preamble, postamble
- Config is loadable via API (`GET /api/config/workflows`)
- Missing or invalid config falls back to built-in defaults silently

### FR-6: Workflow Suggestion from Transitions
- Phase transitions return a `workflowSuggestion` in the API response
- The frontend reads this and automatically opens the WorkflowLaunchPanel for the suggested workflow type
- Mapping: planning->plan, speccing->spec, implementing->implement, verifying->verify

### FR-7: Backward Compatibility
- Legacy webhook-based workflow triggers (`WorkflowService.triggerWorkflow`) still fire alongside the new system
- `NullRunner` used when `WHEATLEY_GLADOS_CMD` is not configured
- Existing output monitoring (terminal view, cancel, history) unchanged

## Non-Functional Requirements

### NFR-1: Real-Time Updates
- Workflow output polled every 2s during active runs
- SSE `workflow-done` events trigger immediate query invalidation for responsive UI updates

### NFR-2: Testability
- Template resolution logic unit-testable independent of Claude CLI
- Config loading tested with mock GitAdapter
- Prompt assembly tested for correct section ordering

## Success Criteria
1. Dragging a card to Planning column shows the WorkflowLaunchPanel after the transition completes
2. Launch panel shows workflow-specific params (e.g., Feature Name for plan) pre-filled from card context
3. Preamble/postamble are visible in collapsible Instructions section, editable per-run
4. Running a workflow produces a single-shot Claude CLI execution with assembled prompt
5. Configuration in `.wheatley/workflows.json` is respected for defaults
6. Output streams to terminal view; cancel works; history shows completed runs
