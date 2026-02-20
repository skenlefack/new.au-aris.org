import { Injectable, Logger } from '@nestjs/common';

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

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  /** tenantId → Map<userId, UserPresence> */
  private readonly tenantPresence = new Map<string, Map<string, UserPresence>>();

  setOnline(tenantId: string, userId: string, email: string): void {
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
  }

  setOffline(tenantId: string, userId: string): void {
    const tenantMap = this.tenantPresence.get(tenantId);
    if (!tenantMap) return;

    const existing = tenantMap.get(userId);
    if (existing) {
      existing.online = false;
      existing.lastSeen = new Date();
    }
  }

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

    if (removed > 0) {
      this.logger.debug(`Presence cleanup: removed ${removed} stale entries`);
    }
    return removed;
  }
}
