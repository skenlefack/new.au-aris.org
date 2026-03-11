import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // GET /health — public health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'realtime',
    timestamp: new Date().toISOString(),
  }));

  // GET /ready — readiness probe
  app.get('/ready', async () => ({
    status: 'ok',
    service: 'realtime',
    timestamp: new Date().toISOString(),
  }));

  // GET /api/v1/realtime/health — API-namespaced health
  app.get('/api/v1/realtime/health', async () => ({
    status: 'ok',
    service: 'realtime',
    timestamp: new Date().toISOString(),
  }));

  // GET /api/v1/realtime/stats — authenticated stats endpoint
  app.get('/api/v1/realtime/stats', {
    preHandler: [app.authHookFn],
  }, async () => {
    const stats = app.roomManager.getStats();
    const rooms = app.roomManager.getAllRooms();
    const totalOnlineUsers = app.presenceService.getAllOnlineCount();

    return {
      data: {
        ...stats,
        rooms,
        totalOnlineUsers,
      },
    };
  });

  // GET /api/v1/realtime/rooms — list active hierarchical rooms + memberCount
  app.get('/api/v1/realtime/rooms', {
    preHandler: [app.authHookFn],
  }, async () => {
    const allRooms = app.roomManager.getAllRooms();
    const redisCounts = await app.presenceService.getAllRoomCounts();

    // Merge in-memory and Redis counts for each room
    const rooms = allRooms.map((room) => ({
      name: room.name,
      memberCount: room.clientCount,
      redisMemberCount: redisCounts.get(room.name) ?? 0,
    }));

    return {
      data: {
        rooms,
        totalRooms: rooms.length,
      },
    };
  });

  // GET /api/v1/realtime/metrics — global stats (presence, rooms, throughput)
  app.get('/api/v1/realtime/metrics', {
    preHandler: [app.authHookFn],
  }, async () => {
    const stats = app.roomManager.getStats();
    const presenceMetrics = await app.presenceService.getMetrics();

    return {
      data: {
        connections: {
          current: stats.connectedClients,
          activeRooms: stats.activeRooms,
        },
        throughput: {
          totalMessages: stats.totalMessages,
          messagesPerSecond: stats.messagesPerSecond,
          uptimeSeconds: stats.uptimeSeconds,
        },
        presence: {
          totalOnline: presenceMetrics.totalOnline,
          roomsWithPresence: presenceMetrics.roomsWithPresence,
          tenantBreakdown: presenceMetrics.tenantBreakdown,
        },
      },
    };
  });
}
