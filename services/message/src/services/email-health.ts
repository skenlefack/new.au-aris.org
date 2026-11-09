/**
 * Email delivery health, read by the Kafka health monitor (tenant service)
 * through GET /health/email.
 *
 * Counts every email the service tries to send over the last hour and checks,
 * at most every 5 minutes, that the configured provider (Postmark or SMTP)
 * still accepts our credentials. Kept in memory: a restart resets the counters,
 * which the monitor treats as "no recent activity", not as a failure.
 */
import type { ProviderCheck } from './channel.interface';

const WINDOW_MS = 60 * 60 * 1000;
const PROVIDER_CHECK_TTL_MS = 5 * 60 * 1000;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

interface Attempt {
  at: number;
  ok: boolean;
}

const attempts: Attempt[] = [];
let lastSuccessAt: number | null = null;
let lastFailureAt: number | null = null;
let lastError: string | null = null;
let lastProvider: string | null = null;
let providerCheck: (ProviderCheck & { checkedAt: number; provider: string }) | null = null;

function prune(now: number): void {
  while (attempts.length > 0 && now - attempts[0].at > WINDOW_MS) attempts.shift();
}

/** Remove recipient addresses so the health endpoint never exposes them. */
function scrub(message: string): string {
  return message.replace(EMAIL_RE, '<recipient>').slice(0, 300);
}

export function recordEmailAttempt(provider: string, ok: boolean, error?: string): void {
  const now = Date.now();
  attempts.push({ at: now, ok });
  prune(now);
  lastProvider = provider;
  if (ok) {
    lastSuccessAt = now;
  } else {
    lastFailureAt = now;
    lastError = scrub(error ?? 'Unknown error');
  }
}

export async function checkProvider(
  getChannel: () => Promise<{ channel: { verify?: () => Promise<ProviderCheck> }; provider: string }>,
): Promise<ProviderCheck & { checkedAt: string; provider: string }> {
  const now = Date.now();
  if (!providerCheck || now - providerCheck.checkedAt > PROVIDER_CHECK_TTL_MS) {
    try {
      const { channel, provider } = await getChannel();
      const result = channel.verify
        ? await channel.verify()
        : { ok: true, detail: `No check available for ${provider}` };
      providerCheck = { ok: result.ok, detail: scrub(result.detail), provider, checkedAt: now };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      providerCheck = { ok: false, detail: scrub(message), provider: lastProvider ?? 'unknown', checkedAt: now };
    }
  }
  return { ...providerCheck, checkedAt: new Date(providerCheck.checkedAt).toISOString() };
}

export function emailDeliveryStats() {
  const now = Date.now();
  prune(now);
  const failed = attempts.filter((a) => !a.ok).length;
  return {
    windowMinutes: WINDOW_MS / 60_000,
    sent: attempts.length - failed,
    failed,
    lastSuccessAt: lastSuccessAt ? new Date(lastSuccessAt).toISOString() : null,
    lastFailureAt: lastFailureAt ? new Date(lastFailureAt).toISOString() : null,
    lastError,
  };
}

/** Test helper. */
export function resetEmailHealth(): void {
  attempts.length = 0;
  lastSuccessAt = null;
  lastFailureAt = null;
  lastError = null;
  lastProvider = null;
  providerCheck = null;
}
