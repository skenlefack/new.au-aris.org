import { describe, it, expect, beforeEach } from 'vitest';
import { recordEmailAttempt, emailDeliveryStats, checkProvider, resetEmailHealth } from '../email-health';

describe('email health', () => {
  beforeEach(() => resetEmailHealth());

  it('counts sends and failures and hides recipient addresses', () => {
    recordEmailAttempt('postmark', true);
    recordEmailAttempt('postmark', false, 'Inactive recipient director@example.org');
    const stats = emailDeliveryStats();
    expect(stats.sent).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.lastError).toBe('Inactive recipient <recipient>');
    expect(stats.lastError).not.toContain('@');
  });

  it('caches the provider check', async () => {
    let calls = 0;
    const getChannel = async () => ({
      provider: 'postmark',
      channel: { verify: async () => { calls += 1; return { ok: true, detail: 'ok' }; } },
    });
    await checkProvider(getChannel);
    await checkProvider(getChannel);
    expect(calls).toBe(1);
  });

  it('reports a provider that cannot be built (missing token) as not ok', async () => {
    const r = await checkProvider(async () => { throw new Error('POSTMARK_SERVER_TOKEN is required'); });
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('POSTMARK_SERVER_TOKEN');
  });
});
