import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthController } from './health.controller';
import type { RoomManagerService } from '../gateway/room-manager.service';
import type { PresenceService } from '../presence/presence.service';

describe('HealthController', () => {
  let controller: HealthController;
  let roomManager: {
    getStats: ReturnType<typeof vi.fn>;
    getAllRooms: ReturnType<typeof vi.fn>;
  };
  let presenceService: {
    getAllOnlineCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    roomManager = {
      getStats: vi.fn().mockReturnValue({
        connectedClients: 5,
        activeRooms: 3,
        totalMessages: 100,
        uptimeSeconds: 600,
        messagesPerSecond: 0.17,
      }),
      getAllRooms: vi.fn().mockReturnValue([
        { name: 'tenant:ke', clientCount: 3 },
        { name: 'outbreaks:ke', clientCount: 2 },
        { name: 'workflow:ke', clientCount: 1 },
      ]),
    };

    presenceService = {
      getAllOnlineCount: vi.fn().mockReturnValue(5),
    };

    controller = new HealthController(
      roomManager as unknown as RoomManagerService,
      presenceService as unknown as PresenceService,
    );
  });

  describe('GET /health', () => {
    it('should return status ok', () => {
      const result = controller.health();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('realtime');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('GET /stats', () => {
    it('should return aggregated statistics', () => {
      const result = controller.stats();

      expect(result.data.connectedClients).toBe(5);
      expect(result.data.activeRooms).toBe(3);
      expect(result.data.totalMessages).toBe(100);
      expect(result.data.rooms).toHaveLength(3);
      expect(result.data.totalOnlineUsers).toBe(5);
    });
  });
});
