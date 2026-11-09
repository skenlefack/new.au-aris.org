/**
 * Records failed Kafka publishes from the tenant service.
 *
 * Publishing is non-blocking (a failure never breaks the HTTP request), so
 * without this tracker a jammed producer stays invisible. The Kafka health
 * monitor reads it to raise an alert, e.g. when welcome emails can no longer
 * be triggered.
 */

export interface PublishFailure {
  topic: string;
  error: string;
  at: number;
}

const KEEP_MS = 60 * 60 * 1000;
const failures: PublishFailure[] = [];
const successes = new Map<string, number>(); // topic → last success (epoch ms)

function prune(now: number): void {
  while (failures.length > 0 && now - failures[0].at > KEEP_MS) failures.shift();
}

export function recordPublishFailure(topic: string, err: unknown): void {
  const now = Date.now();
  const error = (err instanceof Error ? err.message : String(err)).slice(0, 300);
  failures.push({ topic, error, at: now });
  prune(now);
  console.error(`[kafka-publish] ${topic} failed: ${error}`);
}

export function recordPublishSuccess(topic: string): void {
  successes.set(topic, Date.now());
}

/** Failures in the last `windowMs`, ignoring topics that published fine since. */
export function recentPublishFailures(windowMs: number): PublishFailure[] {
  const now = Date.now();
  prune(now);
  return failures.filter((f) => now - f.at <= windowMs && (successes.get(f.topic) ?? 0) < f.at);
}

/**
 * Wraps a Kafka send with a hard timeout and records the outcome.
 * Never throws: callers keep their fire-and-forget behaviour.
 */
export async function trackedSend(topic: string, send: () => Promise<unknown>, timeoutMs = 5000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Kafka send timeout after ${timeoutMs} ms`)), timeoutMs);
    });
    await Promise.race([send(), timeout]);
    recordPublishSuccess(topic);
  } catch (err) {
    recordPublishFailure(topic, err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Test helper. */
export function resetPublishTracker(): void {
  failures.length = 0;
  successes.clear();
}
