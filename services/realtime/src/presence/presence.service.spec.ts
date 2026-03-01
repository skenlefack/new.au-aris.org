import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PresenceService } from '../services/presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    service = new PresenceService();
  });

  describe('setOnline / setOffline', () => {
    it('should mark a user as online', () => {
      service.setOnline('tenant-ke', 'user-1', 'user1@au-aris.org');

      expect(service.isUserOnline('tenant-ke', 'user-1')).toBe(true);
      expect(service.getOnlineCount('tenant-ke')).toBe(1);
    });

    it('should mark a user as offline', () => {
      service.setOnline('tenant-ke', 'user-1', 'user1@au-aris.org');
      service.setOffline('tenant-ke', 'user-1');

      expect(service.isUserOnline('tenant-ke', 'user-1')).toBe(false);
      expect(service.getOnlineCount('tenant-ke')).toBe(0);
    });

    it('should handle setOffline for non-existent tenant gracefully', () => {
      expect(() =>
        service.setOffline('non-existent', 'user-1'),
      ).not.toThrow();
    });

    it('should overwrite existing presence on re-connect', () => {
      service.setOnline('tenant-ke', 'user-1', 'user1@au-aris.org');
      service.setOffline('tenant-ke', 'user-1');
      service.setOnline('tenant-ke', 'user-1', 'user1@au-aris.org');

      expect(service.isUserOnline('tenant-ke', 'user-1')).toBe(true);
    });
  });

  describe('getTenantPresence', () => {
    it('should return empty presence for unknown tenant', () => {
      const presence = service.getTenantPresence('unknown');

      expect(presence.tenantId).toBe('unknown');
      expect(presence.onlineUsers).toHaveLength(0);
      expect(presence.totalOnline).toBe(0);
    });

    it('should return only online users', () => {
      service.setOnline('tenant-ke', 'user-1', 'user1@au-aris.org');
      service.setOnline('tenant-ke', 'user-2', 'user2@au-aris.org');
      service.setOnline('tenant-ke', 'user-3', 'user3@au-aris.org');
      service.setOffline('tenant-ke', 'user-2');

      const presence = service.getTenantPresence('tenant-ke');

      expect(presence.totalOnline).toBe(2);
      expect(presence.onlineUsers).toHaveLength(2);
      expect(presence.onlineUsers.map((u) => u.userId)).toContain('user-1');
      expect(presence.onlineUsers.map((u) => u.userId)).toContain('user-3');
      expect(presence.onlineUsers.map((u) => u.userId)).not.toContain('user-2');
    });

    it('should include email in presence data', () => {
      service.setOnline('tenant-ke', 'user-1', 'user1@au-aris.org');
      const presence = service.getTenantPresence('tenant-ke');

      expect(presence.onlineUsers[0].email).toBe('user1@au-aris.org');
    });
  });

  describe('isUserOnline', () => {
    it('should return false for unknown tenant', () => {
      expect(service.isUserOnline('unknown', 'user-1')).toBe(false);
    });

    it('should return false for unknown user in known tenant', () => {
      service.setOnline('tenant-ke', 'user-1', 'user1@au-aris.org');
      expect(service.isUserOnline('tenant-ke', 'unknown')).toBe(false);
    });
  });

  describe('getOnlineCount', () => {
    it('should return 0 for unknown tenant', () => {
      expect(service.getOnlineCount('unknown')).toBe(0);
    });

    it('should count only online users', () => {
      service.setOnline('tenant-ke', 'user-1', 'u1@au-aris.org');
      service.setOnline('tenant-ke', 'user-2', 'u2@au-aris.org');
      service.setOffline('tenant-ke', 'user-1');

      expect(service.getOnlineCount('tenant-ke')).toBe(1);
    });
  });

  describe('getAllOnlineCount', () => {
    it('should count across all tenants', () => {
      service.setOnline('tenant-ke', 'user-1', 'u1@au-aris.org');
      service.setOnline('tenant-ke', 'user-2', 'u2@au-aris.org');
      service.setOnline('tenant-ng', 'user-3', 'u3@au-aris.org');

      expect(service.getAllOnlineCount()).toBe(3);
    });

    it('should exclude offline users', () => {
      service.setOnline('tenant-ke', 'user-1', 'u1@au-aris.org');
      service.setOnline('tenant-ng', 'user-2', 'u2@au-aris.org');
      service.setOffline('tenant-ke', 'user-1');

      expect(service.getAllOnlineCount()).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should remove stale offline entries', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      service.setOnline('tenant-ke', 'user-1', 'u1@au-aris.org');
      service.setOffline('tenant-ke', 'user-1');

      // The user is offline but still tracked
      expect(service.isUserOnline('tenant-ke', 'user-1')).toBe(false);

      // Advance time by 1 minute so entry is stale relative to maxAge=0
      vi.setSystemTime(now + 60_000);

      const removed = service.cleanup(0);
      expect(removed).toBe(1);

      vi.useRealTimers();
    });

    it('should not remove online users', () => {
      service.setOnline('tenant-ke', 'user-1', 'u1@au-aris.org');

      const removed = service.cleanup(0);
      expect(removed).toBe(0);
      expect(service.isUserOnline('tenant-ke', 'user-1')).toBe(true);
    });

    it('should clean up empty tenant maps', () => {
      service.setOnline('tenant-ke', 'user-1', 'u1@au-aris.org');
      service.setOffline('tenant-ke', 'user-1');
      service.cleanup(0);

      // The tenant should be gone after cleanup
      const presence = service.getTenantPresence('tenant-ke');
      expect(presence.totalOnline).toBe(0);
      expect(presence.onlineUsers).toHaveLength(0);
    });
  });

  describe('multi-tenant isolation', () => {
    it('should isolate presence per tenant', () => {
      service.setOnline('tenant-ke', 'user-1', 'u1@ke.au-aris.org');
      service.setOnline('tenant-ng', 'user-2', 'u2@ng.au-aris.org');

      const kePresence = service.getTenantPresence('tenant-ke');
      const ngPresence = service.getTenantPresence('tenant-ng');

      expect(kePresence.totalOnline).toBe(1);
      expect(kePresence.onlineUsers[0].userId).toBe('user-1');

      expect(ngPresence.totalOnline).toBe(1);
      expect(ngPresence.onlineUsers[0].userId).toBe('user-2');
    });
  });
});
