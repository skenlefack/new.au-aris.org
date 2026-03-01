import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from '../routes/health';
import type { RoomManagerService } from '../services/room-manager.service';
import type { PresenceService } from '../services/presence.service';

describe('Health & Stats Routes', () => {
  let app: FastifyInstance;
  let roomManager: {
    getStats: ReturnType<typeof vi.fn>;
    getAllRooms: ReturnType<typeof vi.fn>;
  };
  let presenceService: {
    getAllOnlineCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
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

    app = Fastify();
    app.decorate('roomManager', roomManager as unknown as RoomManagerService);
    app.decorate('presenceService', presenceService as unknown as PresenceService);
    app.decorate('authHookFn', async () => {});

    await app.register(registerHealthRoutes);
    await app.ready();
  });

  describe('GET /health', () => {
    it('should return status ok', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('realtime');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/realtime/stats', () => {
    it('should return aggregated statistics', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/realtime/stats' });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.data.connectedClients).toBe(5);
      expect(body.data.activeRooms).toBe(3);
      expect(body.data.totalMessages).toBe(100);
      expect(body.data.rooms).toHaveLength(3);
      expect(body.data.totalOnlineUsers).toBe(5);
    });
  });
});
