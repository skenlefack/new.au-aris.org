import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerRawJsonParser } from '../hub/raw-json-parser';
import { computeWebhookSignature, verifyWebhookSignature } from '../hub/webhook-signature';

async function makeApp() {
  const app = Fastify();
  registerRawJsonParser(app);
  app.post('/hook', async (request) => ({
    raw: (request as any).rawBody,
    body: request.body,
    valid: verifyWebhookSignature((request as any).rawBody, 's3cret', request.headers['x-webhook-signature'] as string),
  }));
  await app.ready();
  return app;
}

describe('registerRawJsonParser', () => {
  it('keeps the exact raw body so a partner signature verifies', async () => {
    const app = await makeApp();
    const payload = '{ "records": [ { "cases": 3 } ] }'; // spacing must be preserved byte-for-byte
    const res = await app.inject({
      method: 'POST', url: '/hook', payload,
      headers: { 'content-type': 'application/json', 'x-webhook-signature': computeWebhookSignature(payload, 's3cret') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ raw: payload, body: { records: [{ cases: 3 }] }, valid: true });
  });

  it('still rejects invalid JSON and prototype poisoning like the default parser', async () => {
    const app = await makeApp();
    const bad = await app.inject({ method: 'POST', url: '/hook', payload: '{bad', headers: { 'content-type': 'application/json' } });
    expect(bad.statusCode).toBe(400);
    const poisoned = await app.inject({
      method: 'POST', url: '/hook', payload: '{"__proto__":{"x":1}}', headers: { 'content-type': 'application/json' },
    });
    expect(poisoned.statusCode).toBe(400);
  });
});
