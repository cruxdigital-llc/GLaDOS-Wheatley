# Spec: GLaDOS Workflow Integration (3.3)

## 1. Overview

Adds a lightweight webhook dispatch layer. On phase transitions that trigger
GLaDOS actions, `TransitionService` calls `WorkflowService.triggerWorkflow()`,
which fires an HTTP POST to `GLADOS_WEBHOOK_URL` (if set) and records the
workflow in an in-memory map.

## 2. New files

| File | Purpose |
|---|---|
| `src/server/api/workflow-service.ts` | WorkflowService + in-memory status map |
| `src/server/api/routes/webhooks.ts` | POST /api/webhooks/glados, GET /api/workflow/:itemId |
| `src/client/hooks/use-workflow-status.ts` | Polling hook for workflow status |

## 3. Modified files

| File | Change |
|---|---|
| `src/server/api/transition-service.ts` | Accept optional WorkflowService; call triggerWorkflow on planning/speccing |
| `src/server/api/server.ts` | Instantiate WorkflowService, pass to TransitionService, register webhookRoutes |
| `src/client/components/Card.tsx` | Show "GLaDOS Running..." badge when workflow active |
| `src/client/api.ts` | Add `fetchWorkflowStatus` |

## 4. WorkflowStatus type

```ts
export type WorkflowStatusCode = 'idle' | 'running' | 'done' | 'error';

export interface WorkflowStatus {
  itemId: string;
  status: WorkflowStatusCode;
  action?: string;
  startedAt?: string;
  finishedAt?: string;
}
```

## 5. Webhook payload

```json
{
  "action": "plan-feature",
  "itemId": "3.2.1",
  "phase": "planning",
  "timestamp": "2026-03-28T12:00:00Z"
}
```

## 6. Phase → action mapping

| Target phase | GLaDOS action |
|---|---|
| `planning` | `plan-feature` |
| `speccing` | `spec-feature` |
