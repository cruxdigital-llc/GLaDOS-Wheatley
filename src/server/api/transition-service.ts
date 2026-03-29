/**
 * Transition Service
 *
 * Business logic for executing phase transitions on board items.
 * Validates the transition, generates file actions, and commits each change
 * via the GitAdapter. Also triggers GLaDOS workflows and updates
 * PROJECT_STATUS.md via the injected services.
 */

import type { BoardPhase } from '../../shared/grammar/types.js';
import type { GitAdapter } from '../git/types.js';
import { ConflictError } from '../git/types.js';
import { validateTransition, getTransitionActions } from '../../shared/transitions/engine.js';
import type { WorkflowService } from './workflow-service.js';
import { buildStatusWriteback } from './status-writeback.js';

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export class InvalidTransitionError extends Error {
  readonly from: BoardPhase;
  readonly to: BoardPhase;

  constructor(from: BoardPhase, to: BoardPhase, reason: string) {
    super(reason);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

// Re-export so routes can import from one place
export { ConflictError };

// ---------------------------------------------------------------------------
// TransitionService
// ---------------------------------------------------------------------------

export class TransitionService {
  private readonly adapter: GitAdapter;
  private readonly workflowService: WorkflowService | undefined;

  constructor(adapter: GitAdapter, workflowService?: WorkflowService) {
    this.adapter = adapter;
    this.workflowService = workflowService;
  }

  /**
   * Execute a phase transition for a board item.
   *
   * 1. Validates the (from → to) pair; throws InvalidTransitionError if invalid.
   * 2. Generates the required file actions.
   * 3. Writes each file via the adapter with a machine-parseable commit message.
   * 4. Updates PROJECT_STATUS.md to reflect the new phase.
   * 5. Triggers any GLaDOS workflow associated with the target phase.
   *
   * ConflictError from the adapter is not caught here; it propagates to the caller.
   *
   * @param itemId - Roadmap item ID (e.g., "3.1.2")
   * @param from   - Current phase
   * @param to     - Target phase
   * @param branch - Optional branch to write to; adapter default is used if omitted
   */
  async executeTransition(
    itemId: string,
    from: BoardPhase,
    to: BoardPhase,
    branch?: string,
  ): Promise<void> {
    const result = validateTransition(from, to);
    if (!result.valid) {
      throw new InvalidTransitionError(from, to, result.reason!);
    }

    const actions = getTransitionActions(itemId, from, to);
    const message = `transition: ${itemId} ${from}\u2192${to}`;

    for (const action of actions) {
      await this.adapter.writeFile(action.path, action.content, message, branch);
    }

    // Update PROJECT_STATUS.md
    await this.writeStatusWriteback(itemId, from, to, message, branch);

    // Trigger GLaDOS workflow if applicable (fire-and-forget)
    this.workflowService?.triggerWorkflow(itemId, to);
  }

  private async writeStatusWriteback(
    itemId: string,
    from: BoardPhase,
    to: BoardPhase,
    message: string,
    branch?: string,
  ): Promise<void> {
    const currentContent = (await this.adapter.readFile('PROJECT_STATUS.md', branch)) ?? '';
    const updated = buildStatusWriteback(currentContent, itemId, itemId, from, to);
    if (updated !== currentContent) {
      await this.adapter.writeFile('PROJECT_STATUS.md', updated, message, branch);
    }
  }
}
