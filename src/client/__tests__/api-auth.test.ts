/**
 * Tests for fetchJson auth behavior (JWT attachment and 401 handling).
 *
 * Since vitest runs in a node environment, we mock `window`, `localStorage`,
 * and `fetch` to simulate browser behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to test the internal fetchJson via the public API functions.
// fetchBoard is the simplest — calls fetchJson('/api/board').

describe('fetchJson auth behavior', () => {
  const originalWindow = globalThis.window;
  let mockLocalStorage: Record<string, string>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLocalStorage = {};

    // Provide window-like globals for the module
    (globalThis as any).window = {
      location: { href: '' },
    };
    (globalThis as any).localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { mockLocalStorage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; }),
    };

    // Mock global fetch
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
    delete (globalThis as any).localStorage;
    vi.restoreAllMocks();
  });

  it('attaches Bearer header when wheatley_token exists in localStorage', async () => {
    mockLocalStorage['wheatley_token'] = 'test-jwt-token';

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ phases: [], items: [] }),
    });

    // Dynamically import to pick up the mocked globals
    const { fetchBoard } = await import('../api.js');
    await fetchBoard();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer test-jwt-token');
  });

  it('does not attach Authorization header when no token exists', async () => {
    // No token in localStorage

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ phases: [], items: [] }),
    });

    const { fetchBoard } = await import('../api.js');
    await fetchBoard();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('clears token and redirects on 401 response', async () => {
    mockLocalStorage['wheatley_token'] = 'expired-token';

    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Token expired' }),
    });

    const { fetchBoard } = await import('../api.js');

    await expect(fetchBoard()).rejects.toThrow('Authentication required');

    // Token should be cleared
    expect((globalThis as any).localStorage.removeItem).toHaveBeenCalledWith('wheatley_token');
    // Should redirect to login
    expect((globalThis as any).window.location.href).toBe('/login');
  });

  it('preserves existing Content-Type headers from caller', async () => {
    mockLocalStorage['wheatley_token'] = 'test-token';

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '1', title: 'test', phase: 'backlog' }),
    });

    const { createCard } = await import('../api.js');
    await createCard({ title: 'Test Card' });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toBe('Bearer test-token');
  });
});
