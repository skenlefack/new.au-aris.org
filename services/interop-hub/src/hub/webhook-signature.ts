/**
 * Webhook signature: X-Webhook-Signature = HMAC-SHA256(raw request body, connection secret),
 * hex-encoded, optionally prefixed with "sha256=". Base64 is also accepted.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function computeWebhookSignature(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyWebhookSignature(
  rawBody: string | undefined,
  secret: string,
  header: string | undefined,
): boolean {
  if (!header || rawBody === undefined || !secret) return false;
  const provided = header.trim().replace(/^sha256=/i, '');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();

  let candidate: Buffer;
  if (/^[0-9a-f]{64}$/i.test(provided)) {
    candidate = Buffer.from(provided, 'hex');
  } else {
    try {
      candidate = Buffer.from(provided, 'base64');
    } catch {
      return false;
    }
  }
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
