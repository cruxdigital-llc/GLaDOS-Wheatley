# Tasks: GLaDOS Workflow Integration (3.3)

## Implementation Tasks

- [x] **3.3.1 "Start Planning" action**: TransitionService triggers /glados/plan-feature via WorkflowService when transitioning to planning
- [x] **3.3.2 "Start Spec" action**: TransitionService triggers /glados/spec-feature via WorkflowService when transitioning to speccing
- [x] **3.3.3 Define integration mechanism**: Webhook (HTTP POST to GLADOS_WEBHOOK_URL env var); WorkflowService dispatches fire-and-forget
- [x] **3.3.4 Status feedback**: Card shows "GLaDOS Running..." spinner badge; use-workflow-status hook polls GET /api/workflow/:itemId
- [x] **WorkflowService**: In-memory Map<itemId, WorkflowStatus> with triggerWorkflow() and getStatus()
- [x] **Webhook routes**: POST /api/webhooks/glados + GET /api/workflow/:itemId registered in server.ts
- [x] **fetchWorkflowStatus in api.ts**: GET /api/workflow/:itemId client function
- [x] **use-workflow-status hook**: Polls every 5s when status is 'running'
