# Requirements: GLaDOS Workflow Integration (3.3)

## Functional Requirements

### FR-1 — Webhook endpoint
`POST /api/webhooks/glados` accepts `{ url: string, action: string, itemId: string, phase: string }`
and fires a POST to the configured URL.

### FR-2 — Transition-triggered webhook
When `TransitionService.executeTransition` succeeds and the target phase is
`planning` or `speccing`, the server fires a webhook with the appropriate action.

### FR-3 — Configurable webhook URL
The GLaDOS webhook target URL is read from the environment variable
`GLADOS_WEBHOOK_URL`. If not set, webhook calls are silently skipped.

### FR-4 — Workflow status store
The server maintains an in-memory `Map<itemId, WorkflowStatus>` that records
whether a GLaDOS workflow is running for a given card.

### FR-5 — Workflow status API
`GET /api/workflow/:itemId` returns the current workflow status for an item.
Returns `{ status: 'idle' | 'running' | 'done' | 'error', startedAt?: string }`.

### FR-6 — Frontend status display
The Card component shows a "GLaDOS Running..." badge when the workflow status
for that card is `running`.

### FR-7 — Frontend polling
`use-transitions.ts` (or a dedicated hook) polls `GET /api/workflow/:itemId`
every 5 seconds when a workflow is active.
