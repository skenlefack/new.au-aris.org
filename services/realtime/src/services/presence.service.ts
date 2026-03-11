import type Redis from 'ioredis';

export interface UserPresence {
  userId: string;
  email: string;
  online: boolean;
  lastSeen: Date;
}

export interface TenantPresence {
  tenantId: string;
  onlineUsers: UserPresence[];
  totalOnline: number;
}

const REDIS_PREFIX = 'aris:realtime:';
const ROOM_COUNT_PREFIX = `${REDIS_PREFIX}room:`;
const PRESENCE_PREFIX = `${REDIS_PREFIX}presence:`;
const HEARTBEAT_PREFIX = `${REDIS_PREFIX}heartbeat:`;
const PRESENCE_TTL = 300; // 5 minutes — auto-expire stale entries

export class PresenceService {
  /** tenantId → Map<userId, UserPresence> (in-memory for fast lookups) */
  private readonly tenantPresence = new Map<string, Map<string, UserPresence>>();

  /** Optional Redis for distributed presence */
  private redis: Redis | null = null;

  setRedis(redis: Redis): void {
    this.redis = redis;
  }

  // ── Online / Offline ──

  async setOnline(tenantId: string, userId: string, email: string): Promise<void> {
    // In-memory
    if (!this.tenantPresence.has(tenantId)) {
      this.tenantPresence.set(tenantId, new Map());
    }
    const tenantMap = this.tenantPresence.get(tenantId)!;
    tenantMap.set(userId, {
      userId,
      email,
      online: true,
      lastSeen: new Date(),
    });

    // Redis — store with TTL for distributed presence
    if (this.redis) {
      try {
        await this.redis.set(
          `${PRESENCE_PREFIX}${tenantId}:${userId}`,
          JSON.stringify({ userId, email, online: true, lastSeen: new Date().toISOString() }),
          'EX',
          PRESENCE_TTL,
        );
      } catch { /* non-fatal */ }
    }
  }

  async setOffline(tenantId: string, userId: string): Promise<void> {
    const tenantMap = this.tenantPresence.get(tenantId);
    if (!tenantMap) return;

    const existing = tenantMap.get(userId);
    if (existing) {
      existing.online = false;
      existing.lastSeen = new Date();
    }

    if (this.redis) {
      try {
        await this.redis.del(`${PRESENCE_PREFIX}${tenantId}:${userId}`);
      } catch { /* non-fatal */ }
    }
  }

  // ── Room Counts in Redis ──

  async incrementRoomCount(roomId: string): Promise<number> {
    if (!this.redis) return 0;
    try {
      return await this.redis.incr(`${ROOM_COUNT_PREFIX}${roomId}`);
    } catch { return 0; }
  }

  async decrementRoomCount(roomId: string): Promise<number> {
    if (!this.redis) return 0;
    try {
      const val = await this.redis.decr(`${ROOM_COUNT_PREFIX}${roomId}`);
      // Don't let it go below 0
      if (val < 0) {
        await this.redis.set(`${ROOM_COUNT_PREFIX}${roomId}`, '0');
        return 0;
      }
      // Remove key if room is empty
      if (val === 0) {
        await this.redis.del(`${ROOM_COUNT_PREFIX}${roomId}`);
      }
      return val;
    } catch { return 0; }
  }

  async getRoomCount(roomId: string): Promise<number> {
    if (!this.redis) return 0;
    try {
      const val = await this.redis.get(`${ROOM_COUNT_PREFIX}${roomId}`);
      return val ? parseInt(val, 10) : 0;
    } catch { return 0; }
  }

  async getAllRoomCounts(): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!this.redis) return result;
    try {
      const keys = await this.redis.keys(`${ROOM_COUNT_PREFIX}*`);
      if (keys.length === 0) return result;
      const values = await this.redis.mget(...keys);
      for (let i = 0; i < keys.length; i++) {
        const roomId = keys[i].substring(ROOM_COUNT_PREFIX.length);
        const count = values[i] ? parseInt(values[i], 10) : 0;
        if (count > 0) {
          result.set(roomId, count);
        }
      }
    } catch { /* non-fatal */ }
    return result;
  }

  // ── Heartbeat tracking ──

  async recordHeartbeat(socketId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        `${HEARTBEAT_PREFIX}${socketId}`,
        String(Date.now()),
        'EX',
        120, // 2 min TTL — auto-cleanup if process crashes
      );
    } catch { /* non-fatal */ }
  }

  async removeHeartbeat(socketId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`${HEARTBEAT_PREFIX}${socketId}`);
    } catch { /* non-fatal */ }
  }

  // ── Queries ──

  getTenantPresence(tenantId: string): TenantPresence {
    const tenantMap = this.tenantPresence.get(tenantId);
    if (!tenantMap) {
      return { tenantId, onlineUsers: [], totalOnline: 0 };
    }

    const onlineUsers: UserPresence[] = [];
    for (const presence of tenantMap.values()) {
      if (presence.online) {
        onlineUsers.push(presence);
      }
    }

    return {
      tenantId,
      onlineUsers,
      totalOnline: onlineUsers.length,
    };
  }

  isUserOnline(tenantId: string, userId: string): boolean {
    const tenantMap = this.tenantPresence.get(tenantId);
    if (!tenantMap) return false;
    return tenantMap.get(userId)?.online ?? false;
  }

  getOnlineCount(tenantId: string): number {
    const tenantMap = this.tenantPresence.get(tenantId);
    if (!tenantMap) return 0;

    let count = 0;
    for (const presence of tenantMap.values()) {
      if (presence.online) count++;
    }
    return count;
  }

  getAllOnlineCount(): number {
    let total = 0;
    for (const tenantMap of this.tenantPresence.values()) {
      for (const presence of tenantMap.values()) {
        if (presence.online) total++;
      }
    }
    return total;
  }

  // ── Metrics ──

  async getMetrics(): Promise<{
    totalOnline: number;
    roomsWithPresence: number;
    tenantBreakdown: Array<{ tenantId: string; online: number }>;
  }> {
    const tenantBreakdown: Array<{ tenantId: string; online: number }> = [];
    for (const [tenantId, tenantMap] of this.tenantPresence) {
      let online = 0;
      for (const p of tenantMap.values()) {
        if (p.online) online++;
      }
      if (online > 0) {
        tenantBreakdown.push({ tenantId, online });
      }
    }

    const roomCounts = await this.getAllRoomCounts();

    return {
      totalOnline: this.getAllOnlineCount(),
      roomsWithPresence: roomCounts.size,
      tenantBreakdown,
    };
  }

  /**
   * Clean up stale offline entries older than the given duration.
   */
  cleanup(maxAgeMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;

    for (const [tenantId, tenantMap] of this.tenantPresence) {
      for (const [userId, presence] of tenantMap) {
        if (
          !presence.online &&
          now - presence.lastSeen.getTime() > maxAgeMs
        ) {
          tenantMap.delete(userId);
          removed++;
        }
      }
      if (tenantMap.size === 0) {
        this.tenantPresence.delete(tenantId);
      }
    }

    return removed;
  }
}
