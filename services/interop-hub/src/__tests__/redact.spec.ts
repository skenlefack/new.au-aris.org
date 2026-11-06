import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { maskCredentials, mergeCredentials, SECRET_MASK } from '../hub/redact';

describe('maskCredentials', () => {
  it('masks every credentials object, at any depth, keeping the keys', () => {
    const created = new Date('2026-11-06T08:00:00Z');
    const payload = {
      data: [
        { id: 'c1', credentials: { apiKey: 'k-123', webhookSecret: 's', password: '' }, created_at: created },
        { id: 'p1', connection: { credentials: { token: 't-1' } } },
      ],
    };
    const out = maskCredentials(payload);
    expect(out.data[0].credentials).toEqual({ apiKey: SECRET_MASK, webhookSecret: SECRET_MASK, password: '' });
    expect((out.data[1] as any).connection.credentials).toEqual({ token: SECRET_MASK });
    expect(out.data[0].created_at).toBe(created);
  });

  it('is applied to real responses through a preSerialization hook', async () => {
    const app = Fastify();
    app.addHook('preSerialization', async (_q, _r, p) => maskCredentials(p));
    app.get('/c', async () => ({ data: { name: 'KE DHIS2', credentials: { apiKey: 'secret-value' } } }));
    const res = await app.inject({ method: 'GET', url: '/c' });
    expect(res.body).not.toContain('secret-value');
    expect(res.json().data.credentials.apiKey).toBe(SECRET_MASK);
  });
});

describe('mergeCredentials', () => {
  it('keeps stored secrets when the client sends the mask back, and applies real changes', () => {
    expect(mergeCredentials({ apiKey: 'old', webhookSecret: 'w' }, { apiKey: SECRET_MASK, webhookSecret: 'new' }))
      .toEqual({ apiKey: 'old', webhookSecret: 'new' });
    expect(mergeCredentials(null, { token: 't' })).toEqual({ token: 't' });
  });
});
