# Requirements: Interactive Workflows

## Goal

Make GLaDOS workflows truly interactive when triggered from the Wheatley board. Whether a user drags a card to a new column or clicks a workflow button in the card detail sidebar, they get the same unified launch experience — choose autonomous or interactive mode, configure parameters, and run.

## Functional Requirements

### FR-1: Unified Workflow Launch Panel
- Both drag-and-drop transitions and manual button clicks surface the same WorkflowLaunchPanel modal
- The panel displays: workflow type, card context, mode toggle (Autonomous/Interactive), configurable parameters, and a Run button
- The transition itself (file creation, phase change) still happens immediately; the launch panel is for the subsequent workflow run

### FR-2: Interactive Mode
- GLaDOS workflow commands emit questions wrapped in `:::prompt` / `:::` fence delimiters
- The subprocess runner detects these fences in the output stream and sets the run state to "waiting for input"
- The frontend renders detected prompts as chat-style messages with a text input field for user responses
- User responses are piped to the subprocess's stdin
- Output between prompts renders as read-only terminal output

### FR-3: Autonomous Mode
- Same prompt fence detection mechanism as interactive mode
- Instead of surfacing prompts to the user, auto-answer from per-workflow config defaults
- The workflow runs to completion without user interaction
- Output is still viewable in the terminal area

### FR-4: Two-Phase Execution
- Long workflows (especially implement-feature) have an interactive setup phase followed by autonomous execution
- A `:::phase autonomous` marker in the output signals the transition
- After transition: the UI shifts from chat mode to a background progress indicator
- Users can close the tab/panel and return later; notifications on completion

### FR-5: Workflow Configuration
- Per-workflow-type config stored in `.wheatley/workflows.json` in the repository
- Configurable: default mode, whether to show launch panel, parameter defaults, auto-answer mappings
- Config is loadable via API (`GET /api/config/workflows`)

### FR-6: Backward Compatibility
- If mode is not specified, workflows run with current behavior (no stdin, fire-and-forget)
- Existing WorkflowPanel button behavior continues to work during incremental rollout

## Non-Functional Requirements

### NFR-1: Responsiveness
- Prompt detection and UI state change should occur within 1 polling cycle (currently 2s)
- SSE events for workflow-prompt should provide near-instant notification

### NFR-2: Reliability
- If Claude doesn't emit proper `:::prompt` fences, provide a fallback: stall detection (>30s without output while running) shows a manual input hint
- stdin writes must handle backpressure (don't overflow the pipe)

### NFR-3: Testability
- Prompt fence parsing must be unit-testable independent of actual Claude CLI
- Mock subprocess for route-level integration tests

## Success Criteria
1. Dragging a card to Planning column shows the WorkflowLaunchPanel after the transition completes
2. Selecting Interactive mode and clicking Run shows chat-style prompts from plan-feature workflow
3. Answering prompts causes the workflow to continue and produce spec artifacts
4. Selecting Autonomous mode runs the workflow to completion without user interaction
5. The implement-feature workflow transitions from interactive setup to autonomous execution mid-run
6. Configuration in `.wheatley/workflows.json` is respected for default mode and auto-answers
