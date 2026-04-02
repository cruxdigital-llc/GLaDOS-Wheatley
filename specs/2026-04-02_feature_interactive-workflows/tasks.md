# Tasks: Interactive Workflows

## Backend Foundation
- [x] Extend workflow types (WorkflowState, WorkflowMode, sendInput, pendingPrompt)
- [x] Update NullRunner with sendInput stub
- [x] Create workflow config loader (src/server/workflows/config.ts)
- [x] Add GET /api/config/workflows endpoint

## Subprocess Runner
- [x] Change stdio to pipe stdin, add prompt fence parser
- [x] Implement sendInput() method
- [x] Add autonomous mode auto-answer logic
- [x] Accept EventBus, emit workflow-prompt and workflow-done events
- [x] Handle :::phase autonomous marker

## API Routes
- [x] Add POST /api/workflows/:runId/input endpoint
- [x] Accept mode parameter on POST /api/workflows
- [x] Wire EventBus into SubprocessRunner in server.ts

## Transition Flow
- [x] Return workflowSuggestion from transition-service
- [x] Update transitions route to include suggestion in response

## Client API
- [x] Update WorkflowRun type with mode and pendingPrompt
- [x] Add sendWorkflowInput() and fetchWorkflowConfig() functions
- [x] Update executeTransition() to return workflowSuggestion

## Frontend Components
- [x] Create WorkflowLaunchPanel component
- [x] Rewrite WorkflowPanel with chat UI and launch intent
- [x] Add two-phase indicator and stall detection fallback

## Board Integration
- [x] Board.tsx: workflow launch from transition response
- [x] use-transitions.ts: return mutation response
- [x] use-sse.ts: handle workflow-prompt and workflow-done events

## GLaDOS Commands & Config
- [x] Add prompt fencing protocol via buildArgs() in subprocess-runner.ts
- [x] Add :::phase autonomous instructions via buildArgs()
- [x] Create .wheatley/workflows.json default config

## Tests
- [x] Unit tests for prompt fence parser
- [x] Integration tests for input endpoint
- [x] Run full test suite in Docker
