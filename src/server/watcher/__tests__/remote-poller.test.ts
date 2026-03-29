import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemotePoller } from '../remote-poller.js';
import type { GitAdapter } from '../../git/types.js';

function createMockAdapter(overrides: Partial<GitAdapter> = {}): GitAdapter {
  return {
    readFile: vi.fn().mockResolvedValue('# Roadmap\n'),
    listDirectory: vi.fn().mockResolvedValue([]),
    listBranches: vi.fn().mockResolvedValue(['main']),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    getLatestSha: vi.fn().mockResolvedValue('abc123'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('RemotePoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts and stops without error', () => {
    const adapter = createMockAdapter();
    const poller = new RemotePoller({
      adapter,
      onChange: vi.fn(),
      intervalMs: 1000,
    });
    expect(() => poller.start()).not.toThrow();
    expect(() => poller.stop()).not.toThrow();
  });

  it('polls immediately on start', async () => {
    const adapter = createMockAdapter();
    const poller = new RemotePoller({
      adapter,
      onChange: vi.fn(),
      intervalMs: 5000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(adapter.getLatestSha).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('polls on interval using setTimeout chaining', async () => {
    const adapter = createMockAdapter();
    const poller = new RemotePoller({
      adapter,
      onChange: vi.fn(),
      intervalMs: 1000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0); // Initial poll
    await vi.advanceTimersByTimeAsync(1000); // First interval
    await vi.advanceTimersByTimeAsync(1000); // Second interval

    expect(adapter.getLatestSha).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it('detects SHA changes', async () => {
    const onChange = vi.fn();
    const adapter = createMockAdapter({
      getLatestSha: vi.fn()
        .mockResolvedValueOnce('sha-1')
        .mockResolvedValue('sha-2'),
    });

    const poller = new RemotePoller({
      adapter,
      onChange,
      intervalMs: 1000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0); // Initial poll — sets baseline
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // Second poll — different SHA
    expect(onChange).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it('does not fire when SHA is unchanged', async () => {
    const onChange = vi.fn();
    const adapter = createMockAdapter({
      getLatestSha: vi.fn().mockResolvedValue('same-sha'),
    });

    const poller = new RemotePoller({
      adapter,
      onChange,
      intervalMs: 1000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onChange).not.toHaveBeenCalled();
    poller.stop();
  });

  it('handles adapter errors gracefully', async () => {
    const adapter = createMockAdapter({
      getLatestSha: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    const poller = new RemotePoller({
      adapter,
      onChange: vi.fn(),
      intervalMs: 1000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    // Should not throw
    poller.stop();
  });

  it('stops polling after stop()', async () => {
    const adapter = createMockAdapter();
    const poller = new RemotePoller({
      adapter,
      onChange: vi.fn(),
      intervalMs: 1000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    poller.stop();

    await vi.advanceTimersByTimeAsync(5000);
    // Only the initial poll
    expect(adapter.getLatestSha).toHaveBeenCalledTimes(1);
  });
});
