/**
 * Debounce Utility
 *
 * Trailing-edge debounce: fires callback after a quiet period.
 * Each trigger() resets the timer. cancel() stops pending execution.
 */

export interface Debouncer {
  /** Trigger the debounce. Callback fires after delayMs of quiet. */
  trigger(callback: () => void): void;
  /** Cancel any pending execution. */
  cancel(): void;
}

export function createDebounce(delayMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger(callback: () => void): void {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        callback();
      }, delayMs);
    },

    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
