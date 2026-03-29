import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService, type WebhookConfig } from '../notification-service.js';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with no webhooks when none configured', () => {
    const service = new NotificationService();
    expect(service.listWebhooks()).toHaveLength(0);
  });

  it('accepts initial webhooks via constructor', () => {
    const webhook: WebhookConfig = {
      id: 'test',
      url: 'https://example.com/hook',
      events: [],
      active: true,
      format: 'raw',
    };
    const service = new NotificationService([webhook]);
    expect(service.listWebhooks()).toHaveLength(1);
  });

  it('adds and removes webhooks at runtime', () => {
    const service = new NotificationService();
    service.addWebhook({
      id: 'w1',
      url: 'https://example.com',
      events: [],
      active: true,
      format: 'raw',
    });
    expect(service.listWebhooks()).toHaveLength(1);

    expect(service.removeWebhook('w1')).toBe(true);
    expect(service.listWebhooks()).toHaveLength(0);

    expect(service.removeWebhook('nonexistent')).toBe(false);
  });

  it('records events in the event log', async () => {
    const service = new NotificationService();
    await service.emitClaim('1.1.1', 'jed');
    await service.emitRelease('1.1.1', 'jed');

    const log = service.getEventLog();
    expect(log).toHaveLength(2);
    // Newest first
    expect(log[0].type).toBe('release');
    expect(log[1].type).toBe('claim');
  });

  it('respects event log limit', async () => {
    const service = new NotificationService();
    const log = service.getEventLog(1);
    expect(log).toHaveLength(0);

    await service.emitClaim('1.1.1', 'a');
    await service.emitClaim('2.1.1', 'b');
    const limited = service.getEventLog(1);
    expect(limited).toHaveLength(1);
  });

  it('dispatches to matching webhooks (fire-and-forget)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    const service = new NotificationService([
      {
        id: 'all-events',
        url: 'https://example.com/all',
        events: [],
        active: true,
        format: 'raw',
      },
      {
        id: 'claims-only',
        url: 'https://example.com/claims',
        events: ['claim'],
        active: true,
        format: 'raw',
      },
    ]);

    await service.emitClaim('1.1.1', 'jed');

    // Both webhooks should fire for 'claim' event
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('only dispatches to webhooks matching event type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    const service = new NotificationService([
      {
        id: 'transitions-only',
        url: 'https://example.com/transitions',
        events: ['transition'],
        active: true,
        format: 'raw',
      },
    ]);

    await service.emitClaim('1.1.1', 'jed');
    expect(fetchSpy).not.toHaveBeenCalled();

    await service.emitTransition('1.1.1', 'planning', 'speccing', 'jed');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('skips inactive webhooks', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    const service = new NotificationService([
      {
        id: 'inactive',
        url: 'https://example.com',
        events: [],
        active: false,
        format: 'raw',
      },
    ]);

    await service.emitClaim('1.1.1', 'jed');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends Slack-formatted messages for slack webhooks', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    const service = new NotificationService([
      {
        id: 'slack',
        url: 'https://hooks.slack.com/services/test',
        events: [],
        active: true,
        format: 'slack',
      },
    ]);

    await service.emitClaim('1.1.1', 'jed');

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.text).toContain('jed');
    expect(callBody.text).toContain('claimed');
    expect(callBody.text).toContain('1.1.1');
  });

  it('silently handles webhook failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const service = new NotificationService([
      {
        id: 'failing',
        url: 'https://example.com/fail',
        events: [],
        active: true,
        format: 'raw',
      },
    ]);

    // Should not throw
    await expect(service.emitClaim('1.1.1', 'jed')).resolves.toBeUndefined();
  });

  it('emitConflict includes branch and spec data', async () => {
    const service = new NotificationService();
    await service.emitConflict(['feat/a', 'feat/b'], ['spec-shared']);

    const log = service.getEventLog();
    expect(log[0].type).toBe('conflict');
    expect(log[0].payload.branches).toEqual(['feat/a', 'feat/b']);
  });

  it('emitTTLWarning and emitTTLExpired record correct events', async () => {
    const service = new NotificationService();
    await service.emitTTLWarning('1.1.1', 'alice', 3.5);
    await service.emitTTLExpired('1.1.1', 'alice');

    const log = service.getEventLog();
    expect(log[0].type).toBe('ttl-expired');
    expect(log[1].type).toBe('ttl-warning');
    expect(log[1].payload.hoursRemaining).toBe(3.5);
  });
});
