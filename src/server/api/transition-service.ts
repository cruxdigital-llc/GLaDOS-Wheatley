/**
 * Transition Service
 *
 * Business logic for executing phase transitions on board items.
 * Validates the transition, generates file actions, and commits each change
 * via the GitAdapter.
 */

import type { BoardPhase } from '../../shared/grammar/types.js';
import type { GitAdapter } from '../git/types.js';
import { ConflictError } from '../git/types.js';
import { validateTransition, getTransitionActions } from '../../shared/transitions/engine.js';

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

  constructor(adapter: GitAdapter) {
    this.adapter = adapter;
  }

  /**
   * Execute a phase transition for a board item.
   *
   * 1. Validates the (from → to) pair; throws InvalidTransitionError if invalid.
   * 2. Generates the required file actions.
   * 3. Writes each file via the adapter with a machine-parseable commit message.
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
  }
}
