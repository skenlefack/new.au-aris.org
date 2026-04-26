/**
 * usage-logger.ts — Logs AI usage to Redis (lightweight) for stats.
 * Also provides getUsageStats() for the /usage endpoint.
 */

import type Redis from 'ioredis';

const KEY_PREFIX = 'aris:ai:usage:';

export interface AiUsageEntry {
  userId: string;
  endpoint: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  status: 'success' | 'failed' | 'timeout';
  timestamp: number;
}

export interface AiUsageStats {
  lastHour: { totalRequests: number; totalTokens: number; avgDurationMs: number };
  lastDay: { totalRequests: number; totalTokens: number; avgDurationMs: number };
  lastWeek: { totalRequests: number; totalTokens: number; avgDurationMs: number };
}

export class UsageLogger {
  constructor(private redis: Redis) {}

  /**
   * Log a single AI request to Redis sorted set (score = timestamp).
   * Entries expire after 7 days.
   */
  async log(entry: AiUsageEntry): Promise<void> {
    const key = `${KEY_PREFIX}log`;
    const score = entry.timestamp || Date.now();
    const member = JSON.stringify({ ...entry, timestamp: score });

    await this.redis.zadd(key, score.toString(), member);
    // Trim entries older than 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await this.redis.zremrangebyscore(key, 0, cutoff);
  }

  /**
   * Get usage statistics for last hour, day, week.
   */
  async getUsageStats(): Promise<AiUsageStats> {
    const key = `${KEY_PREFIX}log`;
    const now = Date.now();

    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const [hourEntries, dayEntries, weekEntries] = await Promise.all([
      this.redis.zrangebyscore(key, hourAgo, now),
      this.redis.zrangebyscore(key, dayAgo, now),
      this.redis.zrangebyscore(key, weekAgo, now),
    ]);

    return {
      lastHour: this.aggregateEntries(hourEntries),
      lastDay: this.aggregateEntries(dayEntries),
      lastWeek: this.aggregateEntries(weekEntries),
    };
  }

  private aggregateEntries(raw: string[]): { totalRequests: number; totalTokens: number; avgDurationMs: number } {
    if (raw.length === 0) {
      return { totalRequests: 0, totalTokens: 0, avgDurationMs: 0 };
    }

    let totalTokens = 0;
    let totalDuration = 0;

    for (const item of raw) {
      try {
        const entry = JSON.parse(item) as AiUsageEntry;
        totalTokens += (entry.tokensInput ?? 0) + (entry.tokensOutput ?? 0);
        totalDuration += entry.durationMs ?? 0;
      } catch {
        // Skip malformed entries
      }
    }

    return {
      totalRequests: raw.length,
      totalTokens,
      avgDurationMs: Math.round(totalDuration / raw.length),
    };
  }
}
