/**
 * Workflow Service
 *
 * Manages GLaDOS workflow state in memory and dispatches webhooks to the
 * configured GLADOS_WEBHOOK_URL when phase transitions trigger workflow actions.
 *
 * The in-memory map is intentionally not persisted — it resets on server restart.
 */

import type { BoardPhase } from '../../shared/grammar/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowStatusCode = 'idle' | 'running' | 'done' | 'error';

export interface WorkflowStatus {
  itemId: string;
  status: WorkflowStatusCode;
  action?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** Map of target phase to GLaDOS action name. */
const PHASE_ACTIONS: Partial<Record<BoardPhase, string>> = {
  planning: 'plan-feature',
  speccing: 'spec-feature',
};

// ---------------------------------------------------------------------------
// WorkflowService
// ---------------------------------------------------------------------------

export class WorkflowService {
  private readonly statuses = new Map<string, WorkflowStatus>();
  private readonly webhookUrl: string | undefined;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * Return the current workflow status for an item, or an idle record if none.
   */
  getStatus(itemId: string): WorkflowStatus {
    return this.statuses.get(itemId) ?? { itemId, status: 'idle' };
  }

  /**
   * Fire a GLaDOS webhook for the given transition if the target phase has a
   * registered action. Updates the in-memory status map.
   *
   * This is fire-and-forget: errors are logged but not re-thrown.
   */
  triggerWorkflow(itemId: string, toPhase: BoardPhase): void {
    const action = PHASE_ACTIONS[toPhase];
    if (!action) return;

    const startedAt = new Date().toISOString();
    this.statuses.set(itemId, { itemId, status: 'running', action, startedAt });

    if (!this.webhookUrl) {
      // No URL configured — mark done immediately (no-op)
      this.statuses.set(itemId, {
        itemId,
        status: 'done',
        action,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      return;
    }

    const payload = {
      action,
      itemId,
      phase: toPhase,
      timestamp: startedAt,
    };

    void fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        const finishedAt = new Date().toISOString();
        if (res.ok) {
          this.statuses.set(itemId, {
            itemId,
            status: 'done',
            action,
            startedAt,
            finishedAt,
          });
        } else {
          this.statuses.set(itemId, {
            itemId,
            status: 'error',
            action,
            startedAt,
            finishedAt,
          });
        }
      })
      .catch(() => {
        this.statuses.set(itemId, {
          itemId,
          status: 'error',
          action,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
      });
  }
}
