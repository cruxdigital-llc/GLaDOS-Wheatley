import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebounce } from '../debounce.js';

describe('createDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires callback after delay', () => {
    const debouncer = createDebounce(100);
    const callback = vi.fn();
    debouncer.trigger(callback);

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('resets timer on re-trigger', () => {
    const debouncer = createDebounce(100);
    const callback = vi.fn();

    debouncer.trigger(callback);
    vi.advanceTimersByTime(80);
    debouncer.trigger(callback); // Reset
    vi.advanceTimersByTime(80);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents execution', () => {
    const debouncer = createDebounce(100);
    const callback = vi.fn();
    debouncer.trigger(callback);
    debouncer.cancel();
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });

  it('can be re-triggered after cancel', () => {
    const debouncer = createDebounce(100);
    const callback = vi.fn();
    debouncer.trigger(callback);
    debouncer.cancel();
    debouncer.trigger(callback);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid triggers into single callback', () => {
    const debouncer = createDebounce(50);
    const callback = vi.fn();

    // Rapid fire
    for (let i = 0; i < 10; i++) {
      debouncer.trigger(callback);
      vi.advanceTimersByTime(10);
    }

    // Still waiting for quiet period
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
