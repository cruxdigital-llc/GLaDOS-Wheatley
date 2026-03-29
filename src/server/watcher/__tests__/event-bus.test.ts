import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../event-bus.js';

describe('EventBus', () => {
  it('notifies subscribers on emit', () => {
    const bus = new EventBus<string>();
    const callback = vi.fn();
    bus.on(callback);
    bus.emit('hello');
    expect(callback).toHaveBeenCalledWith('hello');
  });

  it('supports multiple subscribers', () => {
    const bus = new EventBus<number>();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.on(cb1);
    bus.on(cb2);
    bus.emit(42);
    expect(cb1).toHaveBeenCalledWith(42);
    expect(cb2).toHaveBeenCalledWith(42);
  });

  it('unsubscribes with off()', () => {
    const bus = new EventBus<string>();
    const callback = vi.fn();
    bus.on(callback);
    bus.off(callback);
    bus.emit('should not fire');
    expect(callback).not.toHaveBeenCalled();
  });

  it('removeAll clears all listeners', () => {
    const bus = new EventBus<string>();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.on(cb1);
    bus.on(cb2);
    bus.removeAll();
    bus.emit('nope');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
    expect(bus.listenerCount).toBe(0);
  });

  it('reports correct listenerCount', () => {
    const bus = new EventBus<string>();
    expect(bus.listenerCount).toBe(0);
    const cb = vi.fn();
    bus.on(cb);
    expect(bus.listenerCount).toBe(1);
    bus.off(cb);
    expect(bus.listenerCount).toBe(0);
  });

  it('does not add duplicate listeners', () => {
    const bus = new EventBus<string>();
    const callback = vi.fn();
    bus.on(callback);
    bus.on(callback); // Same reference
    bus.emit('test');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('handles emit with no listeners', () => {
    const bus = new EventBus<string>();
    expect(() => bus.emit('test')).not.toThrow();
  });
});
